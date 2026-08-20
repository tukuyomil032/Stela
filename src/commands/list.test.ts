import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { resetTmpHome } from '../lib/testing/fakeHome.js';

// Order matters: fakeHome.js's node:os mock must be registered before
// lib/cache.js/lib/config.js are ever imported (directly or transitively
// through list.js), so it's imported above before this dynamic import.
const { saveCache } = await import('../lib/cache.js');
const { saveConfig } = await import('../lib/config.js');
const { listCommand } = await import('./list.js');

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

let logs: string[];
const originalLog = console.log;

beforeEach(() => {
  resetTmpHome();
  saveConfig({ cacheTTL: 30, defaultLanguageFilter: [], pageSize: 30, lang: 'en' });
  logs = [];
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };
});

afterEach(() => {
  console.log = originalLog;
  resetTmpHome();
});

describe('listCommand: cache-hit path (no network call needed/attempted)', () => {
  test('--no-interactive prints all cached repos as a table without calling GitHub', async () => {
    saveCache([repo({ full_name: 'owner/one' }), repo({ id: 2, full_name: 'owner/two' })]);
    await listCommand({ interactive: false, refresh: false });
    const out = logs.join('\n');
    expect(out).toContain('owner/one');
    expect(out).toContain('owner/two');
  });

  test('reports "no repositories found" when the cache is empty', async () => {
    saveCache([]);
    await listCommand({ interactive: false, refresh: false });
    expect(logs.join('\n')).toContain('No repositories found.');
  });

  test('--lang filters the cached repo list', async () => {
    saveCache([
      repo({ id: 1, full_name: 'owner/ts-repo', language: 'TypeScript' }),
      repo({ id: 2, full_name: 'owner/rs-repo', language: 'Rust' }),
    ]);
    await listCommand({ interactive: false, refresh: false, lang: 'rust' });
    const out = logs.join('\n');
    expect(out).toContain('owner/rs-repo');
    expect(out).not.toContain('owner/ts-repo');
  });

  test('--sort stars orders results by star count descending', async () => {
    saveCache([
      repo({ id: 1, full_name: 'owner/low', stargazers_count: 5 }),
      repo({ id: 2, full_name: 'owner/high', stargazers_count: 500 }),
    ]);
    await listCommand({ interactive: false, refresh: false, sort: 'stars' });
    const out = logs.join('\n');
    expect(out.indexOf('owner/high')).toBeLessThan(out.indexOf('owner/low'));
  });

  test('interactive mode with an explicit filter skips the wizard, prints the table, and aborts cleanly on a non-TTY stdin', async () => {
    saveCache([repo({ full_name: 'owner/one' })]);
    // selectPageAction() short-circuits to null when stdin isn't a TTY
    // (verified in lib/interactive.test.ts), so the pagination loop exits
    // via the "Aborted." path immediately after the first render — no
    // @clack/prompts mock is needed for this branch.
    await listCommand({ interactive: true, refresh: false, sort: 'stars' });
    const out = logs.join('\n');
    expect(out).toContain('owner/one');
    expect(out).toContain('Aborted.');
  });
});
