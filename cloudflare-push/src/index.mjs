import { getDailyVerseForDate, getSydneyDateParts } from '../../assets/daily-verses.mjs';

const TOPIC = 'live-broadcasts';
const CHANNEL_URL = 'https://www.youtube.com/channel/';
const LIVE_URL = 'https://hchurchbible.org/church.html';
const OAUTH_URL = 'https://oauth2.googleapis.com/token';
const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
const INQUIRY_RECIPIENT = 'info@hchurchbible.org';
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const DAILY_SUBSCRIBER_PREFIX = 'daily-verse:subscriber:';
const DAILY_SENT_PREFIX = 'daily-verse:sent:';
const DAILY_TITLE = {
  ar: 'آية اليوم',
  en: 'Verse of the Day',
  es: 'Versículo del día',
  fr: 'Verset du jour'
};

let cachedAccessToken = '';
let accessTokenExpiresAt = 0;

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowedOrigins = (env.ALLOWED_ORIGINS || '').split(',').map((item) => item.trim());
  if (!origin || !allowedOrigins.includes(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function jsonResponse(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers }
  });
}

function base64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function encodeJson(value) {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function formatSydneyDate(parts) {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function isSydneyDailyVerseTime(date) {
  const { hour } = getSydneyDateParts(date);
  return hour === 9;
}

export function buildDailyVerseMessage(token, verse, day, language) {
  const locale = ['ar', 'en', 'es', 'fr'].includes(language) ? language : 'ar';
  const title = DAILY_TITLE[locale];
  const body = `${verse.text[locale]} — ${verse.names[locale]} ${verse.chapter}:${verse.verse}`;
  const url = 'https://hchurchbible.org/index.html#dailyVerse';
  const tag = `daily-verse-${day}`;
  return {
    message: {
      token,
      notification: { title, body },
      data: { type: 'daily-verse', day, language: locale, url, tag },
      webpush: {
        fcm_options: { link: url },
        notification: { title, body, icon: 'https://hchurchbible.org/assets/app-icons/icon-192.png', tag }
      },
      android: { priority: 'HIGH', notification: { tag } },
      apns: { payload: { aps: { sound: 'default' } } }
    }
  };
}

async function dailySubscriberKey(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${DAILY_SUBSCRIBER_PREFIX}${hash}`;
}

async function readDailySubscribers(state) {
  const subscribers = [];
  let cursor;
  do {
    const page = await state.list({ prefix: DAILY_SUBSCRIBER_PREFIX, cursor });
    for (const key of page.keys) {
      const value = await state.get(key.name);
      if (!value) continue;
      try {
        const subscriber = JSON.parse(value);
        if (subscriber.token && ['ar', 'en', 'es', 'fr'].includes(subscriber.language)) {
          subscribers.push({ key: key.name, ...subscriber });
        }
      } catch {
        console.error('Skipping malformed daily verse subscriber record.', key.name);
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return subscribers;
}

async function sendDailyVerseMessage(env, payload) {
  const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT || '{}');
  if (!serviceAccount.project_id) throw new Error('Firebase service account is not configured');
  const accessToken = await getAccessToken(env);
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(serviceAccount.project_id)}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );
  if (response.ok) return;
  const responseBody = await response.text();
  const error = new Error(`FCM daily verse send returned ${response.status}`);
  error.status = response.status;
  error.responseBody = responseBody;
  throw error;
}

export async function sendDailyVerseNotifications(env, date, sendMessage = (payload) => sendDailyVerseMessage(env, payload)) {
  const parts = getSydneyDateParts(date);
  if (parts.hour !== 9) return { sent: 0, skipped: 'outside-schedule' };

  const day = formatSydneyDate(parts);
  const subscribers = await readDailySubscribers(env.PUSH_STATE);
  if (!subscribers.length) return { sent: 0, skipped: 'no-subscribers' };

  const verse = getDailyVerseForDate(date);
  let sent = 0;
  let alreadySent = 0;
  for (const subscriber of subscribers) {
    const dedupeKey = `${DAILY_SENT_PREFIX}${day}:${subscriber.key.slice(DAILY_SUBSCRIBER_PREFIX.length)}`;
    if (await env.PUSH_STATE.get(dedupeKey)) {
      alreadySent += 1;
      continue;
    }

    try {
      await sendMessage(buildDailyVerseMessage(subscriber.token, verse, day, subscriber.language));
      await env.PUSH_STATE.put(dedupeKey, 'sent', { expirationTtl: 172800 });
      sent += 1;
    } catch (error) {
      console.error('Unable to deliver daily verse notification.', error);
      if (
        (error.status === 404 || error.status === 400)
        && /UNREGISTERED|registration-token-not-registered/i.test(error.responseBody || '')
      ) {
        await env.PUSH_STATE.delete(subscriber.key);
      }
    }
  }
  if (alreadySent === subscribers.length) return { sent: 0, skipped: 'already-sent' };
  return { sent, day };
}

async function sendInquiry(env, name, message) {
  if (!env.RESEND_API_KEY || !env.INQUIRY_FROM_EMAIL) {
    throw new Error('Resend API key and verified sender address must be configured');
  }

  const response = await fetch(RESEND_EMAILS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env.INQUIRY_FROM_EMAIL,
      to: [INQUIRY_RECIPIENT],
      subject: 'New inquiry from Hope Church NSW website',
      text: `Name: ${name}\n\nMessage:\n${message}`
    })
  });
  if (!response.ok) throw new Error(`Resend returned ${response.status}`);
}

async function getAccessToken(env) {
  if (cachedAccessToken && Date.now() < accessTokenExpiresAt - 60_000) return cachedAccessToken;
  if (!env.FIREBASE_SERVICE_ACCOUNT) throw new Error('FIREBASE_SERVICE_ACCOUNT secret is not configured');

  const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('Firebase service account is missing required fields');
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const unsignedToken = `${encodeJson({ alg: 'RS256', typ: 'JWT' })}.${encodeJson({
    iss: serviceAccount.client_email,
    scope: FCM_SCOPE,
    aud: OAUTH_URL,
    iat: issuedAt,
    exp: issuedAt + 3600
  })}`;
  const privateKeyDer = Uint8Array.from(
    atob(serviceAccount.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '')),
    (character) => character.charCodeAt(0)
  );
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(unsignedToken)
  );
  const assertion = `${unsignedToken}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch(OAUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });
  if (!response.ok) throw new Error(`Google OAuth returned ${response.status}`);
  const result = await response.json();
  cachedAccessToken = result.access_token;
  accessTokenExpiresAt = Date.now() + result.expires_in * 1000;
  return cachedAccessToken;
}

async function updateTopicSubscription(env, token, subscribe) {
  const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT || '{}');
  if (!serviceAccount.project_id) throw new Error('Firebase service account is not configured');
  const accessToken = await getAccessToken(env);
  const registrationId = encodeURIComponent(token);
  const endpoint = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(serviceAccount.project_id)}/registrations/${registrationId}/topicSubscriptions`;
  const url = subscribe
    ? `${endpoint}?topic_name=${encodeURIComponent(TOPIC)}`
    : `${endpoint}/${encodeURIComponent(TOPIC)}`;
  const response = await fetch(url, {
    method: subscribe ? 'POST' : 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: '{}'
  });
  if (!response.ok && !(subscribe && response.status === 409) && !(response.status === 404 && !subscribe)) {
    throw new Error(`FCM topic subscription returned ${response.status}`);
  }
}

export function parseLiveVideoId(html, responseUrl) {
  const redirectedVideoId = new URL(responseUrl).searchParams.get('v');
  const detailsVideoId = html.match(/"videoDetails":\{"videoId":"([A-Za-z0-9_-]{11})"/)?.[1];
  const videoId = redirectedVideoId || detailsVideoId;
  const isLive = Boolean(videoId) && /"isLiveNow":true/.test(html);
  return isLive ? videoId : null;
}

async function sendLiveNotification(env, videoId) {
  const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT || '{}');
  if (!serviceAccount.project_id) throw new Error('Firebase service account is not configured');
  const accessToken = await getAccessToken(env);
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(serviceAccount.project_id)}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: {
          topic: TOPIC,
          notification: {
            title: 'كنيسة رجاء الأمم سيدني',
            body: 'بدأ البث المباشر الآن. اضغط للمشاهدة.'
          },
          data: { videoId, url: LIVE_URL },
          webpush: {
            fcm_options: { link: LIVE_URL },
            notification: { icon: 'https://hchurchbible.org/assets/app-icons/icon-192.png' }
          },
          android: { priority: 'HIGH' },
          apns: { payload: { aps: { sound: 'default' } } }
        }
      })
    }
  );
  if (!response.ok) throw new Error(`FCM send returned ${response.status}`);
}

async function detectAndNotify(env) {
  const channelId = env.YOUTUBE_CHANNEL_ID;
  if (!channelId) throw new Error('YOUTUBE_CHANNEL_ID is not configured');
  const response = await fetch(`${CHANNEL_URL}${encodeURIComponent(channelId)}/live`, {
    redirect: 'follow',
    headers: {
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'Mozilla/5.0 (compatible; HopeChurchLiveNotifications/1.0)'
    }
  });
  if (!response.ok) throw new Error(`YouTube returned ${response.status}`);
  const html = await response.text();
  const videoId = parseLiveVideoId(html, response.url);
  if (!videoId || await env.PUSH_STATE.get('last-notified-video-id') === videoId) return;

  await sendLiveNotification(env, videoId);
  await env.PUSH_STATE.put('last-notified-video-id', videoId);
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (!cors) return jsonResponse({ error: 'Origin not allowed' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, cors);

    const path = new URL(request.url).pathname;
    if (path === '/inquiry') {
      if (!(request.headers.get('Content-Type') || '').toLowerCase().includes('application/json')) {
        return jsonResponse({ error: 'Content-Type must be application/json' }, 415, cors);
      }

      const contentLength = Number(request.headers.get('Content-Length') || 0);
      if (contentLength > 10_000) return jsonResponse({ error: 'Inquiry is too large' }, 413, cors);

      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: 'Invalid JSON body' }, 400, cors);
      }

      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return jsonResponse({ error: 'Invalid inquiry' }, 400, cors);
      }
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (
        (typeof body.website === 'string' && body.website.trim())
        || !name || name.length > 100
        || !message || message.length > 5000
      ) {
        return jsonResponse({ error: 'Invalid inquiry' }, 400, cors);
      }

      try {
        await sendInquiry(env, name, message);
        return jsonResponse({ sent: true }, 200, cors);
      } catch (error) {
        console.error('Unable to send website inquiry.', error);
        return jsonResponse({ error: 'Unable to send inquiry' }, 502, cors);
      }
    }

    if (!['/subscribe', '/unsubscribe', '/daily-subscribe', '/daily-unsubscribe'].includes(path)) {
      return jsonResponse({ error: 'Not found' }, 404, cors);
    }
    if (!(request.headers.get('Content-Type') || '').toLowerCase().includes('application/json')) {
      return jsonResponse({ error: 'Content-Type must be application/json' }, 415, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400, cors);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return jsonResponse({ error: 'Invalid subscription' }, 400, cors);
    }
    if (typeof body.token !== 'string' || body.token.length < 100 || body.token.length > 4096) {
      return jsonResponse({ error: 'Invalid FCM registration token' }, 400, cors);
    }

    try {
      if (path === '/daily-subscribe' || path === '/daily-unsubscribe') {
        const key = await dailySubscriberKey(body.token);
        if (path === '/daily-subscribe') {
          if (
            !['ar', 'en', 'es', 'fr'].includes(body.language)
            || !['native', 'web'].includes(body.platform)
          ) {
            return jsonResponse({ error: 'A supported language and platform are required' }, 400, cors);
          }
          await env.PUSH_STATE.put(key, JSON.stringify({
            token: body.token,
            language: body.language,
            platform: body.platform
          }));
          return jsonResponse({ subscribed: true }, 200, cors);
        }
        await env.PUSH_STATE.delete(key);
        return jsonResponse({ subscribed: false }, 200, cors);
      }

      await updateTopicSubscription(env, body.token, path === '/subscribe');
      return jsonResponse({ subscribed: path === '/subscribe' }, 200, cors);
    } catch (error) {
      console.error('Notification subscription update failed.', error);
      return jsonResponse({ error: 'Unable to update notification subscription' }, 502, cors);
    }
  },

  async scheduled(controller, env) {
    try {
      await detectAndNotify(env);
    } catch (error) {
      console.error('Live stream notification check failed.', error);
    }
    try {
      await sendDailyVerseNotifications(
        env,
        new Date(controller?.scheduledTime ?? Date.now())
      );
    } catch (error) {
      console.error('Daily verse notification schedule failed.', error);
    }
  }
};
