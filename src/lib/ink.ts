/**
 * Timing and tone for the hero ink.
 *
 * Everything here is pure: no canvas, no DOM, no clock. The component
 * (src/components/InkWash.astro) owns the pixels; this file owns the shapes, so
 * the interesting decisions stay reachable from tests/ink.test.ts.
 *
 * Nothing here reads a clock or a random number. Every function takes its seed
 * as an argument, which is what lets the composition vary per visitor while
 * staying exactly reproducible for tests and measurement — see INK_SEED.
 *
 * The shapes used to live here too — a spine, bristles, deformed wash layers.
 * All of it was a picture *of* ink, which is why every new reference needed a
 * new approximation. That is now a wet-paper simulation in ./ink-field.ts, and
 * what is left here is the part that was never about appearance: when the ink
 * arrives, how long it stays, and how it dries.
 */

/**
 * How strong the wash is at its densest, as plain opacity.
 *
 * This used to mean something else: the layer composited with
 * `mix-blend-mode: difference`, so the number described how far towards a full
 * inversion the ink dragged its backdrop, and it had to sit near 1 because the
 * middle of that scale is a dead zone where text turns to grey mush.
 *
 * The soak is gone and the wash sits behind the text, so this is opacity again
 * and belongs low. It is a background: the text on top must stay comfortable,
 * and the whole point of dropping the blend was to allow a broad, light field
 * rather than a few dark blots.
 *
 * It sat at 0.2, which was too low once the ink reads in five registers: 焦墨 is
 * near-black, and five levels inside 0.2 put the top two within 4% of each
 * other, where nobody can tell them apart. This is the ceiling the darkest
 * register reaches, so it has to leave room for the tones to separate.
 *
 * The number is set by measurement, not by taste. The ink sits behind the hero
 * headline, so it trades directly against text contrast, and the readability
 * pass is what decides how far it can go. What makes the rise affordable is
 * that only the throw's dense head ever reaches the top register — the darkest
 * tone is an accent covering a few percent of the sheet, not a slab.
 */
export const INK_PEAK_ALPHA = 0.8;

/** How long the brush takes to travel its path when you arrive on the page. */
export const ENTRANCE_MS = 2200;

/**
 * The default composition — and the one every test and harness pins to.
 *
 * This used to be the *only* composition, on the reasoning that a portfolio
 * hero should be a gesture someone chose rather than a dice roll that hands one
 * reader a good stroke and the next an ugly one. That concern was right and the
 * conclusion was too strong: the answer is to roll inside a space where every
 * outcome works, not to refuse to roll.
 *
 * So the component now picks a seed per visit (see `pickSeed` in
 * src/components/InkWash.astro) and everything downstream takes the seed as an
 * argument, which is why this stays exported: measurement needs a fixed
 * composition to compare against, and every property in tests/ink-field.test.ts
 * is checked across many seeds rather than assumed from this one.
 */
export const INK_SEED = 20260802;

/** Seeded PRNG (mulberry32). Same seed ⇒ same sequence, on every platform. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hashed lattice value in [0,1] — the corners value noise interpolates between. */
function hash2(ix: number, iy: number, seed: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1274126177)) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177) | 0;
  h = (h ^ (h >>> 16)) | 0;
  return (h >>> 0) / 4294967295;
}

/**
 * Smooth 2D value noise in [0,1]. A convex combination of four lattice values,
 * so the range is guaranteed by construction rather than by clamping.
 */
export function valueNoise2(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  // smoothstep, so the lattice grid never shows as diamond creases
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
}

/**
 * Fractal brownian motion in [0,1] — several octaves of value noise, each half
 * the amplitude and twice the frequency.
 */
