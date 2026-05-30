import chalk from 'chalk';
import ora from 'ora';
import { clearCache } from '../lib/cache.js';
import { loadConfig } from '../lib/config.js';
import { searchRepos, starRepo } from '../lib/github.js';
import { createI18n } from '../lib/i18n.js';
import { searchWizard, selectMultipleRepos, selectPageAction } from '../lib/interactive.js';
import {
  disableMouseTracking,
  enableMouseTracking,
  getCurrentRow,
  parseSgrMouseEvent,
} from '../lib/mouse.js';
import type { MultiSortConfig } from '../lib/sort.js';
import { openInBrowser } from '../lib/system.js';
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
    const result = await searchWizard(t, config.pageSize);
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

    // Query cursor row BEFORE printing the table so we can map clicks to repo indices
    const tableStartRow = await getCurrentRow();

    printSearchTable(currentRepos, t);
    console.log(chalk.dim(t.paginationInfo(currentPage, selectedNames.size)));
    if (process.stdout.isTTY) {
      console.log(chalk.dim('  Shift+click on a repository name to open in browser'));
    }

    const hasNextPage = currentPage * perPage < totalCount;

    // Enable SGR mouse tracking and listen for Shift+left-click events.
    // printSearchTable prints 7 lines before repo[0]:
    //   blank + box(3) + blank + header + separator
    const REPO_ROW_OFFSET = 7;
    enableMouseTracking();

    const mouseHandler = (data: Buffer): void => {
      const event = parseSgrMouseEvent(data.toString());
      if (!event || event.button !== 0 || !event.shift || event.released) return;

      const repoIndex = event.y - tableStartRow - REPO_ROW_OFFSET;
      if (repoIndex >= 0 && repoIndex < currentRepos.length) {
        openInBrowser(`https://github.com/${currentRepos[repoIndex].full_name}`);
      }
    };

    process.stdin.on('data', mouseHandler);
    const action = await selectPageAction(t, currentPage, hasNextPage);
    disableMouseTracking();
    process.stdin.removeListener('data', mouseHandler);

    if (action === null) {
      console.log(t.aborted);
      return;
    }

    if (action === 'select') {
      const preSelected = currentRepos
        .filter((r) => selectedNames.has(r.full_name))
        .map((r) => r.full_name);
      const pageSelected = await selectMultipleRepos(currentRepos, preSelected);

      const currentPageNames = new Set(currentRepos.map((r) => r.full_name));
      const pageSelectedNames = new Set(pageSelected.map((r) => r.full_name));

      for (const name of currentPageNames) {
        if (!pageSelectedNames.has(name) && selectedNames.has(name)) {
          selectedNames.delete(name);
          const idx = allSelected.findIndex((r) => r.full_name === name);
          if (idx !== -1) allSelected.splice(idx, 1);
        }
      }
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

  for (let i = 0; i < allSelected.length; i++) {
    const repo = allSelected[i];
    const parts = repo.full_name.split('/');
    const owner = parts[0];
    const repoName = parts[1];

    const label = t.searchStarring(repo.full_name, i + 1, allSelected.length);
    const repoSpinner = ora(label).start();
    try {
      await starRepo(token, owner, repoName);
      repoSpinner.succeed(label);
    } catch (e) {
      repoSpinner.fail(`Failed to star ${repo.full_name}`);
      throw e;
    }
  }

  clearCache();
  console.log(chalk.green(t.searchStarred(allSelected.length)));
}
