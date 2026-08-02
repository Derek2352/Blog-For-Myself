/**
 * 飛白 — the generative half of the hero brush stroke.
 *
 * Everything here is pure: no canvas, no DOM, no clock. The component
 * (src/components/InkWash.astro) owns the pixels; this file owns the shapes, so
 * the interesting decisions stay reachable from tests/ink.test.ts.
 *
 * The composition is deliberately seeded from a constant rather than from the
 * visitor. A portfolio hero should be a gesture someone chose, not a dice roll
 * that hands one reader a good stroke and the next an ugly one.
 *
 * ## Why there is no "draw the striations" function
 *
 * The white streaks running through a dry brush stroke (飛白, "flying white")
 * are not marks. They are the gaps between the hairs, showing paper where the
 * brush had no ink left to give. So the brush here is modelled as a bundle of
 * individual bristles, each tracing the spine at its own offset, each with its
 * own profile of where it ran dry. Draw the bristles and the white arrives on
 * its own — and it looks like a brush because it was made like one.
 */

/**
 * How completely the stroke inverts what it crosses.
 *
 * The canvas paints white and composites with `mix-blend-mode: difference`, so
 * this is not opacity in the usual sense — it is how far towards a full flip the
 * ink drags its backdrop. Paper goes dark, and the text inside the stroke goes
 * pale, as though the ink soaked through and knocked it out.
 *
 * The scale has a hinge in the middle. At 0.5 every backdrop lands on the same
 * grey and the text inside the stroke vanishes; below that the text keeps its
 * normal polarity at reduced contrast, above it the polarity flips. So this
 * belongs near 1, and values around 0.5 are the one genuinely bad choice.
 */
export const INK_PEAK_ALPHA = 0.88;

/** How long a cursor splat takes to dry, in milliseconds. */
export const TRAIL_MS = 2000;

/** How long the brush takes to travel its path when you arrive on the page. */
export const ENTRANCE_MS = 2200;

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
 * The spine — the path the brush travels.
 * ------------------------------------------------------------------ */

export interface SpinePoint {
  x: number;
  y: number;
  /** Unit normal, perpendicular to travel. Bristles are offset along this. */
  nx: number;
  ny: number;
  /** Half-width of the brush here, in pixels. */
  width: number;
  /** Position along the stroke, 0 at the head, 1 at the tail. */
  t: number;
}

/**
 * The band the stroke sweeps through, as fractions of hero height.
 *
 * This used to hug the top so it would clear the headline. It no longer needs
 * to: the stroke crosses the text on purpose and inverts it on the way past, so
 * the words stay readable inside the ink rather than being obscured by it. That
 * turns the constraint inside out — the mark now wants the middle, where the
 * writing is, because crossing something is the whole point of the gesture.
 */
export const STROKE_TOP = 0.14;
export const STROKE_BOTTOM = 0.58;

/**
 * A gentle S sweeping left to right across the top of the hero.
 *
 * Confined to the top `STROKE_BAND` of the box, because everything below it is
 * the headline. The width tapers from a loaded head to a dry tail — a stroke of
 * constant width reads as a ribbon, not as a brush that was pressed and then
 * lifted.
 */
