import { describe, it, expect } from 'vitest';
import {
  SWIPE_MIN_SPEED,
  SWIPE_RADIUS,
  IMPULSE_SPEED,
  IMPULSE_TRAVEL_PX,
  GRAZE_MS,
  HEADING_MIN_SPEED,
  HEADING_TAU_MS,
  IMPULSE_MS,
  SHOVE_FOOTING,
  SHOVE_MIN,
  SHOVE_MIN_DEG,
  SWIPE_COOLDOWN_MS,
  SWIPE_TRY_FRACTION,
  contactFor,
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
  const at = (deg: number) => {
    const r = (deg * Math.PI) / 180;
    const v = veer(1, 0, Math.cos(r), Math.sin(r));
    return Math.hypot(v.x, v.y);
  };

  it('is exactly the angle it claims to be', () => {
    // The threshold is derived from the angle rather than the other way round, so this pins the two
    // together: a magnitude tuned by feel would drift away from the number the design reasons about.
    expect(at(SHOVE_MIN_DEG - 0.5)).toBeLessThan(SHOVE_MIN);
    expect(at(SHOVE_MIN_DEG + 0.5)).toBeGreaterThan(SHOVE_MIN);
  });

  it('rejects everything inside the zone', () => {
    for (let deg = 0; deg < SHOVE_MIN_DEG; deg += 1) expect(at(deg)).toBeLessThan(SHOVE_MIN);
  });

  it('admits everything outside it, so the |sin θ| ramp survives', () => {
    for (let deg = SHOVE_MIN_DEG + 1; deg <= 90; deg += 2) expect(at(deg)).toBeGreaterThanOrEqual(SHOVE_MIN);
  });

  it('is wider than the heading’s own drift during a flick, or nobody can enter it', () => {
    // The finding that widened it from 8.6°. A flick takes ~104ms and the cat's heading rotates 6–11°
    // in that time because its quarry walks, so a zone narrower than that drift is unreachable in play:
    // `scratchpad/hand.mjs` swept a half-circle at 12° spacing and got 14–15 shoves and 0 grazes.
    expect(SHOVE_MIN_DEG).toBeGreaterThan(11);
  });

  it('still leaves most of the circle live — a dead zone, not a difficulty', () => {
    // Four quadrant-ends are dead: 4 × SHOVE_MIN_DEG out of 360°.
    expect((4 * SHOVE_MIN_DEG) / 360).toBeLessThan(0.3);
  });

  it('suppresses only impulses that were never legible anyway', () => {
    // At the threshold the shove travels this far against a 28px cat. Below ~9px it cannot be seen, so
    // the zone costs nothing visible — which is what makes it affordable.
    const travelAtThreshold = SHOVE_MIN * (2 / 3) * (IMPULSE_MS / 1000);
    expect(travelAtThreshold).toBeLessThan(9);
  });

  it('is symmetric: swiping against the heading is as dead as swiping along it', () => {
    for (const deg of [180 - SHOVE_MIN_DEG + 1, 178, 180, 182, 180 + SHOVE_MIN_DEG - 1]) {
      expect(at(deg)).toBeLessThan(SHOVE_MIN);
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

describe('contactFor — three outcomes, because the player must tell them apart', () => {
  it('calls a square-across swipe a shove', () => {
    const v = veer(1, 0, 0, 1);
    expect(contactFor(v.x, v.y)).toBe('shove');
  });

  it('calls a near-parallel swipe a graze rather than nothing', () => {
    // The whole point of the type. Before this, "crossed the cat lengthways" and "missed the cat"
    // were the same outcome and the same picture, so a player could not tell which half of the
    // gesture to fix — and it is the graze that carries the useful information: the aim was right.
    for (const deg of [1, 3, 5, 8, 15, 19]) {
      const r = (deg * Math.PI) / 180;
      const v = veer(1, 0, Math.cos(r), Math.sin(r));
      expect(contactFor(v.x, v.y)).toBe('graze');
    }
  });

  it('agrees with SHOVE_MIN exactly, so the guard and the tell can never disagree', () => {
    expect(contactFor(SHOVE_MIN, 0)).toBe('shove');
    expect(contactFor(SHOVE_MIN - 1e-9, 0)).toBe('graze');
  });

  it('calls an exactly-zero impulse a graze, because that is what it is', () => {
    // This test deleted a third case. `contactFor` used to return `'none'` here on the theory that a
    // zero rejection is not contact — but the angle sweep below found `veer` returning exactly zero at
    // 0° and 180°, where the arithmetic is axis-aligned and the floating point cancels cleanly. So the
    // function written to remove a silent outcome had one of its own, at exactly the two angles a
    // player aiming down the cat's back produces. You crossed the cat and got no purchase: that is a
    // graze.
    expect(contactFor(0, 0)).toBe('graze');
    expect(contactFor(veer(1, 0, 1, 0).x, veer(1, 0, 1, 0).y)).toBe('graze');
    expect(contactFor(veer(1, 0, -1, 0).x, veer(1, 0, -1, 0).y)).toBe('graze');
  });

  it('is direction-blind: only the magnitude decides', () => {
    for (let deg = 0; deg < 360; deg += 11) {
      const r = (deg * Math.PI) / 180;
      const big = contactFor(Math.cos(r) * SHOVE_MIN * 2, Math.sin(r) * SHOVE_MIN * 2);
      const small = contactFor((Math.cos(r) * SHOVE_MIN) / 2, (Math.sin(r) * SHOVE_MIN) / 2);
      expect(big).toBe('shove');
      expect(small).toBe('graze');
    }
  });

  it('covers every angle: a swipe that crosses the cat is never silent', () => {
    // The property the whole fix exists to establish, and it is stronger than "the dead zone has a
    // tell": it says there is no gap *between* the two tells where feedback disappears. This is the
    // check that found the `none` case, at 0° and 180°.
    for (let deg = 0; deg < 360; deg += 3) {
      const r = (deg * Math.PI) / 180;
      const v = veer(1, 0, Math.cos(r), Math.sin(r));
      expect(['shove', 'graze']).toContain(contactFor(v.x, v.y));
    }
  });
});

describe('GRAZE_MS', () => {
  it('does not share the shove cooldown, so a miss is not punished twice', () => {
    // If a graze consumed `SWIPE_COOLDOWN_MS`, brushing the cat lengthways would lock the player out
    // of a real shove for half a second — the dead zone would feel like a trap instead of a miss.
    expect(GRAZE_MS).toBeLessThan(SWIPE_COOLDOWN_MS);
  });

  it('is long enough to be seen and short enough not to trail the gesture', () => {
    expect(GRAZE_MS).toBeGreaterThanOrEqual(200);
    expect(GRAZE_MS).toBeLessThan(IMPULSE_MS);
  });
});

describe('the heading is the cat’s own velocity', () => {
  /**
   * The card's smoothing, restated so its shape is pinned by a test rather than by one line in a
   * 2500-line component: an exponential moving average framed on dt, not a per-frame alpha.
   *
   * The remainder step is not a detail. Without it the loop overshoots — at 20fps five 50ms steps cover
   * 250ms of a 220ms window — and the frame-rate comparison below then measures *the helper's* rounding
   * rather than the average's behaviour. It failed that way first, at 0.039 against a 0.02 bound, and
   * the average was innocent.
   */
  const settle = (fps: number, ms: number) => {
    const step = Math.min(0.05, 1 / fps);
    const tau = HEADING_TAU_MS / 1000;
    let v = 0;
    let left = ms / 1000;
    while (left > 1e-9) {
      const dt = Math.min(step, left);
      v += (1 - v) * (1 - Math.exp(-dt / tau));
      left -= dt;
    }
    return v;
  };

  it('settles at the same rate whatever the frame rate', () => {
    // The reason the average is framed on `dt`. With a fixed per-frame alpha the cat's axis would
    // settle faster on a desktop than on a phone — the bug class the card's `dt` cap exists to stop.
    const slow = settle(20, HEADING_TAU_MS);
    const fast = settle(120, HEADING_TAU_MS);
    expect(Math.abs(slow - fast)).toBeLessThan(1e-9);
    // And both land on the continuous answer, 1 − 1/e, which is what "one time constant" means.
    for (const fps of [20, 30, 60, 120]) {
      expect(settle(fps, HEADING_TAU_MS)).toBeCloseTo(1 - 1 / Math.E, 6);
    }
  });

  it('is most of the way there after one time constant, and not before', () => {
    // 1 − 1/e ≈ 0.63. Pins the window to the number `HEADING_TAU_MS` claims to be.
    expect(settle(60, HEADING_TAU_MS)).toBeGreaterThan(0.55);
    expect(settle(60, HEADING_TAU_MS)).toBeLessThan(0.72);
    expect(settle(60, HEADING_TAU_MS / 4)).toBeLessThan(0.35);
  });

  it('is long enough to outlast the drift that made the dead zone unenterable', () => {
    // The quarry line rotates 6–11° during a ~104ms flick. A window shorter than the gesture would
    // inherit that swing instead of damping it, which is the whole reason the axis moved to velocity.
    expect(HEADING_TAU_MS).toBeGreaterThan(104);
  });

  it('is short enough that the axis is the cat’s current line, not its history', () => {
    // Past ~400ms the shove would be answering where the cat used to be going.
    expect(HEADING_TAU_MS).toBeLessThan(400);
  });

  it('treats a barely-moving cat as having no heading at all', () => {
    // Below this, a direction derived from the movement is noise — and `veer` already does the right
    // thing with a zero heading, so the floor hands it that case rather than a random axis.
    expect(HEADING_MIN_SPEED).toBeLessThan(CARD_STALK_SPEED / 2);
    expect(HEADING_MIN_SPEED).toBeGreaterThan(0);
  });

  it('shoves a cat with no heading at full strength, from any direction', () => {
    // What the floor hands to `veer`, checked at the boundary the card actually passes: a standing cat
    // has no "across", and every angle must work on it.
    for (let deg = 0; deg < 360; deg += 15) {
      const r = (deg * Math.PI) / 180;
      const v = veer(0, 0, Math.cos(r), Math.sin(r));
      expect(Math.hypot(v.x, v.y)).toBeCloseTo(IMPULSE_SPEED, 6);
      expect(contactFor(v.x, v.y)).toBe('shove');
    }
  });
});

describe('SWIPE_TRY_FRACTION — the speed floor stops being silent', () => {
  const band = (speed: number) => isSwipe(speed) || speed >= SWIPE_MIN_SPEED * SWIPE_TRY_FRACTION;

  it('answers a crossing swipe that was merely too slow', () => {
    // The fault this closes: "you missed the cat" and "you crossed it too slowly" were the same
    // picture, which is the identical two-failures-one-face problem the graze fixed for angle.
    expect(band(SWIPE_MIN_SPEED * 0.9)).toBe(true);
    expect(band(SWIPE_MIN_SPEED * SWIPE_TRY_FRACTION)).toBe(true);
  });

  it('stays silent below the band, because answering a drift is noise', () => {
    expect(band(SWIPE_MIN_SPEED * SWIPE_TRY_FRACTION - 0.01)).toBe(false);
    expect(band(0)).toBe(false);
  });

  it('keeps the band clear of the cat’s own walk, so following it cannot trigger anything', () => {
    // A pointer tracking the cat must never produce a tell, which is what `SWIPE_MIN_SPEED` was set
    // against in the first place — lowering the *response* threshold must not undo that.
    const catTopSpeed = CARD_STALK_SPEED * 1.4;
    expect(SWIPE_MIN_SPEED * SWIPE_TRY_FRACTION).toBeGreaterThan(catTopSpeed * 2);
  });

  it('is a band, not a second floor: everything above SWIPE_MIN_SPEED is still a real swipe', () => {
    expect(SWIPE_TRY_FRACTION).toBeGreaterThan(0);
    expect(SWIPE_TRY_FRACTION).toBeLessThan(1);
  });
});

/*
 * `describe('HAND_HINT_EVERY_MS')` stood here — two checks that the caption's restatement waited long
 * enough not to nag and came back soon enough to be seen. Deleted in 2.6 with the constant, when the
 * cat took over teaching the verb. `tests/arena.test.ts` covers the replacement: `teach-swipe` fires at
 * the cold opening and stops once the player has done anything.
 */

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
