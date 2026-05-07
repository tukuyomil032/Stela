import chalk from 'chalk';
import gradient from 'gradient-string';
import stringWidth from 'string-width';
import type { SearchRepo, StarredRepo } from '../types/github.js';
import type { Messages } from './i18n.js';
import { colorizeLanguage } from './languageColors.js';

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function padRaw(rawStr: string, coloredStr: string, width: number): string {
  const padding = Math.max(0, width - stringWidth(rawStr));
  return coloredStr + ' '.repeat(padding);
}

function printBox(title: string): void {
  const inner = `  ${title}  `;
  const line = '═'.repeat(inner.length);
  console.log(gradient.cristal(`╔${line}╗`));
  console.log(gradient.cristal(`║${inner}║`));
  console.log(gradient.cristal(`╚${line}╝`));
}

export function printTable(repos: StarredRepo[], t: Messages): void {
  if (repos.length === 0) {
    console.log(t.noReposFound);
    return;
  }

  console.log('');
  printBox(`★ ${t.tableHeader(repos.length)}`);
  console.log('');

  let nameWidth = stringWidth(t.tableRepo);
  let langWidth = stringWidth(t.tableLang);
  let starsWidth = stringWidth(t.tableStars);
  let forksWidth = stringWidth(t.tableForks);
  let dateWidth = stringWidth(t.tableUpdated);

  for (const repo of repos) {
    nameWidth = Math.max(nameWidth, repo.full_name.length);
    langWidth = Math.max(langWidth, repo.language ? repo.language.length : 'unknown'.length);
    const starsRaw = repo.stargazers_count.toLocaleString();
    starsWidth = Math.max(starsWidth, starsRaw.length + 2);
    const forksRaw = repo.forks_count.toLocaleString();
    forksWidth = Math.max(forksWidth, forksRaw.length + 2);
    dateWidth = Math.max(dateWidth, formatDate(repo.updated_at).length);
  }

  const numWidth = 4;
  const gap = '   ';

  const headerNum = ' '.repeat(numWidth);
  const headerName = padRaw(t.tableRepo, chalk.bold(t.tableRepo), nameWidth);
  const headerLang = padRaw(t.tableLang, chalk.bold(t.tableLang), langWidth);
  const headerStars = padRaw(t.tableStars, chalk.bold(t.tableStars), starsWidth);
  const headerForks = padRaw(t.tableForks, chalk.bold(t.tableForks), forksWidth);
  const headerDate = chalk.bold(t.tableUpdated);
  console.log(
    `  ${headerNum}${gap}${headerName}${gap}${headerLang}${gap}${headerStars}${gap}${headerForks}${gap}${headerDate}`,
  );

  const sepWidth =
    numWidth +
    gap.length +
    nameWidth +
    gap.length +
    langWidth +
    gap.length +
    starsWidth +
    gap.length +
    forksWidth +
    gap.length +
    dateWidth;
  console.log(`  ${chalk.dim('─'.repeat(sepWidth))}`);

  repos.forEach((repo, idx) => {
    const numRaw = String(idx + 1);
    const numPadded = numRaw.padStart(numWidth);
    const numColored = chalk.dim(numPadded);

    const nameRaw = repo.full_name;
    const nameColored = padRaw(nameRaw, chalk.cyan(nameRaw), nameWidth);

    const langRaw = repo.language || 'unknown';
    const langColored = padRaw(langRaw, colorizeLanguage(repo.language), langWidth);

    const starsCount = repo.stargazers_count.toLocaleString();
    const starsRaw = `★ ${starsCount}`;
    const starsColored = padRaw(
      starsRaw,
      `${chalk.yellow('★')} ${chalk.green(starsCount)}`,
      starsWidth,
    );

    const forksCount = repo.forks_count.toLocaleString();
    const forksRaw = `⎇ ${forksCount}`;
    const forksColored = padRaw(
      forksRaw,
      `${chalk.magenta('⎇')} ${chalk.magenta(forksCount)}`,
      forksWidth,
    );

    const dateRaw = formatDate(repo.updated_at);
    const dateColored = chalk.dim(dateRaw);

    console.log(
      `  ${numColored}${gap}${nameColored}${gap}${langColored}${gap}${starsColored}${gap}${forksColored}${gap}${dateColored}`,
    );
  });

  console.log(`  ${chalk.dim('─'.repeat(sepWidth))}`);
  console.log(`  Total: ${repos.length} repositories`);
}

