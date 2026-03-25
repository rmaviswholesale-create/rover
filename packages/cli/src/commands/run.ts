import { RoverClient, RoverAPIError } from '@rtrvr-ai/sdk';
import { getApiKey, getBaseUrl } from '../config.js';

export interface RunOptions {
  url: string;
  timeout?: number;
}

export async function runTask(prompt: string, options: RunOptions): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('Error: not authenticated. Run `rtrvr auth login` first.');
    process.exit(1);
  }

  const client = new RoverClient({ apiKey, baseUrl: getBaseUrl() });

  console.log('');
  console.log(`  Prompt : ${prompt}`);
  console.log(`  URL    : ${options.url}`);
  console.log('');
  console.log('  Submitting task…');

  const timeoutMs = options.timeout !== undefined ? options.timeout * 1000 : undefined;

  try {
    const task = await client.run(prompt, { url: options.url, timeout: timeoutMs });

    if (task.status === 'completed') {
      console.log('  Status : completed');
      console.log('');
      console.log('  Result:');
      console.log('  ───────');
      console.log(indent(task.result ?? '(no result)', 2));
    } else {
      console.error(`  Status : ${task.status}`);
      if (task.error) console.error(`  Error  : ${task.error}`);
      process.exit(1);
    }
  } catch (err) {
    if (err instanceof RoverAPIError) {
      console.error(`  API error (${err.status}): ${err.message}`);
    } else {
      console.error(`  Error: ${String(err)}`);
    }
    process.exit(1);
  }

  console.log('');
}

function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text.split('\n').map((l) => `${pad}${l}`).join('\n');
}
