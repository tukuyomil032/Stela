import chalk from 'chalk';
import ora from 'ora';
import { clearCache } from '../lib/cache.js';
import { searchRepos, starRepo } from '../lib/github.js';
import { selectMultipleRepos } from '../lib/interactive.js';
import { printSearchTable } from '../lib/table.js';
import type { SearchRepo } from '../types/github.js';

interface SearchOptions {
  interactive: boolean;
  lang?: string;
  sort?: string;
  limit?: number;
}

export async function searchCommand(query: string, options: SearchOptions): Promise<void> {
  const { getToken } = await import('../lib/auth.js');
  const token = getToken();

  const spinner = ora('Searching repositories...').start();
  let repos: SearchRepo[];

  try {
    repos = await searchRepos(token, query, {
      lang: options.lang,
      sort: options.sort,
      limit: options.limit,
    });
    spinner.succeed(`Found ${repos.length} repositories`);
  } catch (e) {
    spinner.fail('Failed to search repositories');
    throw e;
  }

  if (repos.length === 0) {
    console.log(chalk.yellow('No repositories found.'));
    return;
  }

  if (!options.interactive) {
    printSearchTable(repos);
    return;
  }

  const selected = await selectMultipleRepos(repos);

  if (selected.length === 0) {
    console.log(chalk.yellow('No repositories selected.'));
    return;
  }

  for (const repo of selected) {
    const parts = repo.full_name.split('/');
    const owner = parts[0];
    const repoName = parts[1];

    const repoSpinner = ora(`Starring ${repo.full_name}...`).start();
    try {
      await starRepo(token, owner, repoName);
      repoSpinner.succeed(`Starred ${repo.full_name}`);
    } catch (e) {
      repoSpinner.fail(`Failed to star ${repo.full_name}`);
      throw e;
    }
  }

  clearCache();
  console.log(chalk.green(`✓ Starred ${selected.length} repositories`));
}
