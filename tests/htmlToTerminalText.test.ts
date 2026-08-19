import { describe, expect, it } from 'vitest';
import { htmlToTerminalText } from '../src/lib/htmlToTerminalText.js';

describe('htmlToTerminalText', () => {
  it('converts <br> to a newline', () => {
    expect(htmlToTerminalText('a<br>b')).toBe('a\nb');
    expect(htmlToTerminalText('a<br/>b')).toBe('a\nb');
    expect(htmlToTerminalText('a<br />b')).toBe('a\nb');
  });

  it('converts a paired heading to styled text with surrounding newlines', () => {
    const out = htmlToTerminalText('<h2>Title</h2>');
    expect(out).toContain('Title');
    expect(out.startsWith('\n')).toBe(true);
    expect(out.endsWith('\n')).toBe(true);
    expect(out).not.toContain('<h2>');
    expect(out).not.toContain('</h2>');
  });

  it('converts a paired anchor to "text (href)" form', () => {
    const out = htmlToTerminalText('<a href="https://example.com">click</a>');
    expect(out).toContain('click');
    expect(out).toContain('https://example.com');
    expect(out).not.toContain('<a');
    expect(out).not.toContain('</a>');
  });

  it('converts paired bold and italic tags without leaving tags behind', () => {
    expect(htmlToTerminalText('<b>x</b>')).not.toMatch(/<\/?b>/);
    expect(htmlToTerminalText('<strong>x</strong>')).not.toMatch(/<\/?strong>/);
    expect(htmlToTerminalText('<i>x</i>')).not.toMatch(/<\/?i>/);
    expect(htmlToTerminalText('<em>x</em>')).not.toMatch(/<\/?em>/);
  });

  it('strips transparent wrapper tags but keeps their content', () => {
    const out = htmlToTerminalText('<div><sup>note</sup></div>');
    expect(out).toContain('note');
    expect(out).not.toMatch(/<\/?(?:div|sup)>/);
  });

  it('drops picture/source scaffolding around an already-substituted image placeholder', () => {
    const out = htmlToTerminalText('<picture><source srcset="x.svg"></picture>');
    expect(out).not.toContain('<picture>');
    expect(out).not.toContain('<source');
  });

  it('handles an orphan open tag with no matching close in the same call', () => {
    // Simulates a CommonMark HTML block split across a blank line: marked
    // hands this renderer each half separately.
    const opening = htmlToTerminalText('<a href="https://example.com"><div>');
    const closing = htmlToTerminalText('</div><b>text</b></a>');
    expect(opening).not.toMatch(/<[a-zA-Z]/);
    expect(closing).not.toMatch(/<\/?(?:div|b|a)>/);
    expect(closing).toContain('text');
  });

  it('strips any remaining unrecognized tag as a last resort', () => {
    const out = htmlToTerminalText('<kbd>Ctrl</kbd>+<kbd>C</kbd>');
    expect(out).not.toMatch(/<\/?kbd>/);
    expect(out).toContain('Ctrl');
    expect(out).toContain('C');
  });

  it('converts <hr> to a visible rule', () => {
    const out = htmlToTerminalText('<hr>');
    expect(out).not.toContain('<hr>');
    expect(out.trim().length).toBeGreaterThan(0);
  });

  it('leaves plain text with no tags untouched', () => {
    expect(htmlToTerminalText('just text')).toBe('just text');
  });
});
