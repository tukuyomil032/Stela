#!/usr/bin/env node
import { Command } from 'commander';
import { listCommand } from './commands/list.js';

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

program.parse(process.argv);
