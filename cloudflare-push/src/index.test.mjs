import test from 'node:test';
import assert from 'node:assert/strict';
import worker, {
  buildDailyVerseMessage,
  isSydneyDailyVerseTime,
  parseLiveVideoId,
  sendDailyVerseNotifications
} from './index.mjs';
import { getDailyVerseForDate, getSydneyDateParts } from '../../assets/daily-verses.mjs';

class MemoryKV {
  values = new Map();

  async get(key) {
    return this.values.get(key) || null;
  }

  async put(key, value) {
    this.values.set(key, value);
  }

  async delete(key) {
    this.values.delete(key);
  }

  async list({ prefix }) {
    return {
      keys: Array.from(this.values.keys())
        .filter((name) => name.startsWith(prefix))
        .map((name) => ({ name })),
      list_complete: true
    };
  }
}

function dailySubscriptionRequest(path, token, details = {}) {
  return new Request(`https://push.example/${path}`, {
    method: 'POST',
    headers: { Origin: 'https://hchurchbible.org', 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, ...details })
  });
}

test('detects an active channel stream by video details', () => {
  const html = '"videoDetails":{"videoId":"abcdefghijk"},"isLiveNow":true';
  assert.equal(parseLiveVideoId(html, 'https://www.youtube.com/channel/example/live'), 'abcdefghijk');
});

test('does not report a scheduled or archived live video as currently live', () => {
  const html = '"videoDetails":{"videoId":"abcdefghijk"},"isLiveContent":true';
  assert.equal(parseLiveVideoId(html, 'https://www.youtube.com/channel/example/live'), null);
});

test('rejects requests from origins that are not configured', async () => {
  const response = await worker.fetch(new Request('https://push.example/subscribe', {
    method: 'POST',
    headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'x'.repeat(120) })
  }), { ALLOWED_ORIGINS: 'https://hchurchbible.org' });
  assert.equal(response.status, 403);
});

test('rejects malformed registration tokens', async () => {
  const response = await worker.fetch(new Request('https://push.example/subscribe', {
    method: 'POST',
    headers: { Origin: 'https://hchurchbible.org', 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'too-short' })
  }), { ALLOWED_ORIGINS: 'https://hchurchbible.org' });
  assert.equal(response.status, 400);
});

test('schedules at 9 AM Sydney across AEDT and AEST without a fixed UTC hour', () => {
  const aedt = new Date('2026-10-03T22:00:00Z');
  const aest = new Date('2026-04-04T23:00:00Z');
  assert.deepEqual(
    (({ year, month, day, hour, minute }) => ({ year, month, day, hour, minute }))(getSydneyDateParts(aedt)),
    { year: 2026, month: 10, day: 4, hour: 9, minute: 0 }
  );
  assert.deepEqual(
    (({ year, month, day, hour, minute }) => ({ year, month, day, hour, minute }))(getSydneyDateParts(aest)),
    { year: 2026, month: 4, day: 5, hour: 9, minute: 0 }
  );
  assert.equal(isSydneyDailyVerseTime(aedt), true);
  assert.equal(isSydneyDailyVerseTime(aest), true);
  assert.equal(isSydneyDailyVerseTime(new Date('2026-10-03T21:59:00Z')), false);
  assert.equal(isSydneyDailyVerseTime(new Date('2026-04-04T23:01:00Z')), true);
  assert.equal(isSydneyDailyVerseTime(new Date('2026-04-05T00:00:00Z')), false);
});

