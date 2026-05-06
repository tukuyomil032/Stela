import type { StarredRepo } from '../types/github.js';
import { exitWithError } from './error.js';

const BASE_URL = 'https://api.github.com';

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

export async function fetchAllStarred(token: string): Promise<StarredRepo[]> {
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
