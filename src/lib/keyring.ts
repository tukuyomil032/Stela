import { Entry } from '@napi-rs/keyring';
import { exitWithError } from './error.js';

const SERVICE = 'stela';
const ACCOUNT = 'github-token';

/**
 * @napi-rs/keyring's sync Entry API (verified against the real macOS
 * Keychain backend, not just its .d.ts) returns `null`/`false` — it does
 * NOT throw — when there is simply no stored credential. Any exception
 * thrown here is therefore a genuine, unexpected keychain failure (e.g.
 * an Ambiguous match, or the platform's credential store being
 * unavailable), never a normal "not logged in" state, so it is always
 * surfaced and never swallowed.
 */
function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function saveToken(token: string): void {
  try {
    new Entry(SERVICE, ACCOUNT).setPassword(token);
  } catch (error) {
    exitWithError(`Failed to save GitHub token to the OS keychain: ${toErrorMessage(error)}`);
  }
}

export function loadToken(): string | null {
  try {
    return new Entry(SERVICE, ACCOUNT).getPassword();
  } catch (error) {
    exitWithError(`Failed to read GitHub token from the OS keychain: ${toErrorMessage(error)}`);
  }
}

export function deleteToken(): boolean {
  try {
    return new Entry(SERVICE, ACCOUNT).deletePassword();
  } catch (error) {
    exitWithError(`Failed to delete GitHub token from the OS keychain: ${toErrorMessage(error)}`);
  }
}
