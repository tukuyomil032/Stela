import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { FakeEntry, resetFakeKeyring } from './testing/fakeKeyring.js';

let authImpl: (options: { type: 'oauth' }) => Promise<{ token: string }>;
let lastOnVerification: ((v: unknown) => void) | undefined;
let openedUrls: string[] = [];

mock.module('@napi-rs/keyring', () => ({ Entry: FakeEntry }));

mock.module('./system.js', () => ({
  openInBrowser: (url: string) => {
    openedUrls.push(url);
  },
  copyToClipboard: () => {},
}));

mock.module('@octokit/auth-oauth-device', () => ({
  createOAuthDeviceAuth: (options: { onVerification: (v: unknown) => void }) => {
    lastOnVerification = options.onVerification;
    return (opts: { type: 'oauth' }) => authImpl(opts);
  },
}));

const { login, logout, getStoredToken, requireToken } = await import('./auth.js');
const { loadToken } = await import('./keyring.js');

const originalExit = process.exit;
const originalConsoleError = console.error;
let exitCode: number | undefined;
let exitMessage: string | undefined;

beforeEach(() => {
  resetFakeKeyring();
  openedUrls = [];
  exitCode = undefined;
  exitMessage = undefined;
  authImpl = async () => ({ token: 'gho_devicetoken' });
  // biome-ignore lint/suspicious/noExplicitAny: overriding process.exit for testing exitWithError
  (process as any).exit = (code?: number) => {
    exitCode = code;
    throw new Error(`process.exit(${code})`);
  };
  console.error = (...args: unknown[]) => {
    exitMessage = args.join(' ');
  };
});

afterEach(() => {
  process.exit = originalExit;
  console.error = originalConsoleError;
});

describe('auth: login', () => {
  test('stores the token returned by the device flow and never logs it', async () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.join(' '));
    };

    await login();

    console.log = originalLog;

    expect(loadToken()).toBe('gho_devicetoken');
    for (const line of logs) {
      expect(line.includes('gho_devicetoken')).toBe(false);
    }
  });

  test('surfaces onVerification info to the user and opens the browser', async () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.join(' '));
    };

    const verification = {
      device_code: 'device123',
      user_code: 'ABCD-1234',
      verification_uri: 'https://github.com/login/device',
      expires_in: 900,
      interval: 5,
    };
    authImpl = async () => {
      lastOnVerification?.(verification);
      return { token: 'gho_devicetoken' };
    };

    await login();
    console.log = originalLog;

    expect(openedUrls).toContain('https://github.com/login/device');
    expect(logs.some((l) => l.includes('ABCD-1234'))).toBe(true);
  });

  test('does not silently succeed when the device flow fails (e.g. expired_token)', async () => {
    authImpl = async () => {
      throw new Error('expired_token');
    };

    await expect(login()).rejects.toThrow('process.exit(1)');
    expect(exitCode).toBe(1);
    expect(loadToken()).toBeNull();
    expect(exitMessage).toContain('expired_token');
  });
});

describe('auth: logout', () => {
  test('deletes the stored token and reports success', async () => {
    await login();
    logout();
    expect(loadToken()).toBeNull();
  });

  test('reports when there was nothing to log out of, without pretending success', () => {
    logout();
    expect(loadToken()).toBeNull();
  });
});

describe('auth: getStoredToken / requireToken', () => {
  test('getStoredToken returns null when nothing is stored', () => {
    expect(getStoredToken()).toBeNull();
  });

  test('requireToken exits with a helpful message when not logged in', () => {
    expect(() => requireToken()).toThrow('process.exit(1)');
    expect(exitCode).toBe(1);
    expect(exitMessage).toContain('stela auth login');
  });

  test('requireToken returns the stored token when logged in', async () => {
    await login();
    expect(requireToken()).toBe('gho_devicetoken');
  });
});
