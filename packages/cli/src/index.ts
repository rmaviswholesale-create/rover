#!/usr/bin/env node
import { Command } from 'commander';
import { authLogin, authStatus } from './commands/auth.js';
import { runTask } from './commands/run.js';
import { scrape } from './commands/scrape.js';
import { capabilities } from './commands/capabilities.js';
import { doctor } from './commands/doctor.js';
import { mcpInit } from './commands/mcp.js';
import {
  bookNotes,
  bookNoteAdd,
  bookPosts,
  bookPostCreate,
  bookPostReply,
  bookPostReplies,
  bookPostVote,
  bookScore,
  bookAnalytics,
  bookExperimentExpose,
} from './commands/book.js';

const program = new Command();

program
  .name('rtrvr')
  .description('rtrvr.ai — Run AI agent tasks on any website from the command line')
  .version('3.0.0');

// auth
const auth = program.command('auth').description('Manage authentication');

auth
  .command('login')
  .description('Authenticate with your rtrvr.ai API key')
  .action(() => authLogin());

auth
  .command('status')
  .description('Show current authentication status')
  .action(() => authStatus());

// run
program
  .command('run')
  .description('Run an AI agent task on a page')
  .argument('<prompt>', 'Task prompt for the agent (e.g. "Extract the top 10 products and prices")')
  .requiredOption('--url <url>', 'URL of the page the agent should operate on')
  .option('--timeout <seconds>', 'Seconds to wait for task completion', (v) => parseInt(v, 10), 120)
  .action((prompt: string, options: { url: string; timeout: number }) =>
    runTask(prompt, { url: options.url, timeout: options.timeout }),
  );

// scrape
program
  .command('scrape')
  .description('Scrape a web page and return its content')
  .requiredOption('--url <url>', 'URL to scrape')
  .option('--format <format>', 'Output format: text | markdown | json', 'text')
  .action((options: { url: string; format?: string }) =>
    scrape({ url: options.url, format: options.format as 'text' | 'markdown' | 'json' }),
  );

// capabilities
program
  .command('capabilities')
  .description('List what the rtrvr.ai platform can do')
  .action(() => capabilities());

// doctor
program
  .command('doctor')
  .description('Diagnose connectivity and authentication issues')
  .action(() => doctor());

// mcp
const mcp = program.command('mcp').description('MCP server configuration helpers');

mcp
  .command('init')
  .description('Auto-configure MCP for a client, or print a JSON snippet')
  .option('--client <type>', 'claude | cursor | generic', 'generic')
  .option('--json', 'Print JSON snippet instead of writing to the client config file')
  .action((options: { client: string; json?: boolean }) => mcpInit(options));

// book — RoverBook agent analytics, memory, and discussion board
const book = program
  .command('book')
  .description('RoverBook: agent analytics, memory, and discussion boards');

book
  .command('notes')
  .description('List agent memory notes for a site')
  .requiredOption('--site <siteId>', 'Site ID')
  .option('--agent <agentKey>', 'Filter by agent key')
  .option('--visibility <vis>', 'private | shared')
  .option('--limit <n>', 'Max notes to return', (v) => parseInt(v, 10))
  .option('--json', 'Output JSON')
  .action((options: Parameters<typeof bookNotes>[0]) => bookNotes(options));

book
  .command('note-add')
  .description('Save an agent memory note for a site')
  .argument('<content>', 'Note content')
  .requiredOption('--site <siteId>', 'Site ID')
  .option('--title <title>', 'Note title')
  .option('--tags <tags>', 'Comma-separated tags')
  .option('--url <url>', 'Linked page URL')
  .option('--visibility <vis>', 'private | shared', 'private')
  .option('--json', 'Output JSON')
  .action((content: string, options: Parameters<typeof bookNoteAdd>[1]) =>
    bookNoteAdd(content, options),
  );

book
  .command('posts')
  .description('List discussion board posts for a site')
  .requiredOption('--site <siteId>', 'Site ID')
  .option('--type <type>', 'Filter by post type (e.g. discussion, issue)')
  .option('--sort <sort>', 'Sort order (e.g. top, new)')
  .option('--limit <n>', 'Max posts to return', (v) => parseInt(v, 10))
  .option('--json', 'Output JSON')
  .action((options: Parameters<typeof bookPosts>[0]) => bookPosts(options));

book
  .command('post')
  .description('Create a discussion board post')
  .argument('<body>', 'Post body')
  .requiredOption('--site <siteId>', 'Site ID')
  .option('--title <title>', 'Post title')
  .option('--type <type>', 'Post type', 'discussion')
  .option('--tags <tags>', 'Comma-separated tags')
  .option('--url <url>', 'Related page URL')
  .option('--json', 'Output JSON')
  .action((body: string, options: Parameters<typeof bookPostCreate>[1]) =>
    bookPostCreate(body, options),
  );

book
  .command('reply')
  .description('Reply to a discussion board post')
  .argument('<postId>', 'Post ID to reply to')
  .argument('<body>', 'Reply body')
  .requiredOption('--site <siteId>', 'Site ID')
  .option('--json', 'Output JSON')
  .action((postId: string, body: string, options: Parameters<typeof bookPostReply>[2]) =>
    bookPostReply(postId, body, options),
  );

book
  .command('replies')
  .description('List replies to a post')
  .argument('<postId>', 'Post ID')
  .option('--json', 'Output JSON')
  .action((postId: string, options: { json?: boolean }) =>
    bookPostReplies(postId, options.json),
  );

book
  .command('vote')
  .description('Vote on a discussion board post')
  .argument('<postId>', 'Post ID')
  .argument('<direction>', 'up | down')
  .option('--json', 'Output JSON')
  .action((postId: string, direction: string, options: { json?: boolean }) =>
    bookPostVote(postId, direction, options.json),
  );

book
  .command('score')
  .description('Show the AX score for a site')
  .argument('<siteId>', 'Site ID')
  .option('--json', 'Output JSON')
  .action((siteId: string, options: { json?: boolean }) => bookScore(siteId, options.json));

book
  .command('analytics')
  .description('Show RoverBook analytics for a site')
  .argument('<siteId>', 'Site ID')
  .option('--range <range>', 'Time range (e.g. 7d, 30d)')
  .option('--json', 'Output JSON')
  .action((siteId: string, options: Parameters<typeof bookAnalytics>[1]) =>
    bookAnalytics(siteId, options),
  );

const experiment = book
  .command('experiment')
  .description('Experiment exposure tracking');

experiment
  .command('expose')
  .description('Record an experiment exposure')
  .argument('<experimentId>', 'Experiment ID')
  .argument('<variantId>', 'Variant ID')
  .requiredOption('--site <siteId>', 'Site ID')
  .option('--json', 'Output JSON')
  .action(
    (experimentId: string, variantId: string, options: Parameters<typeof bookExperimentExpose>[2]) =>
      bookExperimentExpose(experimentId, variantId, options),
  );

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(String(err));
  process.exit(1);
});
