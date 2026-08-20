// Shared fake for `@clack/prompts`, used by every test file that exercises
// lib/interactive.ts (directly or via a command). Same rationale as
// fakeKeyring.ts / fakeHome.ts: mock.module() is global for the whole test
// process, and interactive.ts is only ever evaluated once, so every
// consumer must register the exact same fake rather than each mocking
// '@clack/prompts' independently.

import { mock } from 'bun:test';

export const CANCEL = Symbol('clack-cancel');

const queue: unknown[] = [];

export function enqueue(...values: unknown[]): void {
  queue.push(...values);
}

export function resetClack(): void {
  queue.length = 0;
}

function next(): unknown {
  if (queue.length === 0) {
    throw new Error('fakeClack: no queued response left for this prompt call');
  }
  return queue.shift();
}

mock.module('@clack/prompts', () => ({
  select: async () => next(),
  confirm: async () => next(),
  text: async () => next(),
  autocompleteMultiselect: async () => next(),
  intro: () => {},
  isCancel: (value: unknown) => value === CANCEL,
}));
