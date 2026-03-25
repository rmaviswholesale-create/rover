import type {
  RoverClientOptions,
  TaskOptions,
  ScrapeOptions,
  TaskResult,
  ScrapeResult,
  CapabilitiesResult,
  DoctorResult,
  CreateTaskPayload,
} from './types.js';

const DEFAULT_BASE_URL = 'https://agent.rtrvr.ai';
const POLL_INTERVAL_MS = 2000;
const DEFAULT_TIMEOUT_MS = 120_000;

export class RoverClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: RoverClientOptions = {}) {
    const apiKey = options.apiKey ?? process.env['RTRVR_API_KEY'];
    if (!apiKey) {
      throw new Error(
        'API key is required. Set RTRVR_API_KEY env var or pass apiKey option.',
      );
    }
    this.apiKey = apiKey;
    this.baseUrl = (options.baseUrl ?? process.env['RTRVR_BASE_URL'] ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'User-Agent': '@rtrvr-ai/sdk/3.0.0',
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
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

    return res.json() as Promise<T>;
  }

  async createTask(payload: CreateTaskPayload): Promise<TaskResult> {
    return this.request<TaskResult>('POST', '/v1/tasks', payload);
  }

  async getTask(taskId: string): Promise<TaskResult> {
    return this.request<TaskResult>('GET', `/v1/tasks/${taskId}`);
  }

  async run(prompt: string, options: TaskOptions): Promise<TaskResult> {
    const task = await this.createTask({ prompt, url: options.url });
    const deadline = Date.now() + (options.timeout ?? DEFAULT_TIMEOUT_MS);

    let current = task;
    while (current.status === 'pending' || current.status === 'running') {
      if (Date.now() >= deadline) {
        throw new Error(`Task ${current.id} timed out after waiting for completion.`);
      }
      await sleep(POLL_INTERVAL_MS);
      current = await this.getTask(current.id);
    }

    return current;
  }

  async scrape(options: ScrapeOptions): Promise<ScrapeResult> {
    return this.request<ScrapeResult>('POST', '/v1/scrape', { url: options.url });
  }

  async capabilities(): Promise<CapabilitiesResult> {
    return this.request<CapabilitiesResult>('GET', '/v1/capabilities');
  }

  async doctor(): Promise<DoctorResult> {
    return this.request<DoctorResult>('GET', '/v1/doctor');
  }
}

export class RoverAPIError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'RoverAPIError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
