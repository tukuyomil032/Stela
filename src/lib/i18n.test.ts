import { describe, expect, test } from 'bun:test';
import { createI18n } from './i18n.js';

describe('createI18n', () => {
  test('defaults to English for any lang other than "ja"', () => {
    const en = createI18n('en');
    expect(en.aborted).toBe('Aborted.');
  });

  test('returns Japanese messages for "ja"', () => {
    const ja = createI18n('ja');
    expect(ja.aborted).toBe('中断しました。');
  });

  test('en and ja expose exactly the same set of keys', () => {
    const en = createI18n('en');
    const ja = createI18n('ja');
    expect(Object.keys(en).sort()).toEqual(Object.keys(ja).sort());
  });

  test('function-valued messages interpolate their arguments', () => {
    const en = createI18n('en');
    expect(en.listFetched(5)).toBe('Fetched 5 repositories.');
    expect(en.searchStarring('owner/repo', 2, 10)).toBe('Starring repo:owner/repo [2/10]');
    expect(en.configUnknownKey('bogus')).toContain('bogus');

    const ja = createI18n('ja');
    expect(ja.listFetched(5)).toBe('5 件取得しました。');
  });
});
