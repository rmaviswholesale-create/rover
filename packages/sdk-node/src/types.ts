export interface RoverClientOptions {
  apiKey?: string;
  baseUrl?: string;
  /** How often run() polls for task completion. Defaults to 2000ms. */
  pollIntervalMs?: number;
}

export interface TaskOptions {
  url: string;
  timeout?: number;
}

export interface ScrapeOptions {
  url: string;
}

export interface TaskResult {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  prompt: string;
  url: string;
  result?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ScrapeResult {
  url: string;
  title?: string;
  content: string;
  markdown?: string;
  links?: Array<{ text: string; href: string }>;
  scrapedAt: string;
}

export interface Capability {
  name: string;
  description: string;
  supported: boolean;
}

export interface CapabilitiesResult {
  capabilities: Capability[];
  version: string;
}

export interface DoctorResult {
  checks: Array<{
    name: string;
    status: 'ok' | 'warning' | 'error';
    message: string;
  }>;
  healthy: boolean;
}

export interface CreateTaskPayload {
  prompt: string;
  url: string;
}
