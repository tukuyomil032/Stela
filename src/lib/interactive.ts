import {
  autocompleteMultiselect,
  confirm as clackConfirm,
  intro,
  isCancel,
  multiselect,
  select,
  text,
} from '@clack/prompts';
import chalk from 'chalk';
import gradient from 'gradient-string';
import type { SearchRepo, StarredRepo } from '../types/github.js';
import type { Messages } from './i18n.js';
import { colorizeLanguage, LANGUAGE_COLORS } from './languageColors.js';
import type { MultiSortConfig, SortCriteria, SortField, SortOrder, SortPreset } from './sort.js';

function showHeader(): void {
  console.log('');
  intro(gradient.cristal('★ stela — GitHub Star Manager'));
}

export async function selectRepo(repos: StarredRepo[]): Promise<StarredRepo | null> {
  const options = repos.map((repo, idx) => ({
    label: `${chalk.dim(`#${idx + 1}`)} ${chalk.bold(repo.full_name)}`,
    hint:
      colorizeLanguage(repo.language) +
      '  ' +
      chalk.yellow('★') +
      chalk.green(String(repo.stargazers_count)),
    value: repo.full_name,
  }));

  const selected = await select({
    message: 'Select a repository:',
    options,
  });

  if (isCancel(selected)) return null;
  return repos.find((repo) => repo.full_name === selected) || null;
}

export async function confirm(message: string): Promise<boolean> {
  const result = await clackConfirm({ message, initialValue: false });
  if (isCancel(result)) return false;
  return result as boolean;
}

export async function selectMultipleRepos(
  repos: SearchRepo[],
  preSelected?: string[],
): Promise<SearchRepo[]> {
  const options = repos.map((repo, idx) => ({
    label: `${chalk.dim(`#${idx + 1}`)} ${chalk.bold(repo.full_name)}`,
    hint:
      colorizeLanguage(repo.language) +
      '  ' +
      chalk.yellow('★') +
      chalk.green(String(repo.stargazers_count)) +
      '  ' +
      chalk.magenta('⎇') +
      chalk.magenta(String(repo.forks_count)),
    value: repo.full_name,
  }));

  const selected = await multiselect({
    message: 'Select repositories to star (space to toggle, enter to confirm):',
    options,
    required: false,
    initialValues: preSelected,
  });

  if (isCancel(selected)) return [];
  return repos.filter((repo) => (selected as string[]).includes(repo.full_name));
}

export type ListAction = 'browser' | 'clipboard' | 'unstar';

export async function selectMultipleStarredRepos(repos: StarredRepo[]): Promise<StarredRepo[]> {
  const options = repos.map((repo, idx) => ({
    label: `${chalk.dim(`#${idx + 1}`)} ${chalk.bold(repo.full_name)}`,
    hint:
      colorizeLanguage(repo.language) +
      '  ' +
      chalk.yellow('★') +
      chalk.green(String(repo.stargazers_count)),
    value: repo.full_name,
  }));

  const selected = await multiselect({
    message: 'Select repositories (space to toggle, enter to confirm):',
    options,
    required: false,
  });

  if (isCancel(selected)) return [];
  return repos.filter((repo) => (selected as string[]).includes(repo.full_name));
}

export async function selectListAction(): Promise<ListAction | null> {
  const action = await select({
    message: 'Choose an action:',
    options: [
      { label: 'Open in browser', value: 'browser' },
      { label: 'Copy URL to clipboard', value: 'clipboard' },
      { label: 'Unstar selected', value: 'unstar' },
    ],
  });

  if (isCancel(action)) return null;
  return action as ListAction;
}

export type PageAction = 'select' | 'next' | 'prev' | 'done';

export async function selectPageAction(
  t: Messages,
  currentPage: number,
  hasNextPage: boolean,
): Promise<PageAction | null> {
  const options: { label: string; value: PageAction }[] = [
    { label: t.paginationSelect, value: 'select' },
  ];
  if (hasNextPage) {
    options.push({ label: t.paginationNext, value: 'next' });
  }
  if (currentPage > 1) {
    options.push({ label: t.paginationPrev, value: 'prev' });
  }
  options.push({ label: t.paginationDone, value: 'done' });

  const action = await select({
    message: t.paginationPrompt(currentPage),
    options,
  });

  if (isCancel(action)) return null;
  return action as PageAction;
}

export interface SearchWizardResult {
  query: string;
  lang?: string[];
  limit: number;
  multiSort: MultiSortConfig;
}

const ALL_LANGUAGES = Object.keys(LANGUAGE_COLORS).sort();

