/**
 * Page wash — the single soft warm gradient behind every page.
 *
 * There used to be a per-tab *pattern* layer here too (halftone, ledger,
 * contours, waves…). It was removed: the page pattern, the patterned category
 * tiles and the grid inside placeholder covers stacked three deep on one
 * screen, which made pages feel busy on a site whose whole point is that
 * photography leads. What's left is light on paper.
 *
 * Hues are deliberately confined to a WARM BAND (amber → orange → red → wine).
 * The old wheel ran the whole spectrum — violet 285, cyan 195, green 150 — which
 * put a cool cast on half the site and fought the warm ivory/espresso/wine
 * palette. Variation is now a shift in temperature, not in hue family.
 */

/** Warm hue band (degrees): amber, orange, terracotta, red, wine. */
export const HUE_WHEEL = [32, 20, 12, 44, 26, 350, 38] as const;

/** Inclusive warm-band bounds. Anything outside reads as a colour cast. */
export const WARM_RANGE = { min: 8, max: 50 } as const;
/** Wine/red sits just below 360 rather than in 8–50; allowed as the one wrap. */
export const WARM_WRAP = { min: 340, max: 359 } as const;

/** True when a hue belongs to the warm band (or its wine wrap-around). */
export const isWarmHue = (h: number): boolean =>
  (h >= WARM_RANGE.min && h <= WARM_RANGE.max) ||
  (h >= WARM_WRAP.min && h <= WARM_WRAP.max);

/**
 * Stable string hash. Exported because the cat's treat wheel picks from a slug
 * the same way this picks a hue — one deterministic source beats two copies that
 * can drift apart.
 */
export const hash = (s: string): number => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
};

/**
 * Resolve the wash hue for a category: a declared `hue` wins, otherwise one is
 * picked from the warm band by a stable hash of the slug — so a brand-new tab
 * gets a sensible warm wash with no decision required.
 */
export function resolveWash(c: { slug: string; hue?: number | undefined }): { hue: number } {
  // unsigned shift: a signed `>>` can go negative for large hashes, and
  // `negative % length` yields a negative index → undefined hue.
  return { hue: c.hue ?? HUE_WHEEL[(hash(c.slug) >>> 3) % HUE_WHEEL.length]! };
}
