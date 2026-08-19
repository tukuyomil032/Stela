import { fetchReadme } from './github.js';
import type { Messages } from './i18n.js';
import type { KittyCapability } from './kittyGraphics.js';
import { showMessageAndWait, showReadmePager, startLoading, withAltScreen } from './readmePager.js';

/**
 * Probed once per process and reused for every README opened afterward.
 *
 * Must be awaited only while the interactive list's keypress listener is
 * detached (as `interactive.ts` does before invoking the `r` callback):
 * the probe briefly reads raw stdin data for the terminal's reply.
 */
let kittyCapability: Promise<KittyCapability> | null = null;

function getKittyCapability(): Promise<KittyCapability> {
  if (!kittyCapability) {
    kittyCapability = import('./kittyGraphics.js').then((m) => m.detectKittySupport());
  }
  return kittyCapability;
}

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
      let kittyImageIds: number[] = [];

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
          const [{ renderReadme }, kitty] = await Promise.all([
            import('./readme.js'),
            getKittyCapability(),
          ]);
          const rendered = await renderReadme(result.content, {
            owner,
            repo: name,
            defaultBranch: result.defaultBranch,
            token,
            width: Math.max(40, (process.stdout.columns ?? 80) - 2),
            kitty,
          });
          body = rendered.text;
          kittyImageIds = rendered.kittyImageIds;
        }
      } catch {
        // Nothing may escape: we are inside a raw-mode TUI
        message = t.readmeFailed;
      } finally {
        stopLoading();
      }

      try {
        if (body) await showReadmePager(body, repo.full_name, t);
        else await showMessageAndWait(message ?? t.readmeFailed, t.readmeDismissHint);
      } finally {
        // Every image transmitted for this view is scoped to it; free them
        // on the way out regardless of how the pager exited.
        if (kittyImageIds.length > 0) {
          const { deleteImages } = await import('./kittyGraphics.js');
          deleteImages(kittyImageIds);
        }
      }
    });
  };
}
