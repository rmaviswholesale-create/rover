import { requestJson, sleep } from './http.js';
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

export { RoverAPIError } from './http.js';

const DEFAULT_BASE_URL = 'https://agent.rtrvr.ai';
const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_TIMEOUT_MS = 120_000;

export class RoverClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly pollIntervalMs: number;

  constructor(options: RoverClientOptions = {}) {
    const apiKey = options.apiKey ?? process.env['RTRVR_API_KEY'];
    if (!apiKey) {
      throw new Error(
        'API key is required. Set RTRVR_API_KEY env var or pass apiKey option.',
      );
    }
    this.apiKey = apiKey;
    this.baseUrl = (options.baseUrl ?? process.env['RTRVR_BASE_URL'] ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const result = await requestJson<T>({
      method,
      url: `${this.baseUrl}${path}`,
      apiKey: this.apiKey,
      body,
    });
    if (result === null) {
      throw new Error(`Empty response from ${path}`);
    }
    return result;
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
      await sleep(this.pollIntervalMs);
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
