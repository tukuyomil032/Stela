import chalk from 'chalk';
import { clearCache, loadCache } from '../lib/cache.js';
import { loadConfig } from '../lib/config.js';

export function cacheClearCommand(): void {
  clearCache();
  console.log(chalk.green('✓ Cache cleared'));
}

export function cacheStatusCommand(): void {
  const cache = loadCache();
  const config = loadConfig();

  if (!cache) {
    console.log(chalk.yellow('No cache found'));
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
    console.log(`Status:      ${chalk.green('valid')} (expires in ${remainingMin} min)`);
  } else {
    console.log(`Status:      ${chalk.red('expired')}`);
  }
}
