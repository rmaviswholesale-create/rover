import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { readConfig } from '../config.js';

export type McpClientType = 'claude' | 'cursor' | 'generic';

const DEFAULT_MCP_BASE_URL = 'https://mcp.rtrvr.ai';

// ---------- path helpers ----------

function getMcpBaseUrl(): string {
  return (
    process.env['RTRVR_MCP_BASE_URL'] ??
    readConfig().baseUrl?.replace('api.', 'mcp.') ??
    DEFAULT_MCP_BASE_URL
  );
}

/**
 * Canonical config file for each client:
 *   claude → ~/.claude.json
 *   cursor → ~/.cursor/mcp.json
 */
export function getMcpClientConfigPath(clientType: Exclude<McpClientType, 'generic'>): string {
  const home = homedir();
  return clientType === 'claude'
    ? join(home, '.claude.json')
    : join(home, '.cursor', 'mcp.json');
}

// ---------- URL builder ----------

export function buildMcpUrl(apiKey?: string): string {
  const base = getMcpBaseUrl();
  const url = new URL(base);
  if (apiKey) url.searchParams.set('apiKey', apiKey);
  return url.toString();
}

// ---------- JSON snippet builders ----------

export function buildMcpProfile(
  clientType: McpClientType,
  url: string,
): Record<string, unknown> {
  if (clientType === 'claude') {
    return {
      mcpServers: {
        rtrvr: { transport: 'http', url },
      },
    };
  }

  if (clientType === 'cursor') {
    // Snippet format (for --json); the actual file format uses mcpServers at the top level
    return {
      mcpServers: {
        rtrvr: { url },
      },
    };
  }

  return {
    endpoint: url,
    notes: 'Pass this URL to any MCP-compatible client.',
  };
}

// ---------- write helpers ----------

export interface McpWriteResult {
  configPath: string;
  created: boolean;
  previousEntry: Record<string, unknown> | undefined;
}

/**
 * Reads, deep-merges, and writes the rtrvr server entry into the right
 * config file for the given client.  Existing keys are preserved.
 */
export function writeMcpClientConfig(
  clientType: Exclude<McpClientType, 'generic'>,
  apiKey?: string,
): McpWriteResult {
  const configPath = getMcpClientConfigPath(clientType);
  const url = buildMcpUrl(apiKey);

  const serverEntry: Record<string, unknown> =
    clientType === 'claude' ? { transport: 'http', url } : { url };

  let existing: Record<string, unknown> = {};
  let created = false;
  if (existsSync(configPath)) {
    try {
      existing = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
    } catch {
      // Treat corrupt file as empty
    }
  } else {
    created = true;
  }

  const existingServers = existing['mcpServers'] as Record<string, unknown> | undefined;
  const previousEntry = existingServers?.['rtrvr'] as Record<string, unknown> | undefined;

  const updated: Record<string, unknown> = {
    ...existing,
    mcpServers: {
      ...(existingServers ?? {}),
      rtrvr: serverEntry,
    },
  };

  mkdirSync(join(configPath, '..'), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');

  return { configPath, created, previousEntry };
}

// ---------- CLI action ----------

export interface McpInitOptions {
  client: string;
  json?: boolean;
}

export function mcpInit(options: McpInitOptions): void {
  if (!['claude', 'cursor', 'generic'].includes(options.client)) {
    console.error(`Error: --client must be claude, cursor, or generic (got "${options.client}")`);
    process.exit(1);
  }

  const clientType = options.client as McpClientType;
  const apiKey = process.env['RTRVR_API_KEY'] ?? readConfig().apiKey;

  // generic (or --json): just print the snippet
  if (clientType === 'generic' || options.json) {
    const url = buildMcpUrl(apiKey);
    const profile = buildMcpProfile(clientType, url);
    console.log(JSON.stringify(profile, null, 2));
    return;
  }

  const result = writeMcpClientConfig(clientType as Exclude<McpClientType, 'generic'>, apiKey);
  const action = result.created ? 'Created' : result.previousEntry ? 'Updated' : 'Wrote';
  console.log(`${action} ${result.configPath}`);
  console.log(`rtrvr MCP server configured for ${clientType}.`);
  console.log(
    clientType === 'claude'
      ? 'Restart Claude Code to load the new server.'
      : 'Restart Cursor to load the new server.',
  );
}
