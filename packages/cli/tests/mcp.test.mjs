import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  getMcpClientConfigPath,
  buildMcpUrl,
  buildMcpProfile,
  writeMcpClientConfig,
} from '../dist/commands/mcp.js';

let fakeHome;
const originalHome = process.env.HOME;
const originalMcpBase = process.env.RTRVR_MCP_BASE_URL;
const originalApiKey = process.env.RTRVR_API_KEY;

beforeEach(() => {
  fakeHome = mkdtempSync(join(tmpdir(), 'rtrvr-mcp-test-'));
  process.env.HOME = fakeHome;
  process.env.RTRVR_MCP_BASE_URL = 'https://mcp.example.com';
  delete process.env.RTRVR_API_KEY;
});

afterEach(() => {
  process.env.HOME = originalHome;
  if (originalMcpBase === undefined) delete process.env.RTRVR_MCP_BASE_URL;
  else process.env.RTRVR_MCP_BASE_URL = originalMcpBase;
  if (originalApiKey === undefined) delete process.env.RTRVR_API_KEY;
  else process.env.RTRVR_API_KEY = originalApiKey;
  rmSync(fakeHome, { recursive: true, force: true });
});

test('getMcpClientConfigPath returns the canonical file per client', () => {
  assert.equal(getMcpClientConfigPath('claude'), join(fakeHome, '.claude.json'));
  assert.equal(getMcpClientConfigPath('cursor'), join(fakeHome, '.cursor', 'mcp.json'));
});

test('buildMcpUrl appends the apiKey query param when given', () => {
  const url = new URL(buildMcpUrl('secret-key'));
  assert.equal(url.origin, 'https://mcp.example.com');
  assert.equal(url.searchParams.get('apiKey'), 'secret-key');

  const bare = new URL(buildMcpUrl());
  assert.equal(bare.searchParams.get('apiKey'), null);
});

test('buildMcpProfile shapes claude and cursor snippets around mcpServers.rtrvr', () => {
  const claude = buildMcpProfile('claude', 'https://mcp.example.com/');
  assert.equal(claude.mcpServers.rtrvr.transport, 'http');
  assert.equal(claude.mcpServers.rtrvr.url, 'https://mcp.example.com/');

  const cursor = buildMcpProfile('cursor', 'https://mcp.example.com/');
  assert.equal(cursor.mcpServers.rtrvr.url, 'https://mcp.example.com/');
});

test('writeMcpClientConfig creates ~/.cursor/mcp.json when missing', () => {
  const result = writeMcpClientConfig('cursor');

  assert.equal(result.created, true);
  assert.equal(result.previousEntry, undefined);
  assert.ok(existsSync(result.configPath));

  const written = JSON.parse(readFileSync(result.configPath, 'utf8'));
  assert.ok(written.mcpServers.rtrvr.url.startsWith('https://mcp.example.com'));
});

test('writeMcpClientConfig preserves existing keys and other servers in ~/.claude.json', () => {
  const configPath = join(fakeHome, '.claude.json');
  writeFileSync(
    configPath,
    JSON.stringify({
      someUserSetting: { nested: true },
      mcpServers: { otherServer: { url: 'https://other.example.com' } },
    }),
  );

  const result = writeMcpClientConfig('claude');

  assert.equal(result.created, false);
  const written = JSON.parse(readFileSync(configPath, 'utf8'));
  assert.deepEqual(written.someUserSetting, { nested: true });
  assert.equal(written.mcpServers.otherServer.url, 'https://other.example.com');
  assert.equal(written.mcpServers.rtrvr.transport, 'http');
});

test('writeMcpClientConfig reports the previous rtrvr entry on update', () => {
  mkdirSync(join(fakeHome, '.cursor'), { recursive: true });
  writeFileSync(
    join(fakeHome, '.cursor', 'mcp.json'),
    JSON.stringify({ mcpServers: { rtrvr: { url: 'https://old.example.com' } } }),
  );

  const result = writeMcpClientConfig('cursor');

  assert.deepEqual(result.previousEntry, { url: 'https://old.example.com' });
  const written = JSON.parse(readFileSync(result.configPath, 'utf8'));
  assert.notEqual(written.mcpServers.rtrvr.url, 'https://old.example.com');
});
