import inquirer from 'inquirer';
import type { StarredRepo } from '../types/github.js';

export async function selectRepo(repos: StarredRepo[]): Promise<StarredRepo | null> {
  try {
    const choices = repos.map((repo) => ({
      name: `${repo.full_name} (${repo.language || 'Unknown'})`,
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
