#!/usr/bin/env node
import { Command } from 'commander';
import { cacheClearCommand, cacheStatusCommand } from './commands/cache.js';
import { listCommand } from './commands/list.js';
import { starCommand } from './commands/star.js';
import { unstarCommand } from './commands/unstar.js';

const program = new Command();

program
  .name('stela')
  .version('0.0.0')
  .description(
    'A TypeScript CLI that lets you view starred repositories, unstar them, and search for repositories by language or genre to star new ones',
  );

program
  .command('list')
  .description('List starred repositories')
  .option('--no-interactive', 'Output as table (non-interactive)')
  .option('--lang <lang>', 'Filter by programming language')
  .option('--sort <sort>', 'Sort by: stars or updated')
  .option('--refresh', 'Force refresh cache', false)
  .action(async (options) => {
    await listCommand(options);
  });

program
  .command('star <target>')
  .description('Star a repository (format: owner/repo or GitHub URL)')
  .option('--no-interactive', 'Disable interactive mode')
  .action(async (target, options) => {
    await starCommand(target, options);
  });

program
  .command('unstar <target>')
  .description('Unstar a repository (format: owner/repo)')
  .option('--no-interactive', 'Disable interactive mode')
  .option('-y, --yes', 'Skip confirmation prompt', false)
  .action(async (target, options) => {
    await unstarCommand(target, options);
  });

const cacheCommand = new Command('cache').description('Manage cache');

cacheCommand
  .command('clear')
  .description('Clear the cache')
  .action(() => {
    cacheClearCommand();
  });

cacheCommand
  .command('status')
  .description('Show cache status')
  .action(() => {
    cacheStatusCommand();
  });

program.addCommand(cacheCommand);

program.parse(process.argv);
