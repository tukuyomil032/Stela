import chalk from 'chalk';
import { loadConfig, saveConfig } from '../lib/config.js';
import { exitWithError } from '../lib/error.js';

export function configShowCommand(): void {
  const config = loadConfig();
  console.log(chalk.bold('Current configuration:'));
  console.log(`  cacheTTL:              ${chalk.cyan(String(config.cacheTTL))} minutes`);
  console.log(
    `  defaultLanguageFilter: ${chalk.cyan(config.defaultLanguageFilter.length > 0 ? config.defaultLanguageFilter.join(', ') : '(none)')}`,
  );
  console.log(`  pageSize:              ${chalk.cyan(String(config.pageSize))}`);
}

export function configSetCommand(key: string, value: string): void {
  const config = loadConfig();

  switch (key) {
    case 'cacheTTL': {
      const num = Number(value);
      if (Number.isNaN(num) || num <= 0) {
        exitWithError(`cacheTTL must be a positive number`);
      }
      config.cacheTTL = num;
      break;
    }
    case 'defaultLanguageFilter': {
      config.defaultLanguageFilter = value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      break;
    }
    case 'pageSize': {
      const num = Number(value);
      if (Number.isNaN(num) || num <= 0) {
        exitWithError(`pageSize must be a positive number`);
      }
      config.pageSize = num;
      break;
    }
    default:
      exitWithError(
        `Unknown config key: "${key}". Valid keys: cacheTTL, defaultLanguageFilter, pageSize`,
      );
  }

  saveConfig(config);
  console.log(chalk.green(`✓ Set ${key} = ${value}`));
}
