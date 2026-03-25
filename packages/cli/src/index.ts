#!/usr/bin/env node
import { Command } from 'commander';
import { authLogin, authStatus } from './commands/auth.js';
import { runTask } from './commands/run.js';
import { scrape } from './commands/scrape.js';
import { capabilities } from './commands/capabilities.js';
import { doctor } from './commands/doctor.js';
import { mcpInit } from './commands/mcp.js';

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

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(String(err));
  process.exit(1);
});
