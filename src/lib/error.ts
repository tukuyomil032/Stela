import chalk from 'chalk';

export function exitWithError(message: string): never {
  console.error(chalk.red('Error:'), message);
  process.exit(1);
}
