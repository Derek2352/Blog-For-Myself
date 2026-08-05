/**
 * A wet-paper model — the ink, simulated rather than drawn.
 *
 * Every earlier version of the hero wash was a *picture of* ink: polygons
 * deformed until their outlines resembled a stain. That is why each new
 * reference needed a new approximation — bristles for a dry brush, layered blobs
 * for a wash, pools for a field. Each faked a different appearance of the same
 * physical thing, so none of them generalised.
 *
 * Here the appearance is not authored at all. Water carries pigment through
 * paper and evaporates; bleeding, soft edges, granulation and darkened rims are
 * consequences. Yan et al. (Heritage Science 2022, 10:186) call this class of
 * approach a "local equilibrium model for the dispersion of water and ink on
 * paper"; this is a small one, sized for a background layer rather than for a
 * painting application.
 *
 * Pure: no DOM, no canvas, no clock. The component owns the pixels.
 */

import { mulberry32, valueNoise2 } from './ink';

export interface InkField {
  gw: number;
  gh: number;
  /** Surface water. Drives all movement. */
  wet: Float32Array;
  /** Pigment in suspension — travels with the water. */
  pig: Float32Array;
  /** Pigment settled onto the paper. This is what renders. */
  dep: Float32Array;
  /**
   * Ink **strength** — how concentrated the 墨 at this cell is, 0–1.
   *
   * Distinct from `pig`, which is only *how much*. A model with amount but no
   * strength cannot express 墨分五色 at all: the five tones are five
   * concentrations, not five densities of one ink, which is exactly the
   * difference between a painter loading 濃墨 and dipping for 淡墨.
   *
   * Not having it is what made the tones read as contour lines. Quantising a
   * single smooth density field draws its level sets, and the level sets of a
   * blob are nested rings; there is no setting of the tone table that escapes
   * that. Concentration is piecewise-constant instead — flat across one pour,
   * stepping only where a different pour's ink reached — so quantising it draws
   * material fronts, which is what 破墨 boundaries are.
   *
   * Carried by the pigment and mixed mass-weighted. Never diffused on its own:
   * a diffusion pass here would smooth it into a gradient and put the contours
   * straight back, one level down.
   */
  conc: Float32Array;
  /**
   * 滲透 — the greatest wetness this cell has ever held.
   *
   * The water front, remembered. On 宣紙 water wicks through the fibre network
   * faster than the carbon can follow, because the particles are filtered and
   * adsorbed as they travel; so a mark is a compact dark core sitting inside a
   * much wider faint watermark, rather than one soft blob.
   *
   * A high-water mark rather than live wetness, because a 水暈 is a *tide
   * line*: rendering `wet` would make the halo evaporate along with the water,
   * and it is the permanence that makes a mark look absorbed into the sheet
   * instead of floated on it.
   */
  soak: Float32Array;
  /** Paper absorbency. Oriented fibre, seeded once and never touched again. */
  fibre: Float32Array;
  /** What the renderer shows: suspended plus settled. */
  vis: Float32Array;
  /**
   * The drift, precomputed per cell.
   *
   * `flowBias` is a pure function of position and seed, so it returns the same
   * vector on every tick for the life of the field — and it was being recomputed
   * for every cell on every tick, six noise evaluations at a time. At eight
   * ticks a frame over a padded field that came to roughly two million noise
   * evaluations per frame, which is where the frame budget was going.
   */
  biasX: Float32Array;
  biasY: Float32Array;
  /** Scratch buffers, so a step allocates nothing. */
  tmpWet: Float32Array;
  tmpPig: Float32Array;
  tmpConc: Float32Array;
}

/** Direction of the paper's grain, in radians. Ink wicks along it. */
export const FIBRE_ANGLE = 0.28;

/**
 * Oriented paper grain.
 *
 * Yan et al. use Gabor noise rather than Perlin for rice paper precisely because
 * it is *directional*, and that matters here: real fibre has a lay, and ink
 * travels along it further than across it. Sampling ordinary value noise on a
 * squashed, rotated coordinate frame gives the same anisotropy for a fraction of
 * the cost — the lobes come out stretched along the grain.
 *
 * Deliberately low frequency. Sampled per grid cell, paper that varied cell to
 * cell modulated the flow at exactly the scale the upscale later reveals, and
 * the wash came out granular instead of silky. Real fibre is finer than a
 * millimetre; what belongs at this scale is the *lay* of it, not the threads.
 */
export function fibreNoise(x: number, y: number, seed: number): number {
  const c = Math.cos(FIBRE_ANGLE);
  const s = Math.sin(FIBRE_ANGLE);
  // rotate into fibre space, then squash along it so features elongate
  const u = (x * c + y * s) * 0.055;
  const v = (-x * s + y * c) * 0.30;
  const coarse = valueNoise2(u, v, seed);
  const fine = valueNoise2(u * 2.3, v * 2.0, seed + 17);
  return coarse * 0.68 + fine * 0.32;
}

/**
 * A slow, swirling drift — the water in the bowl is not still.
 *
 * Used only to bias how a cell divides its outflow *among* its downhill
 * neighbours, never to add flow. That keeps it redistributive and so incapable
 * of destabilising the solver, while giving plumes the curl of ink billowing
 * rather than expanding as a disc.
 *
 * Taken as the perpendicular of a noise gradient, which is divergence-free by
 * construction: the drift stirs the ink around without inventing or destroying
 * any of it.
 */
export function flowBias(x: number, y: number, seed: number): { dx: number; dy: number } {
  // Wavelength must be *shorter* than a plume, or the drift merely carries the
  // whole blob sideways instead of tearing it into filaments.
  // Long wavelength. A short one tore the plume apart at cell scale, which
  // reads as dirt; a long one folds it, which reads as ink turning over in
  // water.
  const k = 0.016;
  const e = 1.4;
  const n0 = fbmLocal(x * k, y * k, seed);
  const gx = fbmLocal((x + e) * k, y * k, seed) - n0;
  const gy = fbmLocal(x * k, (y + e) * k, seed) - n0;
  // perpendicular of the gradient
  const len = Math.hypot(gx, gy) || 1;
  return { dx: -gy / len, dy: gx / len };
}

