import * as readline from 'node:readline';
import {
  autocompleteMultiselect,
  confirm as clackConfirm,
  intro,
  isCancel,
  select,
  text,
} from '@clack/prompts';
import chalk from 'chalk';
import gradient from 'gradient-string';
import stringWidth from 'string-width';
import type { SearchRepo, StarredRepo } from '../types/github.js';
import type { Messages } from './i18n.js';
import { colorizeLanguage, LANGUAGE_COLORS } from './languageColors.js';
import { disableMouseTracking, enableMouseTracking, parseSgrMouseEvent } from './mouse.js';
import type { MultiSortConfig, SortCriteria, SortField, SortOrder, SortPreset } from './sort.js';

function wrapText(text: string, maxWidth: number): string[] {
  if (stringWidth(text) <= maxWidth) return [text];
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (current === '') {
      current = word;
    } else if (stringWidth(current) + 1 + stringWidth(word) <= maxWidth) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function customMultiselect<T extends { full_name: string; description: string | null }>(
  items: T[],
  message: string,
  renderLabel: (item: T, idx: number) => string,
  preSelected?: string[],
): Promise<T[]> {
  const selected = new Set<number>(
    preSelected
      ? items
          .map((item, i) => (preSelected.includes(item.full_name) ? i : -1))
          .filter((i) => i !== -1)
      : [],
  );

  let cursor = 0;
  let showDesc = false;
  let linesRendered = 0;
  const maxVisible = Math.min(items.length, 15);
  let scrollTop = 0;

  if (process.stdin.isTTY) {
    process.stdin.resume();
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
  }

  function clearRendered(): void {
    if (linesRendered > 0) {
      process.stdout.moveCursor(0, -linesRendered);
      process.stdout.clearScreenDown();
    }
  }

  function renderList(): void {
    const lines: string[] = [];
    lines.push('');
    lines.push(`  ${chalk.bold(message)}`);
    lines.push('');

    if (cursor < scrollTop) scrollTop = cursor;
    if (cursor >= scrollTop + maxVisible) scrollTop = cursor - maxVisible + 1;

    const end = Math.min(scrollTop + maxVisible, items.length);
    for (let i = scrollTop; i < end; i++) {
      const item = items[i];
      const isSelected = selected.has(i);
      const isCursor = i === cursor;

      const check = isSelected ? chalk.green('[✓]') : chalk.dim('[ ]');
      const arrow = isCursor ? chalk.cyan('→') : ' ';
      const label = renderLabel(item, i);
      lines.push(`  ${arrow} ${check} ${label}`);
    }

    if (items.length > maxVisible) {
      lines.push(
        chalk.dim(
          `  ... (${scrollTop + 1}-${Math.min(scrollTop + maxVisible, items.length)} / ${items.length})`,
        ),
      );
    }

    lines.push('');
    lines.push(
      chalk.dim(
        `  ${selected.size} selected | ↑↓/jk nav, space toggle, i desc, enter confirm, q cancel`,
      ),
    );
    lines.push('');

    const output = lines.join('\n');
    process.stdout.write(output);
    linesRendered = lines.length - 1;
  }

  function renderDescription(): void {
    const item = items[cursor];
    const lines: string[] = [];
    lines.push('');
    lines.push(`  ${chalk.bold('Description:')} ${chalk.cyan(item.full_name)}`);
    lines.push('');

    const rawDesc = item.description ?? '';
    if (rawDesc) {
      const wrapped = wrapText(rawDesc, 76);
      for (const line of wrapped) {
        lines.push(`  ${line}`);
      }
    } else {
      lines.push(`  ${chalk.dim('(No description.)')}`);
    }

    lines.push('');
    lines.push(chalk.dim('  Press i to return'));
    lines.push('');

    const output = lines.join('\n');
    process.stdout.write(output);
    linesRendered = lines.length - 1;
  }

  function render(): void {
    clearRendered();
    if (showDesc) {
      renderDescription();
    } else {
      renderList();
    }
  }

  return new Promise((resolve) => {
    function cleanup(): void {
      process.stdin.removeListener('keypress', onKeypress);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
        process.stdin.pause();
      }
    }

    function onKeypress(str: string, key: readline.Key): void {
      if (!key) return;
      if (key.ctrl && key.name === 'c') {
        clearRendered();
        cleanup();
        resolve([]);
        return;
      }

      if (showDesc) {
        if (str === 'i' || key.name === 'escape') {
          showDesc = false;
          render();
        }
        return;
      }

      if (key.name === 'up' || str === 'k') {
        cursor = Math.max(0, cursor - 1);
        render();
      } else if (key.name === 'down' || str === 'j') {
        cursor = Math.min(items.length - 1, cursor + 1);
        render();
      } else if (str === ' ') {
        if (selected.has(cursor)) selected.delete(cursor);
        else selected.add(cursor);
        render();
      } else if (str === 'i') {
        showDesc = true;
        render();
      } else if (key.name === 'return') {
        clearRendered();
        cleanup();
        resolve(Array.from(selected).map((i) => items[i]));
      } else if (key.name === 'escape' || str === 'q') {
        clearRendered();
        cleanup();
        resolve([]);
      }
    }

    process.stdin.on('keypress', onKeypress);
    render();
  });
}

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
  return customMultiselect(
    repos,
    'Select repositories to star (space=toggle, i=desc, enter=confirm):',
    (repo, idx) =>
      `${chalk.dim(`#${idx + 1}`)} ${chalk.bold(repo.full_name)}  ` +
      colorizeLanguage(repo.language) +
      '  ' +
      chalk.yellow('★') +
      chalk.green(String(repo.stargazers_count)) +
      '  ' +
      chalk.magenta('⎇') +
      chalk.magenta(String(repo.forks_count)),
    preSelected,
  );
}

