import { describe, it, expect, beforeAll } from 'vitest';
import {
  DENSITY_FULL,
  DEPOSIT_RATE,
  EVAPORATION,
  blurField,
  DRIFT_FLOOR,
  createField,
  dropPlan,
  fibreNoise,
  flowBias,
  AXIS_X0,
  AXIS_X1,
  AXIS_Y0,
  AXIS_Y1,
  ADVECT_BIAS,
  ceilConc,
  FILTRATION,
  haloAlpha,
  SOAK_FULL,
  CONC_SPREAD,
  injectStreak,
  spatterPlan,
  throwAngle,
  TONE_CEILING,
  fiveTones,
  mixConc,
  injectBand,
  injectBlob,
  coverage,
  COVERAGE_FULL,
  mottleAt,
  MOTTLE_DEPTH,
  MOTTLE_SCALE,
  TONES,
  TONE_SOFT,
  voidAt,
  VOID_SCALE,
  resetField,
  stepInk,
  visible,
  type Drop,
  type InkField,
} from '@/lib/ink-field';
import { INK_SEED } from '@/lib/ink';

const sum = (a: Float32Array) => a.reduce((s, v) => s + v, 0);
const run = (f: InkField, n: number) => {
  for (let i = 0; i < n; i++) stepInk(f);
};

/** A field with one drop in the middle, already stepped. */
function drop(steps: number, gw = 60, gh = 60, r = 7) {
  const f = createField(gw, gh, INK_SEED);
  injectBlob(f, gw / 2, gh / 2, r, 1);
  run(f, steps);
  return f;
}

describe('the paper', () => {
  it('is oriented — ink has a grain to travel along', () => {
    // Yan et al. use Gabor noise for rice paper precisely because it is
    // directional. Isotropic paper would let every blot spread as a circle.
    let along = 0;
    let across = 0;
    for (let d = 1; d < 40; d++) {
      along += Math.abs(fibreNoise(d, 0, INK_SEED) - fibreNoise(d - 1, 0, INK_SEED));
      across += Math.abs(fibreNoise(0, d, INK_SEED) - fibreNoise(0, d - 1, INK_SEED));
    }
    // features are stretched along the grain, so change is slower that way
    expect(along).toBeLessThan(across * 0.8);
  });

  it('is nearly uniform — there is no paper in a bowl of water', () => {
    // This once asserted the opposite. The field was widened to a 9:1 ratio to
    // channel flow into fingers; it worked, and it was the wrong mechanism.
    // Substrate channels vary at cell scale, the steep alpha curve magnifies
    // cell-scale variation, and the plume came out granular and dirty.
    // Fingering is the flow's job (advectPig); the medium should be almost
    // featureless, with only enough inhomogeneity not to be perfectly flat.
    const f = createField(60, 60, INK_SEED);
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of f.fibre) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    expect(lo).toBeGreaterThan(0.8);
    expect(hi / lo).toBeLessThan(1.3);
  });

  it('is deterministic', () => {
    expect(Array.from(createField(24, 24, 7).fibre)).toEqual(
      Array.from(createField(24, 24, 7).fibre),
    );
  });
});

