import chalk from 'chalk';
import type { StarredRepo } from '../types/github.js';

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getColumnWidths(repos: StarredRepo[]): {
  name: number;
  language: number;
  stars: number;
  date: number;
} {
  let nameWidth = 'Repository'.length;
  let languageWidth = 'Language'.length;
  let starsWidth = 'Stars'.length;
  let dateWidth = 'Updated'.length;

  repos.forEach((repo) => {
    nameWidth = Math.max(nameWidth, repo.full_name.length);
    languageWidth = Math.max(languageWidth, repo.language ? repo.language.length : 1);
    starsWidth = Math.max(starsWidth, String(repo.stargazers_count).length + 2);
    dateWidth = Math.max(dateWidth, formatDate(repo.updated_at).length);
  });

  return { name: nameWidth, language: languageWidth, stars: starsWidth, date: dateWidth };
}

function padRight(str: string, width: number): string {
  return str + ' '.repeat(Math.max(0, width - str.length));
}

export function printTable(repos: StarredRepo[]): void {
  if (repos.length === 0) {
    console.log('No repositories found.');
    return;
  }

  const widths = getColumnWidths(repos);

  const headerLine =
    padRight('Repository', widths.name) +
    '  ' +
    padRight('Language', widths.language) +
    '  ' +
    padRight('Stars', widths.stars) +
    '  ' +
    padRight('Updated', widths.date);
  console.log(chalk.bold(headerLine));

  const separatorLine =
    padRight('-'.repeat(widths.name), widths.name) +
    '  ' +
    padRight('-'.repeat(widths.language), widths.language) +
    '  ' +
    padRight('-'.repeat(widths.stars), widths.stars) +
    '  ' +
    padRight('-'.repeat(widths.date), widths.date);
  console.log(separatorLine);

  repos.forEach((repo) => {
    const name = chalk.cyan(padRight(repo.full_name, widths.name));
    const language = chalk.yellow(padRight(repo.language ? repo.language : '-', widths.language));
    const stars = chalk.green(padRight(`★ ${repo.stargazers_count}`, widths.stars));
    const date = padRight(formatDate(repo.updated_at), widths.date);

    console.log(`${name}  ${language}  ${stars}  ${date}`);
  });
}
