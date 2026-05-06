import chalk from 'chalk';
import inquirer from 'inquirer';
import type { SearchRepo, StarredRepo } from '../types/github.js';
import type { Messages } from './i18n.js';
import { colorizeLanguage } from './languageColors.js';
import type { MultiSortConfig, SortCriteria, SortPreset } from './sort.js';

export async function selectRepo(repos: StarredRepo[]): Promise<StarredRepo | null> {
  try {
    const choices = repos.map((repo, idx) => ({
      name:
        chalk.dim(`#${idx + 1}`) +
        ' ' +
        chalk.bold(repo.full_name) +
        chalk.dim(' | ') +
        colorizeLanguage(repo.language) +
        chalk.dim(' | ') +
        chalk.yellow('★') +
        chalk.green(String(repo.stargazers_count)),
      value: repo.full_name,
    }));

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'selected',
        message: 'Select a repository:',
        choices,
      },
    ]);

    const selectedFullName = answers.selected;
    const selectedRepo = repos.find((repo) => repo.full_name === selectedFullName);

    return selectedRepo || null;
  } catch (error) {
    if (error instanceof Error && error.message.includes('User force closed')) {
      return null;
    }
    throw error;
  }
}

export async function confirm(message: string): Promise<boolean> {
  try {
    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message,
        default: false,
      },
    ]);

    return answers.confirmed as boolean;
  } catch (error) {
    if (error instanceof Error && error.message.includes('User force closed')) {
      return false;
    }
    throw error;
  }
}

export async function selectMultipleRepos(repos: SearchRepo[]): Promise<SearchRepo[]> {
  try {
    const choices = repos.map((repo, idx) => ({
      name:
        chalk.dim(`#${idx + 1}`) +
        ' ' +
        chalk.bold(repo.full_name) +
        chalk.dim(' | ') +
        colorizeLanguage(repo.language) +
        chalk.dim(' | ') +
        chalk.yellow('★') +
        chalk.green(String(repo.stargazers_count)),
      value: repo.full_name,
    }));

    const answers = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selected',
        message: 'Select repositories to star (space to toggle, enter to confirm):',
        choices,
      },
    ]);

    const selectedFullNames = answers.selected as string[];
    const selectedRepos = repos.filter((repo) => selectedFullNames.includes(repo.full_name));

    return selectedRepos;
  } catch (error) {
    if (error instanceof Error && error.message.includes('User force closed')) {
      return [];
    }
    throw error;
  }
}

export type ListAction = 'browser' | 'clipboard' | 'unstar';

export async function selectMultipleStarredRepos(repos: StarredRepo[]): Promise<StarredRepo[]> {
  try {
    const choices = repos.map((repo, idx) => ({
      name:
        chalk.dim(`#${idx + 1}`) +
        ' ' +
        chalk.bold(repo.full_name) +
        chalk.dim(' | ') +
        colorizeLanguage(repo.language) +
        chalk.dim(' | ') +
        chalk.yellow('★') +
        chalk.green(String(repo.stargazers_count)),
      value: repo.full_name,
    }));

    const answers = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selected',
        message: 'Select repositories (space to toggle, enter to confirm):',
        choices,
      },
    ]);

    const selectedFullNames = answers.selected as string[];
    return repos.filter((repo) => selectedFullNames.includes(repo.full_name));
  } catch (error) {
    if (error instanceof Error && error.message.includes('User force closed')) {
      return [];
    }
    throw error;
  }
}

export async function selectListAction(): Promise<ListAction | null> {
  try {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Choose an action:',
        choices: [
          { name: 'Open in browser', value: 'browser' },
          { name: 'Copy URL to clipboard', value: 'clipboard' },
          { name: 'Unstar selected', value: 'unstar' },
        ],
      },
    ]);
    return answers.action as ListAction;
  } catch (error) {
    if (error instanceof Error && error.message.includes('User force closed')) {
      return null;
    }
    throw error;
  }
}