describe('the simulation', () => {
  it('is densest where it landed and thins outward — ink in water, not on paper', () => {
    // This assertion used to run the other way, and was right to: on paper the
    // perimeter dries first, pigment strands there, and you get a coffee ring.
    // Measuring the reference settled which regime we are in — core alpha 0.549
    // against 0.329 at the edge. A drop in a bowl has no contact line to pin
    // and no fast-drying rim to strand against, so it stays darkest where it
    // fell. ADVECT_BIAS below 1 is what expresses that.
    const f = drop(60);
    const c = Math.round(f.gw / 2);
    const ring = (lo: number, hi: number) => {
      let sum = 0;
      let n = 0;
      for (let y = 0; y < f.gh; y++) {
        for (let x = 0; x < f.gw; x++) {
          const d = Math.hypot(x - c, y - c);
          if (d >= lo && d < hi) { sum += f.dep[y * f.gw + x]!; n++; }
        }
      }
      return n ? sum / n : 0;
    };
    expect(ring(0, 5)).toBeGreaterThan(ring(9, 16));
  });

  it('fingers instead of advancing as a disc', () => {
    // Saffman-Taylor: a thin fluid pushing into a thicker one breaks into
    // fingers. The reference measures 0.21 raggedness (radial reach varying
    // +/-21% around the silhouette); a smooth circle would be ~0. If this ever
    // fails, the permeability contrast has been narrowed and the front has gone
    // back to a disc.
    const f = drop(70, 120, 120, 8);
    const c = 60;
    // Threshold relative to the peak, matching how the reference was measured
    // (a fixed offset from paper white on a normalised image). An absolute
    // floor traces the faint outer halo, which is smooth by construction, and
    // says nothing about whether the plume itself is fingered.
    const cut = Math.max(...f.dep) * 0.06;
    const reach: number[] = [];
    for (let k = 0; k < 64; k++) {
      const th = (k / 64) * Math.PI * 2;
      let far = 0;
      for (let r = 1; r < 55; r++) {
        const x = Math.round(c + Math.cos(th) * r);
        const y = Math.round(c + Math.sin(th) * r);
        if (x < 0 || y < 0 || x >= f.gw || y >= f.gh) break;
        if (f.dep[y * f.gw + x]! > cut) far = r;
      }
      reach.push(far);
    }
    const mean = reach.reduce((a, b) => a + b, 0) / reach.length;
    const std = Math.sqrt(reach.reduce((s, v) => s + (v - mean) ** 2, 0) / reach.length);
    expect(mean).toBeGreaterThan(4);
    expect(std / mean).toBeGreaterThan(0.12);
  });

  it('diffuses unevenly — filaments and voids, not a smooth gradient', () => {
    const f = drop(70, 120, 120, 8);
    const vals = [...f.dep].filter((v) => v > 2e-3);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const std = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
    // the reference sits near 0.50 relative variation
    expect(std / mean).toBeGreaterThan(0.35);
  });

  it('conserves pigment once nothing more is added', () => {
    const f = drop(0);
    const before = sum(f.pig) + sum(f.dep);
    run(f, 60);
    const after = sum(f.pig) + sum(f.dep);
    expect(after).toBeGreaterThan(before * 0.98);
    expect(after).toBeLessThan(before * 1.02);
  });

  it('dries out completely and stays dry', () => {
    const f = drop(0);
    let prev = sum(f.wet);
    expect(prev).toBeGreaterThan(0);
    for (let i = 0; i < 200; i++) {
      stepInk(f);
      const now = sum(f.wet);
      expect(now).toBeLessThanOrEqual(prev + 1e-4);
      prev = now;
    }
    expect(prev).toBeCloseTo(0, 4);
  });

  it('spreads — wet pigment covers more ground than it started on', () => {
    const f = createField(60, 60, INK_SEED);
    injectBlob(f, 30, 30, 5, 1);
    const wetted = (g: InkField) => g.pig.reduce((n, v) => n + (v > 1e-4 ? 1 : 0), 0)
      + g.dep.reduce((n, v) => n + (v > 1e-4 ? 1 : 0), 0);
    const before = wetted(f);
    run(f, 30);
    expect(wetted(f)).toBeGreaterThan(before);
  });

  it('drifts without inventing or destroying water', () => {
    // The drift only redistributes a cell's outflow among its neighbours, so it
    // can steer a plume without the solver losing footing.
    for (let i = 0; i < 50; i++) {
      const b = flowBias(i * 3.1, i * 1.7, INK_SEED);
      expect(Number.isFinite(b.dx)).toBe(true);
      expect(Number.isFinite(b.dy)).toBe(true);
      expect(Math.hypot(b.dx, b.dy)).toBeLessThanOrEqual(1.001);
    }
    // it dominates the gradient on purpose — diffusion alone smooths fingers
    // away — but the floor is what keeps every share strictly positive
    expect(DRIFT_FLOOR).toBeGreaterThan(0);
  });

  it('bleeds further along the grain than across it', () => {
    // the paper has to actually do something, not just exist
    const f = drop(50, 90, 90, 6);
    const c = 45;
    const reach = (dx: number, dy: number) => {
      let far = 0;
      for (let d = 1; d < 40; d++) {
        const x = Math.round(c + dx * d);
        const y = Math.round(c + dy * d);
        if (x < 0 || y < 0 || x >= f.gw || y >= f.gh) break;
        if (f.dep[y * f.gw + x]! > 2e-3) far = d;
      }
      return far;
    };
    const along = reach(Math.cos(0.28), Math.sin(0.28));
    const across = reach(-Math.sin(0.28), Math.cos(0.28));
    expect(along).toBeGreaterThanOrEqual(across);
  });

  it('keeps every field finite and non-negative, forever', () => {
    const f = createField(50, 50, INK_SEED);
    injectBand(f, 0, 50, 25, 12, INK_SEED, 1);
    injectBlob(f, 10, 10, 4, 1);
    // Aggregated rather than a per-cell expect(): 150 steps x 2500 cells x 3
    // fields is 1.1M assertions and the runner spends longer on bookkeeping
    // than the simulation does on physics.
    let bad = 0;
    for (let i = 0; i < 150; i++) {
      stepInk(f);
      for (const g of [f.wet, f.pig, f.dep]) {
        for (const v of g) if (!Number.isFinite(v) || v < -1e-6) bad++;
      }
    }
    expect(bad).toBe(0);
  });

  it('is deterministic for a seed and a step count', () => {
    const a = drop(25);
    const b = drop(25);
    expect(Array.from(a.dep)).toEqual(Array.from(b.dep));
  });

  it('resets without disturbing the paper', () => {
    const f = drop(20);
    const paper = Array.from(f.fibre);
    resetField(f);
    expect(sum(f.wet)).toBe(0);
    expect(sum(f.pig)).toBe(0);
    expect(sum(f.dep)).toBe(0);
    expect(Array.from(f.fibre)).toEqual(paper);
  });

  it('has sane rate constants', () => {
    expect(EVAPORATION).toBeGreaterThan(0);
    expect(EVAPORATION).toBeLessThan(0.5);
    expect(DEPOSIT_RATE).toBeGreaterThan(0);
    expect(DEPOSIT_RATE).toBeLessThan(1);
  });
});

describe('injectBand', () => {
  it('leaves gaps — a field is pools, not a rectangle', () => {
    // diffusion smooths, it never clumps, so if the injection is even the result
    // is an even slab. The negative space has to be created here or not at all.
    const f = createField(120, 60, INK_SEED);
    injectBand(f, 0, 120, 30, 18, INK_SEED, 1);
    let inBand = 0;
    let empty = 0;
    for (let y = 18; y < 42; y++) {
      for (let x = 0; x < 120; x++) {
        inBand++;
        if (f.wet[y * 120 + x]! < 1e-4) empty++;
      }
    }
    expect(empty / inBand).toBeGreaterThan(0.12);
    expect(empty / inBand).toBeLessThan(0.75);
  });

  it('stays inside its band, leaving clean paper above and below', () => {
    const f = createField(80, 80, INK_SEED);
    injectBand(f, 0, 80, 40, 14, INK_SEED, 1);
    for (let y = 0; y < 80; y++) {
      if (Math.abs(y - 40) < 14) continue;
      for (let x = 0; x < 80; x++) expect(f.wet[y * 80 + x]!).toBe(0);
    }
  });
});

describe('coverage — how much paper the ink covers, not how dark it is', () => {
  it('saturates early, so its transition is spent at the edge', () => {
    // This used to be a full-range transfer curve deciding darkness from
    // density, which meant a density gradient showed as a tonal gradient — and
    // quantising those gradients drew their level sets as contour rings. Tone
    // belongs to concentration now. All this owes the ink is a fade where there
    // is barely any of it, confined to a narrow band at the perimeter.
    expect(coverage(COVERAGE_FULL)).toBe(1);
    expect(coverage(0.6)).toBe(1);
    // and the body of a plume — well past the saturation point — is flat
    expect(coverage(0.9)).toBe(coverage(0.5));
  });

  it('is fed a normalised load, not a clamped one', () => {
    // A settled plume runs to about 2.4, so the renderer's old `min(d, 1)`
    // collapsed two thirds of the ink onto one value.
    expect(DENSITY_FULL).toBeGreaterThan(1.8);
    expect(DENSITY_FULL).toBeLessThan(3);
  });

  it('is monotonic and spans the full range', () => {
    let prev = -1;
    for (let i = 0; i <= 100; i++) {
      const a = coverage(i / 100);
      expect(a).toBeGreaterThanOrEqual(prev);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
      prev = a;
    }
    expect(coverage(0)).toBe(0);
    expect(coverage(1)).toBe(1);
  });

  it('still discards a whisper, so clean paper stays clean', () => {
    expect(coverage(0.005)).toBe(0);
  });
});

