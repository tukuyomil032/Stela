import chalk from 'chalk';
import ora from 'ora';
import { clearCache } from '../lib/cache.js';
import { loadConfig } from '../lib/config.js';
import { searchRepos, starRepo } from '../lib/github.js';
import { createI18n } from '../lib/i18n.js';
import {
  editSearchConditions,
  searchControlsWizard,
  selectMultipleRepos,
  selectPageAction,
} from '../lib/interactive.js';
import { getOctokit } from '../lib/octokit.js';
import type { MultiSortConfig } from '../lib/sort.js';
import { sortByMultipleCriteria } from '../lib/sort.js';
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
  queryArgs: string[] | undefined,
  options: SearchOptions,
): Promise<void> {
  const config = loadConfig();
  const t = createI18n(config.lang);
  const octokit = await getOctokit();

  const applyResultSorting = (items: SearchRepo[]): SearchRepo[] => {
    if (
      !options.multiSort ||
      (!options.multiSort.preset && (options.multiSort.criteria?.length ?? 0) === 0)
    ) {
      return items;
    }
    return sortByMultipleCriteria(items, options.multiSort).slice(
      0,
      options.limit ?? config.pageSize,
    );
  };

  let query = queryArgs && queryArgs.length > 0 ? queryArgs.join(' ') : undefined;
  let initialLiveResult: { items: SearchRepo[]; totalCount: number } | undefined;
  let initialEditorError = false;
  let initialLiveRequest:
    | { query: string; lang?: string | string[]; sort?: string; limit: number }
    | undefined;

  if (query === undefined && options.interactive) {
    const result = await editSearchConditions(
      t,
      '',
      undefined,
      undefined,
      config.searchUpdateMode === 'live'
        ? {
            mode: 'live',
            onQueryChange: async (nextQuery) => {
              if (!nextQuery.trim()) return { items: [], totalCount: 0 };
              return searchRepos(octokit, nextQuery, {
                lang: options.lang,
                sort: options.sort,
                limit: options.limit,
              });
            },
            onQueryResult: (value, nextQuery) => {
              initialLiveResult = value as { items: SearchRepo[]; totalCount: number };
              initialLiveRequest = {
                query: nextQuery,
                lang: options.lang,
                sort: options.sort,
                limit: options.limit ?? config.pageSize,
              };
              if (process.stdout.isTTY && initialLiveResult.items.length > 0) {
                process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
                printSearchTable(initialLiveResult.items, t);
              }
            },
            onQueryError: () => console.error(t.searchFailed),
            onConditionsChange: async (conditions) => {
              options.lang = conditions.lang;
              if (!conditions.query.trim()) {
                initialLiveResult = { items: [], totalCount: 0 };
                return;
              }
              const result = await searchRepos(octokit, conditions.query, {
                lang: options.lang,
                sort: options.sort,
                limit: options.limit,
              });
              initialLiveResult = result;
              initialLiveRequest = {
                query: conditions.query,
                lang: options.lang,
                sort: options.sort,
                limit: options.limit ?? config.pageSize,
              };
              if (process.stdout.isTTY) {
                process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
                printSearchTable(result.items, t);
              }
            },
            onConditionsError: () => {
              initialEditorError = true;
              initialLiveResult = undefined;
              console.error(t.searchFailed);
            },
          }
        : undefined,
    );
    if (!result) {
      console.log(t.aborted);
      return;
    }
    query = result.query;
    if (result.lang) options.lang = result.lang;
    const controls = await searchControlsWizard(t, options.limit ?? config.pageSize);
    if (!controls) {
      console.log(t.aborted);
      return;
    }
    options.limit = controls.limit;
    options.multiSort = controls.multiSort;
    if (initialEditorError) query = '';
  }
  if (query === undefined) {
    console.error(t.searchNoQuery);
    process.exit(1);
  }

  let repos: SearchRepo[] = [];
  let totalCount = 0;

  const canReuseInitialLive =
    config.searchUpdateMode === 'live' &&
    !initialEditorError &&
    initialLiveResult &&
    initialLiveRequest &&
    initialLiveRequest.query === query &&
    JSON.stringify(initialLiveRequest.lang) === JSON.stringify(options.lang) &&
    initialLiveRequest.sort === options.sort &&
    initialLiveRequest.limit === (options.limit ?? config.pageSize);

  if (canReuseInitialLive) {
    repos = applyResultSorting(initialLiveResult?.items ?? []);
    totalCount = initialLiveResult?.totalCount ?? 0;
  } else if (query.trim()) {
    const spinner = ora(t.searchSearching).start();
    try {
      const result = await searchRepos(octokit, query, {
        lang: options.lang,
        sort: options.sort,
        limit: options.limit,
      });
      repos = applyResultSorting(result.items);
      totalCount = result.totalCount;
      spinner.succeed(t.searchFound(totalCount));
    } catch (e) {
      spinner.fail(t.searchFailed);
      throw e;
    }
  }

  repos = applyResultSorting(repos);

  if (repos.length === 0) {
    if (!options.interactive) {
      console.log(chalk.yellow(t.noReposFound));
      return;
    }
    while (repos.length === 0) {
      console.log(chalk.yellow(t.noReposFound));
      const retryLang = options.lang
        ? Array.isArray(options.lang)
          ? options.lang
          : [options.lang]
        : undefined;
      let retryEditorError = false;
      let retryLiveResult: { items: SearchRepo[]; totalCount: number } | undefined;
      let retryLiveRequest:
        | { query: string; lang?: string | string[]; sort?: string; limit: number }
        | undefined;
      const retry = await editSearchConditions(
        t,
        query,
        retryLang,
        undefined,
        config.searchUpdateMode === 'live'
          ? {
              mode: 'live' as const,
              onQueryChange: async (nextQuery) => {
                if (!nextQuery.trim()) return { items: [], totalCount: 0 };
                return searchRepos(octokit, nextQuery, {
                  lang: options.lang,
                  sort: options.sort,
                  limit: options.limit,
                });
              },
              onQueryResult: (value, nextQuery) => {
                const result = value as { items: SearchRepo[]; totalCount: number };
                retryLiveResult = result;
                retryLiveRequest = {
                  query: nextQuery,
                  lang: options.lang,
                  sort: options.sort,
                  limit: options.limit ?? config.pageSize,
                };
                repos = applyResultSorting(result.items);
                totalCount = result.totalCount;
                if (process.stdout.isTTY) {
                  process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
                  printSearchTable(repos, t);
                }
              },
              onQueryError: () => console.error(t.searchFailed),
              onConditionsChange: async (conditions) => {
                options.lang = conditions.lang;
                if (!conditions.query.trim()) {
                  repos = [];
                  totalCount = 0;
                  return;
                }
                const result = await searchRepos(octokit, conditions.query, {
                  lang: options.lang,
                  sort: options.sort,
                  limit: options.limit,
                });
                repos = applyResultSorting(result.items);
                totalCount = result.totalCount;
                retryLiveResult = result;
                retryLiveRequest = {
                  query: conditions.query,
                  lang: options.lang,
                  sort: options.sort,
                  limit: options.limit ?? config.pageSize,
                };
              },
              onConditionsError: () => {
                retryEditorError = true;
                console.error(t.searchFailed);
              },
            }
          : undefined,
      );
      if (!retry) {
        console.log(t.aborted);
        return;
      }
      query = retry.query;
      options.lang = retry.lang;
      if (retryEditorError) continue;
      if (!query.trim()) continue;
      const canReuseRetryLive =
        config.searchUpdateMode === 'live' &&
        retryLiveResult &&
        retryLiveRequest &&
        retryLiveRequest.query === query &&
        JSON.stringify(retryLiveRequest.lang) === JSON.stringify(options.lang) &&
        retryLiveRequest.sort === options.sort &&
        retryLiveRequest.limit === (options.limit ?? config.pageSize);
      if (canReuseRetryLive) {
        repos = applyResultSorting(retryLiveResult?.items ?? []);
        totalCount = retryLiveResult?.totalCount ?? 0;
      } else {
        try {
          const retryResult = await searchRepos(octokit, query, {
            lang: options.lang,
            sort: options.sort,
            limit: options.limit,
          });
          repos = applyResultSorting(retryResult.items);
          totalCount = retryResult.totalCount;
        } catch {
          console.error(t.searchFailed);
        }
      }
    }
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
  let needsClear = false;

  while (true) {
    if (needsClear && process.stdout.isTTY) {
      process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
      needsClear = false;
    }

    if (selectedNames.size > 0) {
      console.log(
        chalk.cyan(`  ✓ 選択済み ${selectedNames.size} 件: `) +
          chalk.dim(Array.from(selectedNames).join(', ')),
      );
    }

    printSearchTable(currentRepos, t, undefined, (currentPage - 1) * perPage);
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
      needsClear = true;
    } else if (action === 'search') {
      const currentLang = options.lang
        ? Array.isArray(options.lang)
          ? options.lang
          : [options.lang]
        : undefined;
      let liveEditResult: { items: SearchRepo[]; totalCount: number } | undefined;
      let liveEditError = false;
      const edited = await editSearchConditions(t, query, currentLang, undefined, {
        mode: config.searchUpdateMode ?? 'enter',
        onQueryChange: async (nextQuery) => {
          if (!nextQuery.trim()) return { items: [], totalCount: 0 };
          return searchRepos(octokit, nextQuery, {
            lang: options.lang,
            sort: options.sort,
            limit: options.limit,
          });
        },
        onQueryResult: (value) => {
          const result = value as { items: SearchRepo[]; totalCount: number };
          liveEditResult = result;
          currentRepos = applyResultSorting(result.items);
          totalCount = result.totalCount;
          if (process.stdout.isTTY) {
            process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
            printSearchTable(currentRepos, t, undefined, 0);
            process.stdout.write(`\n${t.paginationInfo(1, selectedNames.size)}\n`);
          }
        },
        onQueryError: () => console.error(t.searchFailed),
        onConditionsChange: async (conditions) => {
          options.lang = conditions.lang;
          if (!conditions.query.trim()) {
            currentRepos = [];
            totalCount = 0;
            return;
          }
          const result = await searchRepos(octokit, conditions.query, {
            lang: options.lang,
            sort: options.sort,
            limit: options.limit,
          });
          liveEditResult = result;
          currentRepos = applyResultSorting(result.items);
          totalCount = result.totalCount;
          if (process.stdout.isTTY) {
            process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
            printSearchTable(currentRepos, t, undefined, 0);
            process.stdout.write(`\n${t.paginationInfo(1, selectedNames.size)}\n`);
          }
        },
        onConditionsError: () => {
          liveEditError = true;
          liveEditResult = undefined;
          console.error(t.searchFailed);
        },
      });
      if (!edited) {
        console.log(t.aborted);
        return;
      }
      query = edited.query;
      options.lang = edited.lang;
      if (!query.trim()) {
        currentRepos = [];
        totalCount = 0;
        currentPage = 1;
        pageCache.clear();
        needsClear = true;
        continue;
      }
      if (liveEditError) {
        currentRepos = [];
        totalCount = 0;
        currentPage = 1;
        pageCache.clear();
        needsClear = true;
        continue;
      }
      if (config.searchUpdateMode === 'live' && liveEditResult) {
        currentRepos = applyResultSorting(liveEditResult.items);
        totalCount = liveEditResult.totalCount;
        currentPage = 1;
        pageCache.clear();
        pageCache.set(1, { items: currentRepos, totalCount });
        needsClear = true;
        if (currentRepos.length === 0) console.log(chalk.yellow(t.noReposFound));
        continue;
      }
      const editSpinner = ora(t.searchSearching).start();
      try {
        const result = await searchRepos(octokit, query, {
          lang: options.lang,
          sort: options.sort,
          limit: options.limit,
        });
        currentRepos = applyResultSorting(result.items);
        totalCount = result.totalCount;
        editSpinner.succeed(t.searchFound(totalCount));
      } catch (e) {
        editSpinner.fail(t.searchFailed);
        throw e;
      }
      currentPage = 1;
      pageCache.clear();
      pageCache.set(1, { items: currentRepos, totalCount });
      needsClear = true;
      if (currentRepos.length === 0) {
        console.log(chalk.yellow(t.noReposFound));
      }
    } else if (action === 'next' || action === 'prev') {
      needsClear = true;
      const targetPage = action === 'next' ? currentPage + 1 : currentPage - 1;

      const cached = pageCache.get(targetPage);
      if (cached) {
        currentRepos = cached.items;
        totalCount = cached.totalCount;
        currentPage = targetPage;
      } else {
        const pageSpinner = ora(t.searchSearching).start();
        try {
          const result = await searchRepos(octokit, query as string, {
            lang: options.lang,
            sort: options.sort,
            limit: options.limit,
            page: targetPage,
          });
          currentRepos = applyResultSorting(result.items);
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

        currentRepos = applyResultSorting(currentRepos);

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
      await starRepo(octokit, owner, repoName);
      repoSpinner.succeed(label);
    } catch (e) {
      repoSpinner.fail(`Failed to star ${repo.full_name}`);
      throw e;
    }
  }

  clearCache();
  console.log(chalk.green(t.searchStarred(allSelected.length)));
}
