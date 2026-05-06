import chalk from 'chalk';
import { Presets, SingleBar } from 'cli-progress';
import { isCacheValid, loadCache, saveCache } from '../lib/cache.js';
import { loadConfig } from '../lib/config.js';
import { fetchAllStarred } from '../lib/github.js';
import { selectRepo } from '../lib/interactive.js';
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

  const selected = await selectRepo(repos);
  if (selected) {
    console.log(chalk.cyan(selected.html_url));
  }
}
