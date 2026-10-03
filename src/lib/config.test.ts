import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { resetTmpHome, TMP_HOME } from './testing/fakeHome.js';

const { loadConfig, saveConfig } = await import('./config.js');

beforeEach(() => {
  resetTmpHome();
});

afterEach(() => {
  resetTmpHome();
});

describe('loadConfig', () => {
  test('returns the default config when no file exists', () => {
    expect(loadConfig()).toEqual({
      cacheTTL: 30,
      defaultLanguageFilter: [],
      pageSize: 30,
      lang: 'en',
      searchUpdateMode: 'enter',
    });
  });

  test('merges a partial on-disk config over the defaults', () => {
    const dir = join(TMP_HOME, '.stela');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'config.json'), JSON.stringify({ cacheTTL: 60 }), 'utf-8');

    const config = loadConfig();
    expect(config.cacheTTL).toBe(60);
    expect(config.pageSize).toBe(30);
  });
});

describe('saveConfig / loadConfig round-trip', () => {
  test('persists changes across saves', () => {
    saveConfig({
      cacheTTL: 15,
      defaultLanguageFilter: ['rust'],
      pageSize: 10,
      lang: 'ja',
      searchUpdateMode: 'enter',
    });
    expect(loadConfig()).toEqual({
      cacheTTL: 15,
      defaultLanguageFilter: ['rust'],
      pageSize: 10,
      lang: 'ja',
      searchUpdateMode: 'enter',
    });
  });

  test('persists the live search update mode', () => {
    saveConfig({
      cacheTTL: 30,
      defaultLanguageFilter: [],
      pageSize: 30,
      lang: 'en',
      searchUpdateMode: 'live',
    });
    expect(loadConfig().searchUpdateMode).toBe('live');
  });
});
