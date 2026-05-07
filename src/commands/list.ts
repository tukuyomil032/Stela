import chalk from 'chalk';
import { Presets, SingleBar } from 'cli-progress';
import ora from 'ora';
import { isCacheValid, loadCache, saveCache } from '../lib/cache.js';
import { loadConfig } from '../lib/config.js';
import { fetchAllStarred, fetchLanguages, unstarRepo } from '../lib/github.js';
import { createI18n } from '../lib/i18n.js';
import {
  confirm,
  listWizard,
  selectListAction,
  selectMultipleStarredRepos,
} from '../lib/interactive.js';
import { bytesToBreakdown, formatLanguageBreakdown } from '../lib/languageColors.js';
import { copyToClipboard, openInBrowser } from '../lib/system.js';
import { printTable } from '../lib/table.js';
import type { StarredRepo } from '../types/github.js';

interface ListOptions {
  interactive: boolean;
  lang?: string | string[];
  sort?: string;
  refresh: boolean;
}

export async function listCommand(options: ListOptions): Promise<void> {
  const config = loadConfig();
  const t = createI18n(config.lang);

  let repos: StarredRepo[];

  if (!options.refresh && isCacheValid(config.cacheTTL)) {
    const cache = loadCache();
    repos = cache?.repos || [];
  } else {
    const { getToken } = await import('../lib/auth.js');
    const token = getToken();
    const bar = new SingleBar(
      {
        format: `${t.listFetching} {value}`,
        hideCursor: true,
      },
      Presets.shades_grey,
    );

    bar.start(Number.MAX_SAFE_INTEGER, 0);
    try {
      repos = await fetchAllStarred(token, (fetched) => {
        bar.update(fetched);
      });
      saveCache(repos);
      bar.stop();
      console.log(chalk.green(t.listFetched(repos.length)));
    } catch (e) {
      bar.stop();
      throw e;
    }
  }

  if (!options.lang && !options.sort && options.interactive) {
    const wizardResult = await listWizard(t, repos);
    if (wizardResult === null) {
      console.log(t.aborted);
      return;
    }
    if (wizardResult.lang) options.lang = wizardResult.lang;
    if (wizardResult.sort) options.sort = wizardResult.sort;
  }

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

  if (repos.length === 0) {
    console.log(chalk.yellow(t.noReposFound));
    return;
  }

  if (!options.interactive) {
    printTable(repos, t);
    return;
  }

  const selected = await selectMultipleStarredRepos(repos);
  if (selected.length === 0) {
    console.log(chalk.yellow(t.noReposSelected));
    return;
  }

  // Show language breakdown for selected repos
  const { getToken: getTokenForLang } = await import('../lib/auth.js');
  const tokenForLang = getTokenForLang();
  for (const repo of selected) {
    const [owner, repoName] = repo.full_name.split('/');
    const bytes = await fetchLanguages(tokenForLang, owner, repoName);
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
    for (const repo of selected) {
      openInBrowser(repo.html_url);
    }
  } else if (action === 'clipboard') {
    const urls = selected.map((r) => r.html_url).join('\n');
    copyToClipboard(urls);
    console.log(chalk.green(t.listCopied(selected.length)));
  } else if (action === 'unstar') {
    const ok = await confirm(t.listUnstarConfirm(selected.length));
    if (!ok) {
      console.log(t.aborted);
      return;
    }
    const { getToken } = await import('../lib/auth.js');
    const token = getToken();
    const succeeded: StarredRepo[] = [];
    for (const repo of selected) {
      const [owner, repoName] = repo.full_name.split('/');
      const spinner = ora(t.listUnstarring(repo.full_name)).start();
      try {
        await unstarRepo(token, owner, repoName);
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
