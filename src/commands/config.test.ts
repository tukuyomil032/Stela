import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { enqueue, resetClack } from '../lib/testing/fakeClack.js';
import { resetTmpHome } from '../lib/testing/fakeHome.js';

// lib/config.ts resolves its file path from node:os.homedir() once at
// import time, so it must only be imported after fakeHome.js has
// registered its node:os mock above.
const { loadConfig } = await import('../lib/config.js');
const { configShowCommand, configSetCommand, configWizardCommand } = await import('./config.js');

let logs: string[];
const originalLog = console.log;
const originalExit = process.exit;
let exitCode: number | undefined;

beforeEach(() => {
  resetTmpHome();
  resetClack();
  logs = [];
  exitCode = undefined;
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };
  // biome-ignore lint/suspicious/noExplicitAny: overriding process.exit for testing exitWithError
  (process as any).exit = (code?: number) => {
    exitCode = code;
    throw new Error(`process.exit(${code})`);
  };
});

afterEach(() => {
  console.log = originalLog;
  process.exit = originalExit;
  resetTmpHome();
});

describe('configShowCommand', () => {
  test('prints the default configuration', () => {
    configShowCommand();
    const out = logs.join('\n');
    expect(out).toContain('30');
    expect(out).toContain('en');
  });
});

describe('configSetCommand', () => {
  test('updates cacheTTL and persists it', () => {
    configSetCommand('cacheTTL', '60');
    expect(loadConfig().cacheTTL).toBe(60);
  });

  test('rejects a non-positive cacheTTL', () => {
    expect(() => configSetCommand('cacheTTL', '-5')).toThrow('process.exit(1)');
    expect(exitCode).toBe(1);
  });

  test('updates lang', () => {
    configSetCommand('lang', 'ja');
    expect(loadConfig().lang).toBe('ja');
  });

  test('rejects an invalid lang', () => {
    expect(() => configSetCommand('lang', 'fr')).toThrow('process.exit(1)');
  });

  test('splits defaultLanguageFilter on commas and trims whitespace', () => {
    configSetCommand('defaultLanguageFilter', 'rust, go , typescript');
    expect(loadConfig().defaultLanguageFilter).toEqual(['rust', 'go', 'typescript']);
  });

  test('rejects an unknown key', () => {
    expect(() => configSetCommand('bogus', 'x')).toThrow('process.exit(1)');
  });
});

describe('configWizardCommand', () => {
  test('applies the wizard-selected key/value pair', async () => {
    enqueue('pageSize', '50');
    await configWizardCommand();
    expect(loadConfig().pageSize).toBe(50);
  });
});
