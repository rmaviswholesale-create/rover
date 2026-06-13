export { RoverClient, RoverAPIError } from './client.js';
export type {
  RoverClientOptions,
  TaskOptions,
  ScrapeOptions,
  TaskResult,
  ScrapeResult,
  Capability,
  CapabilitiesResult,
  DoctorResult,
  CreateTaskPayload,
} from './types.js';

export { RoverBookClient } from './roverbook.js';
export type {
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
  NoteVisibility,
  VoteDirection,
} from './roverbookTypes.js';