/** Two octaves, enough structure for a drift without the cost of more. */
function fbmLocal(x: number, y: number, seed: number): number {
  return valueNoise2(x, y, seed) * 0.7 + valueNoise2(x * 2.3, y * 2.3, seed + 55) * 0.3;
}

/**
 * How hard the drift steers the spread.
 *
 * This has to *dominate* rather than nudge. The solver relaxes water downhill,
 * and diffusion is intrinsically smoothing — it rounds fingers out faster than
 * any amount of permeability contrast creates them, so a gentle bias left the
 * front a disc no matter how the paper was tuned. Ink in water is advection
 * dominated, not diffusive: it goes where the water is going.
 *
 * A neighbour aligned with the drift is favoured about seventeen to one over
 * one against it. Still purely redistributive — the floor keeps every share
 * positive, so no cell can pump water it does not have.
 */
export const DRIFT = 0.5;
/** Share floor, so an unaligned neighbour still receives something. */
export const DRIFT_FLOOR = 0.15;

export function createField(gw: number, gh: number, seed: number): InkField {
  const n = gw * gh;
  const fibre = new Float32Array(n);
  const biasX = new Float32Array(n);
  const biasY = new Float32Array(n);
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const b = flowBias(x, y, seed);
      biasX[y * gw + x] = b.dx;
      biasY[y * gw + x] = b.dy;
      // Nearly uniform, and deliberately so. This was widened to a 9:1 ratio to
      // channel the flow into fingers, which worked and was the wrong idea:
      // there is no paper in a bowl of water. Those channels are what made the
      // plume look granular and dirty, because they vary at cell scale and the
      // steep alpha curve magnifies exactly that. Fingering belongs to the
      // flow — see advectPig — not to a substrate. What is left here is a
      // whisper of inhomogeneity so the medium is not perfectly flat.
      fibre[y * gw + x] = 0.86 + fibreNoise(x, y, seed) * 0.14;
    }
  }
  return {
    gw,
    gh,
    wet: new Float32Array(n),
    pig: new Float32Array(n),
    dep: new Float32Array(n),
    conc: new Float32Array(n),
    soak: new Float32Array(n),
    fibre,
    biasX,
    biasY,
    vis: new Float32Array(n),
    tmpWet: new Float32Array(n),
    tmpPig: new Float32Array(n),
    tmpConc: new Float32Array(n),
  };
}

/**
 * Re-cut the paper for a new composition, in place.
 *
 * The medium — fibre lay and drift — follows the seed, so a fresh mark needs it
 * recomputed. `createField` already does exactly this work; this is the same
 * loop against the buffers that already exist, because it runs once per pour and
 * allocating three Float32Arrays of ~69k floats every twelve seconds would churn
 * for no reason.
 *
 * Deliberately does *not* touch wet, pigment, deposit, concentration or soak.
 * `resetField` owns those, and the caller runs both.
 */
export function reseedField(f: InkField, seed: number): void {
  const { gw, gh, fibre, biasX, biasY } = f;
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const i = y * gw + x;
      const b = flowBias(x, y, seed);
      biasX[i] = b.dx;
      biasY[i] = b.dy;
      fibre[i] = 0.86 + fibreNoise(x, y, seed) * 0.14;
    }
  }
}

/** Clear everything except the medium, which never changes within a pour. */
export function resetField(f: InkField): void {
  f.wet.fill(0);
  f.pig.fill(0);
  f.dep.fill(0);
  f.conc.fill(0);
  f.soak.fill(0);
  f.vis.fill(0);
}

/**
 * Blend ink of strength `cIn` into a cell that already holds `have` pigment.
 *
 * Mass-weighted, which is simply what happens when two inks meet: the result
 * cannot be stronger than the stronger of them or weaker than the weaker, and a
 * trickle of dilute wash cannot bleach a cell that has already put down a lot of
 * 焦墨. The weight on the receiving side counts settled pigment as well as
 * suspended, because what is already dry on the paper still decides how the cell
 * reads.
 */
export function mixConc(cHere: number, have: number, cIn: number, inMass: number): number {
  const tot = have + inMass;
  if (tot <= 1e-9) return cIn;
  return (cHere * have + cIn * inMass) / tot;
}

/**
 * Wavelength of the mottling, in cells. Long on purpose — see `visible`.
 */
export const MOTTLE_SCALE = 30;
/**
 * How far the mottling swings the ink either side of neutral.
 *
 * This was 0.72 — a ±72% swing — back when it was the only thing stopping a
 * smooth diffusion gradient from reading as one flat grey shape. It is now
 * applied *after* the tones are quantised, and at that depth it simply undid
 * them: multiplying a flat register by anything between 0.28 and 1.72 smears it
 * straight back into a gradient, which the rendered histogram showed as three
 * broad humps where there should have been five peaks.
 *
 * The concentration field supplies the structure now, so this returns to what
 * mottling is for: the soft unevenness *within* one wash of one strength.
 */
export const MOTTLE_DEPTH = 0.22;

/**
 * What is actually visible: pigment in suspension plus pigment settled,
 * modulated by broad passages of heavier and lighter ink.
 *
 * In water you see the plume itself, not a stain. Showing only the deposit also
 * capped how far ink could travel, because pigment settles as water dries and
 * drying is what ends the spread — so the visible part was always the part that
 * had stopped moving.
 *
 * ## Mottling is not grain
 *
 * These were conflated once, and it cost a round of work. **Grain** is variation
 * from one cell to the next: that is what a high-contrast permeability field
 * produced, it is what the render blur exists to suppress, and it read as dirt.
 * **Mottling** is variation across tens of cells, which blurring cannot touch
 * and which has no way to alias.
 *
 * Diffusion smooths, and the blur smooths whatever survives it, so a plume comes
 * out flatter than real ink — one even grey shape rather than something with
 * passages. This puts the unevenness back at a scale far above a pixel, where it
 * is structurally incapable of becoming the granularity it is meant to replace.
 */
export function visible(f: InkField): Float32Array {
  const { vis, pig, dep } = f;
  for (let i = 0; i < vis.length; i++) vis[i] = pig[i]! + dep[i]!;
  return vis;
}