describe('visible — mottling, which is not grain', () => {
  const mk = () => {
    const gw = 120;
    const out = new Float32Array(gw * gw);
    for (let i = 0; i < out.length; i++) out[i] = mottleAt(i % gw, (i / gw) | 0, INK_SEED);
    return out;
  };

  it('varies, but no longer carries the composition', () => {
    // The bar here used to be 0.15, from when mottling was the only thing
    // between a smooth diffusion gradient and one flat grey shape. It is applied
    // after the tones are quantised now, and at that strength it undid them:
    // multiplying a flat register by 0.28-1.72 smears it back into a gradient,
    // and the rendered histogram showed three broad humps instead of five peaks.
    // Structure comes from the concentration field; what is left for this is the
    // soft unevenness within a single wash.
    const v = mk();
    const mean = v.reduce((s, x) => s + x, 0) / v.length;
    const std = Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / v.length);
    expect(std / mean).toBeGreaterThan(0.05);
    expect(std / mean).toBeLessThan(0.14);
  });

  it('is low-frequency — this is the whole distinction from grain', () => {
    // Grain is cell-to-cell variation: it is what a high-contrast permeability
    // field produced, what the blur exists to suppress, and what read as dirt.
    // Mottling must vary over tens of cells and barely at all between
    // neighbours, which is what makes it immune to both blurring and aliasing.
    const v = mk();
    const gw = 120;
    let neighbour = 0;
    let far = 0;
    let n = 0;
    for (let y = 0; y < 120; y++) {
      for (let x = 0; x < gw - MOTTLE_SCALE; x++) {
        const i = y * gw + x;
        neighbour += Math.abs(v[i + 1]! - v[i]!);
        far += Math.abs(v[i + MOTTLE_SCALE]! - v[i]!);
        n++;
      }
    }
    expect(far / n).toBeGreaterThan((neighbour / n) * 5);
  });

  it('never inverts or zeroes ink that exists', () => {
    const v = mk();
    for (const x of v) {
      expect(x).toBeGreaterThan(0);
      expect(Number.isFinite(x)).toBe(true);
    }
    expect(MOTTLE_DEPTH).toBeLessThan(1);
  });

  it('leaves clean paper clean — it multiplies, it never adds', () => {
    const f = createField(40, 40, INK_SEED);
    const v = visible(f);
    for (const x of v) expect(x).toBe(0);
  });
});

