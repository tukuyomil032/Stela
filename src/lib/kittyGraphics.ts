/**
 * Kitty Graphics Protocol, Unicode Placeholder mode.
 *
 * Full protocol: https://sw.kovidgoyal.net/kitty/graphics-protocol/
 *
 * terminal-image's own Kitty path writes a raster image directly at the
 * cursor's current position and returns nothing to compose into a string —
 * fine for a one-shot print, useless for a pager that builds one big string
 * up front and re-slices arbitrary ranges of it on every keystroke.
 *
 * The Unicode Placeholder mode sidesteps that: an image is transmitted once
 * (keyed by an id), and a run of ordinary-looking placeholder characters
 * (U+10EEEE) with an encoded foreground color and combining diacritics is
 * embedded directly in the text. Because it's just text, it survives being
 * cut into lines and re-sliced by wrapAnsiLine exactly like the ANSI
 * half-block path already does.
 */

const ESC = '\u001B';
const APC_START = `${ESC}_G`;
const APC_END = `${ESC}\\`;
const PLACEHOLDER = '\u{10EEEE}';

/**
 * Row-encoding combining diacritics, index = row number.
 *
 * Only the first cell of each placeholder row carries a diacritic; the
 * terminal fills in column order from there, so no per-column encoding is
 * needed. Sourced from https://github.com/AnswerDotAI/kittytgp (itself
 * derived from Unicode 6.0.0 combining marks), which documents the scheme
 * this file implements.
 */
const ROW_DIACRITICS: number[] = [
  0x0305, 0x030d, 0x030e, 0x0310, 0x0312, 0x033d, 0x033e, 0x033f, 0x0346, 0x034a, 0x034b, 0x034c,
  0x0350, 0x0351, 0x0352, 0x0357, 0x035b, 0x0363, 0x0364, 0x0365, 0x0366, 0x0367, 0x0368, 0x0369,
  0x036a, 0x036b, 0x036c, 0x036d, 0x036e, 0x036f, 0x0483, 0x0484, 0x0485, 0x0486, 0x0487, 0x0592,
  0x0593, 0x0594, 0x0595, 0x0597, 0x0598, 0x0599, 0x059c, 0x059d, 0x059e, 0x059f, 0x05a0, 0x05a1,
  0x05a8, 0x05a9, 0x05ab, 0x05ac, 0x05af, 0x05c4, 0x0610, 0x0611, 0x0612, 0x0613, 0x0614, 0x0615,
  0x0616, 0x0617, 0x0657, 0x0658, 0x0659, 0x065a, 0x065b, 0x065d, 0x065e, 0x06d6, 0x06d7, 0x06d8,
  0x06d9, 0x06da, 0x06db, 0x06dc, 0x06df, 0x06e0, 0x06e1, 0x06e2, 0x06e4, 0x06e7, 0x06e8, 0x06eb,
  0x06ec, 0x0730, 0x0732, 0x0733, 0x0735, 0x0736, 0x073a, 0x073d, 0x073f, 0x0740, 0x0741, 0x0743,
  0x0745, 0x0747, 0x0749, 0x074a, 0x07eb, 0x07ec, 0x07ed, 0x07ee, 0x07ef, 0x07f0, 0x07f1, 0x07f3,
  0x0816, 0x0817, 0x0818, 0x0819, 0x081b, 0x081c, 0x081d, 0x081e, 0x081f, 0x0820, 0x0821, 0x0822,
  0x0823, 0x0825, 0x0826, 0x0827, 0x0829, 0x082a, 0x082b, 0x082c, 0x082d, 0x0951, 0x0953, 0x0954,
  0x0f82, 0x0f83, 0x0f86, 0x0f87, 0x135d, 0x135e, 0x135f, 0x17dd, 0x193a, 0x1a17, 0x1a75, 0x1a76,
  0x1a77, 0x1a78, 0x1a79, 0x1a7a, 0x1a7b, 0x1a7c, 0x1b6b, 0x1b6d, 0x1b6e, 0x1b6f, 0x1b70, 0x1b71,
  0x1b72, 0x1b73, 0x1cd0, 0x1cd1, 0x1cd2, 0x1cda, 0x1cdb, 0x1ce0, 0x1dc0, 0x1dc1, 0x1dc3, 0x1dc4,
  0x1dc5, 0x1dc6, 0x1dc7, 0x1dc8, 0x1dc9, 0x1dcb, 0x1dcc, 0x1dd1, 0x1dd2, 0x1dd3, 0x1dd4, 0x1dd5,
  0x1dd6, 0x1dd7, 0x1dd8, 0x1dd9, 0x1dda, 0x1ddb, 0x1ddc, 0x1ddd, 0x1dde, 0x1ddf, 0x1de0, 0x1de1,
  0x1de2, 0x1de3, 0x1de4, 0x1de5, 0x1de6, 0x1dfe, 0x20d0, 0x20d1, 0x20d4, 0x20d5, 0x20d6, 0x20d7,
  0x20db, 0x20dc, 0x20e1, 0x20e7, 0x20e9, 0x20f0, 0x2cef, 0x2cf0, 0x2cf1, 0x2de0, 0x2de1, 0x2de2,
  0x2de3, 0x2de4, 0x2de5, 0x2de6, 0x2de7, 0x2de8, 0x2de9, 0x2dea, 0x2deb, 0x2dec, 0x2ded, 0x2dee,
  0x2def, 0x2df0, 0x2df1, 0x2df2, 0x2df3, 0x2df4, 0x2df5, 0x2df6, 0x2df7, 0x2df8, 0x2df9, 0x2dfa,
  0x2dfb, 0x2dfc, 0x2dfd, 0x2dfe, 0x2dff, 0xa66f, 0xa67c, 0xa67d, 0xa6f0, 0xa6f1, 0xa8e0, 0xa8e1,
  0xa8e2, 0xa8e3, 0xa8e4, 0xa8e5, 0xa8e6, 0xa8e7, 0xa8e8, 0xa8e9, 0xa8ea, 0xa8eb, 0xa8ec, 0xa8ed,
  0xa8ee, 0xa8ef, 0xa8f0, 0xa8f1, 0xaab0, 0xaab2, 0xaab3, 0xaab7, 0xaab8, 0xaabe, 0xaabf, 0xaac1,
  0xfe20, 0xfe21, 0xfe22, 0xfe23, 0xfe24, 0xfe25, 0xfe26, 0x10a0f, 0x10a38, 0x1d185, 0x1d186,
  0x1d187, 0x1d188, 0x1d189, 0x1d1aa, 0x1d1ab, 0x1d1ac, 0x1d1ad, 0x1d242, 0x1d243, 0x1d244,
];