/**
 * The mottling multiplier at a cell — applied to the *alpha*, after inkAlpha.
 *
 * Modulating density instead was the obvious place and the wrong one: the alpha
 * curve's gamma compresses its top end, so a wide swing in pigment came out a
 * narrow swing in opacity, and the wash stayed flat. Appearance is what needs
 * varying, so it is varied where appearance is decided.
 *
 * Two long octaves. Both wavelengths sit far above a pixel, which is the entire
 * distinction from grain — blurring cannot remove this and it has no way to
 * alias.
 */
export function mottleAt(x: number, y: number, seed = 0): number {
  const k = 1 / MOTTLE_SCALE;
  const raw =
    valueNoise2(x * k, y * k, seed + 313) * 0.65 +
    valueNoise2(x * k * 2.1, y * k * 2.1, seed + 727) * 0.35;
  // Smooth noise clusters hard around 0.5, and averaging octaves narrows it
  // further — straight out of the generator this swung the density by under a
  // third and the wash stayed visibly flat. Stretching about the midpoint is
  // what turns it into passages rather than a faint ripple.
  const n = Math.max(0, Math.min(1, (raw - 0.5) * 2.6 + 0.5));
  return 1 - MOTTLE_DEPTH + n * MOTTLE_DEPTH * 2;
}

/* ------------------------------------------------------------------ *
 * 潑墨 — the part that is not physics.
 *
 * Everything above this line is a wet-paper solver, and a solver is
 * culturally neutral: run it and you get a soft grey cloud with smooth
 * gradients, which is Western watercolour. What follows is the reading
 * convention Chinese splashed ink is actually seen through, applied on top of
 * the simulation rather than inside it.
 * ------------------------------------------------------------------ */

/**
 * 墨分五色 — the five registers, darkest last: 焦 濃 重 淡 清.
 *
 * Not evenly spaced. The floor is lifted so 清 sits above the threshold where a
 * tint stops being visible at all, and the gaps open slightly toward the top,
 * where the eye can actually resolve them.
 */
export const TONES = [0.16, 0.34, 0.55, 0.78, 1.0];

/** Where the alpha has to reach for each register to take over. */
export const TONE_EDGES = [0.1, 0.28, 0.48, 0.7, 0.88];

/**
 * Half-width of each tonal boundary.
 *
 * Small enough that the registers read as distinct areas rather than as a ramp,
 * wide enough that a boundary crossing a diagonal does not stair-step. Every
 * gap between edges is wider than a full transition, so no two boundaries ever
 * overlap and the flats survive.
 */
export const TONE_SOFT = 0.035;

/**
 * Quantise alpha into the five tones.
 *
 * This is the single change that separates 潑墨 from a stain. Ink does not read
 * as a continuous ramp; it reads as a small number of concentrations, and the
 * visible boundary where one was laid into another is 破墨.
 *
 * It only works because something already varies broadly: `mottleAt` supplies
 * continuous swing at a 30-cell wavelength, and quantising *that* turns it into
 * patches of distinct tone. Quantising a flat field would produce nothing, and
 * quantising cell-scale variation would produce the speckle we removed twice.
 *
 * Written as a sum of rises rather than a lookup, so it is monotone by
 * construction — a lookup with a search would need its boundaries kept in order
 * by hand, and a non-monotone tone curve would invert the ink somewhere.
 */
export function fiveTones(a: number): number {
  if (a <= 0) return 0;
  let out = 0;
  let prev = 0;
  for (let k = 0; k < TONES.length; k++) {
    const t = (a - (TONE_EDGES[k]! - TONE_SOFT)) / (2 * TONE_SOFT);
    const c = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
    out += (TONES[k]! - prev) * c;
    prev = TONES[k]!;
  }
  return out;
}

/** Wavelength of the reserved whites, in cells. Longer than the mottling. */
export const VOID_SCALE = 46;
/** How much of the noise range is reserved as paper. */
export const VOID_THRESHOLD = 0.62;
/** Width of a void's rim. Narrow: 留白 has an edge, it does not fade out. */
export const VOID_EDGE = 0.06;

/**
 * 留白 — how much ink a cell is allowed to hold. 1 = all of it, 0 = paper.
 *
 * The white inside splashed ink is not the ink's failure to arrive; it is
 * placed, and it is as much of the composition as the ink. A diffusion solver
 * cannot produce it — diffusion fills — so the whites have to be reserved.
 *
 * Deliberately a *longer* wavelength than the mottling and a different seed, so
 * the two do not lock together and print the same shape twice. And deliberately
 * gated hard rather than faded: a void with a soft falloff is just a thin
 * patch, which the field already had plenty of.
 */
export function voidAt(x: number, y: number, seed = 0): number {
  const k = 1 / VOID_SCALE;
  const raw =
    valueNoise2(x * k, y * k, seed + 4409) * 0.7 +
    valueNoise2(x * k * 1.9 + 3.1, y * k * 1.9, seed + 811) * 0.3;
  // Same contrast stretch as the mottling, and for the same reason: smooth
  // value noise clusters around 0.5, so an unstretched field never crosses a
  // threshold set anywhere interesting.
  const n = Math.max(0, Math.min(1, (raw - 0.5) * 2.4 + 0.5));
  if (n <= VOID_THRESHOLD) return 1;
  if (n >= VOID_THRESHOLD + VOID_EDGE) return 0;
  const t = (n - VOID_THRESHOLD) / VOID_EDGE;
  return 1 - t * t * (3 - 2 * t);
}

/**
 * Wet a band across the sheet and charge it with pigment.
 *
 * Deliberately lumpy. An even band would spread into an even rectangle; the
 * reference is pools that meet and leave paper showing between them, and that
 * has to start at injection because diffusion smooths, it does not clump.
 */
