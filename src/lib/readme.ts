import type { MarkedTerminalOptions } from 'marked-terminal';

const RAW_BASE = 'https://raw.githubusercontent.com';

/** Hosts that serve status badges. Fetching them costs time and shows nothing. */
const BADGE_HOSTS =
  /(?:^|\.)(?:shields\.io|badgen\.net|badge\.fury\.io|codecov\.io|coveralls\.io|travis-ci\.(?:org|com)|circleci\.com|app\.netlify\.com|forthebadge\.com|herokucdn\.com|api\.codeclimate\.com|snyk\.io)$/i;

/** jimp, which terminal-image builds on, decodes only these. */
const SUPPORTED_IMAGE_TYPE = /^image\/(png|jpeg|jpg|bmp|tiff)\b/i;

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const DEFAULT_MAX_IMAGES = 12;
const DEFAULT_CONCURRENCY = 4;

const MD_IMAGE = /!\[([^\]]*)\]\(\s*(<[^>]+>|[^\s)]+?)(?:\s+["'][^"']*["'])?\s*\)/g;
const HTML_IMAGE = /<img\b[^>]*?>/gi;

export interface RenderReadmeOptions {
  owner: string;
  repo: string;
  defaultBranch: string;
  width: number;
  token?: string;
  maxImages?: number;
  concurrency?: number;
}

export interface ExtractedImage {
  /** The exact substring in the markdown that produced this image. */
  raw: string;
  /** Absolute URL, or null when the source could not be resolved. */
  url: string | null;
  alt: string;
  /** True when we deliberately will not fetch this one (badge, SVG, ...). */
  skip: boolean;
}

function stripQuery(s: string): string {
  return s.split('?')[0].split('#')[0];
}

/**
 * Turn a markdown image source into an absolute URL.
 *
 * Relative paths resolve against raw.githubusercontent.com, and github.com
 * blob/raw links are rewritten to the same host so they return image bytes
 * rather than an HTML page.
 */
export function resolveImageUrl(
  src: string,
  owner: string,
  repo: string,
  branch: string,
): string | null {
  const s = src.trim().replace(/^</, '').replace(/>$/, '');
  if (!s || s.startsWith('data:')) return null;

  if (s.startsWith('//')) return `https:${s}`;

  if (/^https?:\/\//i.test(s)) {
    const blob = s.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:blob|raw)\/(.+)$/i);
    if (blob) return `${RAW_BASE}/${blob[1]}/${blob[2]}/${stripQuery(blob[3])}`;
    return s.split('#')[0];
  }

  // A leading slash means "repository root" in a GitHub README, not site root
  const rel = stripQuery(s.replace(/^\.?\//, ''));
  if (!rel) return null;

  try {
    return new URL(rel, `${RAW_BASE}/${owner}/${repo}/${branch}/`).toString();
  } catch {
    return null;
  }
}

/**
 * Decide whether an image is worth a round trip.
 *
 * SVG is out because rasterizing it would mean pulling in a native dependency,
 * and badges are out because a README with twenty of them would spend seconds
 * fetching pictures that say "build passing".
 */
export function shouldSkipImage(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return true;
  }

  if (/\.(?:svg|webp|avif)$/i.test(u.pathname)) return true;
  if (BADGE_HOSTS.test(u.hostname)) return true;
  if (/\/badges?(?:\/|$)/i.test(u.pathname)) return true;
  return false;
}

/**
 * Blank out fenced and inline code so image syntax inside it is left alone.
 *
 * Only the characters are removed, never the newlines, so every offset in the
 * mask still points at the same character in the original. That is what lets
 * the caller match against the mask and slice from the source.
 */
export function maskCodeBlocks(markdown: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, ' ');
  return markdown
    .replace(/^([ \t]*)(```|~~~)[\s\S]*?^[ \t]*\2[ \t]*$/gm, blank)
    .replace(/`+[^`\n]*`+/g, blank);
}

function build(
  raw: string,
  src: string,
  alt: string,
  owner: string,
  repo: string,
  branch: string,
): ExtractedImage {
  const url = resolveImageUrl(src, owner, repo, branch);
  return { raw, url, alt: alt.trim(), skip: url === null || shouldSkipImage(url) };
}

export function extractImageUrls(
  markdown: string,
  owner: string,
  repo: string,
  branch: string,
): ExtractedImage[] {
  const masked = maskCodeBlocks(markdown);
  const images: ExtractedImage[] = [];

  for (const m of masked.matchAll(MD_IMAGE)) {
    const at = m.index ?? 0;
    const raw = markdown.slice(at, at + m[0].length);
    const srcOffset = m[0].indexOf(m[2]);
    const src = markdown.slice(at + srcOffset, at + srcOffset + m[2].length);
    images.push(build(raw, src, m[1], owner, repo, branch));
  }

  for (const m of masked.matchAll(HTML_IMAGE)) {
    const at = m.index ?? 0;
    const raw = markdown.slice(at, at + m[0].length);
    const src = raw.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!src) continue;
    const alt = raw.match(/\balt\s*=\s*["']([^"']*)["']/i)?.[1] ?? '';
    images.push(build(raw, src, alt, owner, repo, branch));
  }

  return images;
}

