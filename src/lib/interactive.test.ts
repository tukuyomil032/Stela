import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createI18n } from './i18n.js';
import { CANCEL, enqueue, resetClack } from './testing/fakeClack.js';

const {
  confirm,
  selectRepo,
  selectListAction,
  selectCacheAction,
  selectPageAction,
  selectMultipleStarredRepos,
  configWizard,
  searchWizard,
} = await import('./interactive.js');

const t = createI18n('en');

function repo(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    name: 'foo',
    full_name: 'owner/foo',
    html_url: 'https://github.com/owner/foo',
    description: 'a repo',
    language: 'TypeScript',
    stargazers_count: 10,
    updated_at: '2024-01-01T00:00:00Z',
    forks_count: 1,
    ...overrides,
  };
}

let logs: string[];
const originalLog = console.log;
const originalMoveCursor = process.stdout.moveCursor;
const originalClearScreenDown = process.stdout.clearScreenDown;

beforeEach(() => {
  resetClack();
  logs = [];
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };
  // bun's test-runner stdout stub doesn't implement these TTY-only methods
  // that interactive.ts's raw-mode renderer calls between keypresses.
  // biome-ignore lint/suspicious/noExplicitAny: stubbing a TTY-only method absent from bun's test stdout
  (process.stdout as any).moveCursor = () => true;
  // biome-ignore lint/suspicious/noExplicitAny: stubbing a TTY-only method absent from bun's test stdout
  (process.stdout as any).clearScreenDown = () => true;
});

afterEach(() => {
  console.log = originalLog;
  process.stdout.moveCursor = originalMoveCursor;
  process.stdout.clearScreenDown = originalClearScreenDown;
});

describe('confirm', () => {
  test('returns true when confirmed', async () => {
    enqueue(true);
    expect(await confirm('sure?')).toBe(true);
  });

  test('returns false on cancel', async () => {
    enqueue(CANCEL);
    expect(await confirm('sure?')).toBe(false);
  });
});

describe('selectRepo', () => {
  test('resolves the matching repo by full_name', async () => {
    const repos = [repo({ full_name: 'a/b' }), repo({ full_name: 'c/d' })];
    enqueue('c/d');
    expect((await selectRepo(repos))?.full_name).toBe('c/d');
  });

  test('returns null on cancel', async () => {
    enqueue(CANCEL);
    expect(await selectRepo([repo()])).toBeNull();
  });
});

describe('selectListAction', () => {
  test('returns the chosen action', async () => {
    enqueue('unstar');
    expect(await selectListAction()).toBe('unstar');
  });

  test('returns null on cancel', async () => {
    enqueue(CANCEL);
    expect(await selectListAction()).toBeNull();
  });
});

describe('selectCacheAction', () => {
  test('returns the chosen action', async () => {
    enqueue('clear');
    expect(await selectCacheAction(t)).toBe('clear');
  });
});

describe('selectPageAction', () => {
  test('returns null immediately when stdin is not a TTY (non-interactive/CI environment)', async () => {
    expect(process.stdin.isTTY).toBeFalsy();
    expect(await selectPageAction(t, 1, true)).toBeNull();
  });
});

describe('selectMultipleStarredRepos (raw keypress-driven multiselect)', () => {
  test('space toggles selection, enter confirms', async () => {
    const repos = [repo({ full_name: 'a/b' }), repo({ full_name: 'c/d' })];
    const promise = selectMultipleStarredRepos(repos);
    process.stdin.emit('keypress', ' ', { name: undefined });
    process.stdin.emit('keypress', '', { name: 'return' });
    const result = await promise;
    expect(result.map((r) => r.full_name)).toEqual(['a/b']);
  });

  test('q cancels and resolves an empty selection', async () => {
    const repos = [repo({ full_name: 'a/b' })];
    const promise = selectMultipleStarredRepos(repos);
    process.stdin.emit('keypress', 'q', {});
    const result = await promise;
    expect(result).toEqual([]);
  });

  test('ctrl+c cancels and resolves an empty selection', async () => {
    const repos = [repo({ full_name: 'a/b' })];
    const promise = selectMultipleStarredRepos(repos);
    process.stdin.emit('keypress', undefined, { ctrl: true, name: 'c' });
    const result = await promise;
    expect(result).toEqual([]);
  });

  test('down/up moves the cursor without changing the selection', async () => {
    const repos = [repo({ full_name: 'a/b' }), repo({ full_name: 'c/d' })];
    const promise = selectMultipleStarredRepos(repos);
    process.stdin.emit('keypress', '', { name: 'down' });
    process.stdin.emit('keypress', ' ', {});
    process.stdin.emit('keypress', '', { name: 'return' });
    const result = await promise;
    expect(result.map((r) => r.full_name)).toEqual(['c/d']);
  });
});

describe('configWizard', () => {
  test('calls onSet with the selected key and entered value', async () => {
    let captured: string[] | undefined;
    enqueue('cacheTTL', '99');
    await configWizard(
      t,
      { cacheTTL: 30, defaultLanguageFilter: [], pageSize: 30, lang: 'en' },
      (key, value) => {
        captured = [key, value];
      },
    );
    expect(captured).toEqual(['cacheTTL', '99']);
  });

  test('does not call onSet when the key selection is cancelled', async () => {
    let called = false;
    enqueue(CANCEL);
    await configWizard(
      t,
      { cacheTTL: 30, defaultLanguageFilter: [], pageSize: 30, lang: 'en' },
      () => {
        called = true;
      },
    );
    expect(called).toBe(false);
  });
});

describe('searchWizard', () => {
  test('returns null when the mode selection is cancelled', async () => {
    enqueue(CANCEL);
    expect(await searchWizard(t)).toBeNull();
  });

  test('preset mode returns a query, preset, and limit', async () => {
    enqueue('preset', 'hot-new', 'rust cli', [], '50');
    const result = await searchWizard(t, 30);
    expect(result).toEqual({
      query: 'rust cli',
      lang: undefined,
      limit: 50,
      multiSort: { preset: 'hot-new' },
    });
  });
});
