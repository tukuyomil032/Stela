import chalk from 'chalk';
import { getStoredToken, login, logout } from '../lib/auth.js';
import { exitWithError } from '../lib/error.js';
import { getOctokit } from '../lib/octokit.js';

export async function authLoginCommand(): Promise<void> {
  await login();
}

export function authLogoutCommand(): void {
  logout();
}

export async function authStatusCommand(): Promise<void> {
  const token = getStoredToken();
  if (!token) {
    console.log(chalk.yellow('Not logged in. Run: stela auth login'));
    return;
  }

  const octokit = await getOctokit();
  try {
    const { data: user } = await octokit.rest.users.getAuthenticated();
    console.log(chalk.green('✓ Logged in as'), chalk.bold(user.login));
  } catch (error) {
    exitWithError(
      `Stored token is no longer valid: ${error instanceof Error ? error.message : String(error)}. Run: stela auth login`,
    );
  }
}
