import stringWidth from 'string-width';
import { describe, expect, it } from 'vitest';
import { wrapAnsiLine } from '../src/lib/readmePager.js';

const ESC = String.fromCharCode(27);
const strip = (s: string): string => s.replace(new RegExp(`${ESC}\\[[0-9;]*m`, 'g'), '');

describe('wrapAnsiLine', () => {
  it('returns the line unchanged when it already fits', () => {
    expect(wrapAnsiLine('abcd', 4)).toEqual(['abcd']);
  });

  it('returns the line unchanged for an empty string', () => {
    expect(wrapAnsiLine('', 4)).toEqual(['']);
  });

  it('splits a plain long line into pieces that each fit the width', () => {
    const pieces = wrapAnsiLine('abcdefghij', 4);
    expect(pieces.join('')).toBe('abcdefghij');
    for (const p of pieces) expect(stringWidth(p)).toBeLessThanOrEqual(4);
  });

  it('does not split a full-width character in half', () => {
    const line = 'あいうえお'; // each is width 2
    const pieces = wrapAnsiLine(line, 5);
    for (const p of pieces) expect(stringWidth(p)).toBeLessThanOrEqual(5);
    expect(pieces.map(strip).join('')).toBe(line);
  });

  it('keeps every piece within width when SGR codes are present', () => {
    const line = `${ESC}[31mabcdefgh${ESC}[39m`;
    const pieces = wrapAnsiLine(line, 4);
    for (const p of pieces) expect(stringWidth(p)).toBeLessThanOrEqual(4);
    expect(pieces.map(strip).join('')).toBe(strip(line));
  });

  it('carries an open SGR style across a wrap boundary', () => {
    const line = `${ESC}[1m${ESC}[31mhello world${ESC}[0m tail`;
    const pieces = wrapAnsiLine(line, 6);
    // every piece after the first that still carries color should start with an escape
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.map(strip).join('')).toBe(strip(line));
  });

  it('does not split exactly at the width boundary', () => {
    expect(wrapAnsiLine('abcd', 4)).toEqual(['abcd']);
    expect(wrapAnsiLine('abcde', 4).length).toBeGreaterThan(1);
  });
});
