import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { Octokit } from './octokit.js';

const originalExit = process.exit;
let exitCode: number | undefined;
let exitMessage: string | undefined;

beforeEach(() => {
  exitCode = undefined;
  exitMessage = undefined;
  // biome-ignore lint/suspicious/noExplicitAny: overriding process.exit for testing exitWithError
  (process as any).exit = (code?: number) => {
    exitCode = code;
    throw new Error(`process.exit(${code})`);
  };
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    exitMessage = args.join(' ');
    originalConsoleError(...args);
  };
});

afterEach(() => {
  process.exit = originalExit;
});

const { fetchAllStarred, starRepo, unstarRepo, searchRepos, fetchLanguages } = await import(
  './github.js'
);

function fakeRepo(overrides: Partial<Record<string, unknown>> = {}) {
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

describe('fetchAllStarred', () => {
  test('pages until a short page is returned', async () => {
    const calls: number[] = [];
    const octokit = {
      rest: {
        activity: {
          listReposStarredByAuthenticatedUser: async ({ page }: { page: number }) => {
            calls.push(page);
            if (page === 1) {
              return { data: Array.from({ length: 100 }, (_, i) => fakeRepo({ id: i })) };
            }
            return { data: [fakeRepo({ id: 999 })] };
          },
        },
      },
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake client for this test
    } as any as Octokit;

    const repos = await fetchAllStarred(octokit);
    expect(repos.length).toBe(101);
    expect(calls).toEqual([1, 2]);
  });

  test('does not swallow API errors, exits with a message', async () => {
    const octokit = {
      rest: {
        activity: {
          listReposStarredByAuthenticatedUser: async () => {
            throw new Error('boom');
          },
        },
      },
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake client for this test
    } as any as Octokit;

    await expect(fetchAllStarred(octokit)).rejects.toThrow('process.exit(1)');
    expect(exitCode).toBe(1);
    expect(exitMessage).toContain('boom');
  });
});

describe('starRepo / unstarRepo', () => {
  test('starRepo calls the star endpoint with owner/repo', async () => {
    let called: unknown;
    const octokit = {
      rest: {
        activity: {
          starRepoForAuthenticatedUser: async (args: unknown) => {
            called = args;
          },
        },
      },
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake client for this test
    } as any as Octokit;

    await starRepo(octokit, 'owner', 'repo');
    expect(called).toEqual({ owner: 'owner', repo: 'repo' });
  });

  test('starRepo surfaces failures instead of pretending success', async () => {
    const octokit = {
      rest: {
        activity: {
          starRepoForAuthenticatedUser: async () => {
            throw new Error('403 rate limited');
          },
        },
      },
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake client for this test
    } as any as Octokit;

    await expect(starRepo(octokit, 'owner', 'repo')).rejects.toThrow('process.exit(1)');
    expect(exitMessage).toContain('403 rate limited');
  });

  test('unstarRepo surfaces failures instead of pretending success', async () => {
    const octokit = {
      rest: {
        activity: {
          unstarRepoForAuthenticatedUser: async () => {
            throw new Error('404 not found');
          },
        },
      },
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake client for this test
    } as any as Octokit;

    await expect(unstarRepo(octokit, 'owner', 'repo')).rejects.toThrow('process.exit(1)');
    expect(exitMessage).toContain('404 not found');
  });
});

describe('searchRepos', () => {
  test('single language performs one search call', async () => {
    let calls = 0;
    const octokit = {
      rest: {
        search: {
          repos: async () => {
            calls++;
            return {
              data: { items: [fakeRepo()], total_count: 1 },
            };
          },
        },
      },
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake client for this test
    } as any as Octokit;

    const result = await searchRepos(octokit, 'test', {});
    expect(calls).toBe(1);
    expect(result.totalCount).toBe(1);
  });

  test('multiple languages merge and dedupe results', async () => {
    const octokit = {
      rest: {
        search: {
          repos: async ({ q }: { q: string }) => {
            if (q.includes('language:TypeScript')) {
              return {
                data: {
                  items: [fakeRepo({ id: 1 }), fakeRepo({ id: 2 })],
                  total_count: 2,
                },
              };
            }
            return {
              data: { items: [fakeRepo({ id: 2 })], total_count: 1 },
            };
          },
        },
      },
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake client for this test
    } as any as Octokit;

    const result = await searchRepos(octokit, 'test', { lang: ['TypeScript', 'Go'] });
    expect(result.items.map((r) => r.id).sort()).toEqual([1, 2]);
  });

  test('surfaces search API errors', async () => {
    const octokit = {
      rest: {
        search: {
          repos: async () => {
            throw new Error('422 invalid query');
          },
        },
      },
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake client for this test
    } as any as Octokit;

    await expect(searchRepos(octokit, 'test', {})).rejects.toThrow('process.exit(1)');
    expect(exitMessage).toContain('422 invalid query');
  });
});

describe('fetchLanguages', () => {
  test('returns empty object on 404 instead of throwing', async () => {
    const octokit = {
      rest: {
        repos: {
          listLanguages: async () => {
            const err = new Error('Not Found');
            (err as unknown as { status: number }).status = 404;
            throw err;
          },
        },
      },
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake client for this test
    } as any as Octokit;

    const result = await fetchLanguages(octokit, 'owner', 'repo');
    expect(result).toEqual({});
  });

  test('caches results across calls for the same repo', async () => {
    let calls = 0;
    const octokit = {
      rest: {
        repos: {
          listLanguages: async () => {
            calls++;
            return { data: { TypeScript: 100 } };
          },
        },
      },
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake client for this test
    } as any as Octokit;

    await fetchLanguages(octokit, 'owner', 'cached-repo');
    await fetchLanguages(octokit, 'owner', 'cached-repo');
    expect(calls).toBe(1);
  });

  test('surfaces non-404 errors instead of silently returning empty', async () => {
    const octokit = {
      rest: {
        repos: {
          listLanguages: async () => {
            const err = new Error('500 server error');
            (err as unknown as { status: number }).status = 500;
            throw err;
          },
        },
      },
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake client for this test
    } as any as Octokit;

    await expect(fetchLanguages(octokit, 'owner', 'other-repo')).rejects.toThrow('process.exit(1)');
    expect(exitMessage).toContain('500 server error');
  });
});
