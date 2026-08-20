import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { withFakeFetch } from './testing/fakeFetch.js';
import { resetFakeKeyring } from './testing/fakeKeyring.js';

let openedUrls: string[] = [];

type ExchangeResult = {
  data: {
    access_token: string;
    scope?: string;
    token_type?: string;
    refresh_token?: string;
    expires_in?: number;
    refresh_token_expires_in?: number;
  };
  headers: { date?: string };
};

let createDeviceCodeImpl: () => Promise<{
  data: {
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
  };
}>;
let exchangeDeviceCodeImpl: () => Promise<ExchangeResult>;

mock.module('./system.js', () => ({
  openInBrowser: (url: string) => {
    openedUrls.push(url);
  },
  copyToClipboard: () => {},
}));

mock.module('@octokit/oauth-methods', () => ({
  createDeviceCode: async () => createDeviceCodeImpl(),
  exchangeDeviceCode: async () => exchangeDeviceCodeImpl(),
}));

const { login, logout, getStoredToken, requireToken } = await import('./auth.js');
const { loadToken, saveToken } = await import('./keyring.js');

function oauthError(code: string): Error & { response: { data: { error: string } } } {
  const error = new Error(code) as Error & { response: { data: { error: string } } };
  error.response = { data: { error: code } };
  return error;
}

function nonExpiringSession(token: string): string {
  return JSON.stringify({ token });
}

function expiringSession(opts: {
  token: string;
  refreshToken: string;
  expiresAt: string;
  refreshTokenExpiresAt: string;
}): string {
  return JSON.stringify({
    token: opts.token,
    refreshToken: opts.refreshToken,
    expiresAt: opts.expiresAt,
    refreshTokenExpiresAt: opts.refreshTokenExpiresAt,
  });
}

const originalExit = process.exit;
const originalConsoleError = console.error;
let exitCode: number | undefined;
let exitMessage: string | undefined;