export function injectBand(
  f: InkField,
  x0: number,
  x1: number,
  yc: number,
  half: number,
  seed: number,
  amount = 1,
  feather = 0,
  conc = 1,
): void {
  const rnd = mulberry32(seed);
  const jitter = rnd() * 40;
  for (let y = 0; y < f.gh; y++) {
    for (let x = Math.max(0, Math.floor(x0)); x < Math.min(f.gw, Math.ceil(x1)); x++) {
      // Ramp in and out across the slice so that overlapping pours sum to a
      // smooth profile. A hard-edged slice leaves a wetness step at its border,
      // the step drives a flow, and the flow piles pigment into a vertical bar
      // — the pour was visible as stripes before this existed.
      const edgeW = feather > 0 ? Math.min(1, (x - x0) / feather, (x1 - x) / feather) : 1;
      if (edgeW <= 0) continue;
      // soft vertical falloff, roughened so the band's edges are ragged
      const edge = Math.abs(y - yc) / half;
      if (edge >= 1) continue;
      const rough = valueNoise2(x * 0.09 + jitter, y * 0.07, seed + 5) * 0.45 + 0.62;
      const fall = (1 - edge * edge) * rough;
      // Pools: a low-frequency field gated hard, so it is lumps and gaps rather
      // than a gradient. The gaps are the point.
      const pool = valueNoise2(x * 0.055 + jitter, y * 0.045, seed + 9);
      const gate = pool < 0.4 ? 0 : (pool - 0.4) / 0.6;
      const a = fall * gate * amount * edgeW;
      if (a <= 0) continue;
      const i = y * f.gw + x;
      const load = a * PIG_LOAD;
      f.conc[i] = mixConc(f.conc[i]!, f.pig[i]! + f.dep[i]!, conc, load);
      f.wet[i] = Math.min(1.4, f.wet[i]! + a);
      f.pig[i] = Math.min(1.6, f.pig[i]! + load);
    }
  }
}

/**
 * Pigment per unit of water.
 *
 * Decoupled from wetness on purpose. Raising the injected `amount` would make
 * the ink stronger *and* wetter, and wetter ink spreads further and lands even
 * thinner — the first pass poured a band whose mean deposit was 0.12, which
 * inkAlpha correctly discarded as a whisper, so 27% of the sheet held pigment
 * and almost none of it rendered. This concentrates the ink instead.
 */
export const PIG_LOAD = 3.2;

/**
 * How much a single pour's strength varies within itself.
 *
 * A loaded brush is not uniform, and neither is a thrown ladle of 墨. Without
 * this each pour is one flat concentration, which with three drops risks
 * reading as three cut-out slabs meeting at seams rather than as ink. Low
 * frequency and modest: enough that a pour crosses a register boundary here and
 * there, giving irregular patches. It cannot bring the rings back, because it is
 * noise rather than a radial gradient — its level sets are blobs, not circles.
 */
export const CONC_SPREAD = 0.13;

/**
 * How far a pour's outline wanders from its ideal curve, as a share of radius.
 *
 * `injectStreak` and `injectBlob` used to lay their charge as a flawless radial
 * ramp — a mathematical ellipse with a smooth dome inside it. Diffusion only
 * rounds a shape further, so a perfect start stayed perfect, and at hero scale
 * that reads as a cone: even slopes, rounded apex, a mountain rather than a
 * mark. `injectBand` has always roughened itself this way; the two injectors the
 * composition actually uses never got it.
 */
export const POUR_ROUGH = 0.34;

/**
 * Wavelengths for that roughness, per cell. **This band is the whole risk.**
 *
 * Matched to `injectBand`'s existing 0.045–0.09, which is 11 to 22 cells. Noise
 * finer than this is the granular, dirty look that came up twice: it has to vary
 * across a mark, not within a cell.
 */
export const POUR_LOBE_FREQ = 0.055;
export const POUR_POOL_FREQ = 0.075;

/**
 * A pour's local radius multiplier and charge gate at one cell.
 *
 * Two jobs, one pair of noise samples: `lobe` pushes the outline in and out so
 * the silhouette has bays and headlands, and `pool` breaks the interior up so
 * diffusion starts from something uneven. Shared by both injectors so a streak
 * and a droplet are made of the same stuff.
 */
export function pourNoise(
  x: number,
  y: number,
  seed: number,
): { lobe: number; pool: number } {
  const lobe =
    1 +
    (valueNoise2(x * POUR_LOBE_FREQ, y * POUR_LOBE_FREQ, seed + 2609) - 0.5) *
      2 *
      POUR_ROUGH;
  const raw = valueNoise2(x * POUR_POOL_FREQ + 11.3, y * POUR_POOL_FREQ, seed + 3181);
  // Stretched about the midpoint, for the same reason mottleAt is: smooth value
  // noise clusters near 0.5 and an unstretched gate barely gates anything.
  const pool = Math.max(0.35, Math.min(1, (raw - 0.5) * 1.9 + 0.92));
  return { lobe: lobe < 0.35 ? 0.35 : lobe, pool };
}

/** One drop — a splash of splatter, or the cursor. It will bleed on its own. */
export function injectBlob(
  f: InkField,
  cx: number,
  cy: number,
  r: number,
  amount = 1,
  conc = 1,
  seed = 0,
): void {
  // Scanned out to the furthest a lobe can push, not to r — clipping the
  // outline at the box would replace the lobes with the straight edges of the
  // bounding rectangle, which is the exact failure this is meant to remove.
  const far = r * (1 + POUR_ROUGH);
  const x0 = Math.max(0, Math.floor(cx - far));
  const x1 = Math.min(f.gw - 1, Math.ceil(cx + far));
  const y0 = Math.max(0, Math.floor(cy - far));
  const y1 = Math.min(f.gh - 1, Math.ceil(cy + far));
  const rr = far * far;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d > rr) continue;
      // Lobed rather than circular, and pooled rather than domed — see pourNoise.
      const n = pourNoise(x, y, seed);
      const reach = r * n.lobe;
      const dist = Math.sqrt(d);
      if (dist > reach) continue;
      const a = (1 - dist / reach) * amount * n.pool;
      if (a <= 0) continue;
      const i = y * f.gw + x;
      const load = a * PIG_LOAD;
      const c = conc + (valueNoise2(x * 0.045, y * 0.045, seed + 1201) - 0.5) * 2 * CONC_SPREAD;
      f.conc[i] = mixConc(f.conc[i]!, f.pig[i]! + f.dep[i]!, c < 0 ? 0 : c > 1 ? 1 : c, load);
      f.wet[i] = Math.min(1.4, f.wet[i]! + a);
      f.pig[i] = Math.min(1.6, f.pig[i]! + load);
    }
  }
}

