import { fetchReadme } from './github.js';
import type { Messages } from './i18n.js';
import { showMessageAndWait, showReadmePager, startLoading, withAltScreen } from './readmePager.js';

/**
 * Build the `r` handler for the interactive list.
 *
 * `getToken` is a callback rather than a token because `list` only holds one
 * when the cache missed; it resolves lazily on the first README opened.
 */
export function createReadmeViewer(
  t: Messages,
  getToken: () => Promise<string>,
): (repo: { full_name: string }) => Promise<void> {
  return async (repo) => {
    await withAltScreen(async () => {
      const stopLoading = startLoading(t.readmeLoading);
      let body: string | null = null;
      let message: string | null = null;

      try {
        const token = await getToken();
        const [owner, name] = repo.full_name.split('/');
        const result = await fetchReadme(token, owner, name);

        if (result.status === 'notFound') {
          message = t.readmeNotFound;
        } else if (result.status === 'error') {
          message = t.readmeFailed;
        } else {
          // Loaded on demand: terminal-image pulls in jimp, which is not
          // something every stela invocation should pay for
          const { renderReadme } = await import('./readme.js');
          body = await renderReadme(result.content, {
            owner,
            repo: name,
            defaultBranch: result.defaultBranch,
            token,
            width: Math.max(40, (process.stdout.columns ?? 80) - 2),
          });
        }
      } catch {
        // Nothing may escape: we are inside a raw-mode TUI
        message = t.readmeFailed;
      } finally {
        stopLoading();
      }

      if (body) await showReadmePager(body, repo.full_name, t);
      else await showMessageAndWait(message ?? t.readmeFailed, t.readmeDismissHint);
    });
  };
}
