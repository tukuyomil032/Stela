export interface MouseEvent {
  button: number;
  x: number;
  y: number;
  shift: boolean;
  ctrl: boolean;
  meta: boolean;
  released: boolean;
}

// ESC character used to build patterns via RegExp constructor (avoids biome noControlCharactersInRegex)
const ESC = '\x1b';
const DSR_RESPONSE = new RegExp(`${ESC}\\[(\\d+);(\\d+)R`);
const SGR_MOUSE_EVENT = new RegExp(`${ESC}\\[<(\\d+);(\\d+);(\\d+)([Mm])`);

export function enableMouseTracking(): void {
  if (!process.stdout.isTTY) return;
  process.stdout.write(`${ESC}[?1006h`);
}

export function disableMouseTracking(): void {
  if (!process.stdout.isTTY) return;
  process.stdout.write(`${ESC}[?1006l`);
}

export async function getCurrentRow(): Promise<number> {
  if (!process.stdout.isTTY || !process.stdin.isTTY) return 1;

  return new Promise<number>((resolve) => {
    const wasRaw = process.stdin.isRaw ?? false;

    if (!wasRaw) {
      process.stdin.setRawMode(true);
    }

    const onData = (data: Buffer): void => {
      const match = DSR_RESPONSE.exec(data.toString());
      if (match) {
        process.stdin.removeListener('data', onData);
        if (!wasRaw) {
          try {
            process.stdin.setRawMode(false);
          } catch {
            /* noop */
          }
        }
        resolve(Number.parseInt(match[1], 10));
      }
    };

    process.stdin.on('data', onData);
    process.stdout.write(`${ESC}[6n`);

    setTimeout(() => {
      process.stdin.removeListener('data', onData);
      if (!wasRaw) {
        try {
          process.stdin.setRawMode(false);
        } catch {
          /* noop */
        }
      }
      resolve(1);
    }, 500);
  });
}

export function parseSgrMouseEvent(data: string): MouseEvent | null {
  const match = SGR_MOUSE_EVENT.exec(data);
  if (!match) return null;

  const flags = Number.parseInt(match[1], 10);
  const x = Number.parseInt(match[2], 10);
  const y = Number.parseInt(match[3], 10);
  const released = match[4] === 'm';

  if (flags & 64) return null;

  return {
    button: flags & 3,
    shift: !!(flags & 4),
    meta: !!(flags & 8),
    ctrl: !!(flags & 16),
    x,
    y,
    released,
  };
}
