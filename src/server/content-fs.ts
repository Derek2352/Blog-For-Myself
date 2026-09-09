/**
 * The filesystem loader — the Next build's half of "one schema, two loaders".
 *
 * Astro's content layer globs `src/content/`, validates each file against the collection schema,
 * and hands back `{ id, data, body }`. This does the same three things with `gray-matter` and
 * `src/lib/content-schema.ts`, and **returns the same shape on purpose**, so that every pure helper
 * in `src/lib/content.ts` — the sort, the period grouping, the tag counts, the href builders —
 * works against either source without knowing which one it got. The migration's cost is bounded by
 * how much of the site can stay indifferent to the framework, and this boundary is where that is
 * decided.
 *
 * ## Images, which are the one place Astro was doing real work
 *
 * `cover: "./images/cover.svg"` is a path relative to the entry's own folder. Astro's `image()`
 * resolved it, hashed it into `dist/_astro/`, and — the part that matters — read its intrinsic
 * width and height so `<Image>` could emit them and stop the page reflowing as covers load.
 *
 * A static export has no such helper, so both halves are done here rather than dropped:
 *
 *  - **the file** is copied to `public/content/<collection>/<slug>/images/…` by
 *    `scripts/stage-content-images.mjs`, and the path is rewritten to match;
 *  - **the dimensions** are read with `sharp`, which this repo already depends on for the cover
 *    generator, so no new dependency and no guessed aspect ratio.
 *
 * The returned object deliberately mirrors Astro's `ImageMetadata` field for field. A component
 * that only reads `src`, `width`, `height` and `format` cannot tell the two apart, which is the
 * whole point during the period when both builds are alive.
 *
 * ## What is *not* done here
 *
 * Markdown is not rendered. `body` is the raw source, exactly as Astro's `body` is, and rendering
 * happens in `src/server/markdown.ts` through the repo's own remark plugins — including
 * `remark-strip-comments`, without which the provenance notes several entries carry in HTML
 * comments would be published.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import sharp from 'sharp';
import { z } from 'zod';
import { entrySchema, logSchema } from '@/lib/content-schema';

const CONTENT_ROOT = path.join(process.cwd(), 'src', 'content');

/** Where staged copies land under `public/`, and therefore what the served URL starts with. */
export const STAGED_PREFIX = '/content';

/** Astro's `ImageMetadata`, as much of it as anything on this site actually reads. */
export interface StaticImage {
  src: string;
  width: number;
  height: number;
  format: string;
}

/**
 * One item, shaped like Astro's `CollectionEntry`.
 *
 * `id` is the slug with `/index.md` stripped, matching `generateId` in `content.config.ts` — so
 * every URL this site has ever emitted stays the URL it was.
 */
export interface Loaded<T> {
  id: string;
  data: T;
  body: string;
  filePath: string;
}

/**
 * Read an image's real dimensions.
 *
 * SVG is the reason this is not simply `sharp(file).metadata()` and done: for an SVG, sharp
 * reports the *rasterisation* size it would render at, which follows the `width`/`height`
 * attributes when they exist and falls back to a density-derived guess when only a `viewBox`
 * does. Every cover on this site is a generated SVG, so that fallback is not a corner case — it
 * is the common path, and a wrong aspect ratio there means every card on the home page reflows.
 * The viewBox is read directly when present, because it is the authoritative ratio.
 */
