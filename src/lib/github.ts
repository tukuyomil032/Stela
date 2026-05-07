import type { SearchRepo, SearchResult, StarredRepo } from '../types/github.js';
import { exitWithError } from './error.js';

const BASE_URL = 'https://api.github.com';

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

// Session-level in-memory cache for language data
const languageCache = new Map<string, Record<string, number>>();

export async function fetchAllStarred(
  token: string,
  onPage?: (fetched: number, page: number) => void,
): Promise<StarredRepo[]> {
  const repos: StarredRepo[] = [];
  let page = 1;

  while (true) {
    const res = await fetch(`${BASE_URL}/user/starred?per_page=100&page=${page}`, {
      headers: headers(token),
    });

    if (!res.ok) {
      exitWithError(`GitHub API error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as StarredRepo[];
    if (data.length === 0) break;

    repos.push(...data);
    onPage?.(repos.length, page);
    if (data.length < 100) break;
    page++;
  }

  return repos;
}

export async function unstarRepo(token: string, owner: string, repo: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/user/starred/${owner}/${repo}`, {
    method: 'DELETE',
    headers: headers(token),
  });

  if (res.status !== 204) {
    exitWithError(`Failed to unstar ${owner}/${repo}: ${res.status} ${res.statusText}`);
  }
}

export async function starRepo(token: string, owner: string, repo: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/user/starred/${owner}/${repo}`, {
    method: 'PUT',
    headers: { ...headers(token), 'Content-Length': '0' },
  });

  if (res.status !== 204) {
    exitWithError(`Failed to star ${owner}/${repo}: ${res.status} ${res.statusText}`);
  }
}

export async function searchRepos(
  token: string,
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

  if (langs.length <= 1) {
    let searchQuery = query;
    if (langs[0]) searchQuery += ` language:${langs[0]}`;

    const params = new URLSearchParams({
      q: searchQuery,
      sort,
      order: 'desc',
      per_page: String(perPage),
      page: String(page),
    });

    const res = await fetch(`${BASE_URL}/search/repositories?${params}`, {
      headers: headers(token),
    });

    if (!res.ok) {
      exitWithError(`GitHub API error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as SearchResult;
    return { items: data.items.slice(0, perPage), totalCount: data.total_count };
  }

  const seen = new Set<number>();
  const merged: SearchRepo[] = [];
  let maxTotalCount = 0;

  for (const lang of langs) {
    let searchQuery = query;
    if (lang) searchQuery += ` language:${lang}`;

    const params = new URLSearchParams({
      q: searchQuery,
      sort,
      order: 'desc',
      per_page: String(perPage),
      page: String(page),
    });

    const res = await fetch(`${BASE_URL}/search/repositories?${params}`, {
      headers: headers(token),
    });

    if (!res.ok) {
      exitWithError(`GitHub API error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as SearchResult;
    maxTotalCount = Math.max(maxTotalCount, data.total_count);

    for (const item of data.items) {
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
  token: string,
  owner: string,
  repo: string,
): Promise<Record<string, number>> {
  const key = `${owner}/${repo}`;
  const cached = languageCache.get(key);
  if (cached) return cached;

  const res = await fetch(`${BASE_URL}/repos/${owner}/${repo}/languages`, {
    headers: headers(token),
  });

  if (res.status === 404) {
    languageCache.set(key, {});
    return {};
  }

  if (!res.ok) {
    exitWithError(`GitHub API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as Record<string, number>;
  languageCache.set(key, data);
  return data;
}