test('routes localized daily verse payloads to native and web registrations', async () => {
  const state = new MemoryKV();
  const env = { ALLOWED_ORIGINS: 'https://hchurchbible.org', PUSH_STATE: state };
  const nativeToken = 'n'.repeat(120);
  const webToken = 'w'.repeat(120);
  const spanishToken = 's'.repeat(120);
  const arabicToken = 'a'.repeat(120);
  const registrations = await Promise.all([
    worker.fetch(dailySubscriptionRequest('daily-subscribe', nativeToken, {
    language: 'en',
    platform: 'native'
    }), env),
    worker.fetch(dailySubscriptionRequest('daily-subscribe', webToken, {
    language: 'fr',
    platform: 'web'
    }), env),
    worker.fetch(dailySubscriptionRequest('daily-subscribe', spanishToken, {
      language: 'es',
      platform: 'web'
    }), env),
    worker.fetch(dailySubscriptionRequest('daily-subscribe', arabicToken, {
      language: 'ar',
      platform: 'native'
    }), env)
  ]);
  assert.ok(registrations.every((response) => response.status === 200));

  const messages = [];
  const result = await sendDailyVerseNotifications(
    env,
    new Date('2026-10-03T22:00:00Z'),
    async (message) => messages.push(message)
  );
  assert.equal(result.sent, 4);
  assert.equal(messages.length, 4);
  const nativeMessage = messages.find(({ message }) => message.token === nativeToken).message;
  const webMessage = messages.find(({ message }) => message.token === webToken).message;
  const verse = getDailyVerseForDate(new Date('2026-10-03T22:00:00Z'));
  assert.equal(nativeMessage.notification.title, 'Verse of the Day');
  assert.equal(nativeMessage.notification.body, `${verse.text.en} — ${verse.names.en} ${verse.chapter}:${verse.verse}`);
  assert.equal(nativeMessage.data.language, 'en');
  assert.equal(webMessage.webpush.notification.title, 'Verset du jour');
  assert.equal(webMessage.webpush.notification.body, `${verse.text.fr} — ${verse.names.fr} ${verse.chapter}:${verse.verse}`);
  assert.equal(webMessage.data.language, 'fr');
  assert.equal(webMessage.webpush.notification.tag, 'daily-verse-2026-10-04');
  const spanishMessage = messages.find(({ message }) => message.token === spanishToken).message;
  const arabicMessage = messages.find(({ message }) => message.token === arabicToken).message;
  assert.equal(spanishMessage.notification.title, 'Versículo del día');
  assert.equal(spanishMessage.data.language, 'es');
  assert.equal(arabicMessage.notification.title, 'آية اليوم');
  assert.equal(arabicMessage.data.language, 'ar');
});

test('daily schedule retries use the Sydney day deduplication key', async () => {
  const state = new MemoryKV();
  state.values.set('daily-verse:subscriber:test', JSON.stringify({
    token: 't'.repeat(120),
    language: 'es',
    platform: 'web'
  }));
  const env = { PUSH_STATE: state };
  let sends = 0;
  const send = async () => { sends += 1; };
  const runAtNine = new Date('2026-04-04T23:00:00Z');
  assert.deepEqual(await sendDailyVerseNotifications(env, runAtNine, send), { sent: 1, day: '2026-04-05' });
  assert.deepEqual(await sendDailyVerseNotifications(env, runAtNine, send), { sent: 0, skipped: 'already-sent' });
  assert.equal(sends, 1);
});

test('daily schedule retries only subscribers whose first delivery failed', async () => {
  const state = new MemoryKV();
  const deliveredToken = 'd'.repeat(120);
  const transientToken = 'r'.repeat(120);
  state.values.set('daily-verse:subscriber:delivered', JSON.stringify({
    token: deliveredToken,
    language: 'en',
    platform: 'native'
  }));
  state.values.set('daily-verse:subscriber:transient', JSON.stringify({
    token: transientToken,
    language: 'fr',
    platform: 'web'
  }));
  const env = { PUSH_STATE: state };
  const attempts = [];
  let shouldFail = true;
  const send = async ({ message }) => {
    attempts.push(message.token);
    if (message.token === transientToken && shouldFail) throw new Error('Temporary FCM outage');
  };

  assert.deepEqual(
    await sendDailyVerseNotifications(env, new Date('2026-04-04T23:00:00Z'), send),
    { sent: 1, day: '2026-04-05' }
  );
  shouldFail = false;
  assert.deepEqual(
    await sendDailyVerseNotifications(env, new Date('2026-04-04T23:05:00Z'), send),
    { sent: 1, day: '2026-04-05' }
  );
  assert.deepEqual(attempts, [deliveredToken, transientToken, transientToken]);
  assert.deepEqual(
    await sendDailyVerseNotifications(env, new Date('2026-04-04T23:06:00Z'), send),
    { sent: 0, skipped: 'already-sent' }
  );
  assert.deepEqual(attempts, [deliveredToken, transientToken, transientToken]);
});

test('daily unsubscribe removes consented token from future sends', async () => {
  const state = new MemoryKV();
  const env = { ALLOWED_ORIGINS: 'https://hchurchbible.org', PUSH_STATE: state };
  const token = 'u'.repeat(120);
  const subscribe = await worker.fetch(dailySubscriptionRequest('daily-subscribe', token, {
    language: 'ar',
    platform: 'native'
  }), env);
  const unsubscribe = await worker.fetch(dailySubscriptionRequest('daily-unsubscribe', token), env);
  assert.equal(subscribe.status, 200);
  assert.deepEqual(await unsubscribe.json(), { subscribed: false });

  let sends = 0;
  const result = await sendDailyVerseNotifications(
    env,
    new Date('2026-10-03T22:00:00Z'),
    async () => { sends += 1; }
  );
  assert.equal(result.sent, 0);
  assert.equal(sends, 0);
});