const CHUNK_SIZE = 4096;
const MAX_ROWS = ROW_DIACRITICS.length;
const PROBE_ID = 0x00abcdef;

export interface KittyCapability {
  supported: boolean;
  cellWidthPx: number;
  cellHeightPx: number;
}

const FALLBACK_CELL: { widthPx: number; heightPx: number } = { widthPx: 8, heightPx: 16 };

function tmuxWrap(seq: string): string {
  if (!process.env.TMUX) return seq;
  return `${ESC}Ptmux;${seq.replace(new RegExp(ESC, 'g'), ESC + ESC)}${APC_END}`;
}

function apc(control: string, payload: string): string {
  return tmuxWrap(`${APC_START}${control};${payload}${APC_END}`);
}

/**
 * Fit an image into at most `maxCols` terminal cells, preserving aspect
 * ratio via the terminal's actual cell pixel size (falls back to an assumed
 * 8x16 cell when it could not be measured).
 */
export function fitImageCells(
  imageWidthPx: number,
  imageHeightPx: number,
  maxCols: number,
  cell: { widthPx: number; heightPx: number },
): { cols: number; rows: number } {
  const cols = Math.max(1, Math.min(maxCols, Math.floor(maxCols)));
  const displayWidthPx = cols * cell.widthPx;
  const rows = Math.max(
    1,
    Math.min(MAX_ROWS, Math.ceil((imageHeightPx * displayWidthPx) / imageWidthPx / cell.heightPx)),
  );
  return { cols, rows };
}

/**
 * The placeholder text block itself: `rows` lines of `cols` placeholder
 * characters, foreground color carrying the image id, first cell of each
 * row carrying that row's diacritic.
 */
export function placeholderGrid(cols: number, rows: number, imageId: number): string {
  if (rows > MAX_ROWS) throw new RangeError(`rows must be <= ${MAX_ROWS}`);
  if (cols < 1 || rows < 1) throw new RangeError('cols and rows must be >= 1');

  const r = (imageId >> 16) & 0xff;
  const g = (imageId >> 8) & 0xff;
  const b = imageId & 0xff;
  const colorOn = `${ESC}[38;2;${r};${g};${b}m`;
  const colorOff = `${ESC}[39m`;

  // The color escape is repeated on every row, not set once for the whole
  // grid: the pager clears and redraws only whatever line range is on
  // screen, and a row whose color escape scrolled off carries no way to
  // tell the terminal which image its placeholder cells belong to. Kitty
  // then has nothing to paint and the image vanishes for good.
  const lines: string[] = [];
  for (let row = 0; row < rows; row++) {
    const first = PLACEHOLDER + String.fromCodePoint(ROW_DIACRITICS[row]);
    lines.push(colorOn + first + PLACEHOLDER.repeat(cols - 1) + colorOff);
  }

  return lines.join('\n');
}

