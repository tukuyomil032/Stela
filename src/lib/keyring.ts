import { Entry } from '@napi-rs/keyring';
import { exitWithError } from './error.js';

const SERVICE = 'stela';
const ACCOUNT = 'github-token';

function isNoEntryError(error: unknown): boolean {
  return error instanceof Error && /no\s*entry/i.test(error.message);
}

export function saveToken(token: string): void {
  try {
    new Entry(SERVICE, ACCOUNT).setPassword(token);
  } catch (error) {
    exitWithError(
      `Failed to save GitHub token to the OS keychain: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function loadToken(): string | null {
  try {
    return new Entry(SERVICE, ACCOUNT).getPassword();
  } catch (error) {
    if (isNoEntryError(error)) {
      return null;
    }
    exitWithError(
      `Failed to read GitHub token from the OS keychain: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function deleteToken(): boolean {
  try {
    return new Entry(SERVICE, ACCOUNT).deletePassword();
  } catch (error) {
    if (isNoEntryError(error)) {
      return false;
    }
    exitWithError(
      `Failed to delete GitHub token from the OS keychain: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
