import chalk from 'chalk';
import { loadConfig, saveConfig } from '../lib/config.js';
import { exitWithError } from '../lib/error.js';
import { createI18n } from '../lib/i18n.js';
import { configWizard } from '../lib/interactive.js';

export function configShowCommand(): void {
  const config = loadConfig();
  const t = createI18n(config.lang);
  console.log(chalk.bold(t.configTitle));
  console.log(`  ${t.configCacheTTL}:              ${chalk.cyan(String(config.cacheTTL))} minutes`);
  console.log(
    `  ${t.configDefaultLang}: ${chalk.cyan(config.defaultLanguageFilter.length > 0 ? config.defaultLanguageFilter.join(', ') : '(none)')}`,
  );
  console.log(`  ${t.configPageSize}:              ${chalk.cyan(String(config.pageSize))}`);
  console.log(`  ${t.configLang}:                  ${chalk.cyan(config.lang)}`);
}

export function configSetCommand(key: string, value: string): void {
  const config = loadConfig();
  const t = createI18n(config.lang);

  switch (key) {
    case 'cacheTTL': {
      const num = Number(value);
      if (Number.isNaN(num) || num <= 0) {
        exitWithError(t.configInvalidTTL);
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
        exitWithError(t.configInvalidPageSize);
      }
      config.pageSize = num;
      break;
    }
    case 'lang': {
      if (value !== 'en' && value !== 'ja') {
        exitWithError(t.configInvalidLang);
      }
      config.lang = value as 'en' | 'ja';
      break;
    }
    default:
      exitWithError(t.configUnknownKey(key));
  }

  saveConfig(config);
  console.log(chalk.green(t.configSet(key, value)));
}

export async function configWizardCommand(): Promise<void> {
  const config = loadConfig();
  const t = createI18n(config.lang);
  await configWizard(t, config, (key, value) => {
    configSetCommand(key, value);
  });
}
