import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { FakeEntry, resetFakeKeyring } from './testing/fakeKeyring.js';

mock.module('@napi-rs/keyring', () => ({ Entry: FakeEntry }));

const { getOctokit } = await import('./octokit.js');
const { saveToken } = await import('./keyring.js');

const originalExit = process.exit;

beforeEach(() => {
  resetFakeKeyring();
  // biome-ignore lint/suspicious/noExplicitAny: overriding process.exit for testing exitWithError
  (process as any).exit = (code?: number) => {
    throw new Error(`process.exit(${code})`);
  };
});

afterEach(() => {
  process.exit = originalExit;
});

describe('getOctokit', () => {
  test('propagates the not-logged-in failure instead of returning a client with no auth', () => {
    expect(() => getOctokit()).toThrow('process.exit(1)');
  });

  test('returns an authenticated Octokit instance backed by the stored token', () => {
    saveToken('gho_devicetoken');
    const octokit = getOctokit();
    expect(typeof octokit.rest.activity.listReposStarredByAuthenticatedUser).toBe('function');
    expect(typeof octokit.rest.activity.starRepoForAuthenticatedUser).toBe('function');
    expect(typeof octokit.rest.activity.unstarRepoForAuthenticatedUser).toBe('function');
    expect(typeof octokit.rest.search.repos).toBe('function');
    expect(typeof octokit.rest.repos.listLanguages).toBe('function');
  });
});
