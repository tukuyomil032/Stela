// Stubs the global fetch used internally by Octokit's request layer, for
// the small number of command-level tests that exercise a real success
// path end-to-end (real octokit.js -> real github.js -> real Octokit ->
// fetch) without hitting the network. Not module-mocked (fetch is a
// global, not an importable specifier) so it carries none of the
// mock.module() collision risk the other testing/fake*.ts helpers guard
// against — just save/restore globalThis.fetch per test.

type Handler = (url: string, init: RequestInit | undefined) => Response | Promise<Response>;

export function withFakeFetch<T>(handler: Handler, run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = ((url: string | URL, init?: RequestInit) =>
    handler(String(url), init)) as typeof fetch;
  return run().finally(() => {
    globalThis.fetch = original;
  });
}
