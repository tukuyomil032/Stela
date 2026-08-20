import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { enqueue, resetClack } from '../lib/testing/fakeClack.js';
import { resetTmpHome } from '../lib/testing/fakeHome.js';

// lib/cache.ts and lib/config.ts resolve their file paths from
// node:os.homedir() once at import time, so they must only be imported
// (directly or transitively) after fakeHome.js has registered its
// node:os mock above.
const { saveCache } = await import('../lib/cache.js');
const { saveConfig } = await import('../lib/config.js');
const { cacheClearCommand, cacheStatusCommand, cacheWizardCommand } = await import('./cache.js');

function repo(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    name: 'foo',
    full_name: 'owner/foo',
    html_url: 'https://github.com/owner/foo',
    description: null,
    language: 'TypeScript',
    stargazers_count: 10,
    updated_at: '2024-01-01T00:00:00Z',
    forks_count: 1,
    ...overrides,
  };
}

let logs: string[];
const originalLog = console.log;

beforeEach(() => {
  resetTmpHome();
  resetClack();
  logs = [];
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };
});

afterEach(() => {
  console.log = originalLog;
  resetTmpHome();
});

describe('cacheStatusCommand', () => {
  test('reports no cache when nothing has been fetched', () => {
    cacheStatusCommand();
    expect(logs.join('\n')).toContain('No cache found.');
  });

  test('reports repo count and a valid TTL for a fresh cache', () => {
    saveConfig({ cacheTTL: 30, defaultLanguageFilter: [], pageSize: 30, lang: 'en' });
    saveCache([repo(), repo({ id: 2 })]);
    cacheStatusCommand();
    const out = logs.join('\n');
    expect(out).toContain('Repos:');
    expect(out).toContain('2');
    expect(out).toContain('valid');
  });

  test('reports expired once past the TTL', () => {
    saveConfig({ cacheTTL: -1, defaultLanguageFilter: [], pageSize: 30, lang: 'en' });
    saveCache([repo()]);
    cacheStatusCommand();
    expect(logs.join('\n')).toContain('expired');
  });
});

describe('cacheClearCommand', () => {
  test('removes the cache and confirms', () => {
    saveCache([repo()]);
    cacheClearCommand();
    logs = [];
    cacheStatusCommand();
    expect(logs.join('\n')).toContain('No cache found.');
  });
});

describe('cacheWizardCommand', () => {
  test('dispatches to cacheStatusCommand when "status" is chosen', async () => {
    saveCache([repo()]);
    enqueue('status');
    await cacheWizardCommand();
    expect(logs.join('\n')).toContain('Repos:');
  });

  test('dispatches to cacheClearCommand when "clear" is chosen', async () => {
    saveCache([repo()]);
    enqueue('clear');
    await cacheWizardCommand();
    expect(logs.join('\n')).toContain('Cache cleared.');
  });
});
