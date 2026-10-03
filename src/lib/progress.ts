import process from 'node:process';
import chalk from 'chalk';
import gradient from 'gradient-string';
import { createLogUpdate } from 'log-update';
import ora, { type Ora } from 'ora';

export interface ProgressState {
  fetched: number;
  total?: number;
}

export interface FetchProgressRenderer {
  update(state: ProgressState): void;
  succeed(text: string): void;
  fail(text?: string): void;
}

type FetchProgressStream = NodeJS.WritableStream & {
  columns?: number;
  isTTY?: boolean;
  rows?: number;
};

const SHIMMER_WIDTH = 4;
const FETCH_PROGRESS_WIDTH = 24;

export const FETCH_PALETTE = {
  messageBase: '#5EEAD4',
  highlightEnd: '#99F6E4',
  highlightStart: '#ECFDF5',
} as const;

/** Color a moving window while preserving the input's visible width. */
export function renderShimmer(text: string, frame: number, color = true): string {
  if (!color || text.length === 0) return text;

  const characters = Array.from(text);
  const start = ((Math.floor(frame) % characters.length) + characters.length) % characters.length;
  const end = Math.min(characters.length, start + SHIMMER_WIDTH);
  const before = characters.slice(0, start).join('');
  const highlight = characters.slice(start, end).join('');
  const after = characters.slice(end).join('');

  return (
    gradient(FETCH_PALETTE.messageBase, FETCH_PALETTE.messageBase)(before) +
    gradient(FETCH_PALETTE.highlightStart, FETCH_PALETTE.highlightEnd)(highlight) +
    gradient(FETCH_PALETTE.messageBase, FETCH_PALETTE.messageBase)(after)
  );
}

export function renderFetchFrame(
  spinnerFrame: string,
  state: ProgressState,
  shimmerFrame: number,
  color = true,
  statusMessage?: string,
): string {
  const firstLine = statusMessage
    ? renderSpinnerWithShimmer(spinnerFrame, statusMessage, shimmerFrame, color)
    : renderShimmer(spinnerFrame, shimmerFrame, color);
  return `${firstLine}\n${renderFetchProgress(state, FETCH_PROGRESS_WIDTH, color)}`;
}

/**
 * Render the fetch status without letting Ora and log-update both own the
 * cursor. TTY output is owned by log-update; piped output remains Ora's
 * normal line-oriented output.
 */
export function createFetchProgressRenderer(
  message: string,
  color: boolean,
  stream: FetchProgressStream = process.stderr,
): FetchProgressRenderer {
  const spinner = ora({
    color: color ? 'cyan' : false,
    hideCursor: false,
    stream,
    text: message,
  });

  if (!stream.isTTY) {
    spinner.start();
    return createLineRenderer(spinner);
  }

  const log = createLogUpdate(stream, { showCursor: true });
  let state: ProgressState = { fetched: 0 };
  let shimmerFrame = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  let stopped = false;

  const render = (): void => {
    if (stopped) return;
    log(renderFetchFrame(spinner.frame(), state, shimmerFrame, color, message));
    shimmerFrame++;
  };

  const stopTransient = (): void => {
    if (stopped) return;
    stopped = true;
    if (timer) {
      clearInterval(timer);
      timer = undefined;
    }
    log.clear();
    log.done();
  };

  render();
  timer = setInterval(render, 80);

  return {
    update(nextState) {
      state = nextState;
    },
    succeed(text) {
      stopTransient();
      spinner.succeed(text);
    },
    fail(text) {
      stopTransient();
      spinner.fail(text);
    },
  };
}

function renderSpinnerWithShimmer(
  spinnerFrame: string,
  statusMessage: string,
  shimmerFrame: number,
  color: boolean,
): string {
  const messageSuffix = ` ${statusMessage}`;
  const messageStart = spinnerFrame.lastIndexOf(messageSuffix);
  if (messageStart === -1) return spinnerFrame;

  return (
    spinnerFrame.slice(0, messageStart) +
    messageSuffix[0] +
    renderShimmer(statusMessage, shimmerFrame, color)
  );
}

function createLineRenderer(spinner: Ora): FetchProgressRenderer {
  return {
    update(state) {
      spinner.text = `${spinner.text?.split('\n')[0] ?? ''}\n${renderFetchProgress(
        state,
        FETCH_PROGRESS_WIDTH,
        false,
      )}`;
    },
    succeed(text) {
      spinner.succeed(text);
    },
    fail(text) {
      spinner.fail(text);
    },
  };
}

export function renderFetchProgress(state: ProgressState, width = 24, color = true): string {
  const safeWidth = Math.max(4, Math.floor(width));
  const total = state.total ?? 0;
  const ratio = total > 0 ? Math.min(1, state.fetched / total) : 0;
  const filled = total > 0 && state.fetched > 0 ? Math.max(1, Math.round(ratio * safeWidth)) : 0;
  const active = '='.repeat(Math.max(0, filled - 1)) + (filled > 0 ? '>' : '');
  const remaining = '-'.repeat(safeWidth - filled);
  const bar = color
    ? `[${chalk.bold(gradient(FETCH_PALETTE.highlightStart, FETCH_PALETTE.messageBase)(active))}${chalk.dim(remaining)}]`
    : `[${active}${remaining}]`;
  return `${color ? chalk.bold(bar) : bar} ${state.fetched}/${state.total ?? '?'}`;
}
