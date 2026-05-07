#!/usr/bin/env node
import { intro } from '@clack/prompts';
import { Command } from 'commander';
import { renderFilled } from 'oh-my-logo';
import { cacheClearCommand, cacheStatusCommand, cacheWizardCommand } from './commands/cache.js';
import { configSetCommand, configShowCommand, configWizardCommand } from './commands/config.js';
import { listCommand } from './commands/list.js';
import { searchCommand } from './commands/search.js';
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

program
  .command('search [query]')
  .description('Search GitHub repositories and star them')
  .option('--no-interactive', 'Output as table only (non-interactive, no starring)')
  .option('--lang <lang>', 'Filter by programming language')
  .option('--sort <sort>', 'Sort by: stars | forks | updated', 'stars')
  .option('--limit <n>', 'Number of results (max 100)', '30')
  .action(async (query, options) => {
    options.limit = parseInt(options.limit, 10);
    await searchCommand(query, options);
  });

const cacheCommand = new Command('cache').description('Manage cache');

cacheCommand.action(async () => {
  await cacheWizardCommand();
});

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

const configCommand = new Command('config').description('Manage configuration');

configCommand.action(async () => {
  await configWizardCommand();
});

configCommand
  .command('show')
  .description('Show current configuration')
  .action(() => {
    configShowCommand();
  });

configCommand
  .command('set <key> <value>')
  .description('Set a configuration value (keys: cacheTTL, defaultLanguageFilter, pageSize)')
  .action((key, value) => {
    configSetCommand(key, value);
  });

program.addCommand(configCommand);

program.action(async () => {
  await renderFilled('STELA', { palette: 'grad-blue' });
  intro('stela — GitHub Star Manager');
  program.help();
});

program.parse(process.argv);
