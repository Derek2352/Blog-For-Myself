import { describe, it, expect } from 'vitest';
import {
  SWIPE_MIN_SPEED,
  SWIPE_RADIUS,
  IMPULSE_SPEED,
  IMPULSE_TRAVEL_PX,
  IMPULSE_MS,
  SHOVE_FOOTING,
  SHOVE_MIN,
  SWIPE_COOLDOWN_MS,
  swipeSpeed,
  isSwipe,
  segmentHit,
  veer,
  impulseAt,
  swipeReady,
} from '@/lib/hand';
import { CARD_STALK_SPEED } from '@/lib/card';

describe('swipeSpeed', () => {
  it('is px per second, not per frame', () => {
    // 16px in one 16ms frame is 1000px/s, which is a brisk flick.
    expect(swipeSpeed(16, 0, 16)).toBeCloseTo(1000, 0);
  });

  it('measures the diagonal, not the larger axis', () => {
    expect(swipeSpeed(3, 4, 1000)).toBeCloseTo(5, 5);
  });

  it('returns 0 for a zero-length tick so callers need no guard', () => {
    expect(swipeSpeed(10, 10, 0)).toBe(0);
    expect(swipeSpeed(10, 10, -5)).toBe(0);
  });
});

describe('isSwipe', () => {
  it('rejects a pointer merely following the cat', () => {
    // The whole point of the floor: a cursor tracking the cat must not deflect it continuously.
    // A desperate cat tops out around 1.4x its stalk speed.
    const catTopSpeed = CARD_STALK_SPEED * 1.4;
    expect(isSwipe(catTopSpeed)).toBe(false);
    expect(SWIPE_MIN_SPEED).toBeGreaterThan(catTopSpeed * 3);
  });

  it('accepts a real flick', () => {
    expect(isSwipe(swipeSpeed(20, 0, 16))).toBe(true);
  });

  it('is inclusive at the threshold', () => {
    expect(isSwipe(SWIPE_MIN_SPEED)).toBe(true);
    expect(isSwipe(SWIPE_MIN_SPEED - 0.01)).toBe(false);
  });
});

describe('segmentHit', () => {
  it('hits when the segment crosses the cat', () => {
    // Horizontal sweep at y=0 straight through a cat at the origin.
    expect(segmentHit(-50, 0, 50, 0, 0, 0)).toBe(true);
  });

  it('misses when the segment passes wide', () => {
    expect(segmentHit(-50, 100, 50, 100, 0, 0)).toBe(false);
  });

  it('does not let a fast flick tunnel past the cat', () => {
    // This is the reason the function exists. A 120px flick in one frame jumps clean over a cat
    // sitting between the two sampled points; both endpoints are far away, the segment is not.
    const ax = -60;
    const bx = 60;
    expect(Math.hypot(ax, 0)).toBeGreaterThan(SWIPE_RADIUS);
    expect(Math.hypot(bx, 0)).toBeGreaterThan(SWIPE_RADIUS);
    expect(segmentHit(ax, 0, bx, 0, 0, 0)).toBe(true);
  });

  it('clamps to the segment rather than the infinite line', () => {
    // The cat sits on the line's continuation, well past where the pointer stopped.
    expect(segmentHit(-100, 0, -60, 0, 0, 0)).toBe(false);
  });

  it('falls back to point distance for a degenerate segment', () => {
    expect(segmentHit(0, 0, 0, 0, 5, 0)).toBe(true);
    expect(segmentHit(0, 0, 0, 0, SWIPE_RADIUS + 1, 0)).toBe(false);
  });

  it('is inclusive exactly at the radius', () => {
    expect(segmentHit(-10, SWIPE_RADIUS, 10, SWIPE_RADIUS, 0, 0)).toBe(true);
  });
});

