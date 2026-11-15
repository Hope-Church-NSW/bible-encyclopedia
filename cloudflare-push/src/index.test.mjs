import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { parseLiveVideoId } from './index.mjs';

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
