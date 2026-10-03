import { describe, expect, test } from 'bun:test';
import { filterStarredRepos } from './filter.js';

const base = {
  id: 1,
  name: 'one',
  full_name: 'Acme/One',
  html_url: 'https://github.com/Acme/One',
  description: 'A useful command line tool',
  language: 'TypeScript',
  stargazers_count: 1,
  updated_at: '2024-01-01T00:00:00Z',
  forks_count: 1,
};

describe('filterStarredRepos', () => {
  test('matches names, descriptions, languages, and topics case-insensitively', () => {
    expect(
      filterStarredRepos([{ ...base, topics: ['Developer-Tools'] }], 'acme developer'),
    ).toHaveLength(1);
    expect(filterStarredRepos([{ ...base, topics: ['Developer-Tools'] }], 'python')).toHaveLength(
      0,
    );
  });

  test('uses AND semantics and accepts old entries with no topics', () => {
    const repos = [
      { ...base, full_name: 'a/one', topics: ['cli'] },
      { ...base, full_name: 'b/two', topics: ['web'] },
      { ...base, full_name: 'c/three' },
    ];
    expect(filterStarredRepos(repos, 'typescript cli').map((repo) => repo.full_name)).toEqual([
      'a/one',
    ]);
    expect(filterStarredRepos(repos, 'cli missing')).toEqual([]);
  });
});
