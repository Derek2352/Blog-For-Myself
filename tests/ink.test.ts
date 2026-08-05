import { describe, it, expect } from 'vitest';
import {
  CLEAR_MS,
  CYCLE_MS,
  DRY_MS,
  ENTRANCE_MS,
  HOLD_MS,
  INK_PEAK_ALPHA,
  INK_SEED,
  RETURN_MS,
  entrance,
  fbm,
  inkAfterDrying,
  mulberry32,
  strokePresence,
  valueNoise2,
} from '@/lib/ink';
import { TONES, TONE_CEILING } from '@/lib/ink-field';


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

  it('still gives the hero a clean beat, but no longer a wait', () => {
    // This asserted the opposite bound — clear for more than half the cycle — on
    // the reasoning that a mark present most of the time has not solved
    // anything. That was right while the ink's only protection for a reader was
    // being *absent*. Readability is a tone ceiling now, so presence costs
    // nothing, and nine seconds of plain hero was just a wait.
    //
    // What is still wanted is a beat: a stretch long enough to read as the hero
    // settling, and short of the ink never leaving at all.
    let clear = 0;
    let run = 0;
    let longest = 0;
    for (let t = 0; t < CYCLE_MS; t += 10) {
      if (strokePresence(t) < 0.02) {
        clear += 10;
        run += 10;
        if (run > longest) longest = run;
      } else run = 0;
    }
    expect(longest).toBeGreaterThan(2000);
    // present most of the cycle, but the sheet does empty
    expect(clear / CYCLE_MS).toBeGreaterThan(0.12);
    expect(clear / CYCLE_MS).toBeLessThan(0.45);
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

describe('the alpha ceiling', () => {
  it('is bounded where it has to be — over the words', () => {
    // This has been three different claims, because what the number means kept
    // changing. Under `difference` it had to exceed 0.7 to clear a dead zone.
    // Composited normally it was plain opacity and belonged low. Once the ink
    // read in five registers it became the ceiling only 焦墨 reaches.
    //
    // It is now free at the top, because the constraint moved somewhere better:
    // ink crossing a text block is capped at TONE_CEILING, so the worst case a
    // reader ever sees is that product — not the peak. Bounding the peak instead
    // is what kept the whole splash grey, and grey soft-edged ink is a smudge.
    expect(INK_PEAK_ALPHA).toBeGreaterThan(0.05);
    expect(INK_PEAK_ALPHA).toBeLessThanOrEqual(1);
    // The number that actually protects reading. 0.8 × 0.16 ≈ 0.13, against
    // 0.34 before this — the page got more readable as the ink got bolder.
    expect(INK_PEAK_ALPHA * TONE_CEILING).toBeLessThan(0.16);
  });

  it('has range enough for 焦墨 to be near-black', () => {
    // The other half: a splash needs darks that land on bare paper. Capped at
    // 0.34 there was nothing in the composition darker than mid-grey.
    expect(INK_PEAK_ALPHA * TONES[4]!).toBeGreaterThan(0.6);
  });
});
