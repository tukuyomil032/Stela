import { describe, expect, test } from 'bun:test';
import { Writable } from 'node:stream';
import chalk from 'chalk';
import stringWidth from 'string-width';
import {
  createFetchProgressRenderer,
  renderFetchFrame,
  renderFetchProgress,
  renderShimmer,
} from './progress.js';

class FakeStream extends Writable {
  isTTY: boolean;
  columns = 80;
  rows = 24;
  output = '';

  constructor(isTTY: boolean) {
    super();
    this.isTTY = isTTY;
  }

  _write(chunk: Buffer | string, _encoding: string, callback: (error?: Error) => void): void {
    this.output += chunk.toString();
    callback();
  }

  cursorTo(): boolean {
    return true;
  }

  moveCursor(): boolean {
    return true;
  }

  clearLine(): boolean {
    return true;
  }
}

describe('renderFetchProgress', () => {
  test('renders a fixed-width determinate bar', () => {
    const output = renderFetchProgress({ fetched: 571, total: 1225 }, 10, false);
    expect(output).toBe('[====>-----] 571/1225');
  });

  test('renders an indeterminate total and empty bar for zero results', () => {
    expect(renderFetchProgress({ fetched: 0 }, 10, false)).toBe('[----------] 0/?');
  });

  test('does not emit ANSI color codes when color is disabled', () => {
    const output = renderFetchProgress({ fetched: 5, total: 10 }, 10, false);
    expect(output).not.toContain('\u001b[');
  });

  test('keeps the fetched count from the supplied batch state', () => {
    const output = renderFetchFrame(
      'spinner fetching',
      { fetched: 100, total: 201 },
      0,
      false,
      'fetching',
    );
    expect(output).toContain('100/201');
    expect(output).not.toContain('101/201');
  });

  test('leaves the Ora spinner glyph untouched while the message shimmer advances', () => {
    const spinnerFrame = '\u001b[36m⠋\u001b[39m Fetching repositories';
    const originalLevel = chalk.level;
    chalk.level = 1;
    try {
      const first = renderFetchFrame(
        spinnerFrame,
        { fetched: 0 },
        0,
        true,
        'Fetching repositories',
      );
      const second = renderFetchFrame(
        spinnerFrame,
        { fetched: 0 },
        1,
        true,
        'Fetching repositories',
      );
      const firstGlyph = first.split('\n')[0].slice(0, '\u001b[36m⠋\u001b[39m '.length);
      const secondGlyph = second.split('\n')[0].slice(0, '\u001b[36m⠋\u001b[39m '.length);

      expect(firstGlyph).toBe('\u001b[36m⠋\u001b[39m ');
      expect(secondGlyph).toBe(firstGlyph);
      expect(first).not.toBe(second);
    } finally {
      chalk.level = originalLevel;
    }
  });
});

describe('renderShimmer', () => {
  test('moves the highlight window from left to right', () => {
    const originalLevel = chalk.level;
    chalk.level = 1;
    try {
      const first = renderShimmer('Fetching repositories', 0, true);
      const second = renderShimmer('Fetching repositories', 1, true);
      expect(first).not.toBe(second);
    } finally {
      chalk.level = originalLevel;
    }
  });

  test('preserves the first-line display width', () => {
    const message = 'リポジトリを取得中';
    const originalLevel = chalk.level;
    chalk.level = 1;
    try {
      const colored = renderShimmer(message, 3, true);
      expect(stringWidth(colored)).toBe(stringWidth(message));
    } finally {
      chalk.level = originalLevel;
    }
  });
});

describe('createFetchProgressRenderer', () => {
  test('uses log-update on TTY and stops transient output before success', async () => {
    const stream = new FakeStream(true);
    const renderer = createFetchProgressRenderer('Fetching repositories...', false, stream);
    renderer.update({ fetched: 100, total: 201 });
    await new Promise((resolve) => setTimeout(resolve, 90));

    expect(stream.output).toContain('100/201');
    renderer.succeed('Fetched 201 repositories.');
    const outputAfterSuccess = stream.output;
    await new Promise((resolve) => setTimeout(resolve, 90));
    expect(stream.output).toBe(outputAfterSuccess);
    expect(stream.output).toContain('Fetched 201 repositories.');
  });

  test('keeps non-TTY output line-oriented without cursor ANSI sequences', () => {
    const stream = new FakeStream(false);
    const renderer = createFetchProgressRenderer('Fetching repositories...', true, stream);
    renderer.update({ fetched: 100, total: 201 });
    renderer.fail('Fetch failed.');

    expect(stream.output).not.toContain('\u001b[');
    expect(stream.output).toContain('Fetch failed.');
  });

  test('stops the TTY timer before preserving failure output', async () => {
    const stream = new FakeStream(true);
    const renderer = createFetchProgressRenderer('Fetching repositories...', false, stream);
    renderer.fail('Fetch failed.');
    const outputAfterFailure = stream.output;
    await new Promise((resolve) => setTimeout(resolve, 90));

    expect(stream.output).toBe(outputAfterFailure);
    expect(stream.output).toContain('Fetch failed.');
  });
});
