import { describe, expect, test } from 'bun:test';
import { createDebouncedSearch } from './searchUpdate.js';

describe('createDebouncedSearch', () => {
  test('only resolves the latest request after the idle delay', async () => {
    const calls: string[] = [];
    const search = createDebouncedSearch(async (value: string) => {
      calls.push(value);
      return value.toUpperCase();
    }, 5);
    const first = search.schedule('old');
    const latest = search.schedule('new');
    await expect(first).resolves.toBeUndefined();
    await expect(latest).resolves.toBe('NEW');
    expect(calls).toEqual(['new']);
  });

  test('ignores an older request that resolves after a newer request', async () => {
    const resolvers = new Map<string, (value: string) => void>();
    const search = createDebouncedSearch(
      (value: string) =>
        new Promise<string>((resolve) => {
          resolvers.set(value, resolve);
        }),
      1,
    );
    const old = search.schedule('old');
    await new Promise((resolve) => setTimeout(resolve, 5));
    const latest = search.schedule('new');
    await new Promise((resolve) => setTimeout(resolve, 5));
    resolvers.get('old')?.('OLD');
    resolvers.get('new')?.('NEW');
    await expect(old).resolves.toBeUndefined();
    await expect(latest).resolves.toBe('NEW');
  });
});