export interface SearchWizardResult {
  query: string;
  lang?: string;
  limit: number;
  multiSort: MultiSortConfig;
}

export async function searchWizard(t: Messages): Promise<SearchWizardResult | null> {
  try {
    // Step 1: プリセット or カスタム選択
    const modeAnswer = await inquirer.prompt([
      {
        type: 'list',
        name: 'mode',
        message: t.wizardModePrompt,
        choices: [
          { name: t.wizardModePreset, value: 'preset' },
          { name: t.wizardModeCustom, value: 'custom' },
        ],
      },
    ]);

    let multiSort: MultiSortConfig = {};
    let query = '';
    let lang: string | undefined;
    let limit = 30;

    if (modeAnswer.mode === 'preset') {
      // Step 2: プリセット選択
      const presetAnswer = await inquirer.prompt([
        {
          type: 'list',
          name: 'preset',
          message: t.wizardPresetPrompt,
          choices: [
            { name: t.wizardPresetHotNew, value: 'hot-new' },
            { name: t.wizardPresetClassic, value: 'classic' },
            { name: t.wizardPresetRecent, value: 'recent' },
            { name: t.wizardPresetHiddenGems, value: 'hidden-gems' },
          ],
        },
      ]);
      multiSort = { preset: presetAnswer.preset as SortPreset };

      // Step 3: キーワード（任意）
      const qAnswer = await inquirer.prompt([
        {
          type: 'input',
          name: 'query',
          message: t.wizardQueryPrompt,
        },
      ]);
      query = qAnswer.query.trim();

      // Step 4: 言語フィルタ（任意）
      const langAnswer = await inquirer.prompt([
        {
          type: 'input',
          name: 'lang',
          message: t.wizardLangPrompt,
        },
      ]);
      lang = langAnswer.lang.trim() || undefined;

      // Step 5: 取得件数
      const limitAnswer = await inquirer.prompt([
        {
          type: 'input',
          name: 'limit',
          message: t.wizardLimitPrompt,
          default: '30',
          validate: (v: string) => {
            const n = parseInt(v, 10);
            return (!Number.isNaN(n) && n >= 1 && n <= 200) || 'Enter a number between 1 and 200';
          },
        },
      ]);
      limit = parseInt(limitAnswer.limit, 10);
    } else {
      // カスタムモード
      // Step 2: キーワード
      const qAnswer = await inquirer.prompt([
        {
          type: 'input',
          name: 'query',
          message: t.wizardQueryPrompt,
        },
      ]);
      query = qAnswer.query.trim();

      // Step 3: 言語フィルタ（任意）
      const langAnswer = await inquirer.prompt([
        {
          type: 'input',
          name: 'lang',
          message: t.wizardLangPrompt,
        },
      ]);
      lang = langAnswer.lang.trim() || undefined;

      // Step 4: ソート条件1
      const sort1Field = await inquirer.prompt([
        {
          type: 'list',
          name: 'field',
          message: t.wizardSortFieldPrompt,
          choices: [
            { name: 'Stars', value: 'stars' },
            { name: 'Updated', value: 'updated' },
            { name: 'Forks', value: 'forks' },
          ],
        },
      ]);
      const sort1Order = await inquirer.prompt([
        {
          type: 'list',
          name: 'order',
          message: t.wizardSortOrderPrompt,
          choices: [
            { name: 'Descending (high → low)', value: 'desc' },
            { name: 'Ascending (low → high)', value: 'asc' },
          ],
        },
      ]);

      const criteria: SortCriteria[] = [
        { field: sort1Field.field, order: sort1Order.order, weight: 1.0 },
      ];

      // Step 5: ソート条件2（任意）
      const addSort2 = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'add',
          message: t.wizardSort2Prompt,
          default: false,
        },
      ]);

      if (addSort2.add) {
        const sort2Field = await inquirer.prompt([
          {
            type: 'list',
            name: 'field',
            message: t.wizardSortFieldPrompt,
            choices: [
              { name: 'Stars', value: 'stars' },
              { name: 'Updated', value: 'updated' },
              { name: 'Forks', value: 'forks' },
            ],
          },
        ]);
        const sort2Order = await inquirer.prompt([
          {
            type: 'list',
            name: 'order',
            message: t.wizardSortOrderPrompt,
            choices: [
              { name: 'Descending (high → low)', value: 'desc' },
              { name: 'Ascending (low → high)', value: 'asc' },
            ],
          },
        ]);
        // 2条件の場合、それぞれ weight 0.6 / 0.4 に調整
        criteria[0].weight = 0.6;
        criteria.push({ field: sort2Field.field, order: sort2Order.order, weight: 0.4 });
      }

      multiSort = { criteria };

      // Step 6: 取得件数
      const limitAnswer = await inquirer.prompt([
        {
          type: 'input',
          name: 'limit',
          message: t.wizardLimitPrompt,
          default: '30',
          validate: (v: string) => {
            const n = parseInt(v, 10);
            return (!Number.isNaN(n) && n >= 1 && n <= 200) || 'Enter a number between 1 and 200';
          },
        },
      ]);
      limit = parseInt(limitAnswer.limit, 10);
    }

    return { query, lang, limit, multiSort };
  } catch (error) {
    if (error instanceof Error && error.message.includes('User force closed')) {
      return null;
    }
    throw error;
  }
}

