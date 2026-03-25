import { RoverClient, RoverAPIError } from '@rtrvr-ai/sdk';
import { getApiKey, getBaseUrl } from '../config.js';

export interface ScrapeCommandOptions {
  url: string;
  format?: 'text' | 'markdown' | 'json';
}

export async function scrape(options: ScrapeCommandOptions): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('Error: not authenticated. Run `rtrvr auth login` first.');
    process.exit(1);
  }

  const client = new RoverClient({ apiKey, baseUrl: getBaseUrl() });

  console.error(`Scraping ${options.url}…`);

  try {
    const result = await client.scrape({ url: options.url });
    const fmt = options.format ?? 'text';

    if (fmt === 'json') {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (fmt === 'markdown' && result.markdown) {
      console.log(result.markdown);
      return;
    }

    // Default: human-readable text
    if (result.title) {
      console.log(`Title: ${result.title}`);
      console.log('');
    }
    console.log(result.content);

    if (result.links && result.links.length > 0) {
      console.log('');
      console.log(`Links (${result.links.length}):`);
      for (const link of result.links.slice(0, 20)) {
        console.log(`  ${link.text}  →  ${link.href}`);
      }
      if (result.links.length > 20) {
        console.log(`  … and ${result.links.length - 20} more`);
      }
    }
  } catch (err) {
    if (err instanceof RoverAPIError) {
      console.error(`API error (${err.status}): ${err.message}`);
    } else {
      console.error(`Error: ${String(err)}`);
    }
    process.exit(1);
  }
}
