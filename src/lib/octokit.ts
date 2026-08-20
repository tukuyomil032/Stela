import { throttling } from '@octokit/plugin-throttling';
import { Octokit as OctokitCore } from '@octokit/rest';
import { requireToken } from './auth.js';

const ThrottledOctokit = OctokitCore.plugin(throttling);
export type Octokit = InstanceType<typeof ThrottledOctokit>;

/**
 * Returns an authenticated Octokit client backed by the token stored in the
 * OS keychain (see lib/keyring.ts). Exits with an error if the user has not
 * run `stela auth login`.
 *
 * The token is read once here and handed directly to the Octokit
 * constructor; it is not retained in any other variable or cache.
 */
export function getOctokit(): Octokit {
  const token = requireToken();
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
