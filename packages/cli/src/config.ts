import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_DIR = join(homedir(), '.config', 'rtrvr');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export interface Config {
  apiKey?: string;
  baseUrl?: string;
}

export function readConfig(): Config {
  if (!existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) as Config;
  } catch {
    return {};
  }
}

export function writeConfig(config: Config): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

export function getApiKey(): string | undefined {
  return process.env['RTRVR_API_KEY'] ?? readConfig().apiKey;
}

export function getBaseUrl(): string | undefined {
  return process.env['RTRVR_BASE_URL'] ?? readConfig().baseUrl;
}

export function configFilePath(): string {
  return CONFIG_FILE;
}
