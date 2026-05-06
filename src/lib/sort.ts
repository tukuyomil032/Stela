import type { SearchRepo } from '../types/github.js';

export type SortPreset = 'hot-new' | 'classic' | 'recent' | 'hidden-gems';
export type SortField = 'stars' | 'updated' | 'forks';
export type SortOrder = 'desc' | 'asc';

export interface SortCriteria {
  field: SortField;
  order: SortOrder;
  weight: number;
}

export interface MultiSortConfig {
  preset?: SortPreset;
  criteria?: SortCriteria[];
}

export const PRESETS: Record<SortPreset, SortCriteria[]> = {
  'hot-new': [
    { field: 'stars', order: 'desc', weight: 0.6 },
    { field: 'updated', order: 'desc', weight: 0.4 },
  ],
  classic: [{ field: 'stars', order: 'desc', weight: 1.0 }],
  recent: [{ field: 'updated', order: 'desc', weight: 1.0 }],
  'hidden-gems': [
    { field: 'stars', order: 'desc', weight: 0.7 },
    { field: 'forks', order: 'asc', weight: 0.3 },
  ],
};

function getFieldValue<T extends SearchRepo>(repo: T, field: SortField): number {
  switch (field) {
    case 'stars':
      return repo.stargazers_count;
    case 'updated':
      return new Date(repo.updated_at).getTime();
    case 'forks':
      return repo.forks_count;
  }
}

export function sortByMultipleCriteria<T extends SearchRepo>(
  repos: T[],
  config: MultiSortConfig,
): T[] {
  const criteria = config.preset ? PRESETS[config.preset] : (config.criteria ?? []);
  if (criteria.length === 0) return repos;

  const fieldValues = criteria.map(({ field }) => repos.map((r) => getFieldValue(r, field)));

  const fieldStats = fieldValues.map((values) => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    return { min, max };
  });

  const scores = repos.map((_, i) => {
    let score = 0;
    for (let c = 0; c < criteria.length; c++) {
      const { order, weight } = criteria[c];
      const { min, max } = fieldStats[c];
      let normalized = min === max ? 0.5 : (fieldValues[c][i] - min) / (max - min);
      if (order === 'asc') normalized = 1 - normalized;
      score += normalized * weight;
    }
    return score;
  });

  return repos
    .map((repo, i) => ({ repo, score: scores[i] }))
    .sort((a, b) => b.score - a.score)
    .map(({ repo }) => repo);
}
