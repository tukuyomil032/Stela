import type { StarredRepo } from '../types/github.js';

/**
 * Filter a starred-repository cache using whitespace separated AND terms.
 * A term may match the repository name, description, language, or a topic.
 * Missing topics are intentionally treated as an empty list for old caches.
 */
export function filterStarredRepos(repos: StarredRepo[], query?: string): StarredRepo[] {
  const terms = (query ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);

  if (terms.length === 0) return repos;

  return repos.filter((repo) => {
    const haystack = [
      repo.full_name,
      repo.description ?? '',
      repo.language ?? '',
      ...(repo.topics ?? []),
    ].map((value) => value.toLowerCase());

    return terms.every((term) => haystack.some((value) => value.includes(term)));
  });
}
