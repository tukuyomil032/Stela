// Redirects node:os's homedir() to an isolated temp directory for the whole
// test process, so lib/cache.ts and lib/config.ts (which resolve their file
// paths from homedir() once at import time) read/write real files under a
// throwaway directory instead of the developer's actual ~/.stela.
//
// mock.module() is global for the test process, so this is a side-effect
// module imported once by every test file that needs it (cache.test.ts,
// config.test.ts, commands/cache.test.ts, commands/config.test.ts) rather
// than something each file mocks independently — the same pattern as
// fakeKeyring.ts.

import { mock } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import * as realOs from 'node:os';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const TMP_HOME = mkdtempSync(join(tmpdir(), 'stela-test-home-'));

mock.module('node:os', () => ({ ...realOs, homedir: () => TMP_HOME }));

export function resetTmpHome(): void {
  rmSync(join(TMP_HOME, '.stela'), { recursive: true, force: true });
}
