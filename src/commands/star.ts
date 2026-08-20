import chalk from 'chalk';
import { clearCache } from '../lib/cache.js';
import { exitWithError } from '../lib/error.js';
import { starRepo } from '../lib/github.js';
import { getOctokit } from '../lib/octokit.js';

interface StarOptions {
  interactive: boolean;
}

function parseTarget(target: string): { owner: string; repo: string } {
  if (target.startsWith('https://github.com/') || target.startsWith('http://github.com/')) {
    const url = new URL(target);
    const parts = url.pathname.replace(/^\//, '').replace(/\/$/, '').split('/');
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      exitWithError(`Invalid GitHub URL: "${target}"`);
    }
    return { owner: parts[0], repo: parts[1] };
  }

  const parts = target.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    exitWithError(`Invalid format: "${target}". Expected: owner/repo or GitHub URL`);
  }
  return { owner: parts[0], repo: parts[1] };
}

export async function starCommand(target: string, options: StarOptions): Promise<void> {
  if (!options.interactive) {
    exitWithError('star cannot be run with --no-interactive');
  }

  const { owner, repo } = parseTarget(target);

  const octokit = await getOctokit();
  await starRepo(octokit, owner, repo);
  console.log(chalk.green(`✓ Starred ${owner}/${repo}`));

  clearCache();
}
