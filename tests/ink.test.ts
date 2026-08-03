import { describe, it, expect } from 'vitest';
import {
  CLEAR_MS,
  CREEP_MAX,
  CYCLE_MS,
  DRY_MS,
  ENTRANCE_MS,
  HOLD_MS,
  RETURN_MS,
  inkAfterDrying,
  strokePresence,
  INK_PEAK_ALPHA,
  INK_SEED,
  STROKE_BOTTOM,
  STROKE_TOP,
  TRAIL_MS,
  washLayers,
  creep,
  entrance,
  fbm,
  mulberry32,
  splatter,
  strokeSpine,
  trailAlpha,
  valueNoise2,
} from '@/lib/ink';

const W = 1152;
const H = 520;
const spine = strokeSpine(W, H);

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(1234);
    const b = mulberry32(1234);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('stays in [0,1) and does not stick', () => {
    const rnd = mulberry32(INK_SEED);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const v = rnd();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      seen.add(v);
    }
    expect(seen.size).toBeGreaterThan(400);
  });

  it('different seeds diverge', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe('noise', () => {
  it('valueNoise2 stays in [0,1] across the plane', () => {
    for (let i = 0; i < 300; i++) {
      const x = (i % 30) * 0.37 - 5;
      const y = Math.floor(i / 30) * 0.61 - 5;
      const v = valueNoise2(x, y, INK_SEED);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('valueNoise2 is continuous — neighbours never jump', () => {
    let prev = valueNoise2(0, 0.5, INK_SEED);
    for (let i = 1; i <= 200; i++) {
      const v = valueNoise2(i * 0.01, 0.5, INK_SEED);
      expect(Math.abs(v - prev)).toBeLessThan(0.1);
      prev = v;
    }
  });

  it('fbm stays in [0,1] and is deterministic', () => {
    for (let i = 0; i < 200; i++) {
      const v = fbm(i * 0.13, i * 0.29, INK_SEED);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(fbm(i * 0.13, i * 0.29, INK_SEED)).toBe(v);
    }
  });
});

describe('strokeSpine', () => {
  it('is deterministic for the shipped seed', () => {
    expect(strokeSpine(W, H)).toEqual(strokeSpine(W, H, INK_SEED));
  });

  it('travels left to right without doubling back', () => {
    for (let i = 1; i < spine.length; i++) {
      expect(spine[i]!.x).toBeGreaterThan(spine[i - 1]!.x);
    }
  });

  it('enters from off-frame and dries out before the photo column', () => {
    // Entering off-frame is what makes it a gesture rather than a shape. It no
    // longer *leaves* off-frame: the brush runs out of ink over the text and
    // stops there, which keeps the whole head-to-tail story on the words and
    // keeps ink off the photograph.
    expect(spine[0]!.x).toBeLessThan(0);
    expect(spine[spine.length - 1]!.x).toBeLessThan(W * 0.6);
  });

  it('sweeps the middle, where the writing is', () => {
    // The stroke crosses the text on purpose and inverts it on the way past, so
    // unlike the earlier top-band version it *should* be over the words.
    // `OrEqual` because the fit maps the extremes exactly onto the band — the
    // mark is sized to the space rather than fitting inside it by luck.
    for (const p of spine) {
      expect(p.y - p.width).toBeGreaterThanOrEqual(H * STROKE_TOP - 0.001);
      expect(p.y + p.width).toBeLessThanOrEqual(H * STROKE_BOTTOM + 0.001);
    }
    // Overlapping the middle third, rather than crossing one exact midline:
    // what matters is that the mark is interior and lands on the writing, not
    // that it intersects a particular y. It used to hug the top edge.
    const lo = Math.min(...spine.map((p) => p.y - p.width));
    const hi = Math.max(...spine.map((p) => p.y + p.width));
    expect(hi).toBeGreaterThan(H / 3);
    expect(lo).toBeLessThan((H * 2) / 3);
    expect(lo).toBeGreaterThan(H * 0.08);
  });

  it('fits the band for any seed and any box, not just the shipped one', () => {
    // The fit is done by rescaling to measured extent rather than by picking
    // constants that happen to land inside. If that ever regresses to tuned
    // numbers, some seed will clip and nobody will notice until it ships.
    for (const seed of [1, 42, 20260802, 99991, 123456789]) {
      for (const [w, h] of [[1152, 520], [390, 700], [768, 460], [1600, 600]]) {
        for (const p of strokeSpine(w, h, seed)) {
          expect(p.y - p.width).toBeGreaterThanOrEqual(h! * STROKE_TOP - 0.001);
          expect(p.y + p.width).toBeLessThanOrEqual(h! * STROKE_BOTTOM + 0.001);
        }
      }
    }
  });

  it('honours an explicit band', () => {
    for (const [top, bottom] of [[40, 200], [120, 300], [10, 90]]) {
      for (const p of strokeSpine(390, 760, INK_SEED, 90, top, bottom)) {
        expect(p.y - p.width).toBeGreaterThanOrEqual(top! - 0.001);
        expect(p.y + p.width).toBeLessThanOrEqual(bottom! + 0.001);
      }
    }
  });

  it('runs t from 0 to 1 in order', () => {
    expect(spine[0]!.t).toBe(0);
    expect(spine[spine.length - 1]!.t).toBe(1);
    for (let i = 1; i < spine.length; i++) {
      expect(spine[i]!.t).toBeGreaterThan(spine[i - 1]!.t);
    }
  });

  it('tapers from a loaded head to a dry tail', () => {
    const head = spine[0]!.width;
    const tail = spine[spine.length - 1]!.width;
    expect(head).toBeGreaterThan(0);
    expect(tail).toBeGreaterThan(0);
    expect(tail).toBeLessThan(head * 0.4);
  });

  it('carries a unit normal at every sample', () => {
    for (const p of spine) {
      expect(Math.hypot(p.nx, p.ny)).toBeCloseTo(1, 6);
    }
  });

  it('scales with the box it is given', () => {
    const small = strokeSpine(600, 260);
    expect(small[0]!.width).toBeLessThan(spine[0]!.width);
  });
});

describe('washLayers — soft masses, not strands', () => {
  const layers = washLayers(spine, 46);

  it('is deterministic', () => {
    expect(washLayers(spine, 46)).toEqual(washLayers(spine, 46, INK_SEED));
  });

  it('carries less pigment the further out it blooms', () => {
    // Load-bearing, not cosmetic: this ordering IS the drying behaviour. If it
    // ever inverted, inkAfterDrying would empty the core first and the stain
    // would cross-fade instead of drying edge-inward.
    const wash = layers.filter((l) => l.kind === 'wash').sort((a, b) => a.spread - b.spread);
    expect(wash.length).toBeGreaterThan(30);
    for (let i = 1; i < wash.length; i++) {
      expect(wash[i]!.density).toBeLessThan(wash[i - 1]!.density);
    }
  });

  it('keeps clumps dense and small — they are pools, not bloom', () => {
    // A clump sits inside the mass, so it is mid-spread and near-opaque and
    // dries last. It is exempt from the wash's ordering on purpose, which is
    // why the two families are labelled rather than distinguished by position.
    const clumps = layers.filter((l) => l.kind === 'clump');
    expect(clumps.length).toBeGreaterThan(3);
    const washAtSameDepth = layers.filter((l) => l.kind === 'wash' && l.spread > 0.15);
    for (const c of clumps) {
      expect(c.density).toBeGreaterThan(0.8);
      for (const w of washAtSameDepth) expect(c.density).toBeGreaterThan(w.density);
    }
  });

  it('dries from the edge inwards once composed with inkAfterDrying', () => {
    const sorted = layers.filter((l) => l.kind === 'wash').sort((a, b) => a.spread - b.spread);
    const core = sorted[0]!;
    const rim = sorted[sorted.length - 1]!;
    const emptyAt = (d: number) => {
      for (let p = 1; p >= 0; p -= 0.01) if (inkAfterDrying(d, p) === 0) return p;
      return 0;
    };
    expect(emptyAt(rim.density)).toBeGreaterThan(emptyAt(core.density));
  });

  it('gives every layer a closed polygon with organic detail', () => {
    for (const l of layers) {
      expect(l.pts.length % 2).toBe(0);
      // three subdivision levels off a ~20-point ribbon
      expect(l.pts.length / 2).toBeGreaterThan(40);
      for (const v of l.pts) expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('actually blooms — the rim reaches well past the core', () => {
    // Across the wash family only: a clump is deliberately tiny, so including
    // one at either end of the sort measures nothing about blooming.
    const extent = (l: (typeof layers)[number]) => {
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 1; i < l.pts.length; i += 2) {
        lo = Math.min(lo, l.pts[i]!);
        hi = Math.max(hi, l.pts[i]!);
      }
      return hi - lo;
    };
    const wash = layers.filter((l) => l.kind === 'wash').sort((a, b) => a.spread - b.spread);
    expect(extent(wash[wash.length - 1]!)).toBeGreaterThan(extent(wash[0]!) * 1.35);
  });

  it('keeps density in [0,1] so the alpha budget cannot be blown', () => {
    for (const l of layers) {
      expect(l.density).toBeGreaterThan(0);
      expect(l.density).toBeLessThanOrEqual(1);
      expect(l.spread).toBeGreaterThanOrEqual(0);
      expect(l.spread).toBeLessThanOrEqual(1);
    }
  });

  it('includes dark clumps so the interior is mottled, not an airbrush', () => {
    // a smooth core-to-edge gradient reads as a gradient; pigment settles in
    // patches
    expect(layers.filter((l) => l.kind === 'clump').length).toBeGreaterThan(5);
  });
});

describe('splatter', () => {
  const ceiling = H * STROKE_BOTTOM;
  const splats = splatter(spine, 90, INK_SEED, ceiling);

  it('is deterministic', () => {
    expect(splats).toEqual(splatter(spine, 90, INK_SEED, ceiling));
  });

  it('respects the ceiling', () => {
    for (const s of splats) {
      expect(s.y + s.r).toBeLessThanOrEqual(ceiling);
    }
  });

  it('still produces a full set under the ceiling', () => {
    // the bounded retry must not quietly return half a scatter
    expect(splats.length).toBe(90);
  });

  it('is mostly fine mist with a few fat drops', () => {
    // an even distribution reads as polka dots
    const radii = splats.map((s) => s.r).sort((a, b) => a - b);
    const median = radii[Math.floor(radii.length / 2)]!;
    const largest = radii[radii.length - 1]!;
    expect(largest).toBeGreaterThan(median * 3);
    expect(radii.filter((r) => r < median * 1.5).length).toBeGreaterThan(splats.length * 0.5);
  });

  it('stretches the hard-thrown drops into commas', () => {
    // round dots at every size read as printed rather than thrown
    for (const s of splats) {
      expect(s.aspect).toBeGreaterThanOrEqual(1);
      expect(Number.isFinite(s.angle)).toBe(true);
    }
    expect(splats.some((s) => s.aspect > 1.6)).toBe(true);
  });

  it('gives every drop a positive radius and a moment it was flicked', () => {
    for (const s of splats) {
      expect(s.r).toBeGreaterThan(0);
      expect(s.at).toBeGreaterThanOrEqual(0);
      expect(s.at).toBeLessThanOrEqual(1);
    }
  });

  it('scatters near the stroke rather than across the whole box', () => {
    const head = spine[0]!.width;
    for (const s of splats) {
      const nearest = Math.min(...spine.map((p) => Math.hypot(p.x - s.x, p.y - s.y)));
      expect(nearest).toBeLessThan(head * 8);
    }
  });
});

describe('creep — the wet edge', () => {
  it('stays inside its bound, so it can never restructure the gesture', () => {
    for (let t = 0; t <= 1; t += 0.02) {
      for (const ms of [0, 1200, 45_000, 600_000]) {
        const c = creep(t, ms);
        expect(Math.abs(c)).toBeLessThanOrEqual(CREEP_MAX);
      }
    }
  });

  it('varies along the stroke, not just over time', () => {
    // a uniform value would inflate and deflate the whole shape, which reads as
    // breathing rather than as ink soaking outward
    const sampled = new Set<number>();
    for (let t = 0; t <= 1; t += 0.05) sampled.add(Number(creep(t, 5000).toFixed(6)));
    expect(sampled.size).toBeGreaterThan(10);
  });

  it('is deterministic', () => {
    expect(creep(0.4, 9000)).toBe(creep(0.4, 9000, INK_SEED));
  });
});

describe('entrance', () => {
  it('starts from nothing and finishes fully arrived', () => {
    expect(entrance(0)).toEqual({ spread: 0, soak: 0 });
    expect(entrance(-100)).toEqual({ spread: 0, soak: 0 });
    expect(entrance(ENTRANCE_MS)).toEqual({ spread: 1, soak: 1 });
    expect(entrance(ENTRANCE_MS * 10)).toEqual({ spread: 1, soak: 1 });
  });

  it('both envelopes rise monotonically and stay in [0,1]', () => {
    let prevSpread = 0;
    let prevSoak = 0;
    for (let ms = 0; ms <= ENTRANCE_MS; ms += 25) {
      const { spread, soak } = entrance(ms);
      expect(spread).toBeGreaterThanOrEqual(prevSpread);
      expect(soak).toBeGreaterThanOrEqual(prevSoak);
      expect(spread).toBeLessThanOrEqual(1);
      expect(soak).toBeLessThanOrEqual(1);
      prevSpread = spread;
      prevSoak = soak;
    }
  });

  it('does not rush the travel — the stroke must be watchable', () => {
    // An ease-out had the tip 72% along by a third of the way through, which
    // made the entrance look like a finished stroke fading up.
    expect(entrance(ENTRANCE_MS / 3).spread).toBeLessThan(0.4);
    expect(entrance(ENTRANCE_MS / 2).spread).toBeCloseTo(0.5, 1);
  });

  it('commits the mark before the brush finishes travelling', () => {
    // if soak ever trailed spread, the stroke would read as an image fading in
    // rather than as a brush being drawn across the paper
    for (let ms = 25; ms < ENTRANCE_MS; ms += 25) {
      const { spread, soak } = entrance(ms);
      expect(soak).toBeGreaterThan(spread);
    }
  });
});

describe('strokePresence — coming and going', () => {
  it('is fully present through hold and fully gone through clear', () => {
    expect(strokePresence(0)).toBe(1);
    expect(strokePresence(HOLD_MS - 1)).toBe(1);
    expect(strokePresence(HOLD_MS + DRY_MS)).toBe(0);
    expect(strokePresence(HOLD_MS + DRY_MS + CLEAR_MS - 1)).toBe(0);
  });

  it('leaves the hero clean for longer than it covers it', () => {
    // the whole point of the feature — a mark that is present most of the time
    // has not solved anything
    let clear = 0;
    for (let t = 0; t < CYCLE_MS; t += 10) if (strokePresence(t) < 0.02) clear += 10;
    expect(clear).toBeGreaterThan(CYCLE_MS / 2);
  });

  it('falls monotonically while drying and rises monotonically returning', () => {
    let prev = 1;
    for (let t = HOLD_MS; t <= HOLD_MS + DRY_MS; t += 20) {
      const v = strokePresence(t);
      expect(v).toBeLessThanOrEqual(prev + 1e-9);
      prev = v;
    }
    const backFrom = HOLD_MS + DRY_MS + CLEAR_MS;
    prev = 0;
    for (let t = backFrom; t <= backFrom + RETURN_MS; t += 20) {
      const v = strokePresence(t);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = v;
    }
  });

  it('never jumps — a discontinuity would read as the flicker this replaces', () => {
    let prev = strokePresence(0);
    for (let t = 5; t <= CYCLE_MS * 2; t += 5) {
      const v = strokePresence(t);
      expect(Math.abs(v - prev)).toBeLessThan(0.02);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      prev = v;
    }
  });

  it('repeats, and handles a negative or huge clock', () => {
    expect(strokePresence(CYCLE_MS + 250)).toBeCloseTo(strokePresence(250), 10);
    expect(strokePresence(-CYCLE_MS + 250)).toBeCloseTo(strokePresence(250), 10);
    expect(strokePresence(CYCLE_MS * 500 + 60)).toBeCloseTo(strokePresence(60), 10);
  });
});

describe('inkAfterDrying', () => {
  it('is the identity when present and empty when gone', () => {
    for (const ink of [0, 0.3, 0.75, 1]) {
      expect(inkAfterDrying(ink, 1)).toBe(ink);
      expect(inkAfterDrying(ink, 0)).toBe(0);
    }
  });

  it('thin ink dries before thick — the reason this is not a cross-fade', () => {
    // A uniform fade would keep these in step. Drying must not: the faint 飛白
    // tail has to let go while the loaded head is still on the page.
    const thin = 0.2;
    const thick = 0.9;
    let thinGone = -1;
    let thickGone = -1;
    for (let p = 1; p >= 0; p -= 0.01) {
      if (thinGone < 0 && inkAfterDrying(thin, p) === 0) thinGone = p;
      if (thickGone < 0 && inkAfterDrying(thick, p) === 0) thickGone = p;
    }
    expect(thinGone).toBeGreaterThan(thickGone);
    // and at any mid presence the thick ink is strictly ahead
    expect(inkAfterDrying(thick, 0.5)).toBeGreaterThan(inkAfterDrying(thin, 0.5));
  });

  it('stays in [0,1] and rises with both arguments', () => {
    for (let p = 0; p <= 1; p += 0.05) {
      let prev = -1;
      for (let ink = 0; ink <= 1; ink += 0.05) {
        const v = inkAfterDrying(ink, p);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
        expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = v;
      }
    }
    for (let ink = 0.1; ink <= 1; ink += 0.1) {
      let prev = -1;
      for (let p = 0; p <= 1; p += 0.05) {
        const v = inkAfterDrying(ink, p);
        expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = v;
      }
    }
  });
});

describe('trailAlpha', () => {
  it('is full when fresh and gone once dry', () => {
    expect(trailAlpha(0)).toBe(1);
    expect(trailAlpha(-50)).toBe(1);
    expect(trailAlpha(TRAIL_MS)).toBe(0);
    expect(trailAlpha(TRAIL_MS * 3)).toBe(0);
  });

  it('decreases monotonically over its life', () => {
    let prev = trailAlpha(0);
    for (let age = 25; age <= TRAIL_MS; age += 25) {
      const v = trailAlpha(age);
      expect(v).toBeLessThanOrEqual(prev);
      expect(v).toBeGreaterThanOrEqual(0);
      prev = v;
    }
  });
});

describe('the alpha ceiling', () => {
  it("sits well clear of the blend's dead middle", () => {
    // With difference blending, 0.5 maps every backdrop onto the same grey and
    // the text inside the stroke disappears entirely. The soak effect needs the
    // far side of that hinge, not a value near it.
    expect(INK_PEAK_ALPHA).toBeGreaterThan(0.7);
    expect(INK_PEAK_ALPHA).toBeLessThanOrEqual(1);
  });
});
