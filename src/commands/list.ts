import chalk from 'chalk';
import { Presets, SingleBar } from 'cli-progress';
import ora from 'ora';
import { isCacheValid, loadCache, saveCache } from '../lib/cache.js';
import { loadConfig } from '../lib/config.js';
import { fetchAllStarred, unstarRepo } from '../lib/github.js';
import { confirm, selectListAction, selectMultipleStarredRepos } from '../lib/interactive.js';
import { copyToClipboard, openInBrowser } from '../lib/system.js';
import { printTable } from '../lib/table.js';
import type { StarredRepo } from '../types/github.js';

interface ListOptions {
  interactive: boolean;
  lang?: string;
  sort?: string;
  refresh: boolean;
}

export async function listCommand(options: ListOptions): Promise<void> {
  const config = loadConfig();

  let repos: StarredRepo[];

  if (!options.refresh && isCacheValid(config.cacheTTL)) {
    const cache = loadCache();
    repos = cache?.repos || [];
  } else {
    const { getToken } = await import('../lib/auth.js');
    const token = getToken();
    const bar = new SingleBar(
      {
        format: '取得中... {value} リポジトリ',
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
      console.log(chalk.green(`✓ Fetched ${repos.length} starred repositories`));
    } catch (e) {
      bar.stop();
      throw e;
    }
  }

  if (options.lang) {
    const lang = options.lang.toLowerCase();
    repos = repos.filter((r) => r.language?.toLowerCase() === lang);
  }

  if (options.sort === 'stars') {
    repos = repos.sort((a, b) => b.stargazers_count - a.stargazers_count);
  } else if (options.sort === 'updated') {
    repos = repos.sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
  }

  if (repos.length === 0) {
    console.log(chalk.yellow('No repositories found.'));
    return;
  }

  if (!options.interactive) {
    printTable(repos);
    return;
  }

  const selected = await selectMultipleStarredRepos(repos);
  if (selected.length === 0) {
    console.log(chalk.yellow('No repositories selected.'));
    return;
  }

  const action = await selectListAction();
  if (action === null) {
    console.log('Aborted.');
    return;
  }

  if (action === 'browser') {
    for (const repo of selected) {
      openInBrowser(repo.html_url);
    }
  } else if (action === 'clipboard') {
    const urls = selected.map((r) => r.html_url).join('\n');
    copyToClipboard(urls);
    console.log(chalk.green(`✓ Copied ${selected.length} URL(s) to clipboard`));
  } else if (action === 'unstar') {
    const ok = await confirm(`Unstar ${selected.length} repositories?`);
    if (!ok) {
      console.log('Aborted.');
      return;
    }
    const { getToken } = await import('../lib/auth.js');
    const token = getToken();
    const succeeded: StarredRepo[] = [];
    for (const repo of selected) {
      const [owner, repoName] = repo.full_name.split('/');
      const spinner = ora(`Unstarring ${repo.full_name}...`).start();
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
    console.log(chalk.green(`✓ Unstarred ${succeeded.length} repositories`));
  }
}
