import { createDeviceCode, exchangeDeviceCode } from '@octokit/oauth-methods';
import chalk from 'chalk';
import { exitWithError } from './error.js';
import { deleteToken, loadToken, saveToken } from './keyring.js';
import { openInBrowser } from './system.js';

/**
 * GitHub OAuth App client ID (Device Flow enabled, scope: public_repo +
 * offline_access). Per GitHub's official Device Flow docs, the client ID
 * is not a secret and is safe to embed in a distributed client (no
 * client_secret is required for the Device Flow, nor for refreshing a
 * token that the Device Flow issued). Register the app at
 * https://github.com/settings/developers and replace this placeholder
 * before publishing.
 */
const GITHUB_CLIENT_ID = 'REPLACE_WITH_REGISTERED_OAUTH_APP_CLIENT_ID';

/**
 * `offline_access` opts this individual sign-in into an expiring access
 * token + refresh token, regardless of whether the OAuth App itself is
 * configured to require expiring tokens (see GitHub's "Authorizing OAuth
 * apps" docs, "Opting in to expiring tokens at runtime").
 */
const SCOPES = ['public_repo', 'offline_access'];

/** Refresh a little before the real expiry to avoid racing a request. */
const EXPIRY_SAFETY_MARGIN_MS = 60_000;

interface StoredAuth {
  token: string;
  refreshToken?: string;
  /** ISO 8601. Absent means the token does not expire. */
  expiresAt?: string;
  refreshTokenExpiresAt?: string;
}

/**
 * `@octokit/oauth-methods`'s response type for an OAuth App device-code
 * exchange only declares { access_token, scope, token_type } — it doesn't
 * model the `refresh_token`/`expires_in`/`refresh_token_expires_in`
 * fields GitHub actually returns when `offline_access` was requested
 * (confirmed against GitHub's official docs and by inspecting the raw
 * response at runtime; the library's own `authentication` convenience
 * object silently drops these fields for the "oauth-app" client type,
 * which is why this code reads `result.data` directly instead).
 */
interface OAuthAppTokenResponseWithOptionalRefresh {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
}

function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function oauthErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('response' in error)) return undefined;
  const response = (error as { response?: unknown }).response;
  if (typeof response !== 'object' || response === null || !('data' in response)) return undefined;
  const data = (response as { data?: unknown }).data;
  if (typeof data !== 'object' || data === null || !('error' in data)) return undefined;
  const code = (data as { error?: unknown }).error;
  return typeof code === 'string' ? code : undefined;
}

function parseStoredAuth(raw: string | null): StoredAuth | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as { token?: unknown }).token === 'string'
    ) {
      return parsed as StoredAuth;
    }
    return null;
  } catch {
    return null;
  }
}

function toStoredAuth(
  data: OAuthAppTokenResponseWithOptionalRefresh,
  serverDateHeader: string | undefined,
): StoredAuth {
  const stored: StoredAuth = { token: data.access_token };

  if (
    data.refresh_token &&
    typeof data.expires_in === 'number' &&
    typeof data.refresh_token_expires_in === 'number'
  ) {
    const apiTimeMs = serverDateHeader ? new Date(serverDateHeader).getTime() : Number.NaN;
    const base = Number.isNaN(apiTimeMs) ? Date.now() : apiTimeMs;
    stored.refreshToken = data.refresh_token;
    stored.expiresAt = new Date(base + data.expires_in * 1000).toISOString();
    stored.refreshTokenExpiresAt = new Date(
      base + data.refresh_token_expires_in * 1000,
    ).toISOString();
  }

  return stored;
}