describe('veer — the design rule is the arithmetic', () => {
  it('gives a full shove for a swipe square across the heading', () => {
    // Cat heading east, swipe due north.
    const v = veer(1, 0, 0, 1);
    expect(v.x).toBeCloseTo(0, 6);
    expect(Math.abs(v.y)).toBeCloseTo(IMPULSE_SPEED, 6);
  });

  it('gives nothing for a swipe along the heading', () => {
    const along = veer(1, 0, 1, 0);
    expect(Math.hypot(along.x, along.y)).toBeCloseTo(0, 6);
    // And nothing for a swipe directly against it — you cannot brake the cat by tailgating.
    const against = veer(1, 0, -1, 0);
    expect(Math.hypot(against.x, against.y)).toBeCloseTo(0, 6);
  });

  it('returns a *near*-zero for a near-parallel swipe, which is why SHOVE_MIN exists', () => {
    // The card cannot test this for exact zero, and used to. One degree off the heading is a shove of
    // 1.6px/s — invisible, but arriving with the recoil flash and the sound of a real one.
    const off1 = (1 * Math.PI) / 180;
    const v = veer(1, 0, Math.cos(off1), Math.sin(off1));
    const mag = Math.hypot(v.x, v.y);
    expect(mag).toBeGreaterThan(0);
    expect(mag).toBeLessThan(SHOVE_MIN);
  });
});

describe('SHOVE_MIN — the along-the-path dead zone', () => {
  it('rejects everything inside a few degrees of the cat’s line', () => {
    for (let deg = 0; deg <= 8; deg += 1) {
      const r = (deg * Math.PI) / 180;
      const v = veer(1, 0, Math.cos(r), Math.sin(r));
      expect(Math.hypot(v.x, v.y)).toBeLessThan(SHOVE_MIN);
    }
  });

  it('admits everything from ten degrees out, so the |sin θ| ramp survives', () => {
    for (let deg = 10; deg <= 90; deg += 5) {
      const r = (deg * Math.PI) / 180;
      const v = veer(1, 0, Math.cos(r), Math.sin(r));
      expect(Math.hypot(v.x, v.y)).toBeGreaterThanOrEqual(SHOVE_MIN);
    }
  });

  it('is a small fraction of a full shove — a dead zone, not a difficulty', () => {
    expect(SHOVE_MIN).toBeGreaterThan(0);
    expect(SHOVE_MIN).toBeLessThan(IMPULSE_SPEED * 0.25);
  });

  it('is symmetric: swiping against the heading is as dead as swiping along it', () => {
    for (const deg of [175, 178, 180, 182, 185]) {
      const r = (deg * Math.PI) / 180;
      const v = veer(1, 0, Math.cos(r), Math.sin(r));
      expect(Math.hypot(v.x, v.y)).toBeLessThan(SHOVE_MIN);
    }
  });

  it('scales with the sine of the angle between swipe and heading', () => {
    // 45° should give sin(45°) ≈ 0.707 of the full shove — the smooth middle the rule promises.
    const v = veer(1, 0, Math.SQRT1_2, Math.SQRT1_2);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(IMPULSE_SPEED * Math.SQRT1_2, 4);
  });

  it('is never stronger than the peak, at any angle', () => {
    for (let deg = 0; deg < 360; deg += 7) {
      const r = (deg * Math.PI) / 180;
      const v = veer(1, 0, Math.cos(r), Math.sin(r));
      expect(Math.hypot(v.x, v.y)).toBeLessThanOrEqual(IMPULSE_SPEED + 1e-9);
    }
  });

  it('shoves a standing cat at full strength, since it has no axis to be across', () => {
    const v = veer(0, 0, 1, 0);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(IMPULSE_SPEED, 6);
  });

  it('is unaffected by how far the pointer travelled — only by direction', () => {
    const short = veer(1, 0, 0, 5);
    const long = veer(1, 0, 0, 500);
    expect(Math.hypot(long.x, long.y)).toBeCloseTo(Math.hypot(short.x, short.y), 6);
  });

  it('returns zero for a zero-length swipe', () => {
    expect(veer(1, 0, 0, 0)).toEqual({ x: 0, y: 0 });
  });
});