async function measure(file: string): Promise<Omit<StaticImage, 'src'>> {
  if (file.endsWith('.svg')) {
    const src = await readFile(file, 'utf8');
    const viewBox = /viewBox\s*=\s*["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)/.exec(src);
    if (viewBox) {
      return { width: Math.round(Number(viewBox[1])), height: Math.round(Number(viewBox[2])), format: 'svg' };
    }
    const w = /\bwidth\s*=\s*["'](\d+)/.exec(src);
    const h = /\bheight\s*=\s*["'](\d+)/.exec(src);
    if (w && h) return { width: Number(w[1]), height: Number(h[1]), format: 'svg' };
    throw new Error(`${file}: an SVG with neither a viewBox nor width/height has no intrinsic size`);
  }
  const meta = await sharp(file).metadata();
  if (!meta.width || !meta.height) throw new Error(`${file}: no intrinsic dimensions`);
  return { width: meta.width, height: meta.height, format: meta.format ?? 'unknown' };
}

/** `./images/cover.svg` in `entries/foo/` → the staged public URL, measured. */
async function resolveImage(collection: string, slug: string, ref: string): Promise<StaticImage> {
  const rel = ref.replace(/^\.\//, '');
  const abs = path.join(CONTENT_ROOT, collection, slug, rel);
  const { width, height, format } = await measure(abs);
  return { src: `${STAGED_PREFIX}/${collection}/${slug}/${rel}`, width, height, format };
}

/** Every `<slug>/index.md` under a collection, in directory order (callers sort). */
async function slugsIn(collection: string): Promise<string[]> {
  const dir = path.join(CONTENT_ROOT, collection);
  const found = await readdir(dir, { withFileTypes: true });
  return found
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .map((d) => d.name)
    .sort();
}

/**
 * Load and validate one collection.
 *
 * Takes the schema already built rather than a factory, because Zod's input and output types
 * diverge the moment a field has a `.default()` — `tags` is `string[]` coming out and
 * `string[] | undefined` going in — and a generic written over the output type alone cannot
 * describe that. Inferring from the built schema lets both sides be exactly what Zod says.
 *
 * The image fields validate as plain strings and are resolved *after* validation rather than
 * inside it, because resolution touches the disk and a Zod schema that reads files is a schema
 * that cannot be reused — including by the Astro side, which is the entire point of sharing it.
 */
async function load<S extends z.ZodTypeAny>(
  collection: 'entries' | 'logs',
  schema: S,
): Promise<Loaded<z.infer<S>>[]> {
  const out: Loaded<z.infer<S>>[] = [];
  for (const slug of await slugsIn(collection)) {
    const filePath = path.join(CONTENT_ROOT, collection, slug, 'index.md');
    const raw = await readFile(filePath, 'utf8');
    const { data, content } = matter(raw);
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      /* Loud and located. Astro's own failure names the file and the field, and a migration that
         degraded that into "invalid frontmatter" would make every future content mistake harder
         to fix than it was before. */
      const issues = parsed.error.issues
        .map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('\n');
      throw new Error(`${collection}/${slug}/index.md — frontmatter does not validate:\n${issues}`);
    }
    out.push({ id: slug, data: parsed.data, body: content, filePath });
  }
  return out;
}

type RawEntry = z.infer<ReturnType<typeof entrySchema<z.ZodString>>>;
type RawLog = z.infer<ReturnType<typeof logSchema<z.ZodString>>>;

/** An entry, with its images resolved to staged URLs and measured. */
export type FsEntry = Omit<RawEntry, 'cover' | 'gallery'> & {
  cover: StaticImage;
  gallery: { src: StaticImage; alt: string; caption?: string }[];
};

/** A log, same treatment for its one optional image. */
export type FsLog = Omit<RawLog, 'image'> & { image?: StaticImage };

export async function loadEntries(): Promise<Loaded<FsEntry>[]> {
  const rows = await load('entries', entrySchema(z.string()));
  return Promise.all(
    rows.map(async (r) => ({
      ...r,
      data: {
        ...r.data,
        cover: await resolveImage('entries', r.id, r.data.cover),
        gallery: await Promise.all(
          r.data.gallery.map(async (g) => ({ ...g, src: await resolveImage('entries', r.id, g.src) })),
        ),
      },
    })),
  );
}

export async function loadLogs(): Promise<Loaded<FsLog>[]> {
  const rows = await load('logs', logSchema(z.string()));
  return Promise.all(
    rows.map(async (r) => ({
      ...r,
      data: {
        ...r.data,
        image: r.data.image ? await resolveImage('logs', r.id, r.data.image) : undefined,
      },
    })),
  );
}
