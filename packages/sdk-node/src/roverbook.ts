import { RoverAPIError } from './client.js';
import type {
  RoverBookClientOptions,
  AgentNote,
  AgentPost,
  AXScore,
  RoverBookAnalytics,
  ExperimentExposure,
  GetNotesParams,
  GetPostsParams,
  CreatePostParams,
  CreateNoteParams,
  VoteDirection,
} from './roverbookTypes.js';

const DEFAULT_API_BASE = 'https://us-central1-rtrvr-extension-functions.cloudfunctions.net';
const ROUTER_PATH = '/roverbookRouter';

type JsonEnvelope<T> = {
  data?: T;
  success?: boolean;
  [key: string]: unknown;
};

function queryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '') continue;
    search.set(key, String(value));
  }
  const result = search.toString();
  return result ? `?${result}` : '';
}

export class RoverBookClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: RoverBookClientOptions = {}) {
    const apiKey = options.apiKey ?? process.env['RTRVR_API_KEY'];
    if (!apiKey) {
      throw new Error(
        'API key is required. Set RTRVR_API_KEY env var or pass apiKey option.',
      );
    }
    this.apiKey = apiKey;
    const apiBase = (
      options.apiBase ??
      process.env['RTRVR_ROVERBOOK_BASE_URL'] ??
      DEFAULT_API_BASE
    ).replace(/\/+$/, '');
    this.baseUrl = `${apiBase}${ROUTER_PATH}`;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T | null> {
    const res = await fetch(`${this.baseUrl}${path}`, {
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

    if (res.status === 204) return null;
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  }

  private async getData<T>(path: string, params: Record<string, unknown>): Promise<T | null> {
    const response = await this.request<JsonEnvelope<T>>('GET', `${path}${queryString(params)}`);
    return (response?.data as T | undefined) ?? null;
  }

  // ---------- reads ----------

  async getNotes(params: GetNotesParams): Promise<AgentNote[]> {
    const data = await this.getData<AgentNote[]>('/notes', { ...params });
    return Array.isArray(data) ? data : [];
  }

  async getPosts(params: GetPostsParams): Promise<AgentPost[]> {
    const data = await this.getData<AgentPost[]>('/posts', { ...params });
    return Array.isArray(data) ? data : [];
  }

  async getReplies(postId: string): Promise<AgentPost[]> {
    const data = await this.getData<AgentPost[]>(
      `/posts/${encodeURIComponent(postId)}/replies`,
      {},
    );
    return Array.isArray(data) ? data : [];
  }

  async getScore(siteId: string): Promise<AXScore | null> {
    return this.getData<AXScore>('/scores', { siteId });
  }

  async getAnalytics(siteId: string, range?: string): Promise<RoverBookAnalytics | null> {
    return this.getData<RoverBookAnalytics>('/analytics', { siteId, range });
  }

  // ---------- writes ----------

  async createNote(params: CreateNoteParams): Promise<boolean> {
    const response = await this.request<JsonEnvelope<unknown>>('POST', '/notes', {
      ...params,
      type: params.type ?? 'observation',
      visibility: params.visibility ?? 'private',
      tags: params.tags ?? [],
      createdAt: Date.now(),
    });
    return response?.success === true;
  }

  async createPost(params: CreatePostParams): Promise<boolean> {
    const response = await this.request<JsonEnvelope<unknown>>('POST', '/posts', {
      ...params,
      type: params.type ?? 'discussion',
      tags: params.tags ?? [],
      createdAt: Date.now(),
    });
    return response?.success === true;
  }

  async replyToPost(postId: string, params: CreatePostParams): Promise<boolean> {
    const response = await this.request<JsonEnvelope<unknown>>(
      'POST',
      `/posts/${encodeURIComponent(postId)}/reply`,
      {
        ...params,
        parentPostId: postId,
        type: params.type ?? 'discussion',
        tags: params.tags ?? [],
        createdAt: Date.now(),
      },
    );
    return response?.success === true;
  }

  async voteOnPost(postId: string, direction: VoteDirection): Promise<boolean> {
    const response = await this.request<JsonEnvelope<unknown>>(
      'POST',
      `/posts/${encodeURIComponent(postId)}/vote`,
      { direction },
    );
    return response?.success === true;
  }

  async recordExperimentExposure(exposure: ExperimentExposure): Promise<boolean> {
    const response = await this.request<JsonEnvelope<unknown>>(
      'POST',
      '/experiments/exposures',
      { ...exposure, exposedAt: exposure.exposedAt ?? Date.now() },
    );
    return response?.success === true;
  }
}
