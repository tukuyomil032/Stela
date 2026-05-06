import { execFileSync, spawn } from 'node:child_process';
import chalk from 'chalk';

export function openInBrowser(url: string): void {
  try {
    if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'linux') {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
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
