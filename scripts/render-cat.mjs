/**
 * The cat, built in Blender — one render per body part per theme.
 *
 * The cat is not one picture. It is nine vector parts (tail, body, head, two ears, four legs)
 * that `cat.css` and `site-cat.ts` animate separately: legs swing about their tops, the tail about
 * its root, the ears flick, the head grooms and munches, and the arena reads the whole thing as a
 * sprite with a hit area. Replacing any of that with a raster would mean re-doing every pose.
 *
 * So the geometry stays exactly as it is, and Blender supplies only what the flat fill lacked: a
 * form. Each part's outline is inflated into a soft clay piece (`--mode part` in
 * art/blender/diorama.py), lit from the upper front left, and rendered straight on with an
 * orthographic camera fitted to that part's bounding box. The site then paints the render *inside
 * the original path* through an SVG `<pattern>` in objectBoundingBox units (`CatTextures`), so the
 * outline, the hit area and every animation are the vector's, and the shading rides along with
 * each part because a pattern fill lives in the element's own coordinate space.
 *
 * The nine parts are packed into one sprite sheet per theme (`src/assets/cat/`, staged to
 * `/assets/cat/` and cached like the other media) with their rectangles in `sprite.json` — two
 * requests for the whole cat rather than eighteen on every page.
 *
 * One render per theme because the cat is drawn in `--color-ink`, which is near-black on the light
 * theme and near-white on the dark one, and a lit form is not a tint you can recolour afterwards.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  CAT_TAIL_D,
  CAT_BODY_D,
  CAT_HEAD_D,
  CAT_EAR_FAR_D,
  CAT_EAR_NEAR_D,
  CAT_LEGS,
  catLegD,
} from '../src/lib/cat-art.ts';
import { THEMES, resolve } from '../src/design/tokens.mjs';
import { oklchToHex } from '../src/design/color.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = path.join(ROOT, 'src', 'assets', 'cat');
/** Pixels between packed parts, so filtering at a part's edge never samples its neighbour. */
const GUTTER = 4;
const DIORAMA = path.join(ROOT, 'art', 'blender', 'diorama.py');
const PY = process.env.BLENDER_PYTHON ?? 'python3';

/** The parts, by the id `CatTextures` and the two cat components use. */
export const CAT_PARTS = {
  tail: CAT_TAIL_D,
  body: CAT_BODY_D,
  head: CAT_HEAD_D,
  'ear-far': CAT_EAR_FAR_D,
  'ear-near': CAT_EAR_NEAR_D,
  ...Object.fromEntries(CAT_LEGS.map((l, i) => [`leg-${i}`, catLegD(l.x, l.lean)])),
};

/** `--color-ink` per theme, from the token source rather than a copied hex. */
function inkOf(theme) {
  const v = resolve(THEMES[theme].ink);
  return typeof v === 'string' ? v : oklchToHex(v);
}

/**
 * What the sheets were rendered from: the part outlines, the two inks, and the renderer itself.
 * Recorded in sprite.json, and a test compares it with this, so a change to any of the three
 * that was not followed by `npm run art` fails rather than shipping a cat that no longer fits.
 */
export function catKey() {
  const recipe = createHash('sha256').update(readFileSync(DIORAMA)).digest('hex').slice(0, 12);
  const inks = { light: inkOf('light'), dark: inkOf('dark') };
  return createHash('sha256').update(JSON.stringify([CAT_PARTS, inks, recipe])).digest('hex').slice(0, 16);
}

export async function renderCat({ force = false } = {}) {
  mkdirSync(OUT, { recursive: true });
  const spriteFile = path.join(OUT, 'sprite.json');
  const previous = existsSync(spriteFile) ? JSON.parse(readFileSync(spriteFile, 'utf8')) : {};
  const inks = { light: inkOf('light'), dark: inkOf('dark') };
  const key = catKey();
  if (!force && previous.key === key && ['light', 'dark'].every((t) => existsSync(path.join(OUT, `cat-${t}.webp`)))) {
    console.log('cat: current');
    return;
  }
  const tmp = mkdtempSync(path.join(tmpdir(), 'render-cat-'));
  try {
    const sheets = {};
    let parts = null;
    for (const theme of ['light', 'dark']) {
      const ink = inks[theme];
      const tiles = [];
      for (const [part, d] of Object.entries(CAT_PARTS)) {
        const svg = path.join(tmp, 'part.svg');
        writeFileSync(svg, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 40" width="64" height="40"><path d="${d}"/></svg>`);
        const png = path.join(tmp, `${part}-${theme}.png`);
        const r = spawnSync(PY, ['-I', DIORAMA, '--mode', 'part', '--svg', svg, '--out', png, '--colour', ink, '--samples', '48'], { encoding: 'utf8', maxBuffer: 64 << 20 });
        if (r.status !== 0) throw new Error(`Blender failed on cat ${part}-${theme}:\n${(r.stderr || r.stdout).slice(-2000)}`);
        // Flattened onto the flat ink: wherever the clay's rounded rim pulls in from the outline,
        // the vector's own colour shows, so the edge never opens a gap.
        const buf = await sharp(png).flatten({ background: ink }).png().toBuffer();
        const { width, height } = await sharp(buf).metadata();
        tiles.push({ part, buf, width, height });
      }
      // One shelf, left to right. Both themes render the same sizes, so one layout serves both.
      let x = 0;
      const placed = tiles.map((t) => {
        const at = { ...t, x, y: 0 };
        x += t.width + GUTTER;
        return at;
      });
      const W = x - GUTTER;
      const H = Math.max(...tiles.map((t) => t.height));
      sheets[theme] = await sharp({ create: { width: W, height: H, channels: 3, background: ink } })
        .composite(placed.map((t) => ({ input: t.buf, left: t.x, top: t.y })))
        .webp({ quality: 88, effort: 6 })
        .toBuffer();
      parts ??= { width: W, height: H, rects: Object.fromEntries(placed.map((t) => [t.part, [t.x, t.y, t.width, t.height]])) };
    }
    for (const [theme, buf] of Object.entries(sheets)) writeFileSync(path.join(OUT, `cat-${theme}.webp`), buf);
    writeFileSync(spriteFile, `${JSON.stringify({ key, ...parts }, null, 2)}\n`);
    console.log(`cat: rendered ${Object.keys(CAT_PARTS).length} parts × 2 themes → ${Object.values(sheets).map((b) => `${(b.length / 1024).toFixed(1)} KB`).join(' + ')}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