export function strokeSpine(
  w: number,
  h: number,
  seed = INK_SEED,
  samples = 90,
  bandTop = h * STROKE_TOP,
  bandBottom = h * STROKE_BOTTOM,
): SpinePoint[] {
  const rnd = mulberry32(seed);
  const band = Math.max(8, bandBottom - bandTop);
  // The centre line: a shallow sine, phase and depth jittered by the seed so
  // the curve is chosen rather than mechanical.
  // Thickness and swing are sized from the hero, not from the band. Deriving
  // them from the band meant widening the band scaled the whole mark up with
  // it, and moving the stroke to the middle turned it into a 150px black slab.
  // Sized from the smaller dimension, so a tall stacked hero on a phone does
  // not get a proportionally enormous brush just because it is tall.
  const scale = Math.min(w, h);
  const midY = band * 0.5;
  const amp = scale * (0.06 + rnd() * 0.04);
  const phase = rnd() * Math.PI * 2;
  const turns = 1.1 + rnd() * 0.4;
  // Enters from off the left edge and dries out before the photo column rather
  // than running the full width. The whole head-to-tail story then happens
  // across the text, which is the part the stroke is meant to cross.
  const x0 = -w * 0.08;
  const x1 = w * 0.54;
  const headWidth = scale * (0.042 + rnd() * 0.014);

  const xs: number[] = [];
  const ys: number[] = [];
  const widths: number[] = [];
  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1);
    xs.push(x0 + (x1 - x0) * t);
    ys.push(midY + Math.sin(phase + t * Math.PI * turns) * amp);
    // taper: full at the head, thin at the tail, with a slight swell early on
    widths.push(headWidth * (1 - t * 0.82) * (0.86 + 0.14 * Math.sin(t * Math.PI)));
  }

  // Fit the whole mark into the band by construction rather than by choosing
  // constants that happen to land inside it. The first pass tuned the numbers
  // and still clipped the head against the top edge, because bristle offset,
  // creep and line width all reach past the spine's own half-width.
  let top = Infinity;
  let bottom = -Infinity;
  for (let i = 0; i < samples; i++) {
    top = Math.min(top, ys[i]! - widths[i]!);
    bottom = Math.max(bottom, ys[i]! + widths[i]!);
  }
  // Shrink to fit, never stretch to fill — and then centre what is left. The
  // earlier version mapped the extent onto the band exactly, which is right for
  // a narrow band and disastrous for a wide one: it inflated the mark to fill
  // whatever room it was given.
  const k = Math.min(1, band / Math.max(1e-6, bottom - top));
  const slack = (band - (bottom - top) * k) / 2;
  for (let i = 0; i < samples; i++) {
    ys[i] = bandTop + slack + (ys[i]! - top) * k;
    widths[i] = widths[i]! * k;
  }

  const out: SpinePoint[] = [];
  for (let i = 0; i < samples; i++) {
    // Normals from finite differences on the *fitted* points — deriving them
    // from the pre-fit curve would leave them subtly wrong wherever the rescale
    // changed the slope, and the bristles hang off these.
    const a = Math.max(0, i - 1);
    const b = Math.min(samples - 1, i + 1);
    const dx = xs[b]! - xs[a]!;
    const dy = ys[b]! - ys[a]!;
    const len = Math.hypot(dx, dy) || 1;
    out.push({
      x: xs[i]!,
      y: ys[i]!,
      nx: -dy / len,
      ny: dx / len,
      width: widths[i]!,
      t: i / (samples - 1),
    });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * The bristles — where the white comes from.
 * ------------------------------------------------------------------ */

export interface Bristle {
  /** Position across the brush, -1 at one edge, +1 at the other. */
  offset: number;
  /** Per-spine-sample ink, 0 where this hair ran dry. This is the 飛白. */
  breaks: number[];
  /** Per-sample width multiplier — the hair thickening and thinning. */
  press: number[];
  /** Per-sample perpendicular wander, in fractions of stroke width. */
  wander: number[];
}

/**
 * Lay out the brush head.
 *
 * Two things make this read as a real brush rather than as hatching. Bristles
 * cluster toward the middle (`offset` cubed), because a brush carries most of
 * its ink in the body and frays at the edges. And the threshold a hair must
 * clear to hold ink *rises along the stroke*, so hairs drop out progressively
 * and the tail shreds into streaks while the head stays solid.
 */
export function bristles(spine: SpinePoint[], count: number, seed = INK_SEED): Bristle[] {
  const rnd = mulberry32(seed + 7919);
  const out: Bristle[] = [];
  for (let b = 0; b < count; b++) {
    // even spread, jittered, then biased toward the centre
    const even = count === 1 ? 0 : (b / (count - 1)) * 2 - 1;
    const jitter = (rnd() - 0.5) * (2 / count);
    const raw = Math.max(-1, Math.min(1, even + jitter));
    const offset = Math.sign(raw) * Math.pow(Math.abs(raw), 1.35);
    const lane = rnd() * 100;
    const breaks: number[] = [];
    const press: number[] = [];
    const wander: number[] = [];
    for (const p of spine) {
      // Ink remaining in the brush. The threshold a hair must clear is scaled by
      // how *dry* the brush is, so at the head it is zero and every hair holds
      // — the stroke starts as a solid mass and only shreds once the ink runs
      // low. A first pass thresholded against the grain directly, which made
      // every hair break everywhere and read as a bundle of wires.
      const wet = 1 - Math.pow(p.t, 0.85);
      const grain = fbm(p.t * 9, lane, seed + b * 37, 3);
      const edge = 1 - Math.abs(offset) * 0.35;
      // Pooling: a broad, slow field so the body of the stroke has heavier and
      // lighter passages instead of one flat tone.
      const pool = 0.72 + fbm(p.t * 2.3, offset * 1.7, seed + 611, 2) * 0.5;
      const ink = wet * edge - grain * (1 - wet) * 1.6;
      breaks.push(ink > 0 ? Math.min(1, ink * 2.2 * pool) : 0);

      // A hair is not a constant-width line. This is most of what separates a
      // brush from a set of parallel strokes.
      press.push(0.55 + fbm(p.t * 5.5, lane + 40, seed + b * 53, 2) * 1.1);

      // Torn edge: the outermost hairs wander, the core holds its line. A brush
      // frays where it meets paper, and a perfectly parallel boundary is the
      // giveaway that this was drawn by arithmetic.
      const fray = Math.pow(Math.abs(offset), 2.2);
      wander.push((fbm(p.t * 13, lane + 90, seed + b * 71, 3) * 2 - 1) * fray * 0.14);
    }
    out.push({ offset, breaks, press, wander });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Splatter.
 * ------------------------------------------------------------------ */

export interface Splat {
  x: number;
  y: number;
  r: number;
  /** Elongation along the flick. 1 is round; a fast throw stretches the drop. */
  aspect: number;
  /** Direction the drop was travelling, radians. */
  angle: number;
  /** Spine position at which the brush flicked this, so it lands in sequence. */
  at: number;
}

/**
 * Droplets thrown off the brush.
 *
 * Radii follow a power law — a handful of fat drops and a lot of fine mist,
 * which is what a flicked brush actually leaves. An even distribution reads as
 * polka dots.
 */
export function splatter(
  spine: SpinePoint[],
  count: number,
  seed = INK_SEED,
  ceiling = Infinity,
): Splat[] {
  const rnd = mulberry32(seed + 104729);
  const out: Splat[] = [];
  const scale = spine[0]!.width || 1;
  // Bounded attempts, not a while-loop: a tight ceiling could otherwise spin
  // forever looking for room that isn't there.
  for (let i = 0; i < count * 6 && out.length < count; i++) {
    const p = spine[Math.floor(rnd() * spine.length)]!;
    const throwOut = (rnd() - 0.5) * 2;
    const speed = Math.abs(throwOut);
    const dist = p.width * (0.9 + speed * 2.4);
    // power law: rnd³ keeps most of them fine mist
    const u = rnd();
    const r = scale * (0.014 + u * u * u * 0.1);
    const x = p.x + p.nx * dist * Math.sign(throwOut) + (rnd() - 0.5) * p.width;
    const y = p.y + p.ny * dist * Math.sign(throwOut) + (rnd() - 0.5) * p.width;
    if (y + r > ceiling) continue;
    // A drop thrown hard is not a circle — it stretches along its flight and
    // lands as a comma. Round dots at every size read as printed, not thrown.
    const angle = Math.atan2(p.ny * Math.sign(throwOut), p.nx * Math.sign(throwOut));
    out.push({ x, y, r, aspect: 1 + speed * 1.9, angle, at: p.t });

    // Satellites: a big drop shatters on impact and throws a little ring of
    // much smaller ones. This is most of what makes real splatter look busy.
    if (u > 0.86 && out.length < count) {
      const kids = 2 + Math.floor(rnd() * 3);
      for (let s = 0; s < kids && out.length < count; s++) {
        const a = rnd() * Math.PI * 2;
        const d = r * (1.6 + rnd() * 3.4);
        const sy = y + Math.sin(a) * d;
        const sr = r * (0.16 + rnd() * 0.3);
        if (sy + sr > ceiling) continue;
        out.push({
          x: x + Math.cos(a) * d,
          y: sy,
          r: sr,
          aspect: 1 + rnd() * 0.6,
          angle: a,
          at: p.t,
        });
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Motion.
 * ------------------------------------------------------------------ */

/** Largest perpendicular bleed, as a fraction of local stroke width. */
export const CREEP_MAX = 0.09;

/**
 * The wet edge, still moving.
 *
 * Indexed by position along the spine as well as by time, so different stretches
 * of the stroke bleed at different moments — a uniform value would just inflate
 * and deflate the whole shape, which reads as breathing rather than as ink
 * soaking outward. Bounded hard: this may never restructure the gesture, only
 * blur its boundary.
 */
export function creep(t: number, timeMs: number, seed = INK_SEED): number {
  const n = fbm(t * 3.2, timeMs * 0.00007, seed + 5171, 2);
  return (n * 2 - 1) * CREEP_MAX;
}

/**
 * The arrival: the brush travelling its path.
 *
 * Two envelopes rather than one. A stroke that simply faded up would read as an
 * image loading, so `soak` (opacity) commits early while `spread` — here the
 * fraction of the path the brush has covered — is still travelling.
 */
export function entrance(
  elapsedMs: number,
  delayMs = 0,
): { spread: number; soak: number } {
  const p = (elapsedMs - delayMs) / ENTRANCE_MS;
  if (p <= 0) return { spread: 0, soak: 0 };
  if (p >= 1) return { spread: 1, soak: 1 };
  // Smoothstep, not ease-out. A bloom spreading fastest at the instant it lands
  // is right; a brush is not — an ease-out put the tip 72% down the path in the
  // first third of the time, so the stroke appeared essentially finished before
  // anyone could see it travel. A calligrapher's hand accelerates, holds, and
  // lifts.
  const spread = p * p * (3 - 2 * p);
  const s = Math.min(1, p * 3);
  const soak = 1 - (1 - s) * (1 - s);
  return { spread, soak };
}

/**
 * Alpha envelope for a cursor splat as it dries: 1 when fresh, 0 once TRAIL_MS
 * has passed. Squared so it holds briefly and then goes quickly, the way wet ink
 * sits and then disappears rather than fading at a constant rate.
 */
export function trailAlpha(ageMs: number): number {
  if (ageMs <= 0) return 1;
  if (ageMs >= TRAIL_MS) return 0;
  const k = 1 - ageMs / TRAIL_MS;
  return k * k;
}
