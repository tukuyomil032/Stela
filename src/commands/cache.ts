import chalk from 'chalk';
import { clearCache, loadCache } from '../lib/cache.js';
import { loadConfig } from '../lib/config.js';
import { createI18n } from '../lib/i18n.js';
import { selectCacheAction } from '../lib/interactive.js';

export function cacheClearCommand(): void {
  const config = loadConfig();
  const t = createI18n(config.lang);
  clearCache();
  console.log(chalk.green(t.cacheCleared));
}

export function cacheStatusCommand(): void {
  const cache = loadCache();
  const config = loadConfig();
  const t = createI18n(config.lang);

  if (!cache) {
    console.log(chalk.yellow(t.cacheNone));
    return;
  }

  const fetchedAt = new Date(cache.fetchedAt);
  const ageMs = Date.now() - fetchedAt.getTime();
  const ttlMs = config.cacheTTL * 60 * 1000;
  const remainingMs = ttlMs - ageMs;
  const isValid = remainingMs > 0;

  console.log(`Fetched:     ${chalk.cyan(fetchedAt.toLocaleString())}`);
  console.log(`Repos:       ${chalk.cyan(String(cache.repos.length))}`);
  console.log(`TTL:         ${chalk.cyan(String(config.cacheTTL))} minutes`);
  if (isValid) {
    const remainingMin = Math.ceil(remainingMs / 60000);
    console.log(`Status:      ${chalk.green(t.cacheValid(remainingMin))}`);
  } else {
    console.log(`Status:      ${chalk.red(t.cacheExpired)}`);
  }
}

export async function cacheWizardCommand(): Promise<void> {
  const config = loadConfig();
  const t = createI18n(config.lang);
  const action = await selectCacheAction(t);
  if (action === null) {
    console.log(t.aborted);
    return;
  }
  if (action === 'clear') {
    cacheClearCommand();
  } else {
    cacheStatusCommand();
  }
}
