import { createOAuthDeviceAuth } from '@octokit/auth-oauth-device';
import chalk from 'chalk';
import { exitWithError } from './error.js';
import { deleteToken, loadToken, saveToken } from './keyring.js';
import { openInBrowser } from './system.js';

/**
 * GitHub OAuth App client ID (Device Flow enabled, scope: public_repo).
 * Per GitHub's official Device Flow docs, the client ID is not a secret and
 * is safe to embed in a distributed client (no client_secret is required
 * for the Device Flow). Register the app at https://github.com/settings/developers
 * and replace this placeholder before publishing.
 */
const GITHUB_CLIENT_ID = 'REPLACE_WITH_REGISTERED_OAUTH_APP_CLIENT_ID';

const SCOPES = ['public_repo'];

export async function login(): Promise<void> {
  const auth = createOAuthDeviceAuth({
    clientType: 'oauth-app',
    clientId: GITHUB_CLIENT_ID,
    scopes: SCOPES,
    onVerification(verification) {
      console.log(chalk.cyan('To authenticate, visit:'), verification.verification_uri);
      console.log(chalk.cyan('And enter code:'), chalk.bold(verification.user_code));
      openInBrowser(verification.verification_uri);
    },
  });

  let token: string;
  try {
    const authentication = await auth({ type: 'oauth' });
    token = authentication.token;
  } catch (error) {
    exitWithError(
      `GitHub authentication failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  saveToken(token);
  console.log(chalk.green('✓ Logged in to GitHub'));
}

export function logout(): void {
  const deleted = deleteToken();
  if (deleted) {
    console.log(chalk.green('✓ Logged out'));
  } else {
    console.log(chalk.yellow('No stored GitHub session found.'));
  }
}

export function getStoredToken(): string | null {
  return loadToken();
}

export function requireToken(): string {
  const token = getStoredToken();
  if (!token) {
    exitWithError('Not logged in. Run: stela auth login');
  }
  return token;
}