describe('blurField — why the wash is silky rather than granular', () => {
  it('smooths cell-to-cell speckle', () => {
    // The alpha curve must stay steep to clear the blend's dead middle, and a
    // steep transfer amplifies any per-cell variation into visible grain. This
    // is what removes the grain before the curve can magnify it.
    const gw = 40;
    const gh = 40;
    const src = new Float32Array(gw * gh);
    for (let i = 0; i < src.length; i++) src[i] = i % 2 === 0 ? 1 : 0;
    const out = new Float32Array(gw * gh);
    const scratch = new Float32Array(gw * gh);
    blurField(src, out, scratch, gw, gh, 2);
    const variation = (a: Float32Array) => {
      let v = 0;
      for (let i = 1; i < a.length; i++) v += Math.abs(a[i]! - a[i - 1]!);
      return v;
    };
    expect(variation(out)).toBeLessThan(variation(src) * 0.2);
  });

  it('conserves the total and never invents ink', () => {
    const gw = 30;
    const gh = 30;
    const src = new Float32Array(gw * gh);
    for (let i = 0; i < src.length; i++) src[i] = Math.random();
    const out = new Float32Array(gw * gh);
    const scratch = new Float32Array(gw * gh);
    blurField(src, out, scratch, gw, gh, 2);
    const total = (a: Float32Array) => a.reduce((s, v) => s + v, 0);
    expect(total(out)).toBeGreaterThan(total(src) * 0.9);
    expect(total(out)).toBeLessThan(total(src) * 1.1);
    for (const v of out) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('dropPlan — rain, not a poured band', () => {
  const drops = dropPlan(288, 130, 130 * 0.12, 130 * 0.84, 130, INK_SEED);

  it('is deterministic', () => {
    expect(dropPlan(288, 130, 15.6, 109.2, 130, INK_SEED)).toEqual(drops);
  });

  it('drops broad, and varies', () => {
    // This once required many fine drops and a few fat ones, which suited rain
    // landing on paper. Ink in water wants one or two broad drops instead:
    // diffusion from a point always leaves a dense core and a halo too faint to
    // see, so a drop has to *begin* broad rather than spread into breadth.
    const radii = drops.map((d) => d.r).sort((a, b) => a - b);
    const median = radii[Math.floor(radii.length / 2)]!;
    expect(radii[0]!).toBeGreaterThan(20);
    expect(radii[radii.length - 1]!).toBeGreaterThan(median * 1.1);
  });

  it('crosses the sheet and lands in order', () => {
    // The far bound used to be 0.8 of the width. The throw is deliberately
    // aimed short of that now: the hero's photo card is opaque and covers the
    // right half, so a mark reaching 0.88 put most of itself — and most of its
    // 焦墨 — behind the picture where nobody could see it.
    expect(Math.min(...drops.map((d) => d.x))).toBeLessThan(288 * 0.12);
    expect(Math.max(...drops.map((d) => d.x))).toBeGreaterThan(288 * 0.6);
    for (let i = 1; i < drops.length; i++) {
      expect(drops[i]!.at).toBeGreaterThanOrEqual(drops[i - 1]!.at);
    }
  });

  it('stays within the band it was given', () => {
    for (const d of drops) {
      expect(d.y).toBeGreaterThanOrEqual(130 * 0.12 - 0.001);
      expect(d.y).toBeLessThanOrEqual(130 * 0.84 + 0.001);
      expect(d.amount).toBeGreaterThan(0);
      expect(d.r).toBeGreaterThan(0);
    }
  });
});

describe('fiveTones — 墨分五色', () => {
  const sweep = Array.from({ length: 2001 }, (_, i) => i / 2000);

  it('is monotone and stays in range', () => {
    let prev = -1;
    for (const a of sweep) {
      const v = fiveTones(a);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      expect(v).toBeLessThanOrEqual(1 + 1e-9);
      prev = v;
    }
    expect(fiveTones(0)).toBe(0);
    expect(fiveTones(1)).toBeCloseTo(1, 6);
  });

  it('is genuinely discrete — few levels, not a ramp', () => {
    // A tone curve that merely bends is still a gradient. What makes ink read
    // as ink is that most of the input range maps to one of a handful of
    // outputs, so neighbouring areas of slightly different density come out the
    // *same* tone and the boundary between registers is visible.
    // Counting distinct outputs is the obvious measure and the wrong one: a
    // transition of any width at all contributes a value at every sample, so it
    // counts a curve that is 90% flat as though it were a ramp. What matters is
    // where the *mass* sits — how much of the input range comes out at one of
    // the registers rather than between them. That is the same statement as the
    // rendered histogram being multi-modal, made on the curve itself.
    const levels = [0, ...TONES];
    const atRegister = (f: (a: number) => number) =>
      sweep.filter((a) => levels.some((l) => Math.abs(f(a) - l) < 0.02)).length / sweep.length;

    expect(atRegister(fiveTones)).toBeGreaterThan(0.7);

    // The same measure on a smooth ramp must fail, or the assertion above is
    // measuring nothing. This is the curve fiveTones sits on top of.
    expect(atRegister((a) => Math.pow(a, 0.62))).toBeLessThan(0.35);
  });

  it('spends more of its range on flats than on transitions', () => {
    // Slope is what distinguishes a register from a boundary: inside a register
    // the curve is flat, and it only moves while crossing between two.
    let flat = 0;
    for (let i = 1; i < sweep.length; i++) {
      const slope = (fiveTones(sweep[i]!) - fiveTones(sweep[i - 1]!)) / (sweep[i]! - sweep[i - 1]!);
      if (slope < 0.2) flat++;
    }
    expect(flat / (sweep.length - 1)).toBeGreaterThan(0.55);
  });

  it('has boundaries soft enough not to alias', () => {
    // A hard step would stair-step wherever a tonal edge crosses a diagonal.
    // Bounding the steepest slope is the same statement made continuously.
    let worst = 0;
    for (let i = 1; i < sweep.length; i++) {
      worst = Math.max(worst, Math.abs(fiveTones(sweep[i]!) - fiveTones(sweep[i - 1]!)));
    }
    // Steepest smoothstep slope is 1.5/(2·TONE_SOFT) times the tallest rise.
    const tallest = Math.max(...TONES.map((t, i) => t - (i ? TONES[i - 1]! : 0)));
    expect(worst).toBeLessThan(((tallest * 1.5) / (2 * TONE_SOFT)) * (1 / 2000) * 1.2);
  });

  it('reaches every register', () => {
    // Registers that no input can select are decoration in the constant table.
    for (const level of TONES) {
      expect(sweep.some((a) => Math.abs(fiveTones(a) - level) < 0.005)).toBe(true);
    }
  });
});

describe('voidAt — 留白', () => {
  const cells: number[] = [];
  for (let y = 0; y < 140; y++) for (let x = 0; x < 220; x++) cells.push(voidAt(x, y, INK_SEED));

  it('reserves real paper, not thin patches', () => {
    // Exactly zero matters. A void that merely dips is a light passage, which
    // the mottling already provides plenty of; 留白 is the paper left showing.
    const empty = cells.filter((v) => v === 0).length;
    expect(empty / cells.length).toBeGreaterThan(0.02);
    expect(empty / cells.length).toBeLessThan(0.3);
  });

  it('leaves most of the sheet open to ink', () => {
    expect(cells.filter((v) => v === 1).length / cells.length).toBeGreaterThan(0.55);
  });

  it('stays in range', () => {
    for (const v of cells) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('varies at a long wavelength, so voids are shapes and not holes', () => {
    // Same assertion shape as the mottling's: at cell scale this would be the
    // granularity that has already been removed twice.
    const step = (dx: number) => {
      let sum = 0;
      let n = 0;
      for (let y = 10; y < 130; y += 7) {
        for (let x = 10; x < 200; x += 7) {
          sum += Math.abs(voidAt(x + dx, y, INK_SEED) - voidAt(x, y, INK_SEED));
          n++;
        }
      }
      return sum / n;
    };
    expect(step(VOID_SCALE)).toBeGreaterThan(step(1) * 4);
  });

  it('is deterministic and seed-dependent', () => {
    expect(voidAt(31, 47, INK_SEED)).toBe(voidAt(31, 47, INK_SEED));
    const other: number[] = [];
    for (let y = 0; y < 140; y++) for (let x = 0; x < 220; x++) other.push(voidAt(x, y, 7));
    expect(other).not.toEqual(cells);
  });
});

describe('dropPlan — 氣韻, the throw', () => {
  const drops = dropPlan(288, 130, 130 * 0.12, 130 * 0.84, 24, INK_SEED);

  const corr = (a: number[], b: number[]) => {
    const ma = a.reduce((s, v) => s + v, 0) / a.length;
    const mb = b.reduce((s, v) => s + v, 0) / b.length;
    let num = 0;
    let da = 0;
    let db = 0;
    for (let i = 0; i < a.length; i++) {
      num += (a[i]! - ma) * (b[i]! - mb);
      da += (a[i]! - ma) ** 2;
      db += (b[i]! - mb) ** 2;
    }
    return num / Math.sqrt(da * db);
  };

  it('runs along a diagonal, not a horizontal band', () => {
    // The old plan jittered y symmetrically about the band's middle, which is
    // an isotropic cloud — the one thing a thrown mark is not.
    //
    // The sign is negative because the throw now climbs: it is sourced outside
    // the frame's bottom-left corner and travels up and to the right, and screen
    // y grows downward. Strength of the correlation is what is being asserted.
    expect(corr(drops.map((d) => d.x), drops.map((d) => d.y))).toBeLessThan(-0.7);
  });

  it('is felt rather than drawn', () => {
    // A clean line of drops reads as a stamp. The jitter has to be wide enough
    // that the axis is an impression, so the correlation must be short of 1.
    expect(Math.abs(corr(drops.map((d) => d.x), drops.map((d) => d.y)))).toBeLessThan(0.98);
  });

  it('has a broad head and a small tail', () => {
    const third = Math.floor(drops.length / 3);
    const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
    expect(mean(drops.slice(0, third).map((d) => d.r))).toBeGreaterThan(
      mean(drops.slice(-third).map((d) => d.r)) * 1.15,
    );
  });

  it('charges each pour by its strength, not its place in the throw', () => {
    // 濃墨 is loaded ink. Tying charge to position instead left the dark strike
    // carrying almost no pigment, so the mixing simply outvoted it against the
    // pale wash it landed in and the top registers never reached the screen.
    const strong = drops.filter((d) => d.conc > 0.6);
    const weak = drops.filter((d) => d.conc < 0.4);
    const mean = (xs: Drop[]) => xs.reduce((s, d) => s + d.amount, 0) / xs.length;
    expect(strong.length).toBeGreaterThan(0);
    expect(weak.length).toBeGreaterThan(0);
    expect(mean(strong)).toBeGreaterThan(mean(weak) * 1.2);
  });

  it('spans the axis end to end', () => {
    const s = drops.map((d) => d.x / 288).sort((a, b) => a - b);
    expect(s[0]!).toBeLessThan(0.12);
    expect(s[s.length - 1]!).toBeGreaterThan(0.6);
  });
});

describe('墨分五色 as material, not as contour lines', () => {
  /** A field with three pours of different strength, settled. */
  function poured(gw = 200, gh = 120) {
    const f = createField(gw, gh, INK_SEED);
    const drops = dropPlan(gw, gh, gh * 0.12, gh * 0.84, 3, INK_SEED);
    for (const d of drops) injectBlob(f, d.x, d.y, d.r, d.amount, d.conc, INK_SEED);
    for (let i = 0; i < 400; i++) stepInk(f, 1, INK_SEED);
    return f;
  }

  /** Which register a cell reads as, or -1 for bare paper. */
  const registerOf = (f: InkField, i: number) => {
    if (f.pig[i]! + f.dep[i]! < 0.05) return -1;
    const q = fiveTones(f.conc[i]!);
    let best = 0;
    for (let k = 1; k < TONES.length; k++)
      if (Math.abs(q - TONES[k]!) < Math.abs(q - TONES[best]!)) best = k;
    return best;
  };

  /** Connected regions of constant register, largest first. */
  function regions(f: InkField) {
    const { gw, gh } = f;
    const lab = new Int32Array(gw * gh).fill(-1);
    const sizes: number[] = [];
    const stack: number[] = [];
    for (let s0 = 0; s0 < gw * gh; s0++) {
      if (lab[s0] !== -1) continue;
      const v = registerOf(f, s0);
      if (v < 0) { lab[s0] = -2; continue; }
      lab[s0] = sizes.length;
      stack.length = 0;
      stack.push(s0);
      let n = 0;
      while (stack.length) {
        const i = stack.pop()!;
        n++;
        const x = i % gw;
        const y = (i / gw) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
          const j = ny * gw + nx;
          if (lab[j] !== -1 || registerOf(f, j) !== v) continue;
          lab[j] = sizes.length;
          stack.push(j);
        }
      }
      sizes.push(n);
    }
    return sizes.sort((a, b) => b - a);
  }

  it('the ink is a few territories, not a contour map', () => {
    // THE assertion, and it took two attempts to find one that works.
    //
    // The obvious test — walk rays outward and check the tone sequence is not
    // monotone — measures nothing. Both pipelines score high on it, and the
    // *contoured* one scores higher (0.98 against 0.69), because `mottleAt`
    // swings hard enough to decorrelate register from radius. Rings that are not
    // concentric are still rings.
    //
    // What actually separates a contour map from 破墨 is how much boundary there
    // is. Contours are many thin closed curves; material fronts are a few large
    // territories meeting along a short seam. Measured on the same field, the
    // build this replaced gives 211 regions holding 51% of the ink in its
    // largest three, against 59 regions and 89% here.
    const f = poured();
    const sizes = regions(f);
    const inked = sizes.reduce((a, b) => a + b, 0);
    expect(sizes.length).toBeLessThan(120);
    expect(sizes.slice(0, 3).reduce((a, b) => a + b, 0) / inked).toBeGreaterThan(0.7);
  });

  it('tone is flat inside a pour', () => {
    // The other half of "not a contour map": between the fronts there must be
    // nothing happening. A quantised smooth field steps constantly, because its
    // input never stops sliding.
    const f = poured();
    let pairs = 0;
    let same = 0;
    for (let y = 1; y < f.gh - 1; y++) {
      for (let x = 1; x < f.gw - 1; x++) {
        const i = y * f.gw + x;
        const a = registerOf(f, i);
        if (a < 0) continue;
        const b = registerOf(f, i + 1);
        if (b < 0) continue;
        pairs++;
        if (a === b) same++;
      }
    }
    expect(pairs).toBeGreaterThan(500);
    expect(same / pairs).toBeGreaterThan(0.9);
  });

  it('pours are charged at the registers, and not in descending order', () => {
    const drops = dropPlan(200, 120, 14, 100, 5, INK_SEED);
    for (const d of drops) expect(TONES).toContain(d.conc);
    // Steadily weakening pours would lay a gradient along the throw, which is
    // the thing being escaped — the darkest ink has to sit next to the palest.
    expect(drops.some((d, i) => i > 0 && d.conc > drops[i - 1]!.conc)).toBe(true);
  });
});

describe('mixConc — two inks meeting', () => {
  it('never leaves the range of its inputs', () => {
    for (let i = 0; i < 200; i++) {
      const a = Math.random();
      const b = Math.random();
      const v = mixConc(a, Math.random() * 3, b, Math.random() * 3);
      expect(v).toBeGreaterThanOrEqual(Math.min(a, b) - 1e-9);
      expect(v).toBeLessThanOrEqual(Math.max(a, b) + 1e-9);
    }
  });

  it('weights by mass — a trickle cannot bleach a loaded cell', () => {
    expect(mixConc(1, 5, 0, 0.01)).toBeGreaterThan(0.99);
    expect(mixConc(1, 0.01, 0, 5)).toBeLessThan(0.01);
  });

  it('takes the incoming ink when the cell is empty', () => {
    expect(mixConc(0, 0, 0.7, 1)).toBeCloseTo(0.7, 9);
  });
});

describe('concentration is transported, never diffused', () => {
  it('stays put where no pigment moves', () => {
    // If this ever fails, something is smoothing conc on its own — which would
    // turn it back into a gradient and put the contour rings straight back.
    const f = createField(40, 40, INK_SEED);
    injectBlob(f, 20, 20, 6, 1, 0.55, INK_SEED);
    const far = 3 * f.gw + 3;
    expect(f.conc[far]).toBe(0);
    for (let i = 0; i < 60; i++) stepInk(f, 1, INK_SEED);
    expect(f.conc[far]).toBe(0);
  });

  it('carries strength outward with the ink', () => {
    const f = createField(60, 60, INK_SEED);
    injectBlob(f, 30, 30, 6, 1, 0.78, INK_SEED);
    for (let i = 0; i < 80; i++) stepInk(f, 1, INK_SEED);
    // somewhere the ink has reached that it had not at injection
    let reached = 0;
    for (let i = 0; i < f.conc.length; i++) {
      if (f.pig[i]! + f.dep[i]! > 0.02 && f.conc[i]! > 0.3) reached++;
    }
    expect(reached).toBeGreaterThan(200);
    // and nothing anywhere is stronger than the ink that was poured
    for (const c of f.conc) expect(c).toBeLessThanOrEqual(0.78 + CONC_SPREAD + 1e-6);
  });

  it('is deterministic', () => {
    const run = () => {
      const f = createField(40, 40, INK_SEED);
      injectBlob(f, 20, 20, 6, 1, 0.55, INK_SEED);
      for (let i = 0; i < 40; i++) stepInk(f, 1, INK_SEED);
      return Array.from(f.conc);
    };
    expect(run()).toEqual(run());
  });
});

describe('氣派 — a thrown mark, not a stain', () => {
  it('injectStreak lays an elongated mark, not a blot', () => {
    // Discs were the only shape the model could make, and diffusion only ever
    // rounds a shape further — so every mark was a blot however it was placed.
    // Direction has to be in the mark before spreading gets a vote.
    const f = createField(120, 120, INK_SEED);
    injectStreak(f, 60, 60, 12, 0, 2.5, 1, 1, INK_SEED);
    const reach = (dx: number, dy: number) => {
      let far = 0;
      for (let d = 1; d < 60; d++) {
        const x = Math.round(60 + dx * d);
        const y = Math.round(60 + dy * d);
        if (x < 0 || y < 0 || x >= 120 || y >= 120) break;
        if (f.pig[y * 120 + x]! > 1e-3) far = d;
      }
      return far;
    };
    expect(reach(1, 0)).toBeGreaterThan(reach(0, 1) * 1.8);
  });

  it('a streak follows the angle it was given', () => {
    const f = createField(120, 120, INK_SEED);
    injectStreak(f, 60, 60, 12, Math.PI / 2, 2.5, 1, 1, INK_SEED);
    const reach = (dx: number, dy: number) => {
      let far = 0;
      for (let d = 1; d < 60; d++) {
        const x = Math.round(60 + dx * d);
        const y = Math.round(60 + dy * d);
        if (x < 0 || y < 0 || x >= 120 || y >= 120) break;
        if (f.pig[y * 120 + x]! > 1e-3) far = d;
      }
      return far;
    };
    // rotated a quarter turn, so the long axis is now vertical
    expect(reach(0, 1)).toBeGreaterThan(reach(1, 0) * 1.8);
  });

  it('spatter stays small — a satellite that merges is not a satellite', () => {
    const spatter = spatterPlan(288, 130, 130 * 0.12, 130 * 0.84, 14, INK_SEED);
    const main = dropPlan(288, 130, 130 * 0.12, 130 * 0.84, 3, INK_SEED);
    const smallestMain = Math.min(...main.map((d) => d.r));
    expect(spatter.length).toBe(14);
    for (const d of spatter) {
      expect(d.r).toBeGreaterThan(0);
      expect(d.r).toBeLessThan(smallestMain * 0.25);
    }
  });

  it('spatter is flung past the mark, and scatters wider as it goes', () => {
    const s = spatterPlan(288, 130, 130 * 0.12, 130 * 0.84, 60, INK_SEED);
    const band = 130 * (0.84 - 0.12);
    const axisYAt = (x: number) => {
      const u = (x / 288 - AXIS_X0) / (AXIS_X1 - AXIS_X0);
      return 130 * 0.12 + (AXIS_Y0 + u * (AXIS_Y1 - AXIS_Y0)) * band;
    };
    // Split at the median rather than a fixed x: the satellites all start past
    // the end of the main mark, so the interesting comparison is near half of
    // the spray against the far half, not the sheet's coordinates.
    const off = s
      .map((d) => ({ t: d.x, e: Math.abs(d.y - axisYAt(d.x)) }))
      .sort((a, b) => a.t - b.t);
    const near = off.slice(0, Math.floor(off.length / 3));
    const far = off.slice(-Math.floor(off.length / 3));
    const mean = (xs: { e: number }[]) => xs.reduce((a, b) => a + b.e, 0) / xs.length;
    expect(near.length).toBeGreaterThan(3);
    expect(far.length).toBeGreaterThan(3);
    // the cone: a flung arc sheds droplets that spread out with distance
    expect(mean(far)).toBeGreaterThan(mean(near) * 1.3);
  });

  it('spatter is undiluted — it met nothing on the way', () => {
    for (const d of spatterPlan(288, 130, 16, 109, 14, INK_SEED)) expect(d.conc).toBe(1);
  });

  it('is deterministic', () => {
    expect(spatterPlan(288, 130, 16, 109, 14, INK_SEED)).toEqual(
      spatterPlan(288, 130, 16, 109, 14, INK_SEED),
    );
  });
});

describe('ceilConc — words first', () => {
  it('caps ink to 清 squarely under text, and leaves open paper alone', () => {
    expect(ceilConc(1, 1)).toBeCloseTo(TONE_CEILING, 9);
    expect(ceilConc(1, 0)).toBe(1);
    expect(ceilConc(0.1, 1)).toBe(0.1);
  });

  it('arrives as a gradient — a hard switch would print a straight edge', () => {
    let prev = 2;
    for (let r = 0; r <= 1; r += 0.05) {
      const v = ceilConc(1, r);
      expect(v).toBeLessThanOrEqual(prev + 1e-9);
      expect(v).toBeGreaterThanOrEqual(TONE_CEILING - 1e-9);
      prev = v;
    }
  });

  it('bounds what a reader can ever see', () => {
    // The check that licenses every bit of the contrast elsewhere.
    expect(fiveTones(ceilConc(1, 1))).toBeLessThanOrEqual(TONE_CEILING + 1e-6);
  });
});

describe('coverage is near-binary', () => {
  it('spends almost none of its range in between', () => {
    // A splash has a boundary. While this was a full-range transfer curve the
    // silhouette was a long fade with no edge anywhere in it.
    let mid = 0;
    const n = 2000;
    for (let i = 0; i <= n; i++) {
      const v = coverage(i / n);
      if (v > 0.02 && v < 0.98) mid++;
    }
    expect(mid / n).toBeLessThan(0.06);
  });
});

describe('framing — the source is outside the picture', () => {
  /**
   * The component's arrangement: a field padded on the left and below, with the
   * visible canvas a window into its top-right. Mirrors MARGIN_X / MARGIN_Y in
   * src/components/InkWash.astro.
   */
  const WIN_W = 200;
  const WIN_H = 110;
  const OFF_X = Math.round(WIN_W * 0.38);
  const FW = WIN_W + OFF_X;
  const FH = WIN_H + Math.round(WIN_H * 0.42);

  // Settled once, in beforeAll with its own budget: this is a 276x156 field
  // stepped 400 times. Building it inside the first assertion made whichever
  // test happened to run first blow the default 5s timeout, which reads as that
  // test failing rather than as the fixture being expensive.
  let cached: InkField;
  beforeAll(() => {
    const f = createField(FW, FH, INK_SEED);
    for (const d of dropPlan(FW, FH, 0, FH, 3, INK_SEED)) {
      injectStreak(f, d.x, d.y, d.r, throwAngle(FW, FH), 2.3, d.amount, d.conc, INK_SEED);
    }
    for (let i = 0; i < 400; i++) stepInk(f, 1, INK_SEED);
    cached = f;
  }, 60000);
  const thrown = () => cached;

  const inWindow = (x: number, y: number) => x >= OFF_X && x < FW && y >= 0 && y < WIN_H;

  it('places the head off-frame — the plain statement of the whole change', () => {
    // Every drop used to land inside the canvas, so what showed was a whole
    // blob, rounded far side and all. A complete shape centred in view reads as
    // an object on a page; a fragment entering from off-frame reads as scale.
    const head = dropPlan(FW, FH, 0, FH, 3, INK_SEED)[0]!;
    expect(inWindow(head.x, head.y)).toBe(false);
    // and specifically below and to the left, which is where the throw starts
    expect(head.x).toBeLessThan(OFF_X);
    expect(head.y).toBeGreaterThan(WIN_H);
  });

  it('spends a real share of the mark out of shot', () => {
    // The direct statement of "you are seeing part of something larger".
    //
    // This first asserted that the *densest cell* was off-frame, which was the
    // wrong proxy and failed honestly: pours run light-to-dark (see TONE_ORDER,
    // which is 破墨法 and also what keeps the top registers from being diluted
    // away), and charge follows strength — so the heaviest ink is the last
    // pour, which lands in frame by design. What framing actually needs is that
    // a substantial part of the mark never appears, not that any particular
    // pour is the one hidden.
    const f = thrown();
    const vis = visible(f);
    let inside = 0;
    let outside = 0;
    for (let y = 0; y < FH; y++) {
      for (let x = 0; x < FW; x++) {
        const v = vis[y * FW + x]!;
        if (inWindow(x, y)) inside += v;
        else outside += v;
      }
    }
    expect(outside / (inside + outside)).toBeGreaterThan(0.25);
  });

  it('meets the frame at full strength — a fragment does not fade at the edge', () => {
    const f = thrown();
    const vis = visible(f);
    // the window's left column and bottom row: where the mark crosses out of shot
    let leftMax = 0;
    for (let y = 0; y < WIN_H; y++) leftMax = Math.max(leftMax, vis[y * FW + OFF_X]!);
    let bottomMax = 0;
    for (let x = OFF_X; x < FW; x++) bottomMax = Math.max(bottomMax, vis[(WIN_H - 1) * FW + x]!);
    expect(leftMax).toBeGreaterThan(0.5);
    expect(bottomMax).toBeGreaterThan(0.5);
  });

  it('banks no ink against the window edge', () => {
    // The field's own boundary is a no-flux wall, so ink piles against it. The
    // padding exists to move that wall out of shot; if the ridge showed up at
    // the window's edge instead, the margin would be doing nothing.
    const f = thrown();
    const vis = visible(f);
    const colMean = (x: number) => {
      let s = 0;
      for (let y = 0; y < WIN_H; y++) s += vis[y * FW + x]!;
      return s / WIN_H;
    };
    // no spike at the frame relative to just inside it
    expect(colMean(OFF_X)).toBeLessThan(colMean(OFF_X + 6) * 1.35);
  });

  it('still puts ink inside the window — an off-frame source is not an empty hero', () => {
    const f = thrown();
    const vis = visible(f);
    let inked = 0;
    for (let y = 0; y < WIN_H; y++) {
      for (let x = OFF_X; x < FW; x++) if (vis[y * FW + x]! > 0.05) inked++;
    }
    expect(inked / (WIN_H * WIN_W)).toBeGreaterThan(0.15);
  });
});

describe('滲透 — water runs ahead of the ink', () => {
  /** One drop on open paper, settled. */
  function blot(steps = 300, gw = 140, gh = 140, r = 6) {
    const f = createField(gw, gh, INK_SEED);
    injectBlob(f, gw / 2, gh / 2, r, 1, 1, INK_SEED);
    for (let i = 0; i < steps; i++) stepInk(f, 1, INK_SEED);
    return f;
  }

  /** Where the ink layer starts to render: coverage()'s floor, unnormalised. */
  const INK_FLOOR = 0.012 * DENSITY_FULL;
  /** Where the halo layer starts to render — see haloAlpha. */
  const HALO_FLOOR = 0.004;

  /** Mean radius of the outermost ring above an absolute threshold. */
  const frontRadius = (f: InkField, a: Float32Array, cut: number) => {
    const c = f.gw / 2;
    let sum = 0;
    let n = 0;
    for (let k = 0; k < 48; k++) {
      const th = (k / 48) * Math.PI * 2;
      let far = 0;
      for (let rr = 1; rr < f.gw / 2 - 1; rr++) {
        const x = Math.round(c + Math.cos(th) * rr);
        const y = Math.round(c + Math.sin(th) * rr);
        if (x < 0 || y < 0 || x >= f.gw || y >= f.gh) break;
        if (a[y * f.gw + x]! > cut) far = rr;
      }
      sum += far;
      n++;
    }
    return sum / n;
  };

  it('the water front leads the pigment front', () => {
    // The whole point, as a number. On 宣紙 the fibre passes water and traps
    // carbon, so the wet edge is always outside the ink edge — which is why a
    // mark is a compact core inside a much wider watermark rather than a blob.
    //
    // Measured at the thresholds where each layer actually *renders*, not at a
    // share of each field's own peak. The first version did the latter and read
    // backwards: the two fields have very different peaks, so "6% of peak" is a
    // different physical amount for each and compares nothing.
    const f = blot();
    const ink = visible(f);
    expect(frontRadius(f, f.soak, HALO_FLOOR)).toBeGreaterThan(
      frontRadius(f, ink, INK_FLOOR) * 1.2,
    );
  });

  it('leaves a watermark ring outside the ink', () => {
    // The visible consequence: a real annulus that is damp paper and not ink.
    // Without it the halo would exist in the field and never be seen.
    const f = blot();
    const ink = visible(f);
    let inked = 0;
    let halo = 0;
    for (let i = 0; i < ink.length; i++) {
      if (ink[i]! > INK_FLOOR) inked++;
      else if (f.soak[i]! > HALO_FLOOR) halo++;
    }
    expect(inked).toBeGreaterThan(100);
    expect(halo / (halo + inked)).toBeGreaterThan(0.25);
  });

  it('soak is a high-water mark, not live wetness', () => {
    // A halo that evaporates with the water is not a tide line, and paper keeps
    // its tide line. If this ever fails the watermark will vanish as the sheet
    // dries, which is the one thing it must not do.
    const f = createField(60, 60, INK_SEED);
    injectBlob(f, 30, 30, 6, 1, 1, INK_SEED);
    let prev = new Float32Array(f.soak);
    for (let step = 0; step < 12; step++) {
      for (let i = 0; i < 40; i++) stepInk(f, 1, INK_SEED);
      for (let i = 0; i < f.soak.length; i++) {
        expect(f.soak[i]!).toBeGreaterThanOrEqual(prev[i]! - 1e-9);
      }
      prev = new Float32Array(f.soak);
    }
    // and it is still there once the paper is bone dry
    expect(sum(f.wet)).toBeCloseTo(0, 4);
    expect(Math.max(...f.soak)).toBeGreaterThan(0.05);
  });

  it('filtration keeps the ink edge sharper than the water edge', () => {
    // Every cell the pigment enters takes a cut, so the ink front advances
    // slowly and steeply while the water front runs on soft. That contrast is
    // the look of ink on raw 生宣.
    const f = blot();
    const ink = visible(f);
    const width = (a: Float32Array) =>
      frontRadius(f, a, 0.03) - frontRadius(f, a, 0.5);
    expect(width(ink)).toBeLessThan(width(f.soak));
  });

  it('filtration conserves pigment — it moves it, it does not spend it', () => {
    expect(FILTRATION).toBeGreaterThan(0);
    expect(FILTRATION).toBeLessThan(0.5);
    const f = createField(60, 60, INK_SEED);
    injectBlob(f, 30, 30, 6, 1, 1, INK_SEED);
    const before = sum(f.pig) + sum(f.dep);
    for (let i = 0; i < 120; i++) stepInk(f, 1, INK_SEED);
    const after = sum(f.pig) + sum(f.dep);
    expect(after).toBeGreaterThan(before * 0.98);
    expect(after).toBeLessThan(before * 1.02);
  });

  it('water still outruns ink rather than pushing it — ADVECT_BIAS below 1', () => {
    // Above 1 pigment outruns its water, strands at a drying perimeter, and the
    // blot dries darkest at the rim. That coffee ring was measured *off* the
    // reference and removed; widening the gap for 滲透 must not bring it back.
    expect(ADVECT_BIAS).toBeLessThan(1);
    expect(ADVECT_BIAS).toBeGreaterThan(0.2);
  });
});

describe('haloAlpha — a watermark, not a tone', () => {
  it('stays far below the palest ink', () => {
    // The halo is a change in the paper. If it ever reached 清 it would read as
    // haze over the whole hero instead of as damp fibre.
    for (let s = 0; s <= 1; s += 0.02) {
      expect(haloAlpha(s)).toBeLessThan(TONES[0]! * 0.6);
      expect(haloAlpha(s)).toBeGreaterThanOrEqual(0);
    }
    expect(haloAlpha(0)).toBe(0);
  });

  it('rises then flattens, so the tide line has an edge', () => {
    // A halo that faded gradually all the way out would be a gradient, and a
    // gradient is what the whole composition has been escaping.
    expect(haloAlpha(SOAK_FULL)).toBeCloseTo(haloAlpha(1), 9);
    expect(haloAlpha(SOAK_FULL * 0.5)).toBeGreaterThan(haloAlpha(SOAK_FULL) * 0.3);
  });

  it('is monotonic', () => {
    let prev = -1;
    for (let s = 0; s <= 1; s += 0.01) {
      const v = haloAlpha(s);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = v;
    }
  });
});
