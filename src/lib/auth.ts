import { execSync } from 'node:child_process';
import { exitWithError } from './error.js';

export function getToken(): string {
  try {
    const token = execSync('gh auth token', { encoding: 'utf-8' }).trim();
    if (!token) {
      exitWithError('No GitHub token found. Run: gh auth login');
    }
    return token;
  } catch {
    exitWithError('Failed to get GitHub token. Please install gh CLI and run: gh auth login');
  }
}
