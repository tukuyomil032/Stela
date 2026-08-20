import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { FakeEntry, resetFakeKeyring } from './testing/fakeKeyring.js';

const { saveToken, loadToken, deleteToken } = await import('./keyring.js');

const originalExit = process.exit;
let exitCode: number | undefined;

beforeEach(() => {
  resetFakeKeyring();
  exitCode = undefined;
  // biome-ignore lint/suspicious/noExplicitAny: overriding process.exit for testing exitWithError
  (process as any).exit = (code?: number) => {
    exitCode = code;
    throw new Error(`process.exit(${code})`);
  };
});

afterEach(() => {
  process.exit = originalExit;
});

describe('keyring wrapper', () => {
  test('saveToken then loadToken round-trips the value', () => {
    saveToken('gho_testtoken');
    expect(loadToken()).toBe('gho_testtoken');
  });

  test('loadToken returns null when nothing is stored (native API returns null, does not throw)', () => {
    expect(loadToken()).toBeNull();
  });

  test('deleteToken removes a stored token and returns true', () => {
    saveToken('gho_testtoken');
    expect(deleteToken()).toBe(true);
    expect(loadToken()).toBeNull();
  });

  test('deleteToken returns false when nothing is stored (native API returns false, does not throw)', () => {
    expect(deleteToken()).toBe(false);
  });

  test('loadToken exits with an error (does not silently swallow) on unexpected keychain failures', () => {
    FakeEntry.behavior = 'throw-on-get';
    expect(() => loadToken()).toThrow('process.exit(1)');
    expect(exitCode).toBe(1);
  });

  test('saveToken exits with an error on keychain write failures', () => {
    FakeEntry.behavior = 'throw-on-set';
    expect(() => saveToken('gho_testtoken')).toThrow('process.exit(1)');
    expect(exitCode).toBe(1);
  });

  test('deleteToken exits with an error on unexpected keychain failures', () => {
    FakeEntry.behavior = 'throw-on-delete';
    expect(() => deleteToken()).toThrow('process.exit(1)');
    expect(exitCode).toBe(1);
  });
});
