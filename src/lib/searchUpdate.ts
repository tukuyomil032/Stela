export interface DebouncedSearch<T> {
  schedule(value: string): Promise<T | undefined>;
  cancel(): void;
}

/** Debounce query updates and discard results from superseded requests. */
export function createDebouncedSearch<T>(
  search: (value: string) => Promise<T>,
  delay = 400,
): DebouncedSearch<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let revision = 0;
  let settlePending: ((value: T | undefined) => void) | undefined;

  return {
    schedule(value) {
      revision++;
      const requestRevision = revision;
      if (timer) clearTimeout(timer);
      settlePending?.(undefined);
      return new Promise<T | undefined>((resolve, reject) => {
        settlePending = resolve;
        timer = setTimeout(async () => {
          try {
            const result = await search(value);
            resolve(requestRevision === revision ? result : undefined);
          } catch (error) {
            if (requestRevision === revision) reject(error);
            else resolve(undefined);
          } finally {
            if (requestRevision === revision) settlePending = undefined;
          }
        }, delay);
      });
    },
    cancel() {
      revision++;
      if (timer) clearTimeout(timer);
      settlePending?.(undefined);
      settlePending = undefined;
      timer = undefined;
    },
  };
}