test('live-only registrations are not enrolled in daily verse delivery', async () => {
  const state = new MemoryKV();
  state.values.set('live-broadcasts:existing-token', JSON.stringify({
    token: 'l'.repeat(120),
    language: 'en',
    platform: 'native'
  }));
  let sends = 0;
  const result = await sendDailyVerseNotifications(
    { PUSH_STATE: state },
    new Date('2026-10-03T22:00:00Z'),
    async () => { sends += 1; }
  );
  assert.equal(result.sent, 0);
  assert.equal(sends, 0);
});

test('daily subscribe rejects unsupported language and platform values', async () => {
  const response = await worker.fetch(dailySubscriptionRequest('daily-subscribe', 'x'.repeat(120), {
    language: 'de',
    platform: 'web'
  }), { ALLOWED_ORIGINS: 'https://hchurchbible.org', PUSH_STATE: new MemoryKV() });
  assert.equal(response.status, 400);
});

test('daily notification message builder includes localized native and browser routing', () => {
  const verse = getDailyVerseForDate(new Date('2026-10-03T22:00:00Z'));
  const { message } = buildDailyVerseMessage('fcm-token', verse, '2026-10-04', 'es');
  assert.equal(message.token, 'fcm-token');
  assert.equal(message.notification.title, 'Versículo del día');
  assert.equal(message.data.type, 'daily-verse');
  assert.equal(message.data.url, 'https://hchurchbible.org/index.html#dailyVerse');
  assert.equal(message.android.notification.tag, 'daily-verse-2026-10-04');
  assert.equal(message.webpush.fcm_options.link, message.data.url);
});

test('sends valid inquiries through Resend to the configured church inbox', async () => {
  const originalFetch = globalThis.fetch;
  let resendRequest;
  globalThis.fetch = async (url, options) => {
    resendRequest = { url, options };
    return new Response(null, { status: 200 });
  };

  try {
    const response = await worker.fetch(new Request('https://push.example/inquiry', {
      method: 'POST',
      headers: { Origin: 'https://hchurchbible.org', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Sam', message: 'Please pray for my family.' })
    }), {
      ALLOWED_ORIGINS: 'https://hchurchbible.org',
      RESEND_API_KEY: 'test-key',
      INQUIRY_FROM_EMAIL: 'Hope Church <website@example.org>'
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { sent: true });
    assert.equal(resendRequest.url, 'https://api.resend.com/emails');
    assert.equal(resendRequest.options.headers.Authorization, 'Bearer test-key');
    assert.deepEqual(JSON.parse(resendRequest.options.body), {
      from: 'Hope Church <website@example.org>',
      to: ['info@hchurchbible.org'],
      subject: 'New inquiry from Hope Church NSW website',
      text: 'Name: Sam\n\nMessage:\nPlease pray for my family.'
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects invalid inquiries without contacting Resend', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('Resend must not be called for invalid inquiries');
  };

  try {
    const response = await worker.fetch(new Request('https://push.example/inquiry', {
      method: 'POST',
      headers: { Origin: 'https://hchurchbible.org', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Sam', message: '   ' })
    }), { ALLOWED_ORIGINS: 'https://hchurchbible.org' });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Invalid inquiry' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('reports an unconfigured or failed email service instead of claiming delivery', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 503 });

  try {
    const request = () => new Request('https://push.example/inquiry', {
      method: 'POST',
      headers: { Origin: 'https://hchurchbible.org', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Sam', message: 'A valid message.' })
    });
    const env = { ALLOWED_ORIGINS: 'https://hchurchbible.org' };
    const unconfigured = await worker.fetch(request(), env);
    assert.equal(unconfigured.status, 502);
    assert.deepEqual(await unconfigured.json(), { error: 'Unable to send inquiry' });

    const providerFailure = await worker.fetch(request(), {
      ...env,
      RESEND_API_KEY: 'test-key',
      INQUIRY_FROM_EMAIL: 'Hope Church <website@example.org>'
    });
    assert.equal(providerFailure.status, 502);
    assert.deepEqual(await providerFailure.json(), { error: 'Unable to send inquiry' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