/**
 * An elongated pour, laid along `angle`.
 *
 * The main pours were discs, and diffusion only ever rounds a shape further, so
 * every mark the model could make was a blot. A thrown ladle does not leave
 * blots: it leaves a mark stretched along the direction the arm was moving, and
 * that direction is legible in the mark itself before any spreading happens.
 *
 * Same falloff as `injectBlob`, measured in a frame rotated to the throw and
 * squashed across it, so the only difference is the shape of the level sets.
 */
export function injectStreak(
  f: InkField,
  cx: number,
  cy: number,
  r: number,
  angle: number,
  elong: number,
  amount = 1,
  conc = 1,
  seed = 0,
): void {
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  // Out to the furthest a lobe can push, so the outline is never clipped into
  // the straight edges of its own bounding box.
  const span = r * elong * (1 + POUR_ROUGH);
  const x0 = Math.max(0, Math.floor(cx - span));
  const x1 = Math.min(f.gw - 1, Math.ceil(cx + span));
  const y0 = Math.max(0, Math.floor(cy - span));
  const y1 = Math.min(f.gh - 1, Math.ceil(cy + span));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      // into the throw's frame: u runs along the stroke, v across it
      const u = (dx * ca + dy * sa) / elong;
      const v = -dx * sa + dy * ca;
      const d = Math.sqrt(u * u + v * v);
      // Lobed rather than elliptical, and pooled rather than domed. A thrown
      // ladle does not lay a perfect ellipse, and diffusion will not un-perfect
      // one for us.
      const n = pourNoise(x, y, seed);
      const reach = r * n.lobe;
      if (d > reach) continue;
      const a = (1 - d / reach) * amount * n.pool;
      if (a <= 0) continue;
      const i = y * f.gw + x;
      const load = a * PIG_LOAD;
      const c = conc + (valueNoise2(x * 0.045, y * 0.045, seed + 1201) - 0.5) * 2 * CONC_SPREAD;
      f.conc[i] = mixConc(f.conc[i]!, f.pig[i]! + f.dep[i]!, c < 0 ? 0 : c > 1 ? 1 : c, load);
      f.wet[i] = Math.min(1.4, f.wet[i]! + a);
      f.pig[i] = Math.min(1.6, f.pig[i]! + load);
    }
  }
}

/** How fast water leaves the paper, per tick at dt = 1. */
export const EVAPORATION = 0.0004;
/** How readily suspended pigment settles out. */
export const DEPOSIT_RATE = 0.1;
/**
 * How much faster pigment travels than the water carrying it.
 *
 * Above 1 this produces the coffee ring: pigment outruns its water, strands at
 * a drying perimeter, and the blot dries darkest at the rim. That is correct
 * for ink on **paper**, and it is what this was set to.
 *
 * It is wrong for ink in **water**, which was the reference for a while.
 * Measuring that image gives core alpha 0.549 against 0.329 at the edge —
 * denser in the middle, fading outward — because a drop in a bowl has no
 * contact line to pin and no fast-drying perimeter to strand against.
 *
 * Now well below 1 rather than just under it, which is 滲透. On 宣紙 the water
 * genuinely outruns the ink: it wicks along the fibre while the carbon is
 * filtered out behind it. At 0.85 the two travelled almost together and there
 * was no gap for a halo to live in. Still below 1, so the measured
 * "denser in the middle, no coffee ring" property is untouched — this only
 * widens a separation that already existed.
 */
export const ADVECT_BIAS = 0.5;

/**
 * How much of the pigment arriving in a cell is caught by the fibre there.
 *
 * The actual mechanism behind 滲透, and the reason ink on raw 生宣 has a hard
 * edge inside a soft one. Paper is a filter: water passes through the fibre
 * network, carbon particles are too large and get trapped and adsorbed as they
 * go. So the pigment front advances slowly and *sharply* — every cell it enters
 * takes a cut — while the water front runs on ahead and soft.
 *
 * It is also what the satellites needed. A droplet had no way to keep its
 * pigment compact while its water spread, so each one simply bled into the
 * mass; filtration pins the core in place within a cell or two of where it
 * landed.
 */
export const FILTRATION = 0.16;

/**
 * Carry pigment along the swirl, without diffusing it.
 *
 * This is the piece that makes it ink in water rather than ink on paper, and
 * the piece a diffusion solver cannot supply. Relaxing water downhill is a
 * smoothing kernel: it rounds a front out faster than any permeability contrast
 * or share-weighting can break it up, so the plume stayed a disc no matter how
 * hard the flow was steered. Filaments come from *transport* — pigment moved
 * bodily along a velocity field, which stretches it into streaks and folds
 * instead of averaging it away.
 *
 * Semi-Lagrangian: each cell asks where its pigment came from and samples there,
 * bilinearly. Unconditionally stable at any step size, which matters because the
 * swirl is deliberately fast.
 */
export function advectPig(f: InkField, seed: number, dt = 1): void {
  const { gw, gh, wet, pig, conc, biasX, biasY, tmpPig, tmpConc } = f;
  tmpPig.set(pig);
  tmpConc.set(conc);
  let before = 0;
  for (let i = 0; i < pig.length; i++) before += pig[i]!;
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const i = y * gw + x;
      // only where there is water to carry it
      if (wet[i]! <= 0.002) continue;
      const sx = x - biasX[i]! * SWIRL * dt;
      const sy = y - biasY[i]! * SWIRL * dt;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      if (x0 < 0 || y0 < 0 || x0 >= gw - 1 || y0 >= gh - 1) continue;
      const fx = sx - x0;
      const fy = sy - y0;
      const i00 = y0 * gw + x0;
      const i10 = i00 + 1;
      const i01 = i00 + gw;
      const i11 = i01 + 1;
      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;
      const a = tmpPig[i00]!;
      const bb = tmpPig[i10]!;
      const c = tmpPig[i01]!;
      const d = tmpPig[i11]!;
      const moved = a * w00 + bb * w10 + c * w01 + d * w11;
      pig[i] = moved;
      // Strength is interpolated by *mass*, not by area. A plain bilinear blend
      // of concentration would let a corner holding almost no pigment drag the
      // cell's tone around, which smears interfaces the swirl is meant to fold.
      if (moved > 1e-9) {
        conc[i] =
          (tmpConc[i00]! * a * w00 +
            tmpConc[i10]! * bb * w10 +
            tmpConc[i01]! * c * w01 +
            tmpConc[i11]! * d * w11) /
          moved;
      }
    }
  }

  // Semi-Lagrangian advection is not conservative — a cell sampling from dry
  // paper simply loses what it had, and nothing anywhere gains it. Unchecked
  // that bled off about 40% of the pigment per plume. Rescaling to the
  // pre-advection total is the standard remedy and exact by construction.
  let after = 0;
  for (let i = 0; i < pig.length; i++) after += pig[i]!;
  if (after > 1e-9 && before > 0) {
    const k = before / after;
    for (let i = 0; i < pig.length; i++) pig[i] = pig[i]! * k;
  }
}

