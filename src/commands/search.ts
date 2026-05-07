import chalk from 'chalk';
import ora from 'ora';
import { clearCache } from '../lib/cache.js';
import { loadConfig } from '../lib/config.js';
import { searchRepos, starRepo } from '../lib/github.js';
import { createI18n } from '../lib/i18n.js';
import { searchWizard, selectMultipleRepos, selectPageAction } from '../lib/interactive.js';
import type { MultiSortConfig } from '../lib/sort.js';
import { printSearchTable } from '../lib/table.js';
import type { SearchRepo } from '../types/github.js';

interface SearchOptions {
  interactive: boolean;
  lang?: string | string[];
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
  let totalCount = 0;

  try {
    const result = await searchRepos(token, query, {
      lang: options.lang,
      sort: options.sort,
      limit: options.limit,
    });
    repos = result.items;
    totalCount = result.totalCount;
    spinner.succeed(t.searchFound(totalCount));
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

  // Pagination loop
  let currentPage = 1;
  const perPage = options.limit ?? config.pageSize;
  const allSelected: SearchRepo[] = [];
  const selectedNames = new Set<string>();
  let currentRepos = repos;
  const pageCache = new Map<number, { items: SearchRepo[]; totalCount: number }>();
  pageCache.set(1, { items: repos, totalCount });

  while (true) {
    if (selectedNames.size > 0) {
      console.log(
        chalk.cyan(`  ✓ 選択済み ${selectedNames.size} 件: `) +
          chalk.dim(Array.from(selectedNames).join(', ')),
      );
    }
    printSearchTable(currentRepos, t);
    console.log(chalk.dim(t.paginationInfo(currentPage, selectedNames.size)));

    const hasNextPage = currentPage * perPage < totalCount;
    const action = await selectPageAction(t, currentPage, hasNextPage);

    if (action === null) {
      console.log(t.aborted);
      return;
    }

    if (action === 'select') {
      const preSelected = currentRepos
        .filter((r) => selectedNames.has(r.full_name))
        .map((r) => r.full_name);
      const pageSelected = await selectMultipleRepos(currentRepos, preSelected);

      // Update accumulated selections
      const currentPageNames = new Set(currentRepos.map((r) => r.full_name));
      const pageSelectedNames = new Set(pageSelected.map((r) => r.full_name));

      // Remove deselected repos from this page
      for (const name of currentPageNames) {
        if (!pageSelectedNames.has(name) && selectedNames.has(name)) {
          selectedNames.delete(name);
          const idx = allSelected.findIndex((r) => r.full_name === name);
          if (idx !== -1) allSelected.splice(idx, 1);
        }
      }
      // Add newly selected repos
      for (const repo of pageSelected) {
        if (!selectedNames.has(repo.full_name)) {
          selectedNames.add(repo.full_name);
          allSelected.push(repo);
        }
      }
    } else if (action === 'next' || action === 'prev') {
      const targetPage = action === 'next' ? currentPage + 1 : currentPage - 1;

      const cached = pageCache.get(targetPage);
      if (cached) {
        currentRepos = cached.items;
        totalCount = cached.totalCount;
        currentPage = targetPage;
      } else {
        const pageSpinner = ora(t.searchSearching).start();
        try {
          const result = await searchRepos(token, query as string, {
            lang: options.lang,
            sort: options.sort,
            limit: options.limit,
            page: targetPage,
          });
          currentRepos = result.items;
          totalCount = result.totalCount;
          pageSpinner.succeed(t.searchFound(totalCount));
        } catch (e) {
          pageSpinner.fail(t.searchFailed);
          throw e;
        }

        if (currentRepos.length === 0) {
          console.log(chalk.yellow(t.noReposFound));
          continue;
        }

        // Apply multi-sort if configured
        if (
          options.multiSort &&
          (options.multiSort.preset || (options.multiSort.criteria?.length ?? 0) > 0)
        ) {
          const { sortByMultipleCriteria } = await import('../lib/sort.js');
          currentRepos = sortByMultipleCriteria(currentRepos, options.multiSort);
        }

        pageCache.set(targetPage, { items: currentRepos, totalCount });
        currentPage = targetPage;
      }
    } else {
      // done
      break;
    }
  }

  if (allSelected.length === 0) {
    console.log(chalk.yellow(t.noReposSelected));
    return;
  }

  for (const repo of allSelected) {
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
  console.log(chalk.green(t.searchStarred(allSelected.length)));
}
