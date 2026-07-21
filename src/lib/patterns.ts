/**
 * Soft background patterns — every page gets a quiet texture + faint hue
 * wash instead of a flat ground. Categories declare `pattern`/`hue` in
 * src/data/categories.ts; anything without a declaration (e.g. a brand-new
 * tab) gets a stable pick from a hash of its slug, so no code ever needs
 * editing. The CSS for each pattern lives in src/styles/global.css
 * (`.pat-*`), drawn at whisper opacity so readability never suffers.
 */
export const PATTERN_NAMES = [
  'halftone', // photographic dot grid
  'ledger', // fine graph-paper grid
  'contours', // topographic lines
  'hatch', // rising diagonal strokes
  'weave', // open crosshatch
  'plus', // registration / viewfinder marks
  'waves', // gentle horizontal waves
] as const;

export type PatternName = (typeof PATTERN_NAMES)[number];

/** Muted hue wheel (degrees) for the top-of-page wash. */
export const HUE_WHEEL = [35, 8, 285, 150, 45, 95, 340] as const;

export interface PageTexture {
  pattern: PatternName;
  hue: number;
}

const hash = (s: string): number => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
};

/** Resolve a texture for a category (declared values win, hash fills gaps). */
export function resolveTexture(c: {
  slug: string;
  pattern?: PatternName | undefined;
  hue?: number | undefined;
}): PageTexture {
  const h = hash(c.slug);
  return {
    pattern: c.pattern ?? PATTERN_NAMES[h % PATTERN_NAMES.length]!,
    // unsigned shift: a signed `>>` can go negative for large hashes, and
    // `negative % length` yields a negative index → undefined hue.
    hue: c.hue ?? HUE_WHEEL[(h >>> 3) % HUE_WHEEL.length]!,
  };
}