/** How far pigment is carried per tick, in cells. */
export const SWIRL = 0.4;

/**
 * One tick: flow, advect, deposit, evaporate.
 *
 * Steps 3 and 4 together are the whole trick, and the reason this produces
 * watercolour rather than a blur. A rim holds less water than the middle, so it
 * dries first; deposition rises as wetness falls; and pigment carried outward by
 * the flow strands there and settles. **Edge darkening falls out of the physics**
 * instead of being stroked on, which is exactly what the previous version had to
 * do by hand.
 */
export function stepInk(f: InkField, dt = 1, seed = 0): void {
  const { gw, gh, wet, pig, dep, conc, soak, fibre, biasX, biasY, tmpWet, tmpPig, tmpConc } = f;
  tmpWet.set(wet);
  tmpPig.set(pig);
  tmpConc.set(conc);

  // ---- flow + advection. Water relaxes downhill toward its neighbours and
  // pigment rides along, but faster (see ADVECT_BIAS). Both are gated by the
  // paper, so ink runs along the grain.
  const nb = [0, 0, 0, 0];
  const share = [0, 0, 0, 0];
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const i = y * gw + x;
      const w = tmpWet[i]!;
      if (w <= 0.0005) continue;

      // Gather strictly downhill neighbours — flowing only downhill is what
      // stops this oscillating without needing a stability term. Each share is
      // then steered by the drift, which redistributes the same water rather
      // than adding any, so the plume curls without the solver losing footing.
      // Each share is weighted by the *destination's* permeability, not the
      // source's. Scaling only the outflow rate — which is what this did — makes
      // a cell drain faster or slower but equally in every direction, so the
      // front stays a disc however much contrast the paper has. Gating by where
      // the water is going is what channels it, and channelling is fingering.
      const bdx = biasX[i]!;
      const bdy = biasY[i]!;
      let count = 0;
      let total = 0;
      if (x > 0) {
        const j = i - 1;
        const d = (w - tmpWet[j]!) * (1 + DRIFT * -bdx) * fibre[j]!;
        if (d > 0) { nb[count] = j; share[count] = d; total += d; count++; }
      }
      if (x < gw - 1) {
        const j = i + 1;
        const d = (w - tmpWet[j]!) * (1 + DRIFT * bdx) * fibre[j]!;
        if (d > 0) { nb[count] = j; share[count] = d; total += d; count++; }
      }
      if (y > 0) {
        const j = i - gw;
        const d = (w - tmpWet[j]!) * (1 + DRIFT * -bdy) * fibre[j]!;
        if (d > 0) { nb[count] = j; share[count] = d; total += d; count++; }
      }
      if (y < gh - 1) {
        const j = i + gw;
        const d = (w - tmpWet[j]!) * (1 + DRIFT * bdy) * fibre[j]!;
        if (d > 0) { nb[count] = j; share[count] = d; total += d; count++; }
      }
      if (count === 0 || total <= 0) continue;

      // capped so a cell can never drain more than it holds
      const moveW = Math.min(w * 0.5, total * 1.6 * dt * fibre[i]!);
      const p = tmpPig[i]!;
      const moveP = Math.min(p * 0.6, moveW * (p / (w + 1e-6)) * ADVECT_BIAS);
      // Strength travels with the pigment. Read from the snapshot so a cell that
      // has already taken inflow this sweep still hands on the ink it started
      // the tick with, rather than something half-mixed by scan order.
      const cSrc = tmpConc[i]!;
      for (let k = 0; k < count; k++) {
        const j = nb[k]!;
        const inP = moveP * (share[k]! / total);
        wet[j] = wet[j]! + moveW * (share[k]! / total);
        if (inP > 0) {
          conc[j] = mixConc(conc[j]!, pig[j]! + dep[j]!, cSrc, inP);
          // Filtered on arrival: the fibre keeps a cut of everything passing
          // through it. Conserved — it moves from suspension to deposit, not
          // out of the field — so the mass checks still hold.
          const caught = inP * FILTRATION;
          dep[j] = dep[j]! + caught;
          pig[j] = pig[j]! + (inP - caught);
        }
      }
      wet[i] = wet[i]! - moveW;
      // Losing pigment does not dilute what stays behind, so conc[i] is untouched.
      pig[i] = pig[i]! - moveP;
    }
  }

  // ---- carry pigment along the swirl. Transport, not diffusion: this is what
  // stretches the plume into filaments instead of averaging it into a disc.
  advectPig(f, seed, dt);

  // ---- deposit + evaporate
  for (let i = 0; i < wet.length; i++) {
    const w = wet[i]!;
    // The tide line. Recorded here because the wetness is already in hand, and
    // never lowered — the paper does not forget where the water reached.
    if (w > soak[i]!) soak[i] = w;
    if (w > 0) {
      const p = pig[i]!;
      if (p > 0) {
        // the drier the cell, the faster its pigment strands — this is the rim
        const settle = p * DEPOSIT_RATE * dt * (1 - Math.min(1, w));
        pig[i] = p - settle;
        dep[i] = dep[i]! + settle;
      }
      // A thin film dries faster than a deep one, so the perimeter of a pool
      // retreats first. That steepening gradient is what drives the outward
      // flow that builds the rim.
      const e = EVAPORATION * dt * (0.5 + (1 - Math.min(1, w)));
      wet[i] = w - e < 0 ? 0 : w - e;
    } else if (pig[i]! > 0) {
      // no water left to hold it: everything remaining settles
      dep[i] = dep[i]! + pig[i]!;
      pig[i] = 0;
    }
  }
}

