export class RoverAPIError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'RoverAPIError';
  }
}

export interface RequestJsonOptions {
  method: string;
  url: string;
  apiKey: string;
  body?: unknown;
}

/**
 * Shared JSON request helper for all rtrvr API clients.
 * Throws RoverAPIError on non-2xx; returns null on empty/204 responses.
 */
export async function requestJson<T>(options: RequestJsonOptions): Promise<T | null> {
  const res = await fetch(options.url, {
    method: options.method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.apiKey}`,
      'User-Agent': '@rtrvr-ai/sdk/3.0.0',
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  if (!res.ok) {
    let message = `HTTP ${res.status} ${res.statusText}`;
    try {
      const err = (await res.json()) as { message?: string; error?: string };
      message = err.message ?? err.error ?? message;
    } catch {
      // ignore parse error
    }
    throw new RoverAPIError(message, res.status);
  }

  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text) as T;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
