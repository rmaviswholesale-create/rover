import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { RoverClient, RoverAPIError } from '../dist/index.js';

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.RTRVR_API_KEY;

beforeEach(() => {
  delete process.env.RTRVR_API_KEY;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env.RTRVR_API_KEY;
  else process.env.RTRVR_API_KEY = originalApiKey;
});

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('constructor throws without an API key', () => {
  assert.throws(() => new RoverClient(), /API key is required/);
});

test('constructor accepts apiKey option and strips trailing slash from baseUrl', async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return jsonResponse({ capabilities: [], version: '1' });
  };

  const client = new RoverClient({ apiKey: 'k', baseUrl: 'https://api.example.com/' });
  await client.capabilities();

  assert.equal(calls[0], 'https://api.example.com/v1/capabilities');
});

test('run() polls until the task completes', async () => {
  const statuses = ['pending', 'running', 'completed'];
  let call = 0;
  globalThis.fetch = async (url, init) => {
    call += 1;
    if (call === 1) {
      assert.equal(init.method, 'POST');
      const body = JSON.parse(init.body);
      assert.equal(body.prompt, 'do the thing');
      assert.equal(body.url, 'https://example.com');
      return jsonResponse({ id: 't1', status: 'pending', prompt: body.prompt, url: body.url, createdAt: 'now' });
    }
    assert.match(String(url), /\/v1\/tasks\/t1$/);
    const status = statuses[Math.min(call - 1, statuses.length - 1)];
    return jsonResponse({
      id: 't1',
      status,
      prompt: 'do the thing',
      url: 'https://example.com',
      createdAt: 'now',
      ...(status === 'completed' ? { result: 'all done' } : {}),
    });
  };

  const started = Date.now();
  const client = new RoverClient({ apiKey: 'k', pollIntervalMs: 1 });
  const task = await client.run('do the thing', { url: 'https://example.com' });

  assert.equal(task.status, 'completed');
  assert.equal(task.result, 'all done');
  assert.equal(call, 3);
  // pollIntervalMs must be honored — the default 2s interval would take >4s here
  assert.ok(Date.now() - started < 1000, 'pollIntervalMs option was ignored');
});

test('run() times out if the task never completes', async () => {
  globalThis.fetch = async (url, init) =>
    jsonResponse({ id: 't1', status: init?.method === 'POST' ? 'pending' : 'running', prompt: 'p', url: 'u', createdAt: 'now' });

  const client = new RoverClient({ apiKey: 'k', pollIntervalMs: 1 });
  await assert.rejects(
    () => client.run('p', { url: 'u', timeout: 5 }),
    /timed out/,
  );
});

test('API errors throw RoverAPIError with status and server message', async () => {
  globalThis.fetch = async () => jsonResponse({ message: 'bad key' }, 401);

  const client = new RoverClient({ apiKey: 'k' });
  await assert.rejects(
    () => client.capabilities(),
    (err) => {
      assert.ok(err instanceof RoverAPIError);
      assert.equal(err.status, 401);
      assert.equal(err.message, 'bad key');
      return true;
    },
  );
});

test('scrape() sends the url in the request body', async () => {
  let sentBody;
  globalThis.fetch = async (url, init) => {
    sentBody = JSON.parse(init.body);
    assert.match(String(url), /\/v1\/scrape$/);
    return jsonResponse({ url: sentBody.url, content: 'hello', scrapedAt: 'now' });
  };

  const client = new RoverClient({ apiKey: 'k' });
  const result = await client.scrape({ url: 'https://example.com' });

  assert.equal(sentBody.url, 'https://example.com');
  assert.equal(result.content, 'hello');
});
