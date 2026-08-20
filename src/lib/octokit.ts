import { throttling } from '@octokit/plugin-throttling';
import { Octokit as OctokitCore } from '@octokit/rest';
import { requireToken } from './auth.js';

const ThrottledOctokit = OctokitCore.plugin(throttling);
export type Octokit = InstanceType<typeof ThrottledOctokit>;

/**
 * Returns an authenticated Octokit client backed by the token stored in the
 * OS keychain (see lib/keyring.ts), transparently refreshing it first if
 * it has expired. Exits with an error if the user has not run
 * `stela auth login`, or if refreshing an expired session fails.
 *
 * The token is read once here and handed directly to the Octokit
 * constructor; it is not retained in any other variable or cache.
 */
export async function getOctokit(): Promise<Octokit> {
  const token = await requireToken();
  return new ThrottledOctokit({
    auth: token,
    throttle: {
      onRateLimit: (_retryAfter, options, octokit, retryCount) => {
        octokit.log.warn(`Rate limit hit for ${options.method} ${options.url}`);
        return retryCount < 1;
      },
      onSecondaryRateLimit: (_retryAfter, options, octokit) => {
        octokit.log.warn(`Secondary rate limit hit for ${options.method} ${options.url}`);
        return false;
      },
    },
  });
}
