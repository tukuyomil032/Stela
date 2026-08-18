import type readline from 'node:readline';
import chalk from 'chalk';
import stringWidth from 'string-width';
import type { Messages } from './i18n.js';

const ALT_SCREEN_ON = '\u001B[?1049h\u001B[?25l';
const ALT_SCREEN_OFF = '\u001B[?25h\u001B[?1049l';
const HOME_AND_CLEAR = '\u001B[H\u001B[2J';
const SGR_RESET = '\u001B[0m';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * If an SGR colour sequence starts at `at`, return the index just past it.
 *
 * Written by hand rather than as a regex: an ESC in a literal trips the lint
 * rule against control characters in regular expressions.
 */
function sgrTokenEnd(line: string, at: number): number {
  if (line.charCodeAt(at) !== 0x1b || line[at + 1] !== '[') return at;

  let i = at + 2;
  while (i < line.length) {
    const c = line[i];
    if (c === 'm') return i + 1;
    if (!(c >= '0' && c <= '9') && c !== ';') return at;
    i++;
  }
  return at;
}

/**
 * Split one logical line into pieces that each fit within `width` columns.
 *
 * The pager's whole scroll model rests on "one line written is one terminal row
 * consumed". If the terminal wrapped a long line itself, that count would drift
 * and every keystroke would push the screen further out of alignment.
 */
export function wrapAnsiLine(line: string, width: number): string[] {
  if (width <= 0) return [line];
  if (stringWidth(line) <= width) return [line];

  const out: string[] = [];
  let current = '';
  let consumed = 0;
  let activeSgr = '';
  let i = 0;

  while (i < line.length) {
    const sgrEnd = sgrTokenEnd(line, i);
    if (sgrEnd > i) {
      const token = line.slice(i, sgrEnd);
      current += token;
      // A reset drops the carried style; anything else becomes the style to
      // re-apply at the start of the next piece
      activeSgr = token === SGR_RESET || token === '\u001B[m' ? '' : token;
      i = sgrEnd;
      continue;
    }

    const ch = String.fromCodePoint(line.codePointAt(i) as number);
    const chWidth = stringWidth(ch);

    if (consumed + chWidth > width) {
      out.push(activeSgr ? current + SGR_RESET : current);
      current = activeSgr + ch;
      consumed = chWidth;
    } else {
      current += ch;
      consumed += chWidth;
    }

    i += ch.length;
  }

  out.push(current);
  return out;
}

/**
 * Run `fn` on the alternate screen buffer.
 *
 * Leaving it restores the previous screen contents and cursor position, so the
 * interactive list underneath comes back untouched and its `linesRendered`
 * bookkeeping stays valid.
 */
export async function withAltScreen<T>(fn: () => Promise<T>): Promise<T> {
  process.stdout.write(ALT_SCREEN_ON);
  try {
    return await fn();
  } finally {
    process.stdout.write(ALT_SCREEN_OFF);
  }
}

/**
 * A spinner that never touches stdin.
 *
 * ora would do, but it grabs stdin and toggles raw mode on start and stop.
 * Raw mode here belongs to `customMultiselect`, and handing it to a second
 * owner is exactly how the terminal ends up without echo.
 */
export function startLoading(message: string): () => void {
  let frame = 0;

  const draw = (): void => {
    const spinner = chalk.cyan(SPINNER_FRAMES[frame++ % SPINNER_FRAMES.length]);
    process.stdout.write(`${HOME_AND_CLEAR}\n  ${spinner} ${message}`);
  };

  draw();
  const timer = setInterval(draw, 80);
  timer.unref();

  return () => clearInterval(timer);
}

/** Wait for a keypress, so a short message is readable before we leave. */
function waitForKey(): Promise<void> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      resolve();
      return;
    }

    let settled = false;
    const onKey = (): void => {
      if (settled) return;
      settled = true;
      process.stdin.removeListener('keypress', onKey);
      resolve();
    };

    process.stdin.on('keypress', onKey);
  });
}

export async function showMessageAndWait(message: string, hint: string): Promise<void> {
  process.stdout.write(`${HOME_AND_CLEAR}\n  ${message}\n\n  ${chalk.dim(hint)}`);
  await waitForKey();
}

/**
 * Scroll through pre-rendered ANSI text.
 *
 * Deliberately does not call `setRawMode`, `pause` or `resume`: stdin is
 * already in raw mode and owned by the caller.
 */
export function showReadmePager(rendered: string, title: string, t: Messages): Promise<void> {
  const cols = process.stdout.columns ?? 80;
  const rows = process.stdout.rows ?? 24;
  // header, footer, and one row of slack so nothing scrolls off on its own
  const bodyHeight = Math.max(3, rows - 3);

  const lines = rendered.split('\n').flatMap((line) => wrapAnsiLine(line, cols));
  const maxTop = Math.max(0, lines.length - bodyHeight);

  let top = 0;

  const render = (): void => {
    const end = Math.min(top + bodyHeight, lines.length);
    const body = lines.slice(top, end);
    while (body.length < bodyHeight) body.push('');

    const header = chalk.bold.cyan(`  ${title}`);
    const footer = chalk.dim(`  ${top + 1}-${end} / ${lines.length}  ${t.readmePagerHint}`);

    process.stdout.write(`${HOME_AND_CLEAR}${header}\n${body.join('\n')}\n${footer}`);
  };

  const clamp = (n: number): number => Math.max(0, Math.min(maxTop, n));

  return new Promise((resolve) => {
    let settled = false;

    function cleanup(): void {
      if (settled) return;
      settled = true;
      // Only the listener. Raw mode belongs to customMultiselect.
      process.stdin.removeListener('keypress', onKeypress);
      resolve();
    }

    function onKeypress(str: string, key: readline.Key): void {
      if (!key) return;

      // Raw mode suppresses SIGINT, so Ctrl-C arrives as an ordinary key.
      // Closing the pager hands it back to the list, which knows how to
      // restore the terminal on its way out.
      if (key.ctrl && key.name === 'c') {
        cleanup();
        return;
      }

      const before = top;

      if (key.name === 'up' || str === 'k') top = clamp(top - 1);
      else if (key.name === 'down' || str === 'j') top = clamp(top + 1);
      else if (str === ' ' || str === 'f' || key.name === 'pagedown') top = clamp(top + bodyHeight);
      else if (str === 'b' || key.name === 'pageup') top = clamp(top - bodyHeight);
      else if (str === 'd') top = clamp(top + Math.floor(bodyHeight / 2));
      else if (str === 'u') top = clamp(top - Math.floor(bodyHeight / 2));
      else if (str === 'g') top = 0;
      else if (str === 'G') top = maxTop;
      else if (str === 'q' || key.name === 'escape') {
        cleanup();
        return;
      } else return;

      if (top !== before) render();
    }

    process.stdin.on('keypress', onKeypress);
    render();
  });
}
