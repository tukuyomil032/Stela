import chalk from 'chalk';
import ora from 'ora';
import { isCacheValid, loadCache, saveCache } from '../lib/cache.js';
import { loadConfig } from '../lib/config.js';
import { filterStarredRepos } from '../lib/filter.js';
import { fetchAllStarred, fetchLanguages, unstarRepo } from '../lib/github.js';
import { createI18n } from '../lib/i18n.js';
import {
  confirm,
  listWizard,
  selectListAction,
  selectMultipleStarredRepos,
  selectPageAction,
} from '../lib/interactive.js';
import { bytesToBreakdown, formatLanguageBreakdown } from '../lib/languageColors.js';
import { getOctokit } from '../lib/octokit.js';
import { createFetchProgressRenderer } from '../lib/progress.js';
import { copyToClipboard, openInBrowser } from '../lib/system.js';
import { printTable } from '../lib/table.js';
import type { StarredRepo } from '../types/github.js';

interface ListOptions {
  keywords?: string[];
  interactive: boolean;
  lang?: string | string[];
  sort?: string;
  refresh: boolean;
}

export async function listCommand(options: ListOptions): Promise<void> {
  const config = loadConfig();
  const t = createI18n(config.lang);

  let repos: StarredRepo[];
  let octokit: Awaited<ReturnType<typeof getOctokit>> | undefined;
  async function ensureOctokit(): Promise<Awaited<ReturnType<typeof getOctokit>>> {
    if (!octokit) {
      octokit = await getOctokit();
    }
    return octokit;
  }

  if (!options.refresh && isCacheValid(config.cacheTTL)) {
    const cache = loadCache();
    repos = cache?.repos || [];
  } else {
    const fetchProgress = createFetchProgressRenderer(
      t.listFetching,
      chalk.level > 0,
      process.stderr,
    );
    try {
      repos = await fetchAllStarred(await ensureOctokit(), (fetched, _page, total) => {
        fetchProgress.update({ fetched, total });
      });
      saveCache(repos);
      fetchProgress.succeed(chalk.green(t.listFetched(repos.length)));
    } catch (e) {
      fetchProgress.fail();
      throw e;
    }
  }

  const allRepos = repos;
  let keywordQuery = options.keywords?.join(' ').trim() ?? '';
  let liveInitialQuery = '';

  if (!options.keywords && !options.lang && !options.sort && options.interactive) {
    const wizardResult = await listWizard(
      t,
      repos,
      '',
      undefined,
      undefined,
      config.searchUpdateMode === 'live'
        ? {
            mode: 'live' as const,
            onQueryChange: (nextQuery: string) => filterStarredRepos(allRepos, nextQuery),
            onQueryResult: (value: unknown, nextQuery: string) => {
              liveInitialQuery = nextQuery;
              if (process.stdout.isTTY) {
                process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
                printTable(value as StarredRepo[], t);
              }
            },
            onConditionsChange: ({ lang }: { lang?: string[] }) => {
              options.lang = lang;
              let filtered = filterStarredRepos(allRepos, liveInitialQuery);
              if (lang && lang.length > 0) {
                const selected = lang.map((value) => value.toLowerCase());
                filtered = filtered.filter(
                  (repo) => repo.language && selected.includes(repo.language.toLowerCase()),
                );
              }
              if (process.stdout.isTTY) {
                process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
                printTable(filtered, t);
              }
            },
          }
        : undefined,
    );
    if (wizardResult === null) {
      console.log(t.aborted);
      return;
    }
    if (wizardResult.lang) {
      options.lang = wizardResult.lang;
    }
    options.sort = wizardResult.sort || undefined;
    keywordQuery = wizardResult.query ?? '';
  }

  const applyListFilters = (): void => {
    repos = filterStarredRepos(allRepos, keywordQuery);
    if (options.lang) {
      const langs = Array.isArray(options.lang)
        ? options.lang.map((l) => l.toLowerCase())
        : [options.lang.toLowerCase()];
      repos = repos.filter((r) => r.language && langs.includes(r.language.toLowerCase()));
    }
    if (options.sort === 'stars') {
      repos = repos.sort((a, b) => b.stargazers_count - a.stargazers_count);
    } else if (options.sort === 'updated') {
      repos = repos.sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
    }
  };
  applyListFilters();

  if (repos.length === 0) {
    if (!options.interactive) {
      console.log(chalk.yellow(t.noReposFound));
      return;
    }
    while (repos.length === 0) {
      console.log(chalk.yellow(t.noReposFound));
      const currentLang = options.lang
        ? Array.isArray(options.lang)
          ? options.lang
          : [options.lang]
        : undefined;
      const retry = await listWizard(
        t,
        allRepos,
        keywordQuery,
        currentLang,
        options.sort,
        config.searchUpdateMode === 'live'
          ? {
              mode: 'live' as const,
              onQueryChange: (nextQuery: string) => filterStarredRepos(allRepos, nextQuery),
              onQueryResult: (value: unknown, nextQuery: string) => {
                keywordQuery = nextQuery;
                repos = value as StarredRepo[];
                applyListFilters();
                if (process.stdout.isTTY) {
                  process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
                  printTable(repos, t);
                }
              },
              onConditionsChange: ({ lang }: { lang?: string[] }) => {
                options.lang = lang;
                applyListFilters();
                if (process.stdout.isTTY) {
                  process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
                  printTable(repos, t);
                }
              },
            }
          : undefined,
      );
      if (!retry) {
        console.log(t.aborted);
        return;
      }
      keywordQuery = retry.query ?? '';
      options.lang = retry.lang;
      options.sort = retry.sort || undefined;
      applyListFilters();
    }
  }

  if (!options.interactive) {
    printTable(repos, t);
    return;
  }

  const perPage = config.pageSize;
  let currentPage = 1;
  const allSelected: StarredRepo[] = [];
  const selectedNames = new Set<string>();
  let needsClear = false;

  while (true) {
    const startIdx = (currentPage - 1) * perPage;
    const currentRepos = repos.slice(startIdx, startIdx + perPage);

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

    printTable(currentRepos, t, startIdx);
    console.log(chalk.dim(t.paginationInfo(currentPage, selectedNames.size)));

    const hasNextPage = currentPage * perPage < repos.length;
    const pageAction = await selectPageAction(t, currentPage, hasNextPage);

    if (pageAction === null) {
      console.log(t.aborted);
      return;
    }

    if (pageAction === 'select') {
      const preSelected = currentRepos
        .filter((r) => selectedNames.has(r.full_name))
        .map((r) => r.full_name);
      const pageSelected = await selectMultipleStarredRepos(currentRepos, preSelected);

      const currentPageNames = new Set(currentRepos.map((r) => r.full_name));
      const pageSelectedNames = new Set(pageSelected.map((r) => r.full_name));

      for (const name of currentPageNames) {
        if (!pageSelectedNames.has(name) && selectedNames.has(name)) {
          selectedNames.delete(name);
          const idx = allSelected.findIndex((r) => r.full_name === name);
          if (idx !== -1) {
            allSelected.splice(idx, 1);
          }
        }
      }
      for (const repo of pageSelected) {
        if (!selectedNames.has(repo.full_name)) {
          selectedNames.add(repo.full_name);
          allSelected.push(repo);
        }
      }
      needsClear = true;
    } else if (pageAction === 'next') {
      currentPage++;
      needsClear = true;
    } else if (pageAction === 'prev') {
      currentPage--;
      needsClear = true;
    } else if (pageAction === 'search') {
      const currentLang = options.lang
        ? Array.isArray(options.lang)
          ? options.lang
          : [options.lang]
        : undefined;
      const wizardResult = await listWizard(
        t,
        allRepos,
        keywordQuery,
        currentLang,
        options.sort,
        config.searchUpdateMode === 'live'
          ? {
              mode: 'live' as const,
              onQueryChange: (nextQuery: string) => filterStarredRepos(allRepos, nextQuery),
              onQueryResult: (value: unknown, nextQuery: string) => {
                keywordQuery = nextQuery;
                repos = value as StarredRepo[];
                applyListFilters();
                if (process.stdout.isTTY) {
                  process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
                  printTable(repos.slice(0, config.pageSize), t);
                  process.stdout.write(`\n${t.paginationInfo(1, selectedNames.size)}\n`);
                }
              },
              onConditionsChange: ({ lang }: { lang?: string[] }) => {
                options.lang = lang;
                applyListFilters();
                if (process.stdout.isTTY) {
                  process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
                  printTable(repos.slice(0, config.pageSize), t);
                  process.stdout.write(`\n${t.paginationInfo(1, selectedNames.size)}\n`);
                }
              },
            }
          : undefined,
      );
      if (wizardResult === null) {
        console.log(t.aborted);
        return;
      }
      keywordQuery = wizardResult.query ?? '';
      options.lang = wizardResult.lang;
      options.sort = wizardResult.sort || undefined;
      applyListFilters();
      currentPage = 1;
      needsClear = true;
      if (repos.length === 0) {
        console.log(chalk.yellow(t.noReposFound));
      }
    } else {
      break;
    }
  }

  if (allSelected.length === 0) {
    console.log(chalk.yellow(t.noReposSelected));
    return;
  }

  for (const repo of allSelected) {
    const [owner, repoName] = repo.full_name.split('/');
    const bytes = await fetchLanguages(await ensureOctokit(), owner, repoName);
    const breakdown = formatLanguageBreakdown(bytesToBreakdown(bytes));
    if (breakdown) {
      console.log(`  ${chalk.cyan(repo.full_name)} └─ ${breakdown}`);
    }
  }

  const action = await selectListAction();
  if (action === null) {
    console.log(t.aborted);
    return;
  }

  if (action === 'browser') {
    for (const repo of allSelected) {
      openInBrowser(repo.html_url);
      console.log(chalk.green('✓ ') + chalk.cyan(repo.html_url));
    }
  } else if (action === 'clipboard') {
    const urls = allSelected.map((r) => r.html_url).join('\n');
    copyToClipboard(urls);
    console.log(chalk.green(t.listCopied(allSelected.length)));
  } else if (action === 'unstar') {
    const ok = await confirm(t.listUnstarConfirm(allSelected.length));
    if (!ok) {
      console.log(t.aborted);
      return;
    }
    const succeeded: StarredRepo[] = [];
    for (const repo of allSelected) {
      const [owner, repoName] = repo.full_name.split('/');
      const spinner = ora(t.listUnstarring(repo.full_name)).start();
      try {
        await unstarRepo(await ensureOctokit(), owner, repoName);
        spinner.succeed(`Unstarred ${repo.full_name}`);
        succeeded.push(repo);
      } catch {
        spinner.fail(`Failed to unstar ${repo.full_name}`);
      }
    }
    const removedSet = new Set(succeeded.map((r) => r.full_name));
    const cache = loadCache();
    if (cache) {
      saveCache(cache.repos.filter((r) => !removedSet.has(r.full_name)));
    }
    console.log(chalk.green(t.listUnstarred(succeeded.length)));
  }
}
