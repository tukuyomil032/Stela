import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createI18n } from './i18n.js';
import { printSearchTable, printTable } from './table.js';

const t = createI18n('en');

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

let lines: string[];
const originalLog = console.log;

beforeEach(() => {
  lines = [];
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  };
});

afterEach(() => {
  console.log = originalLog;
});

describe('printTable', () => {
  test('prints the "no repos" message for an empty list', () => {
    printTable([], t);
    expect(lines.join('\n')).toContain(t.noReposFound);
  });

  test('prints a header and every repo row', () => {
    const repos = [repo({ full_name: 'owner/one' }), repo({ id: 2, full_name: 'owner/two' })];
    printTable(repos, t);
    const output = lines.join('\n');
    expect(output).toContain('owner/one');
    expect(output).toContain('owner/two');
    expect(output).toContain('Total: 2 repositories');
  });

  test('numbers rows starting from startIndex + 1', () => {
    printTable([repo()], t, 9);
    const row = lines.find((l) => l.includes('owner/foo'));
    expect(row).toContain('10');
  });
});

describe('printSearchTable', () => {
  test('prints the "no repos" message for an empty list', () => {
    printSearchTable([], t);
    expect(lines.join('\n')).toContain(t.noReposFound);
  });

  test('renders every result row', () => {
    const repos = [repo({ full_name: 'a/b' }), repo({ id: 2, full_name: 'c/d' })];
    printSearchTable(repos, t);
    const output = lines.join('\n');
    expect(output).toContain('a/b');
    expect(output).toContain('c/d');
  });
});
