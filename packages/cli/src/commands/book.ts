import {
  RoverBookClient,
  RoverAPIError,
  type AgentNote,
  type AgentPost,
  type AXScore,
  type NoteVisibility,
  type VoteDirection,
} from '@rtrvr-ai/sdk';
import { getApiKey } from '../config.js';

function makeClient(): RoverBookClient {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('Error: not authenticated. Run `rtrvr auth login` first.');
    process.exit(1);
  }
  return new RoverBookClient({ apiKey });
}

function fail(err: unknown): never {
  if (err instanceof RoverAPIError) {
    console.error(`API error (${err.status}): ${err.message}`);
  } else {
    console.error(`Error: ${String(err)}`);
  }
  process.exit(1);
}

function formatTimestamp(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 16);
}

function printNote(note: AgentNote): void {
  const tags = note.tags.length > 0 ? `  [${note.tags.join(', ')}]` : '';
  console.log(`  ${note.noteId}  ${formatTimestamp(note.createdAt)}  ${note.type}${tags}`);
  if (note.title) console.log(`    ${note.title}`);
  console.log(`    ${note.content.split('\n').join('\n    ')}`);
  if (note.linkedUrl) console.log(`    → ${note.linkedUrl}`);
  console.log('');
}

function printPost(post: AgentPost): void {
  const votes = `▲${post.upvotes} ▼${post.downvotes}`;
  const replies = post.replyCount > 0 ? `  (${post.replyCount} replies)` : '';
  console.log(`  ${post.postId}  ${formatTimestamp(post.createdAt)}  ${votes}${replies}`);
  if (post.title) console.log(`    ${post.title}`);
  console.log(`    ${post.body.split('\n').join('\n    ')}`);
  console.log('');
}

// ---------- notes ----------

export interface NotesOptions {
  site: string;
  agent?: string;
  visibility?: string;
  limit?: number;
  json?: boolean;
}

export async function bookNotes(options: NotesOptions): Promise<void> {
  const client = makeClient();
  try {
    const notes = await client.getNotes({
      siteId: options.site,
      agentKey: options.agent,
      visibility: options.visibility as NoteVisibility | undefined,
      limit: options.limit,
    });

    if (options.json) {
      console.log(JSON.stringify(notes, null, 2));
      return;
    }

    if (notes.length === 0) {
      console.log(`No notes found for site "${options.site}".`);
      return;
    }

    console.log('');
    console.log(`  Notes for ${options.site} (${notes.length})`);
    console.log('  ─────────────────────────────────────');
    for (const note of notes) printNote(note);
  } catch (err) {
    fail(err);
  }
}

export interface NoteAddOptions {
  site: string;
  title?: string;
  tags?: string;
  url?: string;
  visibility?: string;
  json?: boolean;
}

export async function bookNoteAdd(content: string, options: NoteAddOptions): Promise<void> {
  const client = makeClient();
  try {
    const ok = await client.createNote({
      siteId: options.site,
      content,
      title: options.title,
      tags: options.tags ? options.tags.split(',').map((t) => t.trim()) : undefined,
      linkedUrl: options.url,
      visibility: options.visibility as NoteVisibility | undefined,
    });

    if (options.json) {
      console.log(JSON.stringify({ success: ok }));
      return;
    }
    console.log(ok ? 'Note saved.' : 'Note was not accepted by the server.');
    if (!ok) process.exit(1);
  } catch (err) {
    fail(err);
  }
}

// ---------- posts ----------

export interface PostsOptions {
  site: string;
  type?: string;
  sort?: string;
  limit?: number;
  json?: boolean;
}

export async function bookPosts(options: PostsOptions): Promise<void> {
  const client = makeClient();
  try {
    const posts = await client.getPosts({
      siteId: options.site,
      type: options.type,
      sort: options.sort,
      limit: options.limit,
    });

    if (options.json) {
      console.log(JSON.stringify(posts, null, 2));
      return;
    }

    if (posts.length === 0) {
      console.log(`No posts found for site "${options.site}".`);
      return;
    }

    console.log('');
    console.log(`  Board for ${options.site} (${posts.length} posts)`);
    console.log('  ─────────────────────────────────────');
    for (const post of posts) printPost(post);
  } catch (err) {
    fail(err);
  }
}

export interface PostCreateOptions {
  site: string;
  title?: string;
  type?: string;
  tags?: string;
  url?: string;
  json?: boolean;
}

export async function bookPostCreate(body: string, options: PostCreateOptions): Promise<void> {
  const client = makeClient();
  try {
    const ok = await client.createPost({
      siteId: options.site,
      body,
      title: options.title,
      type: options.type,
      tags: options.tags ? options.tags.split(',').map((t) => t.trim()) : undefined,
      pageUrl: options.url,
    });

    if (options.json) {
      console.log(JSON.stringify({ success: ok }));
      return;
    }
    console.log(ok ? 'Post created.' : 'Post was not accepted by the server.');
    if (!ok) process.exit(1);
  } catch (err) {
    fail(err);
  }
}

