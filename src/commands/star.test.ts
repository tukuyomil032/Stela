import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { withFakeFetch } from '../lib/testing/fakeFetch.js';
import { resetTmpHome } from '../lib/testing/fakeHome.js';
import { resetFakeKeyring } from '../lib/testing/fakeKeyring.js';

// Order matters: fakeHome.js/fakeKeyring's leaf mocks must be registered
// before lib/cache.js and lib/keyring.js are ever imported (directly or
// transitively through star.js), so both are imported above before this
// dynamic import.
const { saveToken } = await import('../lib/keyring.js');
const { starCommand } = await import('./star.js');

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

describe('starCommand: validation (no network involved)', () => {
  test('rejects --no-interactive before any network call', async () => {
    await expect(starCommand('owner/repo', { interactive: false })).rejects.toThrow(
      'process.exit(1)',
    );
    expect(exitMessage).toContain('--no-interactive');
  });

  test('rejects a malformed owner/repo target', async () => {
    await expect(starCommand('not-a-valid-target', { interactive: true })).rejects.toThrow(
      'process.exit(1)',
    );
    expect(exitMessage).toContain('Invalid format');
  });

  test('accepts a GitHub URL and extracts owner/repo from it', async () => {
    saveToken('gho_devicetoken');
    let requestedPath = '';
    await withFakeFetch(
      (url) => {
        requestedPath = new URL(url).pathname;
        return new Response(null, { status: 204 });
      },
      () => starCommand('https://github.com/octocat/hello-world', { interactive: true }),
    );
    expect(requestedPath).toBe('/user/starred/octocat/hello-world');
  });
});

describe('starCommand: success path (real Octokit client, stubbed global fetch)', () => {
  test('stars the repo and reports success', async () => {
    saveToken('gho_devicetoken');
    await withFakeFetch(
      () => new Response(null, { status: 204 }),
      () => starCommand('owner/repo', { interactive: true }),
    );
    expect(logs.join('\n')).toContain('Starred owner/repo');
  });

  test('surfaces a GitHub API failure instead of reporting false success', async () => {
    saveToken('gho_devicetoken');
    await expect(
      withFakeFetch(
        () =>
          new Response(JSON.stringify({ message: 'Not Found' }), {
            status: 404,
            headers: { 'content-type': 'application/json' },
          }),
        () => starCommand('owner/missing-repo', { interactive: true }),
      ),
    ).rejects.toThrow('process.exit(1)');
    expect(exitMessage).toContain('Failed to star');
  });
});
