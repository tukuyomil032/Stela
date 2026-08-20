import type { SearchRepo, StarredRepo } from '../types/github.js';
import { exitWithError } from './error.js';
import type { Octokit } from './octokit.js';

// Session-level in-memory cache for language data
const languageCache = new Map<string, Record<string, number>>();

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function fetchAllStarred(
  octokit: Octokit,
  onPage?: (fetched: number, page: number) => void,
): Promise<StarredRepo[]> {
  const repos: StarredRepo[] = [];
  let page = 1;

  while (true) {
    let data: StarredRepo[];
    try {
      const res = await octokit.rest.activity.listReposStarredByAuthenticatedUser({
        per_page: 100,
        page,
      });
      data = res.data as StarredRepo[];
    } catch (error) {
      exitWithError(`GitHub API error: ${toErrorMessage(error)}`);
    }

    if (data.length === 0) break;

    repos.push(...data);
    onPage?.(repos.length, page);
    if (data.length < 100) break;
    page++;
  }

  return repos;
}

export async function unstarRepo(octokit: Octokit, owner: string, repo: string): Promise<void> {
  try {
    await octokit.rest.activity.unstarRepoForAuthenticatedUser({ owner, repo });
  } catch (error) {
    exitWithError(`Failed to unstar ${owner}/${repo}: ${toErrorMessage(error)}`);
  }
}

export async function starRepo(octokit: Octokit, owner: string, repo: string): Promise<void> {
  try {
    await octokit.rest.activity.starRepoForAuthenticatedUser({ owner, repo });
  } catch (error) {
    exitWithError(`Failed to star ${owner}/${repo}: ${toErrorMessage(error)}`);
  }
}

export async function searchRepos(
  octokit: Octokit,
  query: string,
  options: { lang?: string | string[]; sort?: string; limit?: number; page?: number },
): Promise<{ items: SearchRepo[]; totalCount: number }> {
  const langs = options.lang
    ? Array.isArray(options.lang)
      ? options.lang
      : [options.lang]
    : [undefined];
  const perPage = Math.min(options.limit ?? 30, 100);
  const sort = options.sort ?? 'stars';
  const page = options.page ?? 1;

  const sortParam = sort === 'stars' || sort === 'forks' || sort === 'updated' ? sort : undefined;

  async function search(lang: string | undefined) {
    let searchQuery = query;
    if (lang) searchQuery += ` language:${lang}`;

    try {
      const res = await octokit.rest.search.repos({
        q: searchQuery,
        sort: sortParam,
        order: 'desc',
        per_page: perPage,
        page,
      });
      return res.data;
    } catch (error) {
      exitWithError(`GitHub API error: ${toErrorMessage(error)}`);
    }
  }

  if (langs.length <= 1) {
    const data = await search(langs[0]);
    return {
      items: (data.items as SearchRepo[]).slice(0, perPage),
      totalCount: data.total_count,
    };
  }

  const seen = new Set<number>();
  const merged: SearchRepo[] = [];
  let maxTotalCount = 0;

  for (const lang of langs) {
    const data = await search(lang);
    maxTotalCount = Math.max(maxTotalCount, data.total_count);

    for (const item of data.items as SearchRepo[]) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        merged.push(item);
      }
    }
  }

  merged.sort((a, b) => {
    if (sort === 'stars') return b.stargazers_count - a.stargazers_count;
    if (sort === 'forks') return b.forks_count - a.forks_count;
    if (sort === 'updated') {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    }
    return b.stargazers_count - a.stargazers_count;
  });

  return { items: merged.slice(0, perPage), totalCount: maxTotalCount };
}

export async function fetchLanguages(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<Record<string, number>> {
  const key = `${owner}/${repo}`;
  const cached = languageCache.get(key);
  if (cached) return cached;

  try {
    const res = await octokit.rest.repos.listLanguages({ owner, repo });
    languageCache.set(key, res.data);
    return res.data;
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'status' in error && error.status === 404) {
      languageCache.set(key, {});
      return {};
    }
    exitWithError(`GitHub API error: ${toErrorMessage(error)}`);
  }
}
