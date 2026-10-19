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

  describe('repository hyperlinks', () => {
    const osc8Prefix = '\x1b]8;;';
    // biome-ignore lint/suspicious/noControlCharactersInRegex: strips terminal escape sequences
    const osc8 = /\x1b\]8;;[^\x1b]*\x1b\\/g;
    // biome-ignore lint/suspicious/noControlCharactersInRegex: strips terminal escape sequences
    const sgr = /\x1b\[[0-9;]*m/g;
    const originalIsTTY = process.stdout.isTTY;

    function render(isTTY: boolean, overrides: Partial<Record<string, unknown>> = {}): string {
      process.stdout.isTTY = isTTY;
      lines = [];
      printSearchTable([repo(overrides)], t);
      return lines.join('\n');
    }

    afterEach(() => {
      process.stdout.isTTY = originalIsTTY;
    });

    test('wraps the repo name in an OSC 8 link on a TTY', () => {
      const output = render(true);
      expect(output).toContain(`${osc8Prefix}https://github.com/owner/foo`);
    });

    test('emits no OSC 8 sequence when stdout is not a TTY', () => {
      expect(render(false)).not.toContain(osc8Prefix);
    });

    test('emits no OSC 8 sequence for untrusted URLs', () => {
      for (const html_url of ['http://github.com/owner/foo', 'https://evil.example.com/x']) {
        expect(render(true, { html_url })).not.toContain(osc8Prefix);
      }
    });

    test('keeps the visible layout identical with and without links', () => {
      const strip = (s: string) => s.replace(osc8, '').replace(sgr, '');
      expect(strip(render(true))).toBe(strip(render(false)));
    });
  });
});
