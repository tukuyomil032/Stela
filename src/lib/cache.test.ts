import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { resetTmpHome, TMP_HOME } from './testing/fakeHome.js';

const { loadCache, saveCache, isCacheValid, clearCache } = await import('./cache.js');

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

beforeEach(() => {
  resetTmpHome();
});

afterEach(() => {
  resetTmpHome();
});

describe('loadCache / saveCache', () => {
  test('loadCache returns null when nothing has been cached', () => {
    expect(loadCache()).toBeNull();
  });

  test('saveCache then loadCache round-trips the repo list', () => {
    const repos = [repo({ id: 1 }), repo({ id: 2 })];
    saveCache(repos);
    const cache = loadCache();
    expect(cache?.repos).toEqual(repos);
    expect(typeof cache?.fetchedAt).toBe('string');
  });

  test('loadCache backfills a missing forks_count with 0 (legacy cache migration)', () => {
    const legacyRepo = repo();
    delete (legacyRepo as Partial<typeof legacyRepo>).forks_count;
    const cacheDir = join(TMP_HOME, '.stela', 'cache');
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(
      join(cacheDir, 'starred.json'),
      JSON.stringify({ fetchedAt: new Date().toISOString(), repos: [legacyRepo] }),
      'utf-8',
    );

    const cache = loadCache();
    expect(cache?.repos[0].forks_count).toBe(0);
  });
});

describe('isCacheValid', () => {
  test('is false when there is no cache', () => {
    expect(isCacheValid(30)).toBe(false);
  });

  test('is true within the TTL window', () => {
    saveCache([repo()]);
    expect(isCacheValid(30)).toBe(true);
  });

  test('is false once the TTL has elapsed', () => {
    saveCache([repo()]);
    expect(isCacheValid(-1)).toBe(false);
  });
});

describe('clearCache', () => {
  test('removes an existing cache file', () => {
    saveCache([repo()]);
    clearCache();
    expect(loadCache()).toBeNull();
  });

  test('is a no-op (does not throw) when there is nothing to clear', () => {
    expect(() => clearCache()).not.toThrow();
  });
});