/**
 * Separable box blur over a grid, into `out`.
 *
 * Render-time only, and deliberately not part of the physics: deposited pigment
 * does not crawl around after it has dried. This exists because the alpha curve
 * below is steep by necessity, and a steep transfer turns any cell-to-cell
 * variation into visible speckle. Softening the field first is what makes the
 * wash read as silky rather than granular.
 */
export function blurField(
  src: Float32Array,
  out: Float32Array,
  scratch: Float32Array,
  gw: number,
  gh: number,
  radius = 2,
): void {
  const n = radius * 2 + 1;
  for (let y = 0; y < gh; y++) {
    const row = y * gw;
    for (let x = 0; x < gw; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const xx = x + k < 0 ? 0 : x + k >= gw ? gw - 1 : x + k;
        sum += src[row + xx]!;
      }
      scratch[row + x] = sum / n;
    }
  }
  for (let x = 0; x < gw; x++) {
    for (let y = 0; y < gh; y++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const yy = y + k < 0 ? 0 : y + k >= gh ? gh - 1 : y + k;
        sum += scratch[yy * gw + x]!;
      }
      out[y * gw + x] = sum / n;
    }
  }
}

export interface Drop {
  x: number;
  y: number;
  r: number;
  amount: number;
  /** Ink strength for this pour — one of the five registers. */
  conc: number;
  /** 0-1 through the pour when this one lands. */
  at: number;
}

/**
 * Which register the i-th of `count` pours is charged at.
 *
 * Ascending, ending at 焦, and that is 破墨法 rather than an arbitrary choice:
 * lay the 淡墨 wash first, then break 濃墨 into it while it is still wet. The
 * dark strike goes in last precisely so nothing lands on top of it afterwards.
 *
 * Starting dark was the first attempt and it measured badly — the head pour
 * spreads longest and takes every later pour on top of it, so mass-weighted
 * mixing pulled its 焦墨 toward the average and the rendered histogram lost its
 * top two registers entirely.
 *
 * This was a fixed cycle `[0, 2, 4, 1, 3]` indexed by pour number, which was
 * fine at three pours and wrong at two: it gave 清 and 重 and no 焦 anywhere, so
 * with the satellites gone — they carried conc 1 and were quietly supplying all
 * the near-black — the darkest ink in the composition fell to 0.54 alpha and
 * only 1% of the hero stayed above half. Spreading the registers across however
 * many pours there are means the last one is 焦 at any count.
 */
export function toneFor(i: number, count: number): number {
  if (count <= 1) return TONES[TONES.length - 1]!;
  const idx = Math.round((i * (TONES.length - 1)) / (count - 1));
  return TONES[idx]!;
}

/**
 * Where the throw begins and ends, as fractions of the box it is given.
 *
 * The box is now the **padded field**, which is larger than the canvas — see
 * MARGIN_X/MARGIN_Y in src/components/InkWash.astro. That is what lets the
 * throw start at 0.88 of the height and 0.08 of the width and still be *outside
 * the picture*: those coordinates fall in the margin, below and left of the
 * visible window.
 *
 * So the head — the biggest, wettest pour — never appears. What reaches the
 * canvas is the upper-right arc of its spread, which is the difference between
 * a mark on a page and a fragment of something larger.
 *
 * It runs upward for the same reason. The dense end belongs off the bottom-left
 * corner, thinning as it climbs toward the text, which the tone ceiling already
 * protects.
 */
export const AXIS_X0 = 0.1;
export const AXIS_X1 = 0.66;
export const AXIS_Y0 = 0.9;
export const AXIS_Y1 = 0.33;

/**
 * Where the ink falls.
 *
 * Ink arrives as discrete drops that land and then spread into one another,
 * rather than as a band poured across the sheet. That is both what actually
 * happens to ink and what the model wants: a poured band had to be laid down in
 * vertical slices, and every slice boundary was a wetness step that drove a
 * flow and printed a stripe.
 *
 * ## 氣韻 — the throw
 *
 * 潑墨 is flung. The ink carries the direction of the arm, which means the
 * composition has a head and a tail, not a centre. This used to scatter drops
 * along a horizontal band with `y` jittered symmetrically about its middle and
 * size drawn independently of position — an isotropic cloud, which is the one
 * thing a thrown mark is not.
 *
 * So the drops now walk a diagonal, and both size and charge decay along it:
 * heavy and wet where the arm released, sparse and dry where the gesture ran
 * out. Jitter is generous enough that the axis is felt rather than drawn — a
 * clean line of drops would read as a stamp.
 *
 * `sizeRef` exists because placement and scale stopped being the same thing.
 * Radii were taken from `gh`, which was fine while the field *was* the canvas —
 * then the field grew a margin on every side so the throw could be sourced
 * off-frame, and every drop silently grew with it, to 648px across on a 519px
 * hero. Position belongs to the padded field; size belongs to the window.
 *
 * Deterministic, so the composition is chosen rather than rolled.
 */
