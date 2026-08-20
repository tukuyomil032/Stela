import { mock } from 'bun:test';

// Shared fake for `@napi-rs/keyring`'s `Entry` class, used across multiple
// test files. `bun:test`'s `mock.module()` replaces a module specifier
// globally for the whole test process (not per-file), and since keyring.ts
// is only ever evaluated once, every test file must register the *same*
// class instance here rather than defining its own local fake — otherwise
// state from one test file's fake leaks into another file's assertions.
//
// Behavior here matches the real @napi-rs/keyring sync API as verified
// against the actual macOS Keychain backend: getPassword()/deletePassword()
// return null/false for a missing entry, they do not throw. Only genuine
// failures (e.g. an Ambiguous match) throw.

export class FakeEntry {
  static store = new Map<string, string>();
  static behavior: 'normal' | 'throw-on-set' | 'throw-on-get' | 'throw-on-delete' = 'normal';

  private key: string;

  constructor(service: string, account: string) {
    this.key = `${service}:${account}`;
  }

  setPassword(password: string): void {
    if (FakeEntry.behavior === 'throw-on-set') {
      throw new Error('Ambiguous: multiple matching credentials');
    }
    FakeEntry.store.set(this.key, password);
  }

  getPassword(): string | null {
    if (FakeEntry.behavior === 'throw-on-get') {
      throw new Error('Ambiguous: multiple matching credentials');
    }
    return FakeEntry.store.get(this.key) ?? null;
  }

  deletePassword(): boolean {
    if (FakeEntry.behavior === 'throw-on-delete') {
      throw new Error('Ambiguous: multiple matching credentials');
    }
    if (!FakeEntry.store.has(this.key)) return false;
    FakeEntry.store.delete(this.key);
    return true;
  }
}

export function resetFakeKeyring(): void {
  FakeEntry.store.clear();
  FakeEntry.behavior = 'normal';
}

mock.module('@napi-rs/keyring', () => ({ Entry: FakeEntry }));
