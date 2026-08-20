import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { withFakeFetch } from '../lib/testing/fakeFetch.js';
import { resetTmpHome } from '../lib/testing/fakeHome.js';
import { resetFakeKeyring } from '../lib/testing/fakeKeyring.js';

// Order matters: fakeHome.js/fakeKeyring's leaf mocks must be registered
// before lib/cache.js and lib/keyring.js are ever imported (directly or
// transitively through search.js), so both are imported above before
// this dynamic import.
const { saveToken } = await import('../lib/keyring.js');
const { searchCommand } = await import('./search.js');

function searchRepo(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    name: 'repo',
    full_name: 'octocat/repo',
    html_url: 'https://github.com/octocat/repo',
    description: null,
    language: 'TypeScript',
    stargazers_count: 42,
    updated_at: '2024-01-01T00:00:00Z',
    forks_count: 3,
    ...overrides,
  };
}

const originalExit = process.exit;
let exitCode: number | undefined;
let logs: string[];
const originalLog = console.log;
const originalConsoleError = console.error;

beforeEach(() => {
  resetTmpHome();
  resetFakeKeyring();
  saveToken('gho_devicetoken');
  exitCode = undefined;
  logs = [];
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };
  console.error = () => {};
  // biome-ignore lint/suspicious/noExplicitAny: overriding process.exit for testing the searchNoQuery path
  (process as any).exit = (code?: number) => {
    exitCode = code;
    throw new Error(`process.exit(${code})`);
  };
});

afterEach(() => {
  resetTmpHome();
  process.exit = originalExit;
  console.log = originalLog;
  console.error = originalConsoleError;
});

describe('searchCommand: validation', () => {
  test('exits with an error when no query is given in non-interactive mode', async () => {
    await expect(searchCommand(undefined, { interactive: false })).rejects.toThrow(
      'process.exit(1)',
    );
    expect(exitCode).toBe(1);
  });
});

describe('searchCommand: success path (real Octokit client, stubbed global fetch)', () => {
  test('--no-interactive prints search results without starring anything', async () => {
    let requestedUrl = '';
    await withFakeFetch(
      (url) => {
        requestedUrl = url;
        return new Response(
          JSON.stringify({
            total_count: 1,
            incomplete_results: false,
            items: [searchRepo()],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
      () => searchCommand(['awesome', 'cli'], { interactive: false }),
    );

    expect(requestedUrl).toContain('/search/repositories');
    expect(requestedUrl).toContain('q=awesome%20cli');
    expect(logs.join('\n')).toContain('octocat/repo');
  });
});
