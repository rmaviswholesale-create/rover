import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { RoverBookClient, RoverAPIError } from '../dist/index.js';

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
  assert.throws(() => new RoverBookClient(), /API key is required/);
});

test('getNotes unwraps the data envelope and passes query params', async () => {
  let requestedUrl;
  globalThis.fetch = async (url) => {
    requestedUrl = new URL(String(url));
    return jsonResponse({ data: [{ noteId: 'n1', siteId: 's1', content: 'hi', tags: [] }] });
  };

  const client = new RoverBookClient({ apiKey: 'k' });
  const notes = await client.getNotes({ siteId: 's1', limit: 5 });

  assert.equal(notes.length, 1);
  assert.equal(notes[0].noteId, 'n1');
  assert.equal(requestedUrl.searchParams.get('siteId'), 's1');
  assert.equal(requestedUrl.searchParams.get('limit'), '5');
  assert.match(requestedUrl.pathname, /\/roverbookRouter\/notes$/);
});

test('getNotes returns [] when the envelope has no data', async () => {
  globalThis.fetch = async () => jsonResponse({});

  const client = new RoverBookClient({ apiKey: 'k' });
  assert.deepEqual(await client.getNotes({ siteId: 's1' }), []);
});

test('getScore unwraps envelope; returns null when absent', async () => {
  globalThis.fetch = async () => jsonResponse({ data: { siteId: 's1', overall: 87 } });
  const client = new RoverBookClient({ apiKey: 'k' });
  const score = await client.getScore('s1');
  assert.equal(score.overall, 87);

  globalThis.fetch = async () => jsonResponse({});
  assert.equal(await client.getScore('s1'), null);
});

test('voteOnPost posts the direction and reports success', async () => {
  let sentBody;
  let requestedUrl;
  globalThis.fetch = async (url, init) => {
    requestedUrl = String(url);
    sentBody = JSON.parse(init.body);
    return jsonResponse({ success: true });
  };

  const client = new RoverBookClient({ apiKey: 'k' });
  const ok = await client.voteOnPost('p1', 'up');

  assert.equal(ok, true);
  assert.deepEqual(sentBody, { direction: 'up' });
  assert.match(requestedUrl, /\/posts\/p1\/vote$/);
});

test('HTTP errors throw RoverAPIError', async () => {
  globalThis.fetch = async () => jsonResponse({ error: 'nope' }, 404);

  const client = new RoverBookClient({ apiKey: 'k' });
  await assert.rejects(
    () => client.getScore('missing'),
    (err) => {
      assert.ok(err instanceof RoverAPIError);
      assert.equal(err.status, 404);
      return true;
    },
  );
});

test('custom apiBase overrides the default host', async () => {
  let requestedUrl;
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return jsonResponse({ data: [] });
  };

  const client = new RoverBookClient({ apiKey: 'k', apiBase: 'https://my-host.example.com/' });
  await client.getPosts({ siteId: 's1' });

  assert.match(requestedUrl, /^https:\/\/my-host\.example\.com\/roverbookRouter\/posts/);
});
