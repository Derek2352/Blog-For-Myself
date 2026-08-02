/**
 * 潑墨 — the generative half of the hero ink wash.
 *
 * Everything here is pure: no canvas, no DOM, no clock. The component
 * (src/components/InkWash.astro) owns the pixels; this file owns the shapes, so
 * the interesting decisions stay reachable from tests/ink.test.ts.
 *
 * The composition is deliberately seeded from a constant rather than from the
 * visitor. A portfolio hero should be a composition someone chose, not a dice
 * roll that hands one reader a good arrangement and the next an ugly one — the
 * breathing is what keeps it from ever being the same frame twice.
 */

/** Never paint the ink stronger than this. Half the existing page wash (0.10). */
export const INK_PEAK_ALPHA = 0.05;

/** How long a cursor dab takes to dry, in milliseconds. */
export const TRAIL_MS = 2000;

/** The one composition every visitor sees. */
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
  return (
    a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy
  );
}

/**
 * Fractal brownian motion in [0,1] — several octaves of value noise, each half
 * the amplitude and twice the frequency. This is what gives an ink edge its
 * detail-within-detail rather than one smooth wobble.
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

export interface Bloom {
  /** Centre, in canvas pixels. Negative x is off the left edge, which is fine. */
  x: number;
  y: number;
  /** Base radius before the outline displaces it. */
  r: number;
  /** Relative density, 0–1. Scales the fill against INK_PEAK_ALPHA. */
  weight: number;
  /** Per-bloom breathing offset, so they never pulse in unison. */
  phase: number;
  /** How far the edge deviates from the base radius, as a fraction of it. */
  wobble: number;
}

/**
 * The composition: one large wash anchored off the left edge, thinning inward,
 * with two or three small satellites in the left half.
 *
 * The primary bloom's centre sits *outside* the canvas on purpose. A circle
 * centred in frame reads as a blot; one that arrives from off-frame reads as a
 * wash that continues past the edge, which is the whole grammar of 留白 — what
 * is left empty carries as much as what is marked.
 */
export function bloomLayout(w: number, h: number, seed = INK_SEED): Bloom[] {
  const rnd = mulberry32(seed);
  const span = Math.max(w, h);
  const blooms: Bloom[] = [
    {
      x: -w * 0.1,
      y: h * (0.4 + rnd() * 0.2),
      r: span * (0.42 + rnd() * 0.1),
      weight: 1,
      phase: rnd() * Math.PI * 2,
      wobble: 0.26 + rnd() * 0.1,
    },
  ];
  const satellites = 2 + Math.floor(rnd() * 2);
  for (let i = 0; i < satellites; i++) {
    blooms.push({
      x: w * (0.06 + rnd() * 0.34),
      y: h * (0.15 + rnd() * 0.7),
      r: span * (0.06 + rnd() * 0.1),
      weight: 0.35 + rnd() * 0.35,
      phase: rnd() * Math.PI * 2,
      // satellites wobble harder — small marks read as spatter, not as discs
      wobble: 0.34 + rnd() * 0.16,
    });
  }
  return blooms;
}

/**
 * The radii of a bloom's outline, one per angular segment — this is the
 * breathing.
 *
 * Noise is sampled on a *circle* in noise space rather than along the angle
 * directly, so segment 0 and segment n land on the same sample and the outline
 * closes without a seam. Advancing `t` slides that circle through the field,
 * which makes the perimeter creep while the centre stays put — ink bleeds at the
 * fibre, it does not travel.
 */
export function bloomOutline(
  b: Bloom,
  t: number,
  segments: number,
  seed = INK_SEED,
): number[] {
  const out = new Array<number>(segments);
  const bloomSeed = seed + Math.round(b.phase * 1000);
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const n = fbm(Math.cos(a) * 1.6 + 4 + t, Math.sin(a) * 1.6 + 4 - t * 0.6, bloomSeed, 3);
    out[i] = b.r * (1 - b.wobble + b.wobble * 2 * n);
  }
  return out;
}

/**
 * Alpha envelope for a cursor dab as it dries: 1 when fresh, 0 once TRAIL_MS has
 * passed. Squared so it holds briefly and then goes quickly, the way wet ink
 * sits and then disappears rather than fading at a constant rate.
 */
export function trailAlpha(ageMs: number): number {
  if (ageMs <= 0) return 1;
  if (ageMs >= TRAIL_MS) return 0;
  const k = 1 - ageMs / TRAIL_MS;
  return k * k;
}
