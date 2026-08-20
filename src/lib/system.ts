import { execFileSync } from 'node:child_process';
import chalk from 'chalk';

function isTrustedGitHubUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && /(^|\.)github\.com$/.test(parsed.hostname);
  } catch {
    return false;
  }
}

export function openInBrowser(url: string): void {
  if (!isTrustedGitHubUrl(url)) {
    console.log(chalk.yellow('Refusing to open an untrusted URL: ') + url);
    return;
  }

  try {
    if (process.platform === 'darwin') {
      execFileSync('open', [url]);
    } else if (process.platform === 'linux') {
      execFileSync('xdg-open', [url]);
    } else if (process.platform === 'win32') {
      execFileSync('cmd', ['/c', 'start', '', url]);
    } else {
      console.log(chalk.yellow('Cannot open browser on this platform. URL: ') + url);
    }
  } catch {
    console.log(chalk.yellow('Failed to open browser. URL: ') + url);
  }
}

export function copyToClipboard(text: string): void {
  try {
    if (process.platform === 'darwin') {
      execFileSync('pbcopy', [], { input: text });
    } else if (process.platform === 'linux') {
      try {
        execFileSync('xclip', ['-selection', 'clipboard'], { input: text });
      } catch {
        execFileSync('xsel', ['--clipboard', '--input'], { input: text });
      }
    } else if (process.platform === 'win32') {
      execFileSync('clip', [], { input: text });
    } else {
      console.log(chalk.yellow('Cannot copy to clipboard. URL:\n') + text);
    }
  } catch {
    console.log(chalk.yellow('Failed to copy to clipboard. URL:\n') + text);
  }
}