export function dropPlan(
  gw: number,
  gh: number,
  bandTop: number,
  bandBottom: number,
  count: number,
  seed: number,
  sizeRef = gh,
): Drop[] {
  const rnd = mulberry32(seed + 8191);
  const drops: Drop[] = [];
  const band = bandBottom - bandTop;
  for (let i = 0; i < count; i++) {
    // Position along the throw. Distinct from `at`, which is when the drop
    // lands: the pour still runs head-first, but the last drop belongs at the
    // end of the axis rather than two thirds of the way along it.
    const s = count > 1 ? i / (count - 1) : 0;
    const at = i / count;
    const x = (AXIS_X0 + s * (AXIS_X1 - AXIS_X0) + rnd() * 0.16 - 0.08) * gw;
    // Clamped, because the axis now ends at 0.92 of the band and the jitter is
    // +/-0.15 — so without this a tail drop could be placed below the band it
    // was handed, which is the one promise this function makes to its caller.
    const v = AXIS_Y0 + s * (AXIS_Y1 - AXIS_Y0) + rnd() * 0.3 - 0.15;
    const y = bandTop + (v < 0 ? 0 : v > 1 ? 1 : v) * band;
    // Head dense, tail thin — and steeply, because the pour works against it.
    // Drops land in order, so the head has been spreading for the whole pour by
    // the time the tail arrives fresh and concentrated. A gentle decay was
    // therefore invisible: diffusion had thinned the head below the tail before
    // anyone saw either. The gradient has to outrun that.
    const fall = 1 - s * 0.72;
    const p = rnd();
    const conc = toneFor(i, count);
    drops.push({
      x,
      y,
      // Big from the start. Diffusion from a point always yields a peaked
      // profile — a dense core with a halo too faint to render — which is why
      // small drops read as dark blobs on empty paper however far they spread.
      // A broad drop begins flat, and diffusion only has to soften its edge.
      // The tail shrinks, but never below a size that still spreads flat.
      r: sizeRef * (0.46 + p * p * 0.3) * (0.42 + fall * 0.58),
      // Charge follows *strength*, not position. 濃墨 is loaded ink — a heavy
      // brush of it, not a trace — and the mass matters as much as the number:
      // a strong pour carrying little pigment is simply outvoted when the
      // mixing weighs it against the wash it landed in.
      amount: (0.45 + rnd() * 0.25) * (0.55 + conc * 0.75),
      conc,
      at,
    });
  }
  return drops;
}

/**
 * The share of `COVERAGE_FULL` at which ink stops getting any more opaque.
 *
 * Low, and that is the point. This used to be a full-range transfer curve
 * deciding how dark every cell was from its density, which meant density
 * gradients showed as tonal gradients — and quantising those gradients drew
 * their level sets as contour rings.
 *
 * Tone comes from concentration now, so all this has left to do is fade the
 * outer edge of the ink where there is barely any. Saturating early confines
 * that fade to a narrow band at the perimeter, leaving the interior flat.
 */
export const COVERAGE_FULL = 0.055;

/**
 * The strongest ink allowed where words are, as a share of full strength.
 *
 * 清 — the palest register. Ink still crosses the text block; it simply cannot
 * be *strong* there, which is a tone constraint rather than a hole in the layer
 * and so leaves the mass unbroken.
 *
 * This is what licenses the contrast everywhere else. Worst case over text used
 * to be a full-strength register at peak opacity, 1.0 × 0.34; with the ceiling
 * it is 0.16 × 0.8, so the page got *more* readable as the splash got bolder.
 */
export const TONE_CEILING = TONES[0]!;

/**
 * Cap a cell's ink strength by how much of it is reserved for text.
 *
 * `reserve` runs 0 (open paper) to 1 (squarely under a line of text), feathered
 * by the caller so the cap arrives as a gradient. A hard switch would print the
 * text block's bounding box as a straight edge across the ink.
 */
export function ceilConc(conc: number, reserve: number): number {
  if (reserve <= 0) return conc;
  const cap = 1 - reserve * (1 - TONE_CEILING);
  return conc > cap ? cap : conc;
}

/**
 * Wetness at which the watermark is at full (still faint) strength.
 *
 * Low, because the halo's job is to show where water reached at all, not to
 * shade how much of it there was. At 0.22 it was doing the latter: almost the
 * whole damp region sits well under that, so the watermark faded away instead
 * of holding, and only 1.6% of the hero showed any of it. Saturating early is
 * what turns a gradient into a tide line.
 */
export const SOAK_FULL = 0.06;

/**
 * How dark the 水暈 gets, relative to the palest ink register.
 *
 * A fraction of 清, because a watermark is a change in the *paper* — fibre
 * swelled and sizing moved — not a tone in the ink. Too strong and it stops
 * reading as damp paper and starts reading as haze, which is the specific way
 * this can go wrong.
 */
export const HALO_STRENGTH = 0.42;

/**
 * The watermark's alpha at a cell, from its high-water mark.
 *
 * Deliberately not a ramp all the way up: it rises quickly and then flattens,
 * so the halo has an outline — a tide line — rather than fading gradually into
 * the paper. That edge is what says a liquid stopped here.
 */
export function haloAlpha(soak: number): number {
  if (soak <= 0.004) return 0;
  const t = soak >= SOAK_FULL ? 1 : (soak - 0.004) / (SOAK_FULL - 0.004);
  return TONES[0]! * HALO_STRENGTH * (t * t * (3 - 2 * t));
}

/** The throw's direction in radians, for a box of the given proportions. */
export function throwAngle(gw: number, band: number): number {
  return Math.atan2((AXIS_Y1 - AXIS_Y0) * band, (AXIS_X1 - AXIS_X0) * gw);
}

/**
 * How much of the paper this cell's ink actually covers, 0–1.
 *
 * Not the tone. Density says *how much* pigment is present, which decides
 * whether ink covers the cell at all; `conc` says how strong that ink is, which
 * decides what shade it reads as. Conflating the two is what produced a
 * contour map: with a single field driving opacity, every iso-density curve
 * became an iso-alpha curve, and quantising drew all of them.
 *
 * Smoothstep rather than a power curve, because what is wanted is saturation —
 * a plateau over the body of the ink with the whole transition spent at the
 * edge.
 */
export function coverage(load: number): number {
  if (load <= 0.012) return 0;
  const t = load >= COVERAGE_FULL ? 1 : (load - 0.012) / (COVERAGE_FULL - 0.012);
  return t * t * (3 - 2 * t);
}

/**
 * The density that counts as fully loaded ink.
 *
 * The renderer used to clamp `visible()` at 1 before doing anything with it,
 * which was wrong by a factor of two and invisible until the ink was quantised.
 * A settled plume runs to about 2.4 here, with **64% of its inked cells above
 * 1** — so the clamp flattened most of the field onto a single value, and every
 * one of those cells then quantised to the same register. That is why 焦墨 came
 * out as a slab: not because the tone curve was wrong, but because two thirds of
 * the ink had been made numerically identical before the tone curve saw it.
 *
 * Set near the plume's 99th percentile, so the darkest register is reserved for
 * genuine drop cores and the rest of the field has room to spread across the
 * other four. It also restores drying: with everything pinned at the clamp,
 * `inkAfterDrying` stripped the whole field at once instead of stepping it down
 * through the registers.
 */
export const DENSITY_FULL = 2.2;
