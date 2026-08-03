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
  /** Paper absorbency. Oriented fibre, seeded once and never touched again. */
  fibre: Float32Array;
  /** Scratch buffers, so a step allocates nothing. */
  tmpWet: Float32Array;
  tmpPig: Float32Array;
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
  const k = 0.045;
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
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      // Wide contrast, several scales. A narrow range (this was 0.55-1.0)
      // merely nudges the flow; a wide one makes ink flood some channels and
      // starve others, which is what breaks an advancing front into fingers
      // instead of a smooth disc. The floor keeps every cell passable, so ink
      // can never hard-stop against a seam.
      const coarse = fibreNoise(x, y, seed);
      const fine = fibreNoise(x * 2.6 + 31, y * 2.6 - 17, seed + 991);
      const chan = coarse * 0.68 + fine * 0.32;
      fibre[y * gw + x] = 0.12 + Math.pow(chan, 1.6) * 0.95;
    }
  }
  return {
    gw,
    gh,
    wet: new Float32Array(n),
    pig: new Float32Array(n),
    dep: new Float32Array(n),
    fibre,
    tmpWet: new Float32Array(n),
    tmpPig: new Float32Array(n),
  };
}

/** Clear everything except the paper, which never changes. */
export function resetField(f: InkField): void {
  f.wet.fill(0);
  f.pig.fill(0);
  f.dep.fill(0);
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
      f.wet[i] = Math.min(1.4, f.wet[i]! + a);
      f.pig[i] = Math.min(1.6, f.pig[i]! + a * PIG_LOAD);
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
export const PIG_LOAD = 1.0;

/** One drop — a splash of splatter, or the cursor. It will bleed on its own. */
export function injectBlob(
  f: InkField,
  cx: number,
  cy: number,
  r: number,
  amount = 1,
): void {
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(f.gw - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(f.gh - 1, Math.ceil(cy + r));
  const rr = r * r;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d > rr) continue;
      const a = (1 - Math.sqrt(d) / r) * amount;
      const i = y * f.gw + x;
      f.wet[i] = Math.min(1.4, f.wet[i]! + a);
      f.pig[i] = Math.min(1.6, f.pig[i]! + a * PIG_LOAD);
    }
  }
}

/** How fast water leaves the paper, per tick at dt = 1. */
export const EVAPORATION = 0.022;
/** How readily suspended pigment settles out. */
export const DEPOSIT_RATE = 0.1;
/**
 * How much faster pigment travels than the water carrying it.
 *
 * Above 1 this produces the coffee ring: pigment outruns its water, strands at
 * a drying perimeter, and the blot dries darkest at the rim. That is correct
 * for ink on **paper**, and it is what this was set to.
 *
 * It is wrong for ink in **water**, which is the reference now. Measuring that
 * image gives core alpha 0.549 against 0.329 at the edge — denser in the middle,
 * fading outward — because a drop in a bowl has no contact line to pin and no
 * fast-drying perimeter to strand against. So pigment now travels slightly
 * *slower* than the water carrying it and stays where it fell.
 */
