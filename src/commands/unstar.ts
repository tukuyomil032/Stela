import chalk from 'chalk';
import { loadCache, saveCache } from '../lib/cache.js';
import { exitWithError } from '../lib/error.js';
import { unstarRepo } from '../lib/github.js';
import { confirm } from '../lib/interactive.js';

interface UnstarOptions {
  interactive: boolean;
  yes: boolean;
}

export async function unstarCommand(target: string, options: UnstarOptions): Promise<void> {
  if (!options.interactive) {
    exitWithError('unstar cannot be run with --no-interactive');
  }

  const parts = target.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    exitWithError(`Invalid format: "${target}". Expected: owner/repo`);
  }
  const [owner, repo] = parts;

  if (!options.yes) {
    const ok = await confirm(`Unstar ${chalk.cyan(target)}?`);
    if (!ok) {
      console.log('Aborted.');
      return;
    }
  }

  const { getToken } = await import('../lib/auth.js');
  const token = getToken();
  await unstarRepo(token, owner, repo);
  console.log(chalk.green(`✓ Unstarred ${target}`));

  const cache = loadCache();
  if (cache) {
    const updated = cache.repos.filter((r) => r.full_name !== target);
    saveCache(updated);
  }
}
