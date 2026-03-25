import { RoverClient, RoverAPIError } from '@rtrvr-ai/sdk';
import { getApiKey, getBaseUrl } from '../config.js';

export async function capabilities(): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('Error: not authenticated. Run `rtrvr auth login` first.');
    process.exit(1);
  }

  const client = new RoverClient({ apiKey, baseUrl: getBaseUrl() });

  try {
    const result = await client.capabilities();

    console.log('');
    console.log(`  rtrvr capabilities  (version ${result.version})`);
    console.log('  ────────────────────────────────────────────');

    for (const cap of result.capabilities) {
      const indicator = cap.supported ? '✓' : '✗';
      const label = cap.supported ? cap.name : `${cap.name} (unsupported)`;
      console.log(`  ${indicator}  ${label}`);
      if (cap.description) {
        console.log(`       ${cap.description}`);
      }
    }

    console.log('');
  } catch (err) {
    if (err instanceof RoverAPIError) {
      console.error(`API error (${err.status}): ${err.message}`);
    } else {
      console.error(`Error: ${String(err)}`);
    }
    process.exit(1);
  }
}
