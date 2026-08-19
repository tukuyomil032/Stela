import chalk from 'chalk';

/**
 * Convert the common subset of README-flavored raw HTML to terminal text.
 *
 * marked-terminal's default `html` renderer just dims the raw markup
 * (`chalk.gray`) and leaves every tag in place. That's fine for a stray
 * `<kbd>` here and there, but READMEs that lean on HTML for centering and
 * badge layout (github.com/sindresorhus/awesome is a good example) end up
 * rendering as a wall of literal `<div>`/`<picture>`/`<sup>` tag soup.
 *
 * This is deliberately not a real HTML parser: no new dependency, and the
 * handful of tags handled here cover what READMEs actually use. `<img>` is
 * not among them — by the time this runs, extractImageUrls/
 * replaceImagesWithPlaceholders has already swapped every `<img>` for a
 * plain-text placeholder, so none reach this function.
 *
 * marked hands raw HTML to this renderer one CommonMark HTML block at a
 * time, and a block ends at the first blank line — a tag pair split across
 * one (`<a href="...">text` in one block, `</a>` in the next) arrives as two
 * separate, individually unpaired calls. Paired regexes below handle the
 * common case where open and close land in the same call; a second,
 * per-tag pass mops up whatever survives as raw escape codes so nothing
 * reaches the screen as a literal tag either way.
 */

const supportsColor = chalk.level > 0;

function sgr(code: string): string {
  return supportsColor ? `\u001B[${code}m` : '';
}

const BOLD_ON = sgr('1');
const BOLD_OFF = sgr('22');
const ITALIC_ON = sgr('3');
const ITALIC_OFF = sgr('23');
const HEADING_ON = sgr('32') + sgr('1'); // green, bold — matches marked-terminal's own heading style
const HEADING_OFF = sgr('22') + sgr('39');

const SELF_CLOSING_BR = /<br\s*\/?>/gi;
const HR = /<hr\s*\/?>/gi;
const HEADING_PAIR = /<h[1-6](?:\s[^>]*)?>([\s\S]*?)<\/h[1-6]>/gi;
const ANCHOR_PAIR = /<a\s[^>]*?href\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
const BOLD_PAIR = /<(?:b|strong)(?:\s[^>]*)?>([\s\S]*?)<\/(?:b|strong)>/gi;
const ITALIC_PAIR = /<(?:i|em)(?:\s[^>]*)?>([\s\S]*?)<\/(?:i|em)>/gi;

const ORPHAN_HEADING_OPEN = /<h[1-6](?:\s[^>]*)?>/gi;
const ORPHAN_HEADING_CLOSE = /<\/h[1-6]>/gi;
const ORPHAN_BOLD_OPEN = /<(?:b|strong)(?:\s[^>]*)?>/gi;
const ORPHAN_BOLD_CLOSE = /<\/(?:b|strong)>/gi;
const ORPHAN_ITALIC_OPEN = /<(?:i|em)(?:\s[^>]*)?>/gi;
const ORPHAN_ITALIC_CLOSE = /<\/(?:i|em)>/gi;

// Wrapper tags with no terminal equivalent: drop the tag, keep the content.
const TRANSPARENT_WRAPPERS = /<\/?(?:sup|sub|div|span|p|picture|source|center|a)(?:\s[^>]*)?\/?>/gi;
const ANY_REMAINING_TAG = /<\/?[a-zA-Z][^>]*>/g;

export function htmlToTerminalText(html: string): string {
  return (
    html
      .replace(SELF_CLOSING_BR, '\n')
      .replace(HR, () => `\n${chalk.dim('─'.repeat(40))}\n`)
      .replace(HEADING_PAIR, (_all, inner: string) => `\n${HEADING_ON}${inner}${HEADING_OFF}\n`)
      .replace(
        ANCHOR_PAIR,
        (_all, href: string, text: string) => `${text} (${chalk.blue.underline(href)})`,
      )
      .replace(BOLD_PAIR, (_all, inner: string) => `${BOLD_ON}${inner}${BOLD_OFF}`)
      .replace(ITALIC_PAIR, (_all, inner: string) => `${ITALIC_ON}${inner}${ITALIC_OFF}`)
      // Whatever tags survived the paired passes above were split across a
      // blank-line block boundary; give them a matching raw escape instead
      // of dropping the styling entirely, keeping color balanced with OFF
      // codes on the closing side.
      .replace(ORPHAN_HEADING_OPEN, `\n${HEADING_ON}`)
      .replace(ORPHAN_HEADING_CLOSE, `${HEADING_OFF}\n`)
      .replace(ORPHAN_BOLD_OPEN, BOLD_ON)
      .replace(ORPHAN_BOLD_CLOSE, BOLD_OFF)
      .replace(ORPHAN_ITALIC_OPEN, ITALIC_ON)
      .replace(ORPHAN_ITALIC_CLOSE, ITALIC_OFF)
      .replace(TRANSPARENT_WRAPPERS, '')
      .replace(ANY_REMAINING_TAG, '')
  );
}