beforeEach(() => {
  resetFakeKeyring();
  openedUrls = [];
  exitCode = undefined;
  exitMessage = undefined;
  createDeviceCodeImpl = async () => ({
    data: {
      device_code: 'device123',
      user_code: 'ABCD-1234',
      verification_uri: 'https://github.com/login/device',
      expires_in: 900,
      interval: 0, // keep tests fast; real GitHub returns 5+ seconds
    },
  });
  exchangeDeviceCodeImpl = async () => ({
    data: {
      access_token: 'gho_devicetoken',
      refresh_token: 'ghr_refreshtoken',
      expires_in: 28800,
      refresh_token_expires_in: 15897600,
    },
    headers: { date: new Date().toUTCString() },
  });
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
  test('stores the token+refresh token returned by the device flow and never logs the token', async () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.join(' '));
    };

    await login();

    console.log = originalLog;

    const stored = JSON.parse(loadToken() ?? 'null');
    expect(stored.token).toBe('gho_devicetoken');
    expect(stored.refreshToken).toBe('ghr_refreshtoken');
    expect(typeof stored.expiresAt).toBe('string');
    for (const line of logs) {
      expect(line.includes('gho_devicetoken')).toBe(false);
      expect(line.includes('ghr_refreshtoken')).toBe(false);
    }
  });

  test('surfaces the verification URL/code to the user and opens the browser', async () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.join(' '));
    };

    await login();
    console.log = originalLog;

    expect(openedUrls).toContain('https://github.com/login/device');
    expect(logs.some((l) => l.includes('ABCD-1234'))).toBe(true);
  });

  // The real `slow_down` backoff (+5s per GitHub's spec) makes this
  // exceed bun's default 5000ms test timeout, hence the 8000ms override.
  test('keeps polling through authorization_pending and slow_down before succeeding', async () => {
    let calls = 0;
    exchangeDeviceCodeImpl = async () => {
      calls++;
      if (calls === 1) throw oauthError('authorization_pending');
      if (calls === 2) throw oauthError('slow_down');
      return {
        data: {
          access_token: 'gho_devicetoken',
          refresh_token: 'ghr_refreshtoken',
          expires_in: 28800,
          refresh_token_expires_in: 15897600,
        },
        headers: { date: new Date().toUTCString() },
      };
    };

    await login();
    expect(calls).toBe(3);
    expect(JSON.parse(loadToken() ?? 'null').token).toBe('gho_devicetoken');
  }, 8000);

  test('does not silently succeed when the device flow is denied/expired', async () => {
    exchangeDeviceCodeImpl = async () => {
      throw oauthError('expired_token');
    };

    await expect(login()).rejects.toThrow('process.exit(1)');
    expect(exitCode).toBe(1);
    expect(loadToken()).toBeNull();
    expect(exitMessage).toContain('expired_token');
  });

  test('stores a non-expiring session when the API response has no refresh fields', async () => {
    exchangeDeviceCodeImpl = async () => ({
      data: { access_token: 'gho_devicetoken' },
      headers: {},
    });

    await login();
    const stored = JSON.parse(loadToken() ?? 'null');
    expect(stored.token).toBe('gho_devicetoken');
    expect(stored.expiresAt).toBeUndefined();
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

describe('auth: getStoredToken', () => {
  test('returns null when nothing is stored', () => {
    expect(getStoredToken()).toBeNull();
  });

  test('returns the token without refreshing, even if expired', () => {
    saveToken(
      expiringSession({
        token: 'gho_stale',
        refreshToken: 'ghr_stale',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
        refreshTokenExpiresAt: new Date(Date.now() + 1_000_000).toISOString(),
      }),
    );
    expect(getStoredToken()).toBe('gho_stale');
  });
});

describe('auth: requireToken', () => {
  test('exits with a helpful message when not logged in', async () => {
    await expect(requireToken()).rejects.toThrow('process.exit(1)');
    expect(exitCode).toBe(1);
    expect(exitMessage).toContain('stela auth login');
  });

  test('returns a non-expiring token as-is', async () => {
    saveToken(nonExpiringSession('gho_devicetoken'));
    expect(await requireToken()).toBe('gho_devicetoken');
  });

  test('returns the cached token when it is not yet near expiry', async () => {
    saveToken(
      expiringSession({
        token: 'gho_fresh',
        refreshToken: 'ghr_fresh',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        refreshTokenExpiresAt: new Date(Date.now() + 1_000_000_000).toISOString(),
      }),
    );
    expect(await requireToken()).toBe('gho_fresh');
  });

  test('transparently refreshes an expired access token and persists the new session', async () => {
    saveToken(
      expiringSession({
        token: 'gho_old',
        refreshToken: 'ghr_old',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
        refreshTokenExpiresAt: new Date(Date.now() + 1_000_000_000).toISOString(),
      }),
    );

    let requestedBody: Record<string, unknown> | undefined;
    const token = await withFakeFetch(
      (_url, init) => {
        requestedBody = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            access_token: 'gho_new',
            refresh_token: 'ghr_new',
            expires_in: 28800,
            refresh_token_expires_in: 15897600,
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json', date: new Date().toUTCString() },
          },
        );
      },
      () => requireToken(),
    );

    expect(token).toBe('gho_new');
    expect(requestedBody?.refresh_token).toBe('ghr_old');
    expect(requestedBody?.client_secret).toBeUndefined();
    const stored = JSON.parse(loadToken() ?? 'null');
    expect(stored.token).toBe('gho_new');
    expect(stored.refreshToken).toBe('ghr_new');
  });

  test('exits without calling the refresh endpoint once the refresh token itself has expired', async () => {
    let called = false;
    saveToken(
      expiringSession({
        token: 'gho_old',
        refreshToken: 'ghr_old',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
        refreshTokenExpiresAt: new Date(Date.now() - 500).toISOString(),
      }),
    );

    await expect(
      withFakeFetch(
        () => {
          called = true;
          throw new Error('should not be called');
        },
        () => requireToken(),
      ),
    ).rejects.toThrow('process.exit(1)');
    expect(called).toBe(false);
    expect(exitMessage).toContain('stela auth login');
  });

  test('surfaces a refresh failure instead of silently falling back to the stale token', async () => {
    saveToken(
      expiringSession({
        token: 'gho_old',
        refreshToken: 'ghr_old',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
        refreshTokenExpiresAt: new Date(Date.now() + 1_000_000_000).toISOString(),
      }),
    );

    await expect(
      withFakeFetch(
        () =>
          new Response(JSON.stringify({ error: 'bad_refresh_token' }), {
            status: 400,
            headers: { 'content-type': 'application/json' },
          }),
        () => requireToken(),
      ),
    ).rejects.toThrow('process.exit(1)');
    expect(exitMessage).toContain('bad_refresh_token');
  });

  test('surfaces an unreadable (non-JSON) refresh response instead of crashing with an unhandled rejection', async () => {
    saveToken(
      expiringSession({
        token: 'gho_old',
        refreshToken: 'ghr_old',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
        refreshTokenExpiresAt: new Date(Date.now() + 1_000_000_000).toISOString(),
      }),
    );

    await expect(
      withFakeFetch(
        () => new Response('<html>502 Bad Gateway</html>', { status: 502 }),
        () => requireToken(),
      ),
    ).rejects.toThrow('process.exit(1)');
    expect(exitMessage).toContain('unreadable response');
  });
});