describe('impulseAt', () => {
  it('is full at the start and spent at the end', () => {
    expect(impulseAt(0)).toBe(1);
    expect(impulseAt(IMPULSE_MS)).toBe(0);
    expect(impulseAt(IMPULSE_MS * 2)).toBe(0);
  });

  it('decays ease-out, so the shove lands hard and trails off', () => {
    // Past halfway the remainder must be below half — that is what distinguishes it from linear.
    expect(impulseAt(IMPULSE_MS / 2)).toBeGreaterThan(0.5);
    expect(impulseAt(IMPULSE_MS * 0.75)).toBeLessThan(0.5);
  });

  it('never goes negative or above 1', () => {
    for (let ms = -50; ms <= IMPULSE_MS + 50; ms += 10) {
      const v = impulseAt(ms);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('swipeReady', () => {
  it('bars a second shove until the first has spent itself', () => {
    expect(swipeReady(0)).toBe(false);
    expect(swipeReady(SWIPE_COOLDOWN_MS)).toBe(true);
  });

  it('outlasts the impulse, so shoves can never overlap', () => {
    // The cat must always get a moment of its own movement back between two shoves, or the game
    // is a fidget with no failure state.
    expect(SWIPE_COOLDOWN_MS).toBeGreaterThan(IMPULSE_MS);
  });
});

describe('SHOVE_FOOTING — the shove costs the cat its stride', () => {
  it('leaves the cat moving, because a cat stopped dead reads as paused', () => {
    // The whole distinction between this mechanic and a pause button. 0 would be a freeze.
    expect(SHOVE_FOOTING).toBeGreaterThan(0.2);
  });

  it('costs it more than half, because less than that loses the race it exists to win', () => {
    // The homing walk erases a lateral offset at a rate proportional to the offset. Measured with
    // full footing, the peak displacement was 0–3px against a nominal 25px.
    expect(SHOVE_FOOTING).toBeLessThan(0.5);
  });

  it('composes as a decaying multiplier: full stride before and after, least at the peak', () => {
    // The card computes `1 - impulseAt(elapsed) * (1 - SHOVE_FOOTING)`. Stated here so the shape is
    // pinned by a test rather than by one expression inside a 2000-line component.
    const footing = (ms: number) => 1 - impulseAt(ms) * (1 - SHOVE_FOOTING);
    expect(footing(-1)).toBeCloseTo(SHOVE_FOOTING, 6); // impulseAt clamps to 1 before the shove starts
    expect(footing(0)).toBeCloseTo(SHOVE_FOOTING, 6);
    expect(footing(IMPULSE_MS)).toBeCloseTo(1, 6);
    expect(footing(IMPULSE_MS * 2)).toBeCloseTo(1, 6);
    expect(footing(IMPULSE_MS / 2)).toBeGreaterThan(footing(0));
    expect(footing(IMPULSE_MS / 2)).toBeLessThan(1);
  });

  it('never leaves the cat with more stride than it started with', () => {
    for (let ms = -50; ms <= IMPULSE_MS + 50; ms += 10) {
      const f = 1 - impulseAt(ms) * (1 - SHOVE_FOOTING);
      expect(f).toBeLessThanOrEqual(1);
      expect(f).toBeGreaterThanOrEqual(SHOVE_FOOTING);
    }
  });
});

/**
 * The shove against the homing walk — `stepBoss`'s stalk branch, integrated.
 *
 * **Why this simulation is a test and not a note.** The question "how far does a shove actually move
 * the cat" cannot be answered by `IMPULSE_TRAVEL_PX`, because the cat is simultaneously walking
 * *toward its quarry* and re-aiming every frame, so it spends the whole impulse correcting. It also
 * could not be answered in situ: `scratchpad/hand-look.mjs` samples at ~20fps against a moving kitten
 * and a rolled stance, and its figures ranged over 0–14px with no stable story — enough noise that an
 * earlier reading of them concluded the mechanic did nothing at all, and a comment in the card said
 * so. This is what corrected that. Deterministic, no browser, real constants.
 *
 * It duplicates the card's arithmetic, which is a cost worth naming: if `stepBoss` changes shape,
 * this drifts silently rather than failing. It is worth it anyway, because the alternative was a
 * design decision resting on numbers nothing could reproduce.
 */
function shoveSim({
  dist,
  fps,
  footing,
  blend,
}: {
  dist: number;
  fps: number;
  footing: boolean;
  blend: boolean;
}): { peak: number; path: number } {
  const stepMs = 1000 / fps;
  let px = 0;
  let py = 0;
  const qx = dist; // quarry due east and stationary; the shove is due north, i.e. square across
  const shoveY = IMPULSE_SPEED;
  let peak = 0;
  let path = 0;
  for (let ms = 0; ms <= IMPULSE_MS + 200; ms += stepMs) {
    const dt = Math.min(0.05, stepMs / 1000); // the card's own dt cap
    const left = impulseAt(ms);
    const dx = qx - px;
    const dy = 0 - py;
    const d = Math.hypot(dx, dy);
    if (d <= 1) break; // the card's `dist > 1` guard
    const foot = footing ? 1 - left * (1 - SHOVE_FOOTING) : 1;
    const step = Math.min(d, CARD_STALK_SPEED * foot * dt);
    let ux = dx / d;
    let uy = dy / d;
    if (blend && left > 0) {
      // Blend back from the heading it was hit on (due east, the unit x axis).
      ux = ux * (1 - left) + 1 * left;
      uy = uy * (1 - left) + 0 * left;
      const l = Math.hypot(ux, uy) || 1;
      ux /= l;
      uy /= l;
    }
    const nx = px + ux * step;
    const ny = py + uy * step + shoveY * left * dt;
    path += Math.hypot(nx - px, ny - py);
    px = nx;
    py = ny;
    peak = Math.max(peak, py); // py *is* the perpendicular offset in this frame of reference
  }
  return { peak, path };
}

describe('the shove against the homing walk', () => {
  const plain = (dist: number, fps = 20) => shoveSim({ dist, fps, footing: false, blend: false });
  const fixed = (dist: number, fps = 20) => shoveSim({ dist, fps, footing: true, blend: true });

  it('lands most of its nominal travel even with nothing helping it', () => {
    // This is the check that overturned "the shove does nothing". At arm's length the bare impulse
    // delivers essentially all of it.
    expect(plain(140).peak).toBeGreaterThan(IMPULSE_TRAVEL_PX * 0.95);
  });

  it('is eroded worst exactly where a player would most want to shove', () => {
    // Close to its quarry the cat corrects hardest, because the correction goes as step·δ/dist —
    // and close to its quarry is the moment before it pounces.
    expect(plain(10).peak).toBeLessThan(plain(140).peak);
    expect(plain(10).peak).toBeGreaterThan(IMPULSE_TRAVEL_PX * 0.55);
  });

  it('is rescued by the footing and heading remedies where it was weakest', () => {
    expect(fixed(10).peak).toBeGreaterThan(plain(10).peak * 1.35);
    expect(fixed(10).peak).toBeGreaterThan(IMPULSE_TRAVEL_PX * 0.85);
  });

  it('leaves the best case alone, so the remedies buy consistency rather than force', () => {
    // The point is a mechanic that does not depend on where the cat happens to be standing. Both
    // ends of the range should land within a few px of each other once the remedies are in.
    expect(Math.abs(fixed(140).peak - fixed(10).peak)).toBeLessThan(IMPULSE_TRAVEL_PX * 0.2);
  });

  it('never becomes a teleport at any quarry distance or frame rate', () => {
    for (const dist of [10, 20, 40, 80, 140]) {
      for (const fps of [20, 30, 60, 120]) {
        expect(fixed(dist, fps).peak).toBeLessThan(IMPULSE_TRAVEL_PX * 1.3);
      }
    }
  });

  it('does not depend on the frame rate for its result', () => {
    // A displacement that changes with fps would make the mechanic feel different on a slow phone
    // than on a desktop, which is the class of bug the `dt` cap exists to prevent.
    for (const dist of [10, 40, 140]) {
      const slow = fixed(dist, 20).peak;
      const fast = fixed(dist, 120).peak;
      expect(Math.abs(slow - fast)).toBeLessThan(3);
    }
  });
});

describe('the shove is legible without being a teleport', () => {
  it('outruns the cat, which is the whole point of a shove', () => {
    // This is the check that caught the original constant. A peak of 26px/s integrated to 7.3px
    // of travel while the cat itself walks 14px in the same 420ms — the "shove" was slower than
    // the walk it was meant to interrupt. The floor is therefore relative to the cat, not absolute.
    const catWalk = CARD_STALK_SPEED * (IMPULSE_MS / 1000);
    expect(IMPULSE_TRAVEL_PX).toBeGreaterThan(catWalk * 1.4);
  });

  it('moves the cat roughly half a tile, not across the board', () => {
    // A tile is ~96x46 on a 318x217 board.
    expect(IMPULSE_TRAVEL_PX).toBeGreaterThan(12);
    expect(IMPULSE_TRAVEL_PX).toBeLessThan(46);
  });

  it('states its travel as a derived figure, so it cannot go stale', () => {
    expect(IMPULSE_TRAVEL_PX).toBeCloseTo(IMPULSE_SPEED * (2 / 3) * (IMPULSE_MS / 1000), 9);
  });
});