let nextId = 1;

/** A fresh, non-zero id fitting in the 24 bits the color-encoding scheme uses. */
export function nextImageId(): number {
  const id = nextId;
  nextId = (nextId % 0xff_ffff) + 1;
  return id;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Read width/height straight out of a PNG's IHDR chunk, no decode needed.
 *
 * Kitty's `f=100` transmission format is PNG only. Non-PNG buffers (JPEG,
 * BMP, TIFF — the other formats the ANSI path accepts) return null here, so
 * the caller falls back to ANSI half-blocks for those instead of pulling in
 * an image-conversion dependency just to re-encode them.
 */
export function pngDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  if (buf.readUInt32BE(8) !== 13 || buf.toString('ascii', 12, 16) !== 'IHDR') return null;

  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return width > 0 && height > 0 ? { width, height } : null;
}

function chunkBase64(base64: string): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < base64.length; i += CHUNK_SIZE) chunks.push(base64.slice(i, i + CHUNK_SIZE));
  return chunks.length > 0 ? chunks : [''];
}

/**
 * Transmit a PNG and register it as a virtual (Unicode-placeholder) image.
 *
 * Side-effecting: writes directly to stdout. Safe to call at any time,
 * unlike the direct-display `a=T` (no `U=1`) path — there is no cursor
 * position involved until the placeholder text itself is printed elsewhere.
 */
export function transmitImage(png: Buffer, imageId: number, cols: number, rows: number): void {
  const chunks = chunkBase64(png.toString('base64'));
  for (const [i, chunk] of chunks.entries()) {
    const more = i < chunks.length - 1 ? 1 : 0;
    const control =
      i === 0 ? `a=T,f=100,q=2,U=1,i=${imageId},c=${cols},r=${rows},m=${more}` : `q=2,m=${more}`;
    process.stdout.write(apc(control, chunk));
  }
}

/** Free previously transmitted images by id. */
export function deleteImages(imageIds: number[]): void {
  for (const id of imageIds) {
    process.stdout.write(apc(`a=d,d=I,i=${id}`, ''));
  }
}

function parseCellSize(response: string): { widthPx: number; heightPx: number } | null {
  const m = response.match(new RegExp(`${ESC}\\[6;(\\d+);(\\d+)t`));
  if (!m) return null;
  const heightPx = Number(m[1]);
  const widthPx = Number(m[2]);
  if (!(widthPx > 0) || !(heightPx > 0)) return null;
  return { widthPx, heightPx };
}

function parseKittySupport(response: string): boolean {
  return response.includes(`${APC_START}i=${PROBE_ID}`);
}

/**
 * Probe once for Kitty graphics support and terminal cell pixel size.
 *
 * Sends a throwaway `a=q` graphics query, a cell-size query (XTWINOPS
 * `CSI 16 t`), and a DA1 query (`CSI c`, answered by every terminal) in one
 * write, then reads stdin until the DA1 reply arrives or a timeout elapses.
 * A terminal that doesn't support graphics never answers the `a=q` part, so
 * silence past the timeout means "unsupported", not "broken".
 *
 * Must be called while stdin has no other keypress listener attached — the
 * caller detaches its own listener before awaiting this.
 */
export function detectKittySupport(timeoutMs = 200): Promise<KittyCapability> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      resolve({
        supported: false,
        cellWidthPx: FALLBACK_CELL.widthPx,
        cellHeightPx: FALLBACK_CELL.heightPx,
      });
      return;
    }

    let settled = false;
    let buffer = '';
    const timer = setTimeout(finish, timeoutMs);

    function finish(): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      process.stdin.removeListener('data', onData);

      const cell = parseCellSize(buffer) ?? FALLBACK_CELL;
      resolve({
        supported: parseKittySupport(buffer),
        cellWidthPx: cell.widthPx,
        cellHeightPx: cell.heightPx,
      });
    }

    // DA1 replies as "ESC [ ? ... c" -- its arrival means every earlier
    // query this terminal was going to answer already has (or never will).
    const DA1_REPLY = new RegExp(`${ESC}\\[\\?[0-9;]*c`);

    function onData(chunk: Buffer): void {
      buffer += chunk.toString('utf8');
      if (DA1_REPLY.test(buffer)) finish();
    }

    process.stdin.on('data', onData);

    const probeImage = apc(`i=${PROBE_ID},s=1,v=1,a=q,t=d,f=24`, 'AAAA');
    process.stdout.write(`${probeImage}${ESC}[16t${ESC}[c`);
  });
}
