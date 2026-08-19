import { describe, expect, it } from 'vitest';
import { fitImageCells, nextImageId, placeholderGrid } from '../src/lib/kittyGraphics.js';

const CELL = { widthPx: 8, heightPx: 16 };
const ESC_CODE = 27;

/**
 * Strip "ESC [ ... m" SGR sequences without a regex literal, since biome's
 * control-character rule and its regex-literal-preference rule disagree
 * about whether a raw escape byte belongs in one (kittyGraphics.ts hits the same
 * tension and works around it with new RegExp() instead).
 */
function stripSgr(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === ESC_CODE && s[i + 1] === '[') {
      let j = i + 2;
      while (j < s.length && s[j] !== 'm') j++;
      i = j;
      continue;
    }
    out += s[i];
  }
  return out;
}

describe('fitImageCells', () => {
  it('keeps a landscape image within maxCols and scales rows by aspect ratio', () => {
    const { cols, rows } = fitImageCells(1600, 900, 80, CELL);
    expect(cols).toBe(80);
    expect(rows).toBeGreaterThan(0);
    // display px width / display px height should roughly track the image's own ratio
    const displayW = cols * CELL.widthPx;
    const displayH = rows * CELL.heightPx;
    expect(displayW / displayH).toBeCloseTo(1600 / 900, 0);
  });

  it('gives a portrait image more rows than a landscape image at the same width', () => {
    const landscape = fitImageCells(1600, 900, 80, CELL);
    const portrait = fitImageCells(900, 1600, 80, CELL);
    expect(portrait.rows).toBeGreaterThan(landscape.rows);
  });

  it('keeps a square image roughly square in cell-aspect-adjusted terms', () => {
    const { cols, rows } = fitImageCells(1000, 1000, 40, CELL);
    expect(cols).toBe(40);
    // a square image needs roughly half as many rows as cols, since a cell
    // is about twice as tall as it is wide
    expect(rows).toBeGreaterThan(15);
    expect(rows).toBeLessThan(25);
  });

  it('never exceeds maxCols', () => {
    const { cols } = fitImageCells(5000, 200, 30, CELL);
    expect(cols).toBeLessThanOrEqual(30);
  });

  it('never returns zero in either dimension', () => {
    const { cols, rows } = fitImageCells(1, 1, 1, CELL);
    expect(cols).toBeGreaterThanOrEqual(1);
    expect(rows).toBeGreaterThanOrEqual(1);
  });
});

describe('placeholderGrid', () => {
  it('emits exactly `rows` lines', () => {
    const grid = placeholderGrid(4, 3, 0x010203);
    const body = stripSgr(grid);
    expect(body.split('\n')).toHaveLength(3);
  });

  it('gives every line `cols` placeholder characters', () => {
    const grid = placeholderGrid(5, 2, 0x010203);
    const body = stripSgr(grid);
    for (const line of body.split('\n')) {
      // each line is `cols` placeholder chars plus one combining diacritic
      // on the first char; codePointAt-based length isn't 1:1 with .length
      // for astral chars, so count code points instead
      const codePoints = Array.from(line);
      expect(codePoints.length).toBe(5 + 1); // cols placeholders + 1 diacritic
    }
  });

  it('encodes the image id in the truecolor foreground escape', () => {
    const grid = placeholderGrid(2, 1, 0x123456);
    expect(grid).toContain('[38;2;18;52;86m');
    expect(grid).toContain('[39m');
  });

  it('handles a single-column grid without a trailing repeat', () => {
    const grid = placeholderGrid(1, 1, 1);
    const body = stripSgr(grid);
    expect(Array.from(body)).toHaveLength(2); // 1 placeholder + 1 diacritic
  });

  it('throws when rows exceeds the diacritics table size', () => {
    expect(() => placeholderGrid(1, 1000, 1)).toThrow();
  });

  it('throws for non-positive cols or rows', () => {
    expect(() => placeholderGrid(0, 1, 1)).toThrow();
    expect(() => placeholderGrid(1, 0, 1)).toThrow();
  });
});

describe('nextImageId', () => {
  it('never returns zero', () => {
    for (let i = 0; i < 5; i++) expect(nextImageId()).not.toBe(0);
  });

  it('stays within 24 bits', () => {
    for (let i = 0; i < 5; i++) expect(nextImageId()).toBeLessThan(1 << 24);
  });

  it('returns distinct consecutive ids', () => {
    const a = nextImageId();
    const b = nextImageId();
    expect(a).not.toBe(b);
  });
});