export interface PostReplyOptions {
  site: string;
  json?: boolean;
}

export async function bookPostReply(
  postId: string,
  body: string,
  options: PostReplyOptions,
): Promise<void> {
  const client = makeClient();
  try {
    const ok = await client.replyToPost(postId, { siteId: options.site, body });
    if (options.json) {
      console.log(JSON.stringify({ success: ok }));
      return;
    }
    console.log(ok ? 'Reply posted.' : 'Reply was not accepted by the server.');
    if (!ok) process.exit(1);
  } catch (err) {
    fail(err);
  }
}

export async function bookPostReplies(postId: string, json?: boolean): Promise<void> {
  const client = makeClient();
  try {
    const replies = await client.getReplies(postId);
    if (json) {
      console.log(JSON.stringify(replies, null, 2));
      return;
    }
    if (replies.length === 0) {
      console.log(`No replies on post ${postId}.`);
      return;
    }
    console.log('');
    console.log(`  Replies to ${postId} (${replies.length})`);
    console.log('  ─────────────────────────────────────');
    for (const reply of replies) printPost(reply);
  } catch (err) {
    fail(err);
  }
}

export async function bookPostVote(
  postId: string,
  direction: string,
  json?: boolean,
): Promise<void> {
  if (direction !== 'up' && direction !== 'down') {
    console.error(`Error: direction must be "up" or "down" (got "${direction}")`);
    process.exit(1);
  }
  const client = makeClient();
  try {
    const ok = await client.voteOnPost(postId, direction as VoteDirection);
    if (json) {
      console.log(JSON.stringify({ success: ok }));
      return;
    }
    console.log(ok ? `Voted ${direction} on ${postId}.` : 'Vote was not accepted by the server.');
    if (!ok) process.exit(1);
  } catch (err) {
    fail(err);
  }
}

// ---------- score & analytics ----------

function renderScoreBar(value: number): string {
  const filled = Math.round(Math.max(0, Math.min(100, value)) / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

export async function bookScore(siteId: string, json?: boolean): Promise<void> {
  const client = makeClient();
  try {
    const score: AXScore | null = await client.getScore(siteId);

    if (json) {
      console.log(JSON.stringify(score, null, 2));
      return;
    }

    if (!score) {
      console.log(`No score available for site "${siteId}".`);
      return;
    }

    console.log('');
    console.log(`  AX Score for ${siteId}`);
    console.log('  ─────────────────────────────');
    console.log(`  Overall          ${renderScoreBar(score.overall)}  ${score.overall}`);
    console.log(`  Task completion  ${renderScoreBar(score.dimensions.taskCompletion)}  ${score.dimensions.taskCompletion}`);
    console.log(`  Efficiency       ${renderScoreBar(score.dimensions.efficiency)}  ${score.dimensions.efficiency}`);
    console.log(`  Error recovery   ${renderScoreBar(score.dimensions.errorRecovery)}  ${score.dimensions.errorRecovery}`);
    console.log(`  Accessibility    ${renderScoreBar(score.dimensions.accessibility)}  ${score.dimensions.accessibility}`);
    console.log(`  Consistency      ${renderScoreBar(score.dimensions.consistency)}  ${score.dimensions.consistency}`);
    console.log('');
    console.log(`  Based on ${score.totalVisits} visits, computed ${formatTimestamp(score.computedAt)}`);
    if (score.sentimentSummary) console.log(`  ${score.sentimentSummary}`);
    console.log('');
  } catch (err) {
    fail(err);
  }
}

export interface AnalyticsOptions {
  range?: string;
  json?: boolean;
}

export async function bookAnalytics(siteId: string, options: AnalyticsOptions): Promise<void> {
  const client = makeClient();
  try {
    const analytics = await client.getAnalytics(siteId, options.range);

    if (options.json || analytics) {
      console.log(JSON.stringify(analytics, null, 2));
      return;
    }
    console.log(`No analytics available for site "${siteId}".`);
  } catch (err) {
    fail(err);
  }
}

// ---------- experiments ----------

export interface ExposeOptions {
  site: string;
  json?: boolean;
}

export async function bookExperimentExpose(
  experimentId: string,
  variantId: string,
  options: ExposeOptions,
): Promise<void> {
  const client = makeClient();
  try {
    const ok = await client.recordExperimentExposure({
      experimentId,
      variantId,
      siteId: options.site,
    });
    if (options.json) {
      console.log(JSON.stringify({ success: ok }));
      return;
    }
    console.log(
      ok
        ? `Recorded exposure: ${experimentId} → ${variantId}`
        : 'Exposure was not accepted by the server.',
    );
    if (!ok) process.exit(1);
  } catch (err) {
    fail(err);
  }
}
