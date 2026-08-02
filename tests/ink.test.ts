import { describe, it, expect } from 'vitest';
import {
  CREEP_MAX,
  ENTRANCE_MS,
  INK_PEAK_ALPHA,
  INK_SEED,
  STROKE_BAND,
  TRAIL_MS,
  bristles,
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

  it('enters and leaves the frame rather than starting inside it', () => {
    // a stroke that begins and ends on screen reads as a shape, not a gesture
    expect(spine[0]!.x).toBeLessThan(0);
    expect(spine[spine.length - 1]!.x).toBeGreaterThan(W);
  });

  it('stays in the top band, clear of the headline', () => {
    // Everything below STROKE_BAND is the kicker and the h1. The stroke plus its
    // own half-width must clear that, and must also not run off the top — a
    // stroke clipped by the canvas edge reads as a mistake rather than a mark.
    // `OrEqual` because the fit maps the extremes exactly onto the band — the
    // mark is sized to the space rather than fitting inside it by luck.
    for (const p of spine) {
      expect(p.y - p.width).toBeGreaterThan(0);
      expect(p.y + p.width).toBeLessThanOrEqual(H * STROKE_BAND);
    }
  });

  it('fits the band for any seed and any box, not just the shipped one', () => {
    // The fit is done by rescaling to measured extent rather than by picking
    // constants that happen to land inside. If that ever regresses to tuned
    // numbers, some seed will clip and nobody will notice until it ships.
    for (const seed of [1, 42, 20260802, 99991, 123456789]) {
      for (const [w, h] of [[1152, 520], [390, 700], [768, 460], [1600, 600]]) {
        for (const p of strokeSpine(w, h, seed)) {
          expect(p.y - p.width).toBeGreaterThanOrEqual(0);
          expect(p.y + p.width).toBeLessThanOrEqual(h * STROKE_BAND + 0.001);
        }
      }
    }
  });

  it('honours an explicit band, which is how the phone layout is kept clear', () => {
    // The component measures where the hero's content starts and passes it in;
    // the height fraction is only a fallback. A stacked mobile hero is taller
    // than the desktop one while its kicker sits higher, so the fraction alone
    // laid the stroke across the headline at 390px.
    for (const band of [40, 64, 90]) {
      for (const p of strokeSpine(390, 760, INK_SEED, 90, band)) {
        expect(p.y - p.width).toBeGreaterThanOrEqual(0);
        expect(p.y + p.width).toBeLessThanOrEqual(band + 0.001);
      }
    }
  });

  it('leaves headroom at the top so the head is not clipped', () => {
    // bristle offset, creep and line width all reach past the spine half-width
    const highest = Math.min(...spine.map((p) => p.y - p.width));
    expect(highest).toBeGreaterThan(H * STROKE_BAND * 0.05);
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

describe('bristles — where the 飛白 comes from', () => {
  const hairs = bristles(spine, 42);

  it('is deterministic', () => {
    expect(bristles(spine, 42)).toEqual(bristles(spine, 42, INK_SEED));
  });

  it('spans the brush without escaping it', () => {
    for (const h of hairs) {
      expect(h.offset).toBeGreaterThanOrEqual(-1);
      expect(h.offset).toBeLessThanOrEqual(1);
    }
    // hairs on both sides of the spine
    expect(hairs.some((h) => h.offset < -0.3)).toBe(true);
    expect(hairs.some((h) => h.offset > 0.3)).toBe(true);
  });

  it('gives one ink value per spine sample, all in [0,1]', () => {
    for (const h of hairs) {
      expect(h.breaks).toHaveLength(spine.length);
      for (const v of h.breaks) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('actually breaks — otherwise there is no white', () => {
    // the entire effect is hairs declining to draw; a brush with no gaps is a
    // ribbon
    const total = hairs.length * spine.length;
    const dry = hairs.reduce((n, h) => n + h.breaks.filter((v) => v === 0).length, 0);
    expect(dry).toBeGreaterThan(total * 0.15);
    expect(dry).toBeLessThan(total * 0.9);
  });

  it('dries out toward the tail', () => {
    // the head should hold far more ink than the tail, which is what makes it
    // read as one loaded stroke rather than as hatching
    const third = Math.floor(spine.length / 3);
    const inkOver = (from: number, to: number) =>
      hairs.reduce((sum, h) => sum + h.breaks.slice(from, to).reduce((a, b) => a + b, 0), 0);
    expect(inkOver(0, third)).toBeGreaterThan(inkOver(spine.length - third, spine.length) * 2);
  });

  it('frays at the edges before the middle', () => {
    const mid = hairs.filter((h) => Math.abs(h.offset) < 0.3);
    const edge = hairs.filter((h) => Math.abs(h.offset) > 0.7);
    const meanInk = (set: typeof hairs) =>
      set.reduce((s, h) => s + h.breaks.reduce((a, b) => a + b, 0) / h.breaks.length, 0) /
      (set.length || 1);
    expect(meanInk(mid)).toBeGreaterThan(meanInk(edge));
  });
});

describe('splatter', () => {
  const ceiling = H * STROKE_BAND;
  const splats = splatter(spine, 90, INK_SEED, ceiling);

  it('is deterministic', () => {
    expect(splats).toEqual(splatter(spine, 90, INK_SEED, ceiling));
  });

  it('respects the ceiling — droplets were what landed on the headline', () => {
    // splatter is thrown further than the stroke is wide by definition, so the
    // band that constrains the spine cannot constrain this for free
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
  it('stays a background, not a foreground', () => {
    // "confident, a real graphic element" — clearly ink, still clearly behind
    // the words. Raising this past a third is a design decision, not a tweak.
    expect(INK_PEAK_ALPHA).toBeLessThanOrEqual(0.35);
    expect(INK_PEAK_ALPHA).toBeGreaterThan(0.2);
  });
});
