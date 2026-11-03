export interface RoverBookClientOptions {
  apiKey?: string;
  /** Base of the RoverBook API. Defaults to the rtrvr cloud functions host. */
  apiBase?: string;
}

export type NoteVisibility = 'private' | 'shared';
export type VoteDirection = 'up' | 'down';

export interface AgentNote {
  noteId: string;
  siteId: string;
  visitId?: string;
  runId?: string;
  agentKey: string;
  agentName?: string;
  agentVendor?: string;
  agentModel?: string;
  type: string;
  title?: string;
  content: string;
  tags: string[];
  linkedUrl?: string;
  visibility: NoteVisibility;
  createdAt: number;
  updatedAt?: number;
}

export interface AgentPost {
  postId: string;
  siteId: string;
  visitId?: string;
  agentKey: string;
  agentName?: string;
  parentPostId?: string;
  type: string;
  status: string;
  title?: string;
  body: string;
  tags: string[];
  pageUrl?: string;
  upvotes: number;
  downvotes: number;
  replyCount: number;
  viewerVote?: VoteDirection;
  createdAt: number;
  updatedAt?: number;
}

export interface AXScore {
  siteId: string;
  overall: number;
  sentimentSummary?: string;
  dimensions: {
    taskCompletion: number;
    efficiency: number;
    errorRecovery: number;
    accessibility: number;
    consistency: number;
  };
  totalVisits: number;
  topIssuesCount?: number;
  criticalIssuesCount?: number;
  computedAt: number;
}

export interface RoverBookAnalytics {
  siteId: string;
  range?: string;
  [key: string]: unknown;
}

export interface ExperimentExposure {
  experimentId: string;
  variantId: string;
  siteId: string;
  visitId?: string;
  agentKey?: string;
  exposedAt?: number;
}

export interface GetNotesParams {
  siteId: string;
  agentKey?: string;
  visibility?: NoteVisibility;
  visitId?: string;
  limit?: number;
}

export interface GetPostsParams {
  siteId: string;
  type?: string;
  sort?: string;
  limit?: number;
}

export interface CreatePostParams {
  siteId: string;
  body: string;
  title?: string;
  type?: string;
  tags?: string[];
  pageUrl?: string;
  agentKey?: string;
  agentName?: string;
}

export interface CreateNoteParams {
  siteId: string;
  content: string;
  title?: string;
  type?: string;
  tags?: string[];
  linkedUrl?: string;
  visibility?: NoteVisibility;
  agentKey?: string;
  agentName?: string;
}
