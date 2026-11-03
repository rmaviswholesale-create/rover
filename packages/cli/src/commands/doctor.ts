import { RoverClient, RoverAPIError } from '@rtrvr-ai/sdk';
import { getApiKey, getBaseUrl, configFilePath } from '../config.js';

const BASE_URL = 'https://agent.rtrvr.ai';

export async function doctor(): Promise<void> {
  const checks: Array<{ name: string; status: 'ok' | 'warning' | 'error'; message: string }> = [];

  // 1. Node version
  const nodeVersion = process.versions.node;
  const [major] = nodeVersion.split('.').map(Number);
  checks.push({
    name: 'Node.js version',
    status: (major ?? 0) >= 18 ? 'ok' : 'error',
    message: `v${nodeVersion}${(major ?? 0) < 18 ? ' (>=18 required)' : ''}`,
  });

  // 2. API key
  const apiKey = getApiKey();
  checks.push({
    name: 'API key',
    status: apiKey ? 'ok' : 'error',
    message: apiKey
      ? `Found (${process.env['RTRVR_API_KEY'] ? 'env var' : configFilePath()})`
      : 'Missing — run `rtrvr auth login`',
  });

  // 3. Network reachability
  const baseUrl = getBaseUrl() ?? BASE_URL;
  try {
    const res = await fetch(`${baseUrl}/v1/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(8000),
    });
    checks.push({
      name: 'API reachability',
      status: res.ok || res.status === 401 ? 'ok' : 'warning',
      message: `${baseUrl}  →  HTTP ${res.status}`,
    });
  } catch (err) {
    checks.push({
      name: 'API reachability',
      status: 'error',
      message: `${baseUrl}  →  ${String(err)}`,
    });
  }

  // 4. Auth check (only if we have a key)
  if (apiKey) {
    try {
      const client = new RoverClient({ apiKey, baseUrl });
      const result = await client.doctor();
      for (const check of result.checks) {
        checks.push(check);
      }
    } catch (err) {
      const status = err instanceof RoverAPIError && err.status === 401 ? 'error' : 'warning';
      const message =
        err instanceof RoverAPIError
          ? `${err.message} (HTTP ${err.status})`
          : String(err);
      checks.push({ name: 'API authentication', status, message });
    }
  }

  // Print results
  console.log('');
  console.log('  rtrvr doctor');
  console.log('  ────────────');

  let hasError = false;
  for (const check of checks) {
    const icon = check.status === 'ok' ? '✓' : check.status === 'warning' ? '⚠' : '✗';
    console.log(`  ${icon}  ${check.name}`);
    console.log(`       ${check.message}`);
    if (check.status === 'error') hasError = true;
  }

  console.log('');
  if (hasError) {
    console.log('  Some checks failed. See above for details.');
    process.exit(1);
  } else {
    console.log('  All checks passed.');
  }
  console.log('');
}