export async function searchWizard(t: Messages): Promise<SearchWizardResult | null> {
  showHeader();

  const mode = await select({
    message: t.wizardModePrompt,
    options: [
      { label: t.wizardModePreset, value: 'preset' },
      { label: t.wizardModeCustom, value: 'custom' },
    ],
  });
  if (isCancel(mode)) return null;

  let multiSort: MultiSortConfig = {};
  let query = '';
  let lang: string[] | undefined;
  let limit = 30;

  const langOptions = ALL_LANGUAGES.map((l) => ({ label: colorizeLanguage(l), value: l }));

  if (mode === 'preset') {
    const preset = await select({
      message: t.wizardPresetPrompt,
      options: [
        { label: t.wizardPresetHotNew, value: 'hot-new' },
        { label: t.wizardPresetClassic, value: 'classic' },
        { label: t.wizardPresetRecent, value: 'recent' },
        { label: t.wizardPresetHiddenGems, value: 'hidden-gems' },
      ],
    });
    if (isCancel(preset)) return null;
    multiSort = { preset: preset as SortPreset };

    const queryResult = await text({ message: t.wizardQueryPrompt });
    if (isCancel(queryResult)) return null;
    query = (queryResult as string).trim();

    const langResult = await autocompleteMultiselect({
      message: t.wizardLangPrompt,
      options: langOptions,
      required: false,
    });
    if (isCancel(langResult)) return null;
    const selectedLangs = langResult as string[];
    lang = selectedLangs.length > 0 ? selectedLangs : undefined;

    const limitResult = await text({
      message: t.wizardLimitPrompt,
      defaultValue: '30',
      validate: (v) => {
        const n = parseInt(v ?? '', 10);
        if (Number.isNaN(n) || n < 1 || n > 200) return 'Enter a number between 1 and 200';
      },
    });
    if (isCancel(limitResult)) return null;
    limit = parseInt((limitResult as string) ?? '30', 10);
  } else {
    const queryResult = await text({ message: t.wizardQueryPrompt });
    if (isCancel(queryResult)) return null;
    query = (queryResult as string).trim();

    const langResult = await autocompleteMultiselect({
      message: t.wizardLangPrompt,
      options: langOptions,
      required: false,
    });
    if (isCancel(langResult)) return null;
    const selectedLangs = langResult as string[];
    lang = selectedLangs.length > 0 ? selectedLangs : undefined;

    const sortFieldOptions = [
      { label: 'Stars', value: 'stars' },
      { label: 'Updated', value: 'updated' },
      { label: 'Forks', value: 'forks' },
    ];
    const sortOrderOptions = [
      { label: 'Descending (high → low)', value: 'desc' },
      { label: 'Ascending (low → high)', value: 'asc' },
    ];

    const sort1Field = await select({
      message: t.wizardSortFieldPrompt,
      options: sortFieldOptions,
    });
    if (isCancel(sort1Field)) return null;

    const sort1Order = await select({
      message: t.wizardSortOrderPrompt,
      options: sortOrderOptions,
    });
    if (isCancel(sort1Order)) return null;

    const criteria: SortCriteria[] = [
      { field: sort1Field as SortField, order: sort1Order as SortOrder, weight: 1.0 },
    ];

    const addSort2 = await clackConfirm({ message: t.wizardSort2Prompt, initialValue: false });
    if (isCancel(addSort2)) return null;

    if (addSort2) {
      const sort2Field = await select({
        message: t.wizardSortFieldPrompt,
        options: sortFieldOptions,
      });
      if (isCancel(sort2Field)) return null;

      const sort2Order = await select({
        message: t.wizardSortOrderPrompt,
        options: sortOrderOptions,
      });
      if (isCancel(sort2Order)) return null;

      criteria[0].weight = 0.6;
      criteria.push({
        field: sort2Field as SortField,
        order: sort2Order as SortOrder,
        weight: 0.4,
      });
    }

    multiSort = { criteria };

    const limitResult = await text({
      message: t.wizardLimitPrompt,
      defaultValue: '30',
      validate: (v) => {
        const n = parseInt(v ?? '', 10);
        if (Number.isNaN(n) || n < 1 || n > 200) return 'Enter a number between 1 and 200';
      },
    });
    if (isCancel(limitResult)) return null;
    limit = parseInt((limitResult as string) ?? '30', 10);
  }

  return { query, lang, limit, multiSort };
}

export interface ListWizardResult {
  sort?: string;
  lang?: string[];
}

export async function listWizard(
  t: Messages,
  repos: StarredRepo[],
): Promise<ListWizardResult | null> {
  showHeader();

  const sort = await select({
    message: t.listWizardSortPrompt,
    options: [
      { label: t.listWizardSortStars, value: 'stars' },
      { label: t.listWizardSortUpdated, value: 'updated' },
      { label: t.listWizardSortDefault, value: '' },
    ],
  });
  if (isCancel(sort)) return null;

  const langs = [
    ...new Set(repos.map((r) => r.language).filter((l): l is string => l !== null)),
  ].sort();

  const langOptions = langs.map((l) => ({ label: colorizeLanguage(l), value: l }));

  const langResult = await autocompleteMultiselect({
    message: t.listWizardLangPrompt,
    options: langOptions,
    required: false,
  });
  if (isCancel(langResult)) return null;
  const selectedLangs = langResult as string[];

  return {
    sort: (sort as string) || undefined,
    lang: selectedLangs.length > 0 ? selectedLangs : undefined,
  };
}

export async function selectCacheAction(t: Messages): Promise<'clear' | 'status' | null> {
  showHeader();

  const action = await select({
    message: t.cacheSelectPrompt,
    options: [
      { label: t.cacheActionStatus, value: 'status' },
      { label: t.cacheActionClear, value: 'clear' },
    ],
  });

  if (isCancel(action)) return null;
  return action as 'clear' | 'status';
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
  showHeader();

  const key = await select({
    message: t.configWizardKey,
    options: [
      { label: `cacheTTL (current: ${currentConfig.cacheTTL})`, value: 'cacheTTL' },
      { label: `pageSize (current: ${currentConfig.pageSize})`, value: 'pageSize' },
      { label: `lang (current: ${currentConfig.lang})`, value: 'lang' },
    ],
  });
  if (isCancel(key)) return;

  const value = await text({ message: t.configInputValue });
  if (isCancel(value)) return;

  onSet(key as string, (value as string).trim());
}