export function printSearchTable(repos: SearchRepo[], t: Messages, highlightTop?: number): void {
  if (repos.length === 0) {
    console.log(t.noReposFound);
    return;
  }

  console.log('');
  printBox(`🔍 ${t.tableSearchHeader}`);
  console.log('');

  let nameWidth = stringWidth(t.tableRepo);
  let langWidth = stringWidth(t.tableLang);
  let starsWidth = stringWidth(t.tableStars);
  let forksWidth = stringWidth(t.tableForks);
  let dateWidth = stringWidth(t.tableUpdated);

  for (const repo of repos) {
    nameWidth = Math.max(nameWidth, repo.full_name.length);
    langWidth = Math.max(langWidth, repo.language ? repo.language.length : 'unknown'.length);
    const starsRaw = repo.stargazers_count.toLocaleString();
    starsWidth = Math.max(starsWidth, starsRaw.length + 2);
    const forksRaw = repo.forks_count.toLocaleString();
    forksWidth = Math.max(forksWidth, forksRaw.length + 2);
    dateWidth = Math.max(dateWidth, formatDate(repo.updated_at).length);
  }

  const numWidth = 4;
  const gap = '   ';

  const headerNum = ' '.repeat(numWidth);
  const headerName = padRaw(t.tableRepo, chalk.bold(t.tableRepo), nameWidth);
  const headerLang = padRaw(t.tableLang, chalk.bold(t.tableLang), langWidth);
  const headerStars = padRaw(t.tableStars, chalk.bold(t.tableStars), starsWidth);
  const headerForks = padRaw(t.tableForks, chalk.bold(t.tableForks), forksWidth);
  const headerDate = chalk.bold(t.tableUpdated);
  console.log(
    `  ${headerNum}${gap}${headerName}${gap}${headerLang}${gap}${headerStars}${gap}${headerForks}${gap}${headerDate}`,
  );

  const sepWidth =
    numWidth +
    gap.length +
    nameWidth +
    gap.length +
    langWidth +
    gap.length +
    starsWidth +
    gap.length +
    forksWidth +
    gap.length +
    dateWidth;
  console.log(`  ${chalk.dim('─'.repeat(sepWidth))}`);

  const top = highlightTop ?? repos.length;

  repos.forEach((repo, idx) => {
    const rank = idx + 1;
    const numRaw = String(rank);
    const numPadded = numRaw.padStart(numWidth);
    const numColored = chalk.dim(numPadded);

    const nameRaw = repo.full_name;
    const langRaw = repo.language || 'unknown';
    const starsCount = repo.stargazers_count.toLocaleString();
    const starsRaw = `★ ${starsCount}`;
    const forksCount = repo.forks_count.toLocaleString();
    const forksRaw = `⎇ ${forksCount}`;
    const dateRaw = formatDate(repo.updated_at);

    const nameColored = padRaw(nameRaw, chalk.cyan(nameRaw), nameWidth);
    const langColored = padRaw(langRaw, colorizeLanguage(repo.language), langWidth);
    const starsColored = padRaw(
      starsRaw,
      `${chalk.yellow('★')} ${chalk.green(starsCount)}`,
      starsWidth,
    );
    const forksColored = padRaw(
      forksRaw,
      `${chalk.magenta('⎇')} ${chalk.magenta(forksCount)}`,
      forksWidth,
    );
    const dateColored = chalk.dim(dateRaw);

    const pfx = rank <= 3 && rank <= top ? '◆ ' : '  ';
    const content = `${numColored}${gap}${nameColored}${gap}${langColored}${gap}${starsColored}${gap}${forksColored}${gap}${dateColored}`;
    const fullLine = `${pfx}${content}`;

    if (rank <= 3 && rank <= top) {
      console.log(chalk.bold.yellow(fullLine));
    } else if (rank <= 6 && rank <= top) {
      console.log(chalk.bold(fullLine));
    } else if (rank <= 10 && rank <= top) {
      console.log(chalk.white(fullLine));
    } else {
      console.log(fullLine);
    }
  });

  console.log(`  ${chalk.dim('─'.repeat(sepWidth))}`);
}
