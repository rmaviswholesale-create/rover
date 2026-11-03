import { createInterface } from 'readline';
import { writeConfig, readConfig, configFilePath } from '../config.js';

export async function authLogin(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log('');
  console.log('  rtrvr authentication');
  console.log('  ────────────────────');
  console.log('  Get your API key at: https://app.rtrvr.ai/settings/api');
  console.log('');

  const apiKey = await new Promise<string>((resolve) => {
    rl.question('  Enter your API key: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

  if (!apiKey) {
    console.error('  Error: API key cannot be empty.');
    process.exit(1);
  }

  const current = readConfig();
  writeConfig({ ...current, apiKey });

  console.log('');
  console.log(`  Saved to ${configFilePath()}`);
  console.log('  You are now authenticated. Run `rtrvr doctor` to verify.');
  console.log('');
}

export function authStatus(): void {
  const config = readConfig();
  const envKey = process.env['RTRVR_API_KEY'];

  console.log('');
  if (envKey) {
    console.log('  Auth source: RTRVR_API_KEY environment variable');
    console.log(`  Key:         ${maskKey(envKey)}`);
  } else if (config.apiKey) {
    console.log(`  Auth source: ${configFilePath()}`);
    console.log(`  Key:         ${maskKey(config.apiKey)}`);
  } else {
    console.log('  Not authenticated. Run `rtrvr auth login` to set your API key.');
  }
  console.log('');
}

function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}${'*'.repeat(Math.min(key.length - 8, 20))}${key.slice(-4)}`;
}
