import { describe, it, expect } from 'vitest';
import {
  ENTRANCE_MS,
  INK_PEAK_ALPHA,
  INK_SEED,
  TRAIL_MS,
  mulberry32,
  valueNoise2,
  fbm,
  bloomLayout,
  bloomOutline,
  entrance,
  trailAlpha,
} from '@/lib/ink';

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
    // the edge of a bloom is built from this, so a discontinuity would show as
    // a notch in the outline
    let prev = valueNoise2(0, 0.5, INK_SEED);
    for (let i = 1; i <= 200; i++) {
      const v = valueNoise2(i * 0.01, 0.5, INK_SEED);
      expect(Math.abs(v - prev)).toBeLessThan(0.1);
      prev = v;
    }
  });

  it('fbm stays in [0,1] and is deterministic', () => {
    for (let i = 0; i < 200; i++) {
      const x = i * 0.13;
      const y = i * 0.29;
      const v = fbm(x, y, INK_SEED);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(fbm(x, y, INK_SEED)).toBe(v);
    }
  });
});

describe('bloomLayout', () => {
  const W = 800;
  const H = 500;

  it('is deterministic for the shipped seed', () => {
    expect(bloomLayout(W, H)).toEqual(bloomLayout(W, H, INK_SEED));
  });

  it('anchors the primary wash off the left edge', () => {
    // the composition depends on the big bloom arriving from outside the frame;
    // a positive centre would read as a blot sitting in the middle
    const [primary] = bloomLayout(W, H);
    expect(primary!.x).toBeLessThanOrEqual(0);
    expect(primary!.weight).toBe(1);
  });

  it('keeps every satellite in the left half, clear of the photo column', () => {
    const [, ...satellites] = bloomLayout(W, H);
    expect(satellites.length).toBeGreaterThanOrEqual(2);
    for (const s of satellites) {
      expect(s.x).toBeGreaterThan(0);
      expect(s.x).toBeLessThan(W * 0.5);
    }
  });

  it('gives every bloom a usable radius, weight and wobble', () => {
    for (const b of bloomLayout(W, H)) {
      expect(b.r).toBeGreaterThan(0);
      expect(b.weight).toBeGreaterThan(0);
      expect(b.weight).toBeLessThanOrEqual(1);
      // wobble >= 1 would let the outline collapse through zero
      expect(b.wobble).toBeGreaterThan(0);
      expect(b.wobble).toBeLessThan(1);
      expect(b.y).toBeGreaterThan(0);
      expect(b.y).toBeLessThan(H);
    }
  });

  it('scales with the box it is given', () => {
    const small = bloomLayout(400, 250)[0]!;
    const large = bloomLayout(800, 500)[0]!;
    expect(large.r).toBeGreaterThan(small.r);
  });
});

describe('bloomOutline', () => {
  const bloom = bloomLayout(800, 500)[0]!;

  it('returns one radius per segment, all positive', () => {
    const radii = bloomOutline(bloom, 0, 64);
    expect(radii).toHaveLength(64);
    for (const r of radii) expect(r).toBeGreaterThan(0);
  });

  it('stays within the wobble envelope', () => {
    const lo = bloom.r * (1 - bloom.wobble);
    const hi = bloom.r * (1 + bloom.wobble);
    for (const t of [0, 0.7, 3.2, 11.5]) {
      for (const r of bloomOutline(bloom, t, 64)) {
        expect(r).toBeGreaterThanOrEqual(lo);
        expect(r).toBeLessThanOrEqual(hi);
      }
    }
  });

  it('closes seamlessly — the last segment meets the first', () => {
    // noise is sampled on a circle so the outline wraps; a seam would show as a
    // crease running out from the centre
    const radii = bloomOutline(bloom, 1.3, 128);
    const step = Math.abs(radii[0]! - radii[1]!);
    const wrap = Math.abs(radii[0]! - radii[radii.length - 1]!);
    expect(wrap).toBeLessThan(step * 3 + bloom.r * 0.01);
  });

  it('breathes — the edge moves as t advances, deterministically', () => {
    const a = bloomOutline(bloom, 0, 64);
    const b = bloomOutline(bloom, 2.5, 64);
    expect(b).not.toEqual(a);
    expect(bloomOutline(bloom, 2.5, 64)).toEqual(b);
  });

  it('does not drift the centre — only the radius changes', () => {
    // guards the "breathes in place" decision: bloomOutline may never return
    // anything that would move the bloom, so its only output is radii
    const radii = bloomOutline(bloom, 4, 32);
    expect(radii.every((r) => typeof r === 'number')).toBe(true);
  });
});

describe('entrance', () => {
  it('starts from nothing and finishes fully arrived', () => {
    expect(entrance(0)).toEqual({ spread: 0, soak: 0 });
    expect(entrance(-100)).toEqual({ spread: 0, soak: 0 });
    expect(entrance(ENTRANCE_MS)).toEqual({ spread: 1, soak: 1 });
    expect(entrance(ENTRANCE_MS * 10)).toEqual({ spread: 1, soak: 1 });
  });

  it('holds at nothing until its delay has passed', () => {
    const delay = 500;
    expect(entrance(delay - 1, delay).soak).toBe(0);
    expect(entrance(delay + 1, delay).soak).toBeGreaterThan(0);
    // a staggered bloom finishes later than an unstaggered one
    expect(entrance(ENTRANCE_MS, delay).spread).toBeLessThan(1);
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

  it('commits the mark before it spreads', () => {
    // the whole point: ink is dark on landing and *then* opens out. If soak
    // ever trailed spread the wash would read as an image fading in.
    for (let ms = 25; ms < ENTRANCE_MS; ms += 25) {
      const { spread, soak } = entrance(ms);
      expect(soak).toBeGreaterThan(spread);
    }
  });

  it('is fully opaque by a third of the way in', () => {
    expect(entrance(ENTRANCE_MS / 3).soak).toBeCloseTo(1, 5);
    expect(entrance(ENTRANCE_MS / 3).spread).toBeLessThan(0.75);
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
  it('never exceeds half the page wash', () => {
    // the wash gradient sits at 0.10; the whole design rests on the ink being
    // quieter than it. Raising this is a design decision, not a tuning tweak.
    expect(INK_PEAK_ALPHA).toBeLessThanOrEqual(0.05);
  });

  it('keeps every bloom at or under the ceiling once weighted', () => {
    for (const b of bloomLayout(800, 500)) {
      expect(b.weight * INK_PEAK_ALPHA).toBeLessThanOrEqual(INK_PEAK_ALPHA);
    }
  });
});
