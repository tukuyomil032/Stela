import { describe, expect, test } from 'bun:test';
import { PRESETS, sortByMultipleCriteria } from './sort.js';

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

describe('sortByMultipleCriteria', () => {
  test('returns repos unchanged when no criteria and no preset', () => {
    const repos = [repo({ id: 1 }), repo({ id: 2 })];
    expect(sortByMultipleCriteria(repos, {})).toEqual(repos);
  });

  test('classic preset sorts by stars descending', () => {
    const repos = [
      repo({ id: 1, stargazers_count: 5 }),
      repo({ id: 2, stargazers_count: 50 }),
      repo({ id: 3, stargazers_count: 20 }),
    ];
    const sorted = sortByMultipleCriteria(repos, { preset: 'classic' });
    expect(sorted.map((r) => r.id)).toEqual([2, 3, 1]);
  });

  test('recent preset sorts by updated_at descending', () => {
    const repos = [
      repo({ id: 1, updated_at: '2023-01-01T00:00:00Z' }),
      repo({ id: 2, updated_at: '2024-06-01T00:00:00Z' }),
    ];
    const sorted = sortByMultipleCriteria(repos, { preset: 'recent' });
    expect(sorted.map((r) => r.id)).toEqual([2, 1]);
  });

  test('hidden-gems preset favors high stars and low forks', () => {
    const repos = [
      repo({ id: 1, stargazers_count: 100, forks_count: 5 }),
      repo({ id: 2, stargazers_count: 100, forks_count: 90 }),
    ];
    const sorted = sortByMultipleCriteria(repos, { preset: 'hidden-gems' });
    expect(sorted[0].id).toBe(1);
  });

  test('custom criteria with ascending order inverts the ranking', () => {
    const repos = [repo({ id: 1, forks_count: 100 }), repo({ id: 2, forks_count: 1 })];
    const sorted = sortByMultipleCriteria(repos, {
      criteria: [{ field: 'forks', order: 'asc', weight: 1 }],
    });
    expect(sorted.map((r) => r.id)).toEqual([2, 1]);
  });

  test('falls back to 0.5 normalized score when all values are equal', () => {
    const repos = [repo({ id: 1, stargazers_count: 10 }), repo({ id: 2, stargazers_count: 10 })];
    const sorted = sortByMultipleCriteria(repos, {
      criteria: [{ field: 'stars', order: 'desc', weight: 1 }],
    });
    expect(sorted.map((r) => r.id).sort()).toEqual([1, 2]);
  });

  test('PRESETS export matches the documented weighting for hot-new', () => {
    expect(PRESETS['hot-new']).toEqual([
      { field: 'stars', order: 'desc', weight: 0.6 },
      { field: 'updated', order: 'desc', weight: 0.4 },
    ]);
  });
});
