import { describe, it, expect } from 'vitest';
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
  fiveTones,
  injectBand,
  injectBlob,
  inkAlpha,
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

describe('inkAlpha — density spread across the registers', () => {
  it('does not pin the plume against the ceiling', () => {
    // The gamma used to run the other way, lifting the thin parts hard, because
    // the layer peaked at 0.2 opacity and unlifted ink was invisible. fiveTones
    // took that job over — its lowest register has a floor, so anything clearing
    // the first tonal edge renders as a visible tint regardless of density.
    //
    // Doing it in both places was measurable: 43% of the rendered ink landed in
    // the top register, so 焦墨 covered most of the left panel as a slab. What
    // this curve owes the tones is *spread* — a plume's typical density has to
    // land in the middle registers, leaving the darkest one to the drop cores.
    // No lift: at or below linear everywhere, rather than bowed up over it.
    for (let d = 0.05; d < 1; d += 0.05) expect(inkAlpha(d)).toBeLessThanOrEqual(d + 1e-9);
    // but the core still gets there
    expect(inkAlpha(0.95)).toBeGreaterThan(0.9);
  });

  it('is fed a normalised load, not a clamped one', () => {
    // The constant that actually carries the spread. A settled plume runs to
    // about 2.4, so the renderer's old `min(d, 1)` collapsed two thirds of the
    // ink onto one value — invisible until quantisation painted all of it the
    // same register. This has to stay above where the plume's bulk sits, or the
    // plateau comes back.
    expect(DENSITY_FULL).toBeGreaterThan(1.8);
    expect(DENSITY_FULL).toBeLessThan(3);
  });

  it('is monotonic and spans the full range', () => {
    let prev = -1;
    for (let i = 0; i <= 100; i++) {
      const a = inkAlpha(i / 100);
      expect(a).toBeGreaterThanOrEqual(prev);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
      prev = a;
    }
    expect(inkAlpha(0)).toBe(0);
    expect(inkAlpha(1)).toBe(1);
  });

  it('still discards a whisper, so clean paper stays clean', () => {
    expect(inkAlpha(0.005)).toBe(0);
  });
});

describe('visible — mottling, which is not grain', () => {
  const mk = () => {
    const gw = 120;
    const out = new Float32Array(gw * gw);
    for (let i = 0; i < out.length; i++) out[i] = mottleAt(i % gw, (i / gw) | 0, INK_SEED);
    return out;
  };

  it('varies broadly across the field', () => {
    // flat ink reads as one grey shape; real pigment has passages
    const v = mk();
    const mean = v.reduce((s, x) => s + x, 0) / v.length;
    const std = Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / v.length);
    expect(std / mean).toBeGreaterThan(0.15);
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

  it('falls across the whole sheet, and lands in order', () => {
    expect(Math.min(...drops.map((d) => d.x))).toBeLessThan(288 * 0.15);
    expect(Math.max(...drops.map((d) => d.x))).toBeGreaterThan(288 * 0.8);
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
    expect(corr(drops.map((d) => d.x), drops.map((d) => d.y))).toBeGreaterThan(0.7);
  });

  it('is felt rather than drawn', () => {
    // A clean line of drops reads as a stamp. The jitter has to be wide enough
    // that the axis is an impression, so the correlation must be short of 1.
    expect(corr(drops.map((d) => d.x), drops.map((d) => d.y))).toBeLessThan(0.98);
  });

  it('has a dense head and a thin tail', () => {
    const third = Math.floor(drops.length / 3);
    const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
    const head = drops.slice(0, third);
    const tail = drops.slice(-third);
    expect(mean(head.map((d) => d.r))).toBeGreaterThan(mean(tail.map((d) => d.r)) * 1.15);
    expect(mean(head.map((d) => d.amount))).toBeGreaterThan(
      mean(tail.map((d) => d.amount)) * 1.15,
    );
  });

  it('spans the axis end to end', () => {
    const s = drops.map((d) => d.x / 288).sort((a, b) => a - b);
    expect(s[0]!).toBeLessThan(0.2);
    expect(s[s.length - 1]!).toBeGreaterThan(0.82);
  });
});