export function fbm(x: number, y: number, seed: number, octaves = 3): number {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2(x * freq, y * freq, seed + i * 101);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/* ------------------------------------------------------------------ *
 * Coming and going.
 * ------------------------------------------------------------------ */

/**
 * The arrival, as two envelopes.
 *
 * A mark that simply faded up reads as an image loading, so `soak` (opacity)
 * commits early while `spread` — how far the wash has flooded across the sheet —
 * is still travelling. Smoothstep rather than ease-out: an ease-out put the
 * front 72% of the way across in the first third of the time, so nothing was
 * ever seen to move.
 */
export function entrance(
  elapsedMs: number,
  delayMs = 0,
): { spread: number; soak: number } {
  const p = (elapsedMs - delayMs) / ENTRANCE_MS;
  if (p <= 0) return { spread: 0, soak: 0 };
  if (p >= 1) return { spread: 1, soak: 1 };
  const spread = p * p * (3 - 2 * p);
  const s = Math.min(1, p * 3);
  const soak = 1 - (1 - s) * (1 - s);
  return { spread, soak };
}

/** Fully present, after the entrance and after each return. */
export const HOLD_MS = 5000;
/** Drying off the page. */
export const DRY_MS = 1800;
/**
 * Gone — a clean hero.
 *
 * This was 9000, deliberately the longest phase, on the reasoning that a mark
 * present most of the time has not solved anything. That reasoning has expired.
 * It dates from when the ink could put a dark register over the headline and the
 * only protection was for it to be *absent*; readability is a tone ceiling now
 * (see TONE_CEILING), so the ink can be on the page far more of the time without
 * costing a reader anything. Nine seconds of plain hero was just a wait.
 *
 * Only this phase moved. HOLD_MS is untouched on purpose: every measurement
 * harness samples the first cycle between 1.2s and 4.8s after load, and all of
 * those stay inside the hold.
 */
export const CLEAR_MS = 3000;
/** Painting itself back. */
export const RETURN_MS = 2000;
export const CYCLE_MS = HOLD_MS + DRY_MS + CLEAR_MS + RETURN_MS;

/**
 * How much of the stroke is on the page, over one cycle.
 *
 * The ink lands, holds long enough to be seen, dries off, and leaves the sheet
 * clean for a beat before returning. That clean stretch used to be the majority
 * of the cycle, because a dark register over the headline could only be made
 * safe by absence; with the tone ceiling doing that job it is now a pause rather
 * than a wait — see CLEAR_MS.
 *
 * Takes a position *within* the cycle rather than a clock, so the caller can
 * hold time still while someone is reading without this needing to know that
 * readers exist.
 *
 * Every phase boundary is continuous. A discontinuity here would read as a
 * flicker, which is exactly the failure this feature is meant to remove.
 */
export function strokePresence(tMs: number): number {
  const t = ((tMs % CYCLE_MS) + CYCLE_MS) % CYCLE_MS;
  if (t < HOLD_MS) return 1;
  const dry = t - HOLD_MS;
  if (dry < DRY_MS) {
    const p = dry / DRY_MS;
    return 1 - p * p * (3 - 2 * p);
  }
  const clear = dry - DRY_MS;
  if (clear < CLEAR_MS) return 0;
  const back = clear - CLEAR_MS;
  const p = back / RETURN_MS;
  return p * p * (3 - 2 * p);
}

/**
 * What is left of one hair's ink as the stroke dries.
 *
 * Not a fade. Turning the whole layer down uniformly looks like an image being
 * dimmed; ink leaves paper thin-parts-first, the shredded 飛白 tail giving up
 * while the loaded head is still wet.
 *
 * That needs no new data — each hair already records how much ink it holds at
 * each sample, so raising a threshold against it takes the faintest ink first
 * and the darkest last. The stroke therefore leaves in the reverse of the order
 * it arrived.
 */
export function inkAfterDrying(inkLeft: number, presence: number): number {
  if (presence >= 1) return inkLeft;
  if (presence <= 0) return 0;
  const v = (inkLeft - (1 - presence)) / presence;
  return v <= 0 ? 0 : v >= 1 ? 1 : v;
}

