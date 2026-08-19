import { describe, expect, it } from 'vitest';
import {
  extractImageUrls,
  maskCodeBlocks,
  replaceImagesWithPlaceholders,
  resolveImageUrl,
  shouldSkipImage,
} from '../src/lib/readme.js';

describe('resolveImageUrl', () => {
  const owner = 'owner';
  const repo = 'repo';
  const branch = 'main';

  it('resolves a plain relative path', () => {
    expect(resolveImageUrl('docs/a.png', owner, repo, branch)).toBe(
      'https://raw.githubusercontent.com/owner/repo/main/docs/a.png',
    );
  });

  it('resolves a ./ prefixed relative path', () => {
    expect(resolveImageUrl('./a.png', owner, repo, branch)).toBe(
      'https://raw.githubusercontent.com/owner/repo/main/a.png',
    );
  });

  it('resolves a ../ relative path via normal URL rules', () => {
    expect(resolveImageUrl('docs/../img/a.png', owner, repo, branch)).toBe(
      'https://raw.githubusercontent.com/owner/repo/main/img/a.png',
    );
  });

  it('treats a leading slash as repo-root relative', () => {
    expect(resolveImageUrl('/a.png', owner, repo, branch)).toBe(
      'https://raw.githubusercontent.com/owner/repo/main/a.png',
    );
  });

  it('passes through an absolute https URL unchanged', () => {
    expect(resolveImageUrl('https://example.com/x.png', owner, repo, branch)).toBe(
      'https://example.com/x.png',
    );
  });

  it('rewrites a github.com blob URL to raw.githubusercontent.com', () => {
    expect(
      resolveImageUrl('https://github.com/owner/repo/blob/main/docs/a.png', owner, repo, branch),
    ).toBe('https://raw.githubusercontent.com/owner/repo/main/docs/a.png');
  });

  it('returns null for a data: URI', () => {
    expect(resolveImageUrl('data:image/png;base64,abcd', owner, repo, branch)).toBeNull();
  });

  it('strips query strings and fragments from relative paths', () => {
    expect(resolveImageUrl('a.png?raw=true#frag', owner, repo, branch)).toBe(
      'https://raw.githubusercontent.com/owner/repo/main/a.png',
    );
  });
});

describe('shouldSkipImage', () => {
  it('skips SVG files', () => {
    expect(shouldSkipImage('https://raw.githubusercontent.com/o/r/main/logo.svg')).toBe(true);
  });

  it('skips known badge hosts', () => {
    expect(shouldSkipImage('https://img.shields.io/badge/build-passing-green.svg')).toBe(true);
  });

  it('skips paths containing /badge/', () => {
    expect(shouldSkipImage('https://example.com/badges/build.png')).toBe(true);
  });

  it('does not skip an ordinary screenshot', () => {
    expect(shouldSkipImage('https://raw.githubusercontent.com/o/r/main/screenshot.png')).toBe(
      false,
    );
  });

  it('skips URLs it cannot parse', () => {
    expect(shouldSkipImage('not a url')).toBe(true);
  });
});

describe('maskCodeBlocks', () => {
  it('blanks a fenced code block while preserving line count', () => {
    const md = 'before\n```js\nconst x = 1;\n```\nafter';
    const masked = maskCodeBlocks(md);
    expect(masked.split('\n')).toHaveLength(md.split('\n').length);
    expect(masked).not.toContain('const x = 1;');
    expect(masked).toContain('before');
    expect(masked).toContain('after');
  });

  it('blanks inline code spans', () => {
    const md = 'see `![alt](x.png)` here';
    expect(maskCodeBlocks(md)).not.toContain('![alt](x.png)');
  });
});

describe('extractImageUrls', () => {
  const owner = 'owner';
  const repo = 'repo';
  const branch = 'main';

  it('extracts a standard markdown image', () => {
    const images = extractImageUrls('![alt text](docs/a.png)', owner, repo, branch);
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({
      alt: 'alt text',
      url: 'https://raw.githubusercontent.com/owner/repo/main/docs/a.png',
      skip: false,
    });
  });

  it('extracts an image with a title', () => {
    const images = extractImageUrls('![alt](a.png "a title")', owner, repo, branch);
    expect(images).toHaveLength(1);
    expect(images[0].url).toBe('https://raw.githubusercontent.com/owner/repo/main/a.png');
  });

  it('extracts an html <img> tag with alt', () => {
    const images = extractImageUrls('<img src="a.png" alt="hi">', owner, repo, branch);
    expect(images).toHaveLength(1);
    expect(images[0].alt).toBe('hi');
  });

  it('ignores image syntax inside a fenced code block', () => {
    const md = '```\n![alt](nope.png)\n```';
    expect(extractImageUrls(md, owner, repo, branch)).toHaveLength(0);
  });

  it('ignores image syntax inside inline code', () => {
    const md = 'text `![alt](nope.png)` more';
    expect(extractImageUrls(md, owner, repo, branch)).toHaveLength(0);
  });

  it('does not extract reference-style images', () => {
    const md = '![alt][ref]\n\n[ref]: a.png';
    expect(extractImageUrls(md, owner, repo, branch)).toHaveLength(0);
  });

  it('marks badge images as skip', () => {
    const images = extractImageUrls(
      '![badge](https://img.shields.io/badge/build-passing-green.svg)',
      owner,
      repo,
      branch,
    );
    expect(images[0].skip).toBe(true);
  });

  it('widens raw to the whole link when an image is wrapped in one', () => {
    const md = '[![banner](banner.png)](https://example.com/click)';
    const images = extractImageUrls(md, owner, repo, branch);
    expect(images).toHaveLength(1);
    expect(images[0].raw).toBe(md);
  });

  it('does not widen an image that merely sits next to a link', () => {
    const md = '![alt](a.png) and [text](https://example.com)';
    const images = extractImageUrls(md, owner, repo, branch);
    expect(images).toHaveLength(1);
    expect(images[0].raw).toBe('![alt](a.png)');
  });
});

describe('replaceImagesWithPlaceholders', () => {
  const owner = 'owner';
  const repo = 'repo';
  const branch = 'main';

  it('replaces every image and leaves the code block untouched', () => {
    const md = 'before ![a](a.png) middle ![b](b.png) after\n```\n![c](c.png)\n```';
    const images = extractImageUrls(md, owner, repo, branch);
    const out = replaceImagesWithPlaceholders(md, images);

    expect(out).toContain('![c](c.png)');
    for (let i = 0; i < images.length; i++) {
      expect(out).toContain(`STELA_IMG_${i}`);
    }
  });

  it('inlines images not listed in the block set instead of isolating them', () => {
    const md = 'before ![badge](badge.svg) after';
    const images = extractImageUrls(md, owner, repo, branch);
    const out = replaceImagesWithPlaceholders(md, images, new Set());

    expect(out).not.toContain('STELA_IMG');
    expect(out).toBe('before [image: badge] after');
  });

  it('replaces the whole wrapping link when an image is its sole content', () => {
    const md = '[![badge](badge.svg)](https://example.com)';
    const images = extractImageUrls(md, owner, repo, branch);
    const out = replaceImagesWithPlaceholders(md, images, new Set());

    // The link cannot be preserved: marked can't parse a link body cut into
    // a separate paragraph, so the whole [![]()](...)  span is consumed and
    // replaced as one unit, not just the inner image.
    expect(out).not.toContain('STELA_IMG');
    expect(out).not.toContain('](https://example.com)');
    expect(out).toBe('[image: badge]');
  });
});
