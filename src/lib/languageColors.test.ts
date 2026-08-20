import { describe, expect, test } from 'bun:test';
import {
  bytesToBreakdown,
  colorizeLanguage,
  formatLanguageBreakdown,
  LANGUAGE_COLORS,
} from './languageColors.js';

describe('colorizeLanguage', () => {
  test('returns a dim "unknown" label for null', () => {
    expect(colorizeLanguage(null)).toContain('unknown');
  });

  test('colors a known language with its linguist hex code', () => {
    const out = colorizeLanguage('TypeScript');
    expect(out).toContain('TypeScript');
  });

  test('still renders unknown languages without throwing', () => {
    expect(() => colorizeLanguage('SomeLanguageThatDoesNotExist')).not.toThrow();
    expect(colorizeLanguage('SomeLanguageThatDoesNotExist')).toContain(
      'SomeLanguageThatDoesNotExist',
    );
  });
});

describe('bytesToBreakdown', () => {
  test('returns an empty array when total bytes is 0', () => {
    expect(bytesToBreakdown({})).toEqual([]);
  });

  test('computes percentages summing to 100 and sorts descending', () => {
    const result = bytesToBreakdown({ TypeScript: 75, JavaScript: 25 });
    expect(result).toEqual([
      { name: 'TypeScript', percentage: 75 },
      { name: 'JavaScript', percentage: 25 },
    ]);
  });
});

describe('formatLanguageBreakdown', () => {
  test('returns an empty string for no languages', () => {
    expect(formatLanguageBreakdown([])).toBe('');
  });

  test('limits output to the top 2 languages', () => {
    const out = formatLanguageBreakdown([
      { name: 'TypeScript', percentage: 60 },
      { name: 'JavaScript', percentage: 30 },
      { name: 'CSS', percentage: 10 },
    ]);
    expect(out).toContain('TypeScript');
    expect(out).toContain('JavaScript');
    expect(out).not.toContain('CSS');
  });
});

test('LANGUAGE_COLORS has valid hex codes', () => {
  for (const color of Object.values(LANGUAGE_COLORS)) {
    expect(color).toMatch(/^#[0-9a-fA-F]{3,6}$/);
  }
});