export type ListAction = 'browser' | 'clipboard' | 'unstar';

export async function selectMultipleStarredRepos(
  repos: StarredRepo[],
  preSelected?: string[],
): Promise<StarredRepo[]> {
  return customMultiselect(
    repos,
    'Select repositories (space=toggle, i=desc, enter=confirm):',
    (repo, idx) =>
      `${chalk.dim(`#${idx + 1}`)} ${chalk.bold(repo.full_name)}  ` +
      colorizeLanguage(repo.language) +
      '  ' +
      chalk.yellow('★') +
      chalk.green(String(repo.stargazers_count)) +
      '  ' +
      chalk.magenta('⎇') +
      chalk.magenta(String(repo.forks_count)),
    preSelected,
  );
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
  onShiftClick?: (x: number, y: number) => void,
): Promise<PageAction | null> {
  const options: { label: string; value: PageAction }[] = [
    { label: t.paginationSelect, value: 'select' },
  ];
  if (hasNextPage) options.push({ label: t.paginationNext, value: 'next' });
  if (currentPage > 1) options.push({ label: t.paginationPrev, value: 'prev' });
  options.push({ label: t.paginationDone, value: 'done' });

  if (!process.stdin.isTTY) return null;

  let cursor = 0;
  let linesRendered = 0;

  function clearRendered(): void {
    if (linesRendered > 0) {
      process.stdout.moveCursor(0, -linesRendered);
      process.stdout.clearScreenDown();
    }
  }

  function render(): void {
    clearRendered();
    const lines: string[] = [];
    lines.push('');
    lines.push(`  ${chalk.cyan('◇')} ${chalk.dim(t.paginationPrompt(currentPage))}`);
    for (let i = 0; i < options.length; i++) {
      const active = i === cursor;
      const dot = active ? chalk.cyan('●') : chalk.dim('○');
      const label = active ? options[i].label : chalk.dim(options[i].label);
      lines.push(`  ${dot} ${label}`);
    }
    lines.push('');
    process.stdout.write(lines.join('\n'));
    linesRendered = lines.length - 1;
  }

  enableMouseTracking();
  render();

  return new Promise<PageAction | null>((resolve) => {
    process.stdin.resume();
    process.stdin.setRawMode(true);

    let settled = false;

    function cleanup(): void {
      if (settled) return;
      settled = true;
      process.stdin.removeListener('data', onData);
      try {
        process.stdin.setRawMode(false);
      } catch {
        /* noop */
      }
      disableMouseTracking();
      clearRendered();
    }

    function done(result: PageAction | null): void {
      cleanup();
      resolve(result);
    }

    function onData(buf: Buffer): void {
      if (settled) return;
      const str = buf.toString();

      const mouseEvent = parseSgrMouseEvent(str);
      if (mouseEvent) {
        if (mouseEvent.button === 0 && mouseEvent.shift && !mouseEvent.released && onShiftClick) {
          onShiftClick(mouseEvent.x, mouseEvent.y);
        }
        return;
      }

      if (str === '\x03') {
        done(null);
        return;
      }
      if (str === '\x1b') {
        done(null);
        return;
      }
      if (str === '\x1b[A') {
        cursor = Math.max(0, cursor - 1);
        render();
        return;
      }
      if (str === '\x1b[B') {
        cursor = Math.min(options.length - 1, cursor + 1);
        render();
        return;
      }
      if (str === '\r' || str === '\n') {
        done(options[cursor].value);
        return;
      }

      const num = Number.parseInt(str, 10);
      if (!Number.isNaN(num) && num >= 1 && num <= options.length) {
        done(options[num - 1].value);
      }
    }

    process.stdin.on('data', onData);
  });
}

export interface SearchWizardResult {
  query: string;
  lang?: string[];
  limit: number;
  multiSort: MultiSortConfig;
}

const ALL_LANGUAGES = Object.keys(LANGUAGE_COLORS).sort();

export async function searchWizard(
  t: Messages,
  defaultLimit = 30,
): Promise<SearchWizardResult | null> {
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
  let limit = defaultLimit;

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
      defaultValue: String(defaultLimit),
      validate: (v) => {
        const n = parseInt(v ?? '', 10);
        if (Number.isNaN(n) || n < 1 || n > 200) return 'Enter a number between 1 and 200';
      },
    });
    if (isCancel(limitResult)) return null;
    limit = parseInt((limitResult as string) ?? String(defaultLimit), 10);
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
      defaultValue: String(defaultLimit),
      validate: (v) => {
        const n = parseInt(v ?? '', 10);
        if (Number.isNaN(n) || n < 1 || n > 200) return 'Enter a number between 1 and 200';
      },
    });
    if (isCancel(limitResult)) return null;
    limit = parseInt((limitResult as string) ?? String(defaultLimit), 10);
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
