import chalk from 'chalk';
import ora from 'ora';
import { clearCache } from '../lib/cache.js';
import { loadConfig } from '../lib/config.js';
import { searchRepos, starRepo } from '../lib/github.js';
import { createI18n } from '../lib/i18n.js';
import { searchWizard, selectMultipleRepos } from '../lib/interactive.js';
import type { MultiSortConfig } from '../lib/sort.js';
import { printSearchTable } from '../lib/table.js';
import type { SearchRepo } from '../types/github.js';

interface SearchOptions {
  interactive: boolean;
  lang?: string;
  sort?: string;
  limit?: number;
  multiSort?: MultiSortConfig;
}

export async function searchCommand(
  query: string | undefined,
  options: SearchOptions,
): Promise<void> {
  const config = loadConfig();
  const t = createI18n(config.lang);
  const { getToken } = await import('../lib/auth.js');
  const token = getToken();

  if (query === undefined && options.interactive) {
    const result = await searchWizard(t);
    if (!result) {
      console.log(t.aborted);
      return;
    }
    query = result.query;
    if (!options.lang && result.lang) options.lang = result.lang;
    if (!options.limit) options.limit = result.limit;
    options.multiSort = result.multiSort;
  }
  if (query === undefined) {
    console.error(t.searchNoQuery);
    process.exit(1);
  }

  const spinner = ora(t.searchSearching).start();
  let repos: SearchRepo[];

  try {
    repos = await searchRepos(token, query, {
      lang: options.lang,
      sort: options.sort,
      limit: options.limit,
    });
    spinner.succeed(t.searchFound(repos.length));
  } catch (e) {
    spinner.fail(t.searchFailed);
    throw e;
  }

  if (
    options.multiSort &&
    (options.multiSort.preset || (options.multiSort.criteria?.length ?? 0) > 0)
  ) {
    const { sortByMultipleCriteria } = await import('../lib/sort.js');
    repos = sortByMultipleCriteria(repos, options.multiSort);
    repos = repos.slice(0, options.limit ?? 30);
  }

  if (repos.length === 0) {
    console.log(chalk.yellow(t.noReposFound));
    return;
  }

  if (!options.interactive) {
    printSearchTable(repos, t);
    return;
  }

  const selected = await selectMultipleRepos(repos);

  if (selected.length === 0) {
    console.log(chalk.yellow(t.noReposSelected));
    return;
  }

  for (const repo of selected) {
    const parts = repo.full_name.split('/');
    const owner = parts[0];
    const repoName = parts[1];

    const repoSpinner = ora(t.searchStarring(repo.full_name)).start();
    try {
      await starRepo(token, owner, repoName);
      repoSpinner.succeed(t.searchStarring(repo.full_name));
    } catch (e) {
      repoSpinner.fail(`Failed to star ${repo.full_name}`);
      throw e;
    }
  }

  clearCache();
  console.log(chalk.green(t.searchStarred(selected.length)));
}