/**
 * Private-use-area sentinel, so the token cannot collide with README prose.
 *
 * A bare word like `IMG_0` would be replaced if the README happened to contain
 * one; nothing writes U+E000 by hand.
 */
export function placeholderFor(index: number): string {
  return `\uE000STELA_IMG_${index}\uE000`;
}

const PLACEHOLDER_ANY = /\uE000STELA_IMG_(\d+)\uE000/g;

/**
 * Swap every image for its placeholder, each on its own paragraph.
 *
 * The surrounding blank lines matter: as a lone paragraph the placeholder is a
 * single token, so marked-terminal's reflow cannot split it in half and leave
 * the second half unreplaceable.
 */
export function replaceImagesWithPlaceholders(markdown: string, images: ExtractedImage[]): string {
  let out = '';
  let pos = 0;

  for (let i = 0; i < images.length; i++) {
    const at = markdown.indexOf(images[i].raw, pos);
    if (at === -1) continue;
    out += markdown.slice(pos, at);
    out += `\n\n${placeholderFor(i)}\n\n`;
    pos = at + images[i].raw.length;
  }

  return out + markdown.slice(pos);
}

async function fetchImageBuffer(url: string, token?: string): Promise<Buffer | null> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }

  // Never hand the GitHub token to a third-party image host
  const isGitHubHost =
    u.hostname === 'github.com' ||
    u.hostname === 'raw.githubusercontent.com' ||
    u.hostname.endsWith('.githubusercontent.com');

  const h: Record<string, string> = { 'User-Agent': 'stela' };
  if (token && isGitHubHost) h.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(url, {
      headers: h,
      redirect: 'follow',
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    if (!SUPPORTED_IMAGE_TYPE.test(res.headers.get('content-type') ?? '')) return null;
    if (Number(res.headers.get('content-length') ?? '0') > MAX_IMAGE_BYTES) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    // Re-check: content-length is advisory and often absent
    return buf.byteLength > MAX_IMAGE_BYTES ? null : buf;
  } catch {
    return null;
  }
}

/** Run tasks with a fixed number of workers, preserving input order. */
async function mapLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;

  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

async function toAnsiImage(buf: Buffer, width: number): Promise<string | null> {
  try {
    const { default: terminalImage } = await import('terminal-image');
    return await terminalImage.buffer(buf, {
      width: Math.max(10, Math.min(width, 60)),
      preserveAspectRatio: true,
      // Native inline-image protocols emit one escape sequence spanning many
      // rows. The pager slices output line by line, which would cut that
      // sequence in half, so ANSI half-blocks are the default here.
      preferNativeRender: process.env.STELA_README_INLINE_IMAGES === '1',
    });
  } catch {
    return null;
  }
}

function fallbackFor(image: ExtractedImage): string {
  return image.alt ? `[image: ${image.alt}]` : '[image]';
}

/**
 * Render a README to an ANSI string whose every line fits within `width`.
 *
 * Two passes, because marked's renderers are synchronous while image
 * conversion is not: fetch and convert every image up front, render the
 * markdown with placeholders standing in for them, then splice the converted
 * blocks back into the result.
 */
export async function renderReadme(
  markdown: string,
  options: RenderReadmeOptions,
): Promise<string> {
  const { owner, repo, defaultBranch, width, token } = options;
  const maxImages = options.maxImages ?? DEFAULT_MAX_IMAGES;
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;

  const images = extractImageUrls(markdown, owner, repo, defaultBranch);

  const fetchable = images.filter((img) => !img.skip).slice(0, maxImages);
  const blocks = new Map<ExtractedImage, string>();

  await mapLimit(fetchable, concurrency, async (img) => {
    if (!img.url) return;
    const buf = await fetchImageBuffer(img.url, token);
    if (!buf) return;
    const ansi = await toAnsiImage(buf, width);
    if (ansi) blocks.set(img, ansi.replace(/\n+$/, ''));
  });

  const withPlaceholders = replaceImagesWithPlaceholders(markdown, images);

  const { Marked } = await import('marked');
  const { markedTerminal } = await import('marked-terminal');

  const terminalOptions: MarkedTerminalOptions = {
    width,
    // Without these the output ignores the terminal width and the pager's
    // "one logical line is one terminal row" invariant breaks
    reflowText: true,
    tab: 2,
    image: (href) => href,
  };

  const marked = new Marked();
  marked.use(markedTerminal(terminalOptions));

  const rendered = String(await marked.parse(withPlaceholders));

  // Any placeholder that survived reflow is replaced too, so no debris shows
  const restored = rendered.replace(PLACEHOLDER_ANY, (_all, idx: string) => {
    const img = images[Number(idx)];
    if (!img) return '';
    return blocks.get(img) ?? fallbackFor(img);
  });

  return restored.replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '');
}
