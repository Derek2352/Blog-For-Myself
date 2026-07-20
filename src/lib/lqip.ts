/**
 * Build-time LQIP (low-quality image placeholder): a tiny blurred data URI
 * for a cover/photo, used as the background behind the real image so it
 * fades in gently instead of popping.
 *
 * Astro's ImageMetadata doesn't expose a filesystem path, so we resolve the
 * source file from the content folder by reading the item's frontmatter
 * (the same relative path the schema resolves). Runs at build only; results
 * are cached per source file.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const cache = new Map<string, string | null>();

/**
 * Resolve the source filesystem path of an item's cover/photo by reading the
 * relative path from its frontmatter (Astro's ImageMetadata hides the fs
 * path). Returns null if not found. Shared by LQIP and OG-card generation.
 */
export async function contentImagePath(
  kind: 'entries' | 'logs',
  id: string,
  field: 'cover' | 'image' = 'cover',
): Promise<string | null> {
  try {
    const dir = path.join(process.cwd(), 'src/content', kind, id);
    const md = await readFile(path.join(dir, 'index.md'), 'utf8');
    const m = md.match(new RegExp(`^${field}:\\s*"(.*)"`, 'm'));
    if (!m) return null;
    return path.join(dir, m[1].replace(/^\.\//, ''));
  } catch {
    return null;
  }
}

async function lqipFromFile(fsPath: string): Promise<string | null> {
  if (cache.has(fsPath)) return cache.get(fsPath)!;
  let uri: string | null = null;
  try {
    const buf = await sharp(fsPath, { density: 24 })
      .resize(24, 24, { fit: 'inside' })
      .blur(1.1)
      .jpeg({ quality: 50 })
      .toBuffer();
    uri = `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch {
    uri = null;
  }
  cache.set(fsPath, uri);
  return uri;
}

/**
 * Inline style string for a blur-up wrapper (empty when it can't be made).
 * @param kind  'entries' | 'logs'
 * @param id    the item's folder id
 * @param field frontmatter key holding the image path ('cover' or 'image')
 */
export async function lqipStyle(
  kind: 'entries' | 'logs',
  id: string,
  field: 'cover' | 'image' = 'cover',
): Promise<string | undefined> {
  const fsPath = await contentImagePath(kind, id, field);
  if (!fsPath) return undefined;
  const uri = await lqipFromFile(fsPath);
  return uri ? `background-image:url(${uri})` : undefined;
}
