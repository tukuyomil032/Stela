// Shared fake for `@napi-rs/keyring`'s `Entry` class, used across multiple
// test files. `bun:test`'s `mock.module()` replaces a module specifier
// globally for the whole test process (not per-file), and since keyring.ts
// is only ever evaluated once, every test file must register the *same*
// class instance here rather than defining its own local fake — otherwise
// state from one test file's fake leaks into another file's assertions.

export class FakeEntry {
  static store = new Map<string, string>();
  static behavior: 'normal' | 'ambiguous-on-set' | 'ambiguous-on-get' | 'ambiguous-on-delete' =
    'normal';

  private key: string;

  constructor(service: string, account: string) {
    this.key = `${service}:${account}`;
  }

  setPassword(password: string): void {
    if (FakeEntry.behavior === 'ambiguous-on-set') {
      throw new Error('Ambiguous: multiple matching credentials');
    }
    FakeEntry.store.set(this.key, password);
  }

  getPassword(): string | null {
    if (FakeEntry.behavior === 'ambiguous-on-get') {
      throw new Error('Ambiguous: multiple matching credentials');
    }
    const value = FakeEntry.store.get(this.key);
    if (value === undefined) {
      throw new Error('NoEntry: no matching entry found in the keychain');
    }
    return value;
  }

  deletePassword(): boolean {
    if (FakeEntry.behavior === 'ambiguous-on-delete') {
      throw new Error('Ambiguous: multiple matching credentials');
    }
    const value = FakeEntry.store.get(this.key);
    if (value === undefined) {
      throw new Error('NoEntry: no matching entry found in the keychain');
    }
    FakeEntry.store.delete(this.key);
    return true;
  }
}

export function resetFakeKeyring(): void {
  FakeEntry.store.clear();
  FakeEntry.behavior = 'normal';
}
