import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { withFakeFetch } from '../lib/testing/fakeFetch.js';
import { resetTmpHome } from '../lib/testing/fakeHome.js';
import { resetFakeKeyring } from '../lib/testing/fakeKeyring.js';

// Order matters: fakeHome.js/fakeKeyring's leaf mocks must be registered
// before lib/cache.js and lib/keyring.js are ever imported (directly or
// transitively through unstar.js), so both are imported above before
// this dynamic import.
const { saveToken } = await import('../lib/keyring.js');
const { saveCache } = await import('../lib/cache.js');
const { unstarCommand } = await import('./unstar.js');

function repo(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    name: 'repo',
    full_name: 'owner/repo',
    html_url: 'https://github.com/owner/repo',
    description: null,
    language: 'TypeScript',
    stargazers_count: 10,
    updated_at: '2024-01-01T00:00:00Z',
    forks_count: 1,
    ...overrides,
  };
}

const originalExit = process.exit;
const originalConsoleError = console.error;
let exitMessage: string | undefined;
let logs: string[];
const originalLog = console.log;

beforeEach(() => {
  resetTmpHome();
  resetFakeKeyring();
  exitMessage = undefined;
  logs = [];
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };
  console.error = (...args: unknown[]) => {
    exitMessage = args.join(' ');
  };
  // biome-ignore lint/suspicious/noExplicitAny: overriding process.exit for testing exitWithError
  (process as any).exit = (code?: number) => {
    throw new Error(`process.exit(${code})`);
  };
});

afterEach(() => {
  resetTmpHome();
  process.exit = originalExit;
  console.error = originalConsoleError;
  console.log = originalLog;
});

describe('unstarCommand: validation (no network involved)', () => {
  test('rejects --no-interactive before any network call', async () => {
    await expect(unstarCommand('owner/repo', { interactive: false, yes: true })).rejects.toThrow(
      'process.exit(1)',
    );
    expect(exitMessage).toContain('--no-interactive');
  });

  test('rejects a malformed target', async () => {
    await expect(
      unstarCommand('not-a-valid-target', { interactive: true, yes: true }),
    ).rejects.toThrow('process.exit(1)');
    expect(exitMessage).toContain('Invalid format');
  });
});

describe('unstarCommand: success path (real Octokit client, stubbed global fetch)', () => {
  test('unstars the repo, reports success, and prunes it from the cache', async () => {
    saveToken('gho_devicetoken');
    saveCache([repo({ full_name: 'owner/repo' }), repo({ id: 2, full_name: 'owner/keep' })]);

    await withFakeFetch(
      () => new Response(null, { status: 204 }),
      () => unstarCommand('owner/repo', { interactive: true, yes: true }),
    );

    expect(logs.join('\n')).toContain('Unstarred owner/repo');
    const { loadCache } = await import('../lib/cache.js');
    expect(loadCache()?.repos.map((r) => r.full_name)).toEqual(['owner/keep']);
  });

  test('surfaces a GitHub API failure instead of reporting false success', async () => {
    saveToken('gho_devicetoken');
    await expect(
      withFakeFetch(
        () => new Response(null, { status: 404 }),
        () => unstarCommand('owner/missing', { interactive: true, yes: true }),
      ),
    ).rejects.toThrow('process.exit(1)');
    expect(exitMessage).toContain('Failed to unstar');
  });
});
