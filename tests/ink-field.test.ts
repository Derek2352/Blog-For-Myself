import { describe, it, expect } from 'vitest';
import {
  DEPOSIT_RATE,
  EVAPORATION,
  blurField,
  createField,
  dropPlan,
  fibreNoise,
  injectBand,
  injectBlob,
  inkAlpha,
  resetField,
  stepInk,
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

  it('is never impermeable — ink can always move somewhere', () => {
    const f = createField(40, 40, INK_SEED);
    for (const v of f.fibre) {
      expect(v).toBeGreaterThan(0.5);
      expect(v).toBeLessThanOrEqual(1.01);
    }
  });

  it('is deterministic', () => {
    expect(Array.from(createField(24, 24, 7).fibre)).toEqual(
      Array.from(createField(24, 24, 7).fibre),
    );
  });
});

describe('the simulation', () => {
  it('darkens at the rim — the signature of watercolour', () => {
    // THE test. Nothing here draws an edge; the rim holds less water, so it
    // dries first, so deposition rises there, so pigment carried outward by the
    // flow strands and settles. If this fails the model has become a blur.
    const f = drop(45);
    const c = f.gw / 2;
    const at = (dx: number) => f.dep[Math.round(c) * f.gw + Math.round(c + dx)]!;
    const centre = at(0);
    let rim = 0;
    for (let d = 5; d <= 9; d++) rim = Math.max(rim, at(d));
    expect(rim).toBeGreaterThan(centre);
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

describe('inkAlpha — keeping text out of the blend’s dead middle', () => {
  it('vacates the mid-tones', () => {
    // The measured reference puts only 9.6% of its pixels between 0.35 and 0.65
    // alpha. That band is exactly where difference blending maps every backdrop
    // onto the same grey and the text disappears, so the curve has to actively
    // empty it. Check this first if the hero ever goes muddy.
    let mid = 0;
    const n = 1000;
    for (let i = 0; i < n; i++) {
      const a = inkAlpha(i / (n - 1));
      if (a > 0.35 && a < 0.65) mid++;
    }
    expect(mid / n).toBeLessThan(0.15);
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

  it('keeps faint pigment as a safe tint rather than erasing it', () => {
    // An earlier version zeroed everything faint. That was dutifully bimodal
    // and wrong: it deleted the broad light wash the reference is mostly made
    // of, leaving one dark blot on an empty hero. Low alpha was never the
    // hazard — only 0.35-0.65 is — so faint deposits survive, well under the
    // hinge, where text keeps its own polarity on a tint.
    expect(inkAlpha(0.02)).toBe(0);
    for (const d of [0.1, 0.2, 0.3]) {
      expect(inkAlpha(d)).toBeGreaterThan(0);
      expect(inkAlpha(d)).toBeLessThan(0.35);
    }
    // and committed pigment still flips cleanly. Sampled well past the
    // crossing rather than just after it, so moving the threshold retunes the
    // look without falsifying the test.
    expect(inkAlpha(0.85)).toBeGreaterThan(0.8);
    // most of the useful deposit range is tint, not flip — that ratio is what
    // keeps the hero light like the reference instead of a field of black pools
    let tint = 0;
    for (let i = 0; i <= 100; i++) if (inkAlpha(i / 100) < 0.35) tint++;
    expect(tint).toBeGreaterThan(50);
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

  it('is mostly fine drops with a few fat ones', () => {
    // an even size distribution reads as polka dots; the fat ones are what
    // become the dark pools once they spread and merge
    const radii = drops.map((d) => d.r).sort((a, b) => a - b);
    const median = radii[Math.floor(radii.length / 2)]!;
    expect(radii[radii.length - 1]!).toBeGreaterThan(median * 2.5);
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