export async function login(): Promise<void> {
  const { data: verification } = await createDeviceCode({
    clientType: 'oauth-app',
    clientId: GITHUB_CLIENT_ID,
    scopes: SCOPES,
  });

  console.log(chalk.cyan('To authenticate, visit:'), verification.verification_uri);
  console.log(chalk.cyan('And enter code:'), chalk.bold(verification.user_code));
  openInBrowser(verification.verification_uri);

  let interval = verification.interval;
  const deadline = Date.now() + verification.expires_in * 1000;
  let stored: StoredAuth | undefined;

  while (!stored) {
    if (Date.now() > deadline) {
      exitWithError('GitHub authentication timed out. Run: stela auth login');
    }
    await sleep(interval);

    try {
      const result = await exchangeDeviceCode({
        clientType: 'oauth-app',
        clientId: GITHUB_CLIENT_ID,
        code: verification.device_code,
      });
      stored = toStoredAuth(
        result.data as OAuthAppTokenResponseWithOptionalRefresh,
        result.headers.date,
      );
    } catch (error) {
      const code = oauthErrorCode(error);
      if (code === 'authorization_pending') continue;
      if (code === 'slow_down') {
        interval += 5;
        continue;
      }
      exitWithError(`GitHub authentication failed: ${code ?? toErrorMessage(error)}`);
    }
  }

  saveToken(JSON.stringify(stored));
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

/** Whether a session is stored, without refreshing it. Safe to call synchronously. */
export function getStoredToken(): string | null {
  return parseStoredAuth(loadToken())?.token ?? null;
}

/**
 * Refreshing a token isn't a GitHub REST API operation (it's a call to
 * GitHub's OAuth authorization server at github.com, not api.github.com),
 * so it doesn't go through lib/octokit.ts. `@octokit/oauth-methods`'s own
 * `refreshToken()` helper can't be used here either: its type signature
 * requires `clientType: "github-app"` and a mandatory `clientSecret`,
 * which this OAuth App (a public client using the Device Flow) never
 * has — per GitHub's docs, client_secret is "Required unless the token
 * was generated using the device flow". A plain fetch matches exactly
 * what GitHub's own docs show for this endpoint.
 */
async function refreshAccessToken(stored: StoredAuth): Promise<StoredAuth> {
  if (!stored.refreshToken) {
    exitWithError('Stored GitHub session cannot be refreshed. Run: stela auth login');
  }

  let response: Response;
  try {
    response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        grant_type: 'refresh_token',
        refresh_token: stored.refreshToken,
      }),
    });
  } catch (error) {
    exitWithError(
      `Failed to refresh GitHub session: ${toErrorMessage(error)}. Run: stela auth login`,
    );
  }

  const data = (await response.json()) as {
    error?: string;
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    refresh_token_expires_in?: number;
  };

  if (
    !response.ok ||
    data.error ||
    !data.access_token ||
    !data.refresh_token ||
    typeof data.expires_in !== 'number' ||
    typeof data.refresh_token_expires_in !== 'number'
  ) {
    exitWithError(
      `GitHub rejected the refresh token (${data.error ?? 'incomplete response'}). Run: stela auth login`,
    );
  }

  const refreshed = toStoredAuth(
    {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      refresh_token_expires_in: data.refresh_token_expires_in,
    },
    response.headers.get('date') ?? undefined,
  );
  saveToken(JSON.stringify(refreshed));
  return refreshed;
}

/**
 * Returns a valid access token, transparently refreshing it first if it
 * has (or is about to) expire. Exits with an error if there is no stored
 * session, or if refreshing fails.
 */
export async function requireToken(): Promise<string> {
  const stored = parseStoredAuth(loadToken());
  if (!stored) {
    exitWithError('Not logged in. Run: stela auth login');
  }

  if (!stored.expiresAt) {
    return stored.token;
  }

  const expiresAtMs = new Date(stored.expiresAt).getTime();
  if (Date.now() < expiresAtMs - EXPIRY_SAFETY_MARGIN_MS) {
    return stored.token;
  }

  if (
    stored.refreshTokenExpiresAt &&
    Date.now() >= new Date(stored.refreshTokenExpiresAt).getTime()
  ) {
    exitWithError('GitHub session has fully expired. Run: stela auth login');
  }

  const refreshed = await refreshAccessToken(stored);
  return refreshed.token;
}