export const ADVECT_BIAS = 0.85;

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
  const { gw, gh, wet, pig, tmpPig } = f;
  tmpPig.set(pig);
  let before = 0;
  for (let i = 0; i < pig.length; i++) before += pig[i]!;
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const i = y * gw + x;
      // only where there is water to carry it
      if (wet[i]! <= 0.002) continue;
      const b = flowBias(x, y, seed);
      const sx = x - b.dx * SWIRL * dt;
      const sy = y - b.dy * SWIRL * dt;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      if (x0 < 0 || y0 < 0 || x0 >= gw - 1 || y0 >= gh - 1) continue;
      const fx = sx - x0;
      const fy = sy - y0;
      const a = tmpPig[y0 * gw + x0]!;
      const bb = tmpPig[y0 * gw + x0 + 1]!;
      const c = tmpPig[(y0 + 1) * gw + x0]!;
      const d = tmpPig[(y0 + 1) * gw + x0 + 1]!;
      pig[i] =
        a * (1 - fx) * (1 - fy) + bb * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
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
export const SWIRL = 0.85;

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
  const { gw, gh, wet, pig, dep, fibre, tmpWet, tmpPig } = f;
  tmpWet.set(wet);
  tmpPig.set(pig);

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
      const bias = flowBias(x, y, seed);
      let count = 0;
      let total = 0;
      if (x > 0) {
        const j = i - 1;
        const d = (w - tmpWet[j]!) * (1 + DRIFT * -bias.dx) * fibre[j]!;
        if (d > 0) { nb[count] = j; share[count] = d; total += d; count++; }
      }
      if (x < gw - 1) {
        const j = i + 1;
        const d = (w - tmpWet[j]!) * (1 + DRIFT * bias.dx) * fibre[j]!;
        if (d > 0) { nb[count] = j; share[count] = d; total += d; count++; }
      }
      if (y > 0) {
        const j = i - gw;
        const d = (w - tmpWet[j]!) * (1 + DRIFT * -bias.dy) * fibre[j]!;
        if (d > 0) { nb[count] = j; share[count] = d; total += d; count++; }
      }
      if (y < gh - 1) {
        const j = i + gw;
        const d = (w - tmpWet[j]!) * (1 + DRIFT * bias.dy) * fibre[j]!;
        if (d > 0) { nb[count] = j; share[count] = d; total += d; count++; }
      }
      if (count === 0 || total <= 0) continue;

      // capped so a cell can never drain more than it holds
      const moveW = Math.min(w * 0.5, total * 0.06 * dt * fibre[i]!);
      const p = tmpPig[i]!;
      const moveP = Math.min(p * 0.6, moveW * (p / (w + 1e-6)) * ADVECT_BIAS);
      for (let k = 0; k < count; k++) {
        const frac = share[k]! / total;
        wet[nb[k]!] = wet[nb[k]!]! + moveW * frac;
        pig[nb[k]!] = pig[nb[k]!]! + moveP * frac;
      }
      wet[i] = wet[i]! - moveW;
      pig[i] = pig[i]! - moveP;
    }
  }

  // ---- carry pigment along the swirl. Transport, not diffusion: this is what
  // stretches the plume into filaments instead of averaging it into a disc.
  advectPig(f, seed, dt);

  // ---- deposit + evaporate
  for (let i = 0; i < wet.length; i++) {
    const w = wet[i]!;
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
  /** 0-1 through the pour when this one lands. */
  at: number;
}

/**
 * Where the rain falls.
 *
 * Ink arrives as discrete drops that land and then spread into one another,
 * rather than as a band poured across the sheet. That is both what actually
 * happens to ink on paper and what the model wants: a poured band had to be
 * laid down in vertical slices, and every slice boundary was a wetness step
 * that drove a flow and printed a stripe.
 *
 * Sizes follow a power law — many fine drops, a few fat ones that become the
 * dark pools. Deterministic, so the composition is chosen rather than rolled.
 */
export function dropPlan(
  gw: number,
  gh: number,
  bandTop: number,
  bandBottom: number,
  count: number,
  seed: number,
): Drop[] {
  const rnd = mulberry32(seed + 8191);
  const drops: Drop[] = [];
  const yc = (bandTop + bandBottom) / 2;
  const half = (bandBottom - bandTop) / 2;
  for (let i = 0; i < count; i++) {
    const at = i / count;
    // land a little ahead of the front rather than anywhere, so the sheet still
    // fills roughly left to right instead of flickering into existence
    const x = (at * 0.82 + rnd() * 0.3 - 0.06) * gw;
    // biased toward the middle of the band, so its edges stay ragged
    const u = rnd() * 2 - 1;
    const y = yc + Math.sign(u) * Math.pow(Math.abs(u), 1.5) * half;
    const p = rnd();
    drops.push({
      x,
      y,
      r: gh * (0.05 + p * p * p * 0.16),
      amount: 0.7 + rnd() * 0.5,
      at,
    });
  }
  return drops;
}

/**
 * Deposited pigment → the alpha the difference blend receives.
 *
 * The measured reference is soft and light — peak density only ~30% — yet under
 * 10% of it sits between 0.35 and 0.65 alpha. Both facts matter, and a first
 * pass honoured only the second: a curve that zeroed everything faint was
 * dutifully bimodal and erased the broad light wash the reference is mostly
 * made of, leaving a single dark blot.
 *
 * The fix is that *low* alpha was never the problem. Only 0.35-0.65 is — the
 * dead middle where difference blending maps every backdrop onto the same grey.
 * So this keeps the light wash and crosses the middle quickly instead.
 */
export function inkAlpha(dep: number): number {
  // A broad, light wash — most of the sheet, and the bulk of what the reference
  // actually is. Well under the hinge, so text here keeps its own polarity and
  // merely sits on a tint.
  if (dep <= 0.02) return 0;
  if (dep < 0.5) return (0.3 * (dep - 0.02)) / 0.48;
  // The crossing. Everything between a tint and a flip is traversed in one
  // short span of deposit, so almost no pixel lands in 0.35-0.65 where
  // difference blending maps every backdrop onto the same grey.
  if (dep < 0.66) {
    const t = (dep - 0.5) / 0.16;
    return 0.3 + 0.55 * (t * t * (3 - 2 * t));
  }
  // Committed pigment: a clean inversion, text pale and legible inside it.
  const v = 0.85 + (dep - 0.66) * 0.6;
  return v > 1 ? 1 : v;
}