export interface ListWizardResult {
  sort?: string;
  lang?: string;
}

export async function listWizard(t: Messages): Promise<ListWizardResult | null> {
  try {
    const sortAnswer = await inquirer.prompt([
      {
        type: 'list',
        name: 'sort',
        message: t.listWizardSortPrompt,
        choices: [
          { name: t.listWizardSortStars, value: 'stars' },
          { name: t.listWizardSortUpdated, value: 'updated' },
          { name: t.listWizardSortDefault, value: '' },
        ],
      },
    ]);

    const langAnswer = await inquirer.prompt([
      {
        type: 'input',
        name: 'lang',
        message: t.listWizardLangPrompt,
      },
    ]);

    return {
      sort: sortAnswer.sort || undefined,
      lang: langAnswer.lang.trim() || undefined,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('User force closed')) {
      return null;
    }
    throw error;
  }
}

export async function selectCacheAction(t: Messages): Promise<'clear' | 'status' | null> {
  try {
    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: t.cacheSelectPrompt,
        choices: [
          { name: t.cacheActionStatus, value: 'status' },
          { name: t.cacheActionClear, value: 'clear' },
        ],
      },
    ]);
    return answer.action as 'clear' | 'status';
  } catch (error) {
    if (error instanceof Error && error.message.includes('User force closed')) {
      return null;
    }
    throw error;
  }
}

export async function configWizard(
  t: Messages,
  currentConfig: {
    cacheTTL: number;
    defaultLanguageFilter: string[];
    pageSize: number;
    lang: string;
  },
  onSet: (key: string, value: string) => void,
): Promise<void> {
  try {
    const keyAnswer = await inquirer.prompt([
      {
        type: 'list',
        name: 'key',
        message: t.configWizardKey,
        choices: [
          { name: `cacheTTL (current: ${currentConfig.cacheTTL})`, value: 'cacheTTL' },
          { name: `pageSize (current: ${currentConfig.pageSize})`, value: 'pageSize' },
          { name: `lang (current: ${currentConfig.lang})`, value: 'lang' },
        ],
      },
    ]);

    const valueAnswer = await inquirer.prompt([
      {
        type: 'input',
        name: 'value',
        message: t.configInputValue,
      },
    ]);

    onSet(keyAnswer.key, valueAnswer.value.trim());
  } catch (error) {
    if (error instanceof Error && error.message.includes('User force closed')) {
      return;
    }
    throw error;
  }
}
