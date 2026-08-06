import { describe, it, expect } from 'vitest';
import {
  CLAIMABLE,
  PROTECTED,
  PROTECTED_TREE,
  MIN_CLAIM_AREA,
  MAX_TILT,
  INITIAL_CLAIM_FRACTION,
  SCRUB_MS,
  STILL_PX,
  HIDDEN_TRUCE_MS,
  IDLE_TRUCE_MS,
  TELEGRAPH_MS,
  LEAP_MS,
  RECOVER_MS,
  POUNCE_RANGE,
  POUNCE_THRESHOLD,
  HIT_RADIUS,
  PREDICT_CAP,
  AIM_LEAD_MS,
  STALK_SPEED,
  OPENING_GRACE_MS,
  LURE_MS,
  FETCH_SPEED,
  phaseDuration,
  canPounce,
  nextPhase,
  provoked,
  predict,
  leapArc,
  leapPos,
  pounceHit,
  bigEnough,
  dropNested,
  pickClaims,
  claimTilt,
  scrubProgress,
  stillEnough,
  territory,
  isCleared,
  arenaCaption,
} from '@/lib/arena';

/**
 * The board is queried from page furniture, so these tests stand in for the
 * design intent the selectors encode: what the cat may take, and what it may
 * never take however the page is written.
 */
describe('the board — queried, never authored', () => {
  it('claims the page’s own furniture, not arena markup', () => {
    for (const sel of ['h1', 'h2', 'figure', '.card', '.panel', '.frame', '.kicker', '.rail']) {
      expect(CLAIMABLE).toContain(sel);
    }
  });

  it('never claims the way out', () => {
    expect(PROTECTED_TREE).toContain('header');
    expect(PROTECTED_TREE).toContain('.tabbar');
  });

  it('never claims anything focusable — the fight must not eat the tab order', () => {
    for (const sel of ['a', 'button', 'input', 'select', 'textarea', '[tabindex]']) {
      expect(PROTECTED.split(/,\s*/)).toContain(sel);
    }
  });

  it('protects the hero pane, and everything inside it', () => {
    // `[data-ink-reserve]` and `.glass` are the same div by design, so exclusion
    // has to win. Subtree, not self: protecting only the div would still have let
    // the cat claim the h1 and the kicker inside it — the same failure by another
    // route, and the one block guaranteed to stay legible is the whole point.
    expect(CLAIMABLE).toContain('[data-ink-reserve]');
    expect(PROTECTED_TREE).toContain('.glass');
  });

  it('protects the cat’s own HUD, which wears .rail', () => {
    // .cat-caption carries .rail, so without this the first press had the cat
    // claiming its own score chip.
    expect(CLAIMABLE).toContain('.rail');
    expect(PROTECTED_TREE).toContain('#cat-hud');
    expect(PROTECTED_TREE).toContain('#site-cat');
  });

  it('keeps the two lists apart — self-only for focusables, subtree for furniture', () => {
    // A card link is `a.card`: excluded as a focusable, while the `.frame` inside
    // it stays claimable. If focusables were subtree-protected, most of the board
    // on an index page would vanish.
    expect(PROTECTED).not.toContain('header');
    expect(PROTECTED_TREE).not.toContain('button');
  });
});

describe('bigEnough', () => {
  it('takes a rail-sized line', () => {
    expect(bigEnough(300, 16)).toBe(true);
  });

  it('rejects sprite stubs and empty spans', () => {
    expect(bigEnough(0, 0)).toBe(false);
    expect(bigEnough(9, 9)).toBe(false);
    expect(bigEnough(400, 0)).toBe(false);
  });

  it('rejects negative rects rather than multiplying them positive', () => {
    expect(bigEnough(-100, -100)).toBe(false);
  });

  it('is exactly the stated threshold', () => {
    expect(bigEnough(30, 30)).toBe(true); // 900
    expect(bigEnough(29, 30)).toBe(false); // 870
    expect(MIN_CLAIM_AREA).toBe(900);
  });
});

describe('dropNested — transforms compound, so only the outermost claims', () => {
  // A tiny stand-in for the homepage: figure > a.card > .frame > img
  const contains = (outer: string, inner: string) => inner.startsWith(outer + '/');

  it('keeps the outer element and drops what sits inside it', () => {
    expect(dropNested(['fig', 'fig/frame'], contains)).toEqual(['fig']);
  });

  it('keeps siblings', () => {
    expect(dropNested(['a', 'b', 'c'], contains)).toEqual(['a', 'b', 'c']);
  });

  it('drops a whole chain, not just one level', () => {
    expect(dropNested(['fig', 'fig/card', 'fig/card/frame'], contains)).toEqual(['fig']);
  });

  it('is a no-op on an empty board', () => {
    expect(dropNested([], contains)).toEqual([]);
  });

  it('never drops an element for containing itself', () => {
    expect(dropNested(['solo'], contains)).toEqual(['solo']);
  });
});

describe('pickClaims', () => {
  it('is deterministic — a seed reproduces a board', () => {
    expect(pickClaims(20, INITIAL_CLAIM_FRACTION, 4242)).toEqual(
      pickClaims(20, INITIAL_CLAIM_FRACTION, 4242),
    );
  });

  it('gives different boards for different seeds', () => {
    const a = pickClaims(20, INITIAL_CLAIM_FRACTION, 1).join();
    const b = pickClaims(20, INITIAL_CLAIM_FRACTION, 2).join();
    expect(a).not.toBe(b);
  });

  it('claims roughly the asked-for share', () => {
    expect(pickClaims(20, 0.55, 7)).toHaveLength(11);
    expect(pickClaims(100, 0.55, 7)).toHaveLength(55);
  });

  it('never claims the whole page — something is always readable', () => {
    for (let n = 2; n <= 40; n++) {
      expect(pickClaims(n, 1, n * 31).length).toBeLessThan(n);
    }
  });

  it('always claims something, so the button never looks broken', () => {
    for (let n = 1; n <= 40; n++) {
      expect(pickClaims(n, 0.01, n * 17).length).toBeGreaterThan(0);
    }
  });

  it('returns indices in DOM order, each one only once', () => {
    const got = pickClaims(30, 0.55, 99);
    expect([...got].sort((a, b) => a - b)).toEqual(got);
    expect(new Set(got).size).toBe(got.length);
    for (const i of got) {
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(30);
    }
  });

  it('scatters rather than taking the top of the page', () => {
    // The failure this guards is a stride or a prefix: both looked like a
    // rendering fault instead of an invasion. A scattered set has gaps in it.
    let scattered = 0;
    for (let seed = 0; seed < 20; seed++) {
      const got = pickClaims(24, 0.55, seed * 977 + 1);
      const isPrefix = got.every((v, i) => v === i);
      const gaps = got.filter((v, i) => i > 0 && v !== got[i - 1]! + 1).length;
      if (!isPrefix && gaps >= 3) scattered++;
    }
    expect(scattered).toBe(20);
  });

  it('survives an empty board', () => {
    expect(pickClaims(0, 0.55, 1)).toEqual([]);
  });
});

describe('claimTilt', () => {
  it('stays inside the ceiling — a wide block tilted far hands a phone a scrollbar', () => {
    for (let i = 0; i < 200; i++) {
      expect(Math.abs(claimTilt(i, 20260806))).toBeLessThanOrEqual(MAX_TILT);
    }
    expect(MAX_TILT).toBeLessThanOrEqual(0.5);
  });

  it('is deterministic per element', () => {
    expect(claimTilt(5, 11)).toBe(claimTilt(5, 11));
  });

  it('tilts both ways, so the page looks nudged rather than sheared', () => {
    const tilts = Array.from({ length: 40 }, (_, i) => claimTilt(i, 3));
    expect(tilts.some((t) => t > 0)).toBe(true);
    expect(tilts.some((t) => t < 0)).toBe(true);
  });

  it('gives neighbours different tilts', () => {
    expect(claimTilt(0, 3)).not.toBe(claimTilt(1, 3));
  });
});

describe('scrubProgress', () => {
  it('starts at nothing', () => {
    expect(scrubProgress(0)).toBe(0);
    expect(scrubProgress(-50)).toBe(0);
    expect(scrubProgress(NaN)).toBe(0);
  });

  it('completes exactly at SCRUB_MS and never overshoots', () => {
    expect(scrubProgress(SCRUB_MS)).toBe(1);
    expect(scrubProgress(SCRUB_MS * 10)).toBe(1);
  });

  it('rises monotonically', () => {
    let prev = -1;
    for (let t = 0; t <= SCRUB_MS; t += 70) {
      const p = scrubProgress(t);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });

  it('is halfway at half the time — the ring has to be readable as progress', () => {
    expect(scrubProgress(SCRUB_MS / 2)).toBeCloseTo(0.5, 6);
  });

  it('leaves room for a pounce to interrupt it', () => {
    // §10: under 900ms the interrupt is irrelevant, over 2200ms it is tedium.
    expect(SCRUB_MS).toBeGreaterThanOrEqual(900);
    expect(SCRUB_MS).toBeLessThanOrEqual(2200);
  });
});

describe('stillEnough', () => {
  it('forgives the jitter of a hand that is trying to hold still', () => {
    expect(stillEnough(0, 0)).toBe(true);
    expect(stillEnough(2, 2)).toBe(true);
  });

  it('measures distance, not axes — a diagonal drift is still a drift', () => {
    expect(stillEnough(5, 5)).toBe(false); // 7.07 > 6, though neither axis is
  });

  it('is a real tolerance, not zero', () => {
    expect(STILL_PX).toBeGreaterThan(0);
  });
});

describe('territory', () => {
  it('is the cat’s share', () => {
    expect(territory(5, 10)).toBe(0.5);
    expect(territory(0, 10)).toBe(0);
    expect(territory(10, 10)).toBe(1);
  });

  it('never divides by an empty board', () => {
    expect(territory(3, 0)).toBe(0);
  });

  it('clamps nonsense rather than reporting more than a whole page', () => {
    expect(territory(30, 10)).toBe(1);
    expect(territory(-3, 10)).toBe(0);
  });
});

describe('isCleared', () => {
  it('is true only when the cat holds nothing', () => {
    expect(isCleared(0, 9)).toBe(true);
    expect(isCleared(1, 9)).toBe(false);
  });

  it('is false on a board with nothing to fight over', () => {
    expect(isCleared(0, 0)).toBe(false);
  });
});

describe('arenaCaption', () => {
  it('counts what the visitor has taken back, not what the cat holds', () => {
    expect(arenaCaption(4, 9)).toBe('5 / 9 reclaimed');
  });

  it('says so on a clear', () => {
    expect(arenaCaption(0, 9)).toBe('the page is yours');
  });

  it('always says something — the HUD line is never blank', () => {
    for (const [c, t] of [
      [0, 0],
      [3, 9],
      [9, 9],
      [-1, 9],
      [12, 9],
    ] as const) {
      expect(arenaCaption(c, t).length).toBeGreaterThan(0);
    }
  });

  it('stays lower-case and short, like the rest of the cat’s furniture', () => {
    for (const s of [arenaCaption(4, 9), arenaCaption(0, 9), arenaCaption(0, 0)]) {
      expect(s).toBe(s.toLowerCase());
      expect(s.split(' ').length).toBeLessThanOrEqual(7);
      expect(s).not.toContain('!');
    }
  });
});

describe('nextPhase — the pounce state machine', () => {
  it('runs telegraph → leap → recover → stalk, and stops there', () => {
    expect(nextPhase('telegraph', TELEGRAPH_MS)).toBe('leap');
    expect(nextPhase('leap', LEAP_MS)).toBe('recover');
    expect(nextPhase('recover', RECOVER_MS)).toBe('stalk');
    expect(nextPhase('stalk', 999_999)).toBe(null); // only a decision ends a stalk
  });

  it('never begins the leap before the telegraph is over', () => {
    // §5.3's named failure state: a pounce that lands during its own telegraph is
    // unreactable. Driving phases by elapsed time rather than accumulated dt makes
    // it unreachable — including at a frame rate nobody should have.
    for (const elapsed of [0, 1, 100, TELEGRAPH_MS - 1]) {
      expect(nextPhase('telegraph', elapsed)).toBe(null);
    }
    expect(nextPhase('telegraph', TELEGRAPH_MS - 0.001)).toBe(null);
  });

  it('advances one phase per call, so a stalled frame cannot skip the leap', () => {
    expect(nextPhase('telegraph', 60_000)).toBe('leap');
  });

  it('gives a telegraph long enough to react to and short enough to punish', () => {
    expect(TELEGRAPH_MS).toBeGreaterThanOrEqual(300); // human reaction ~250ms
    expect(TELEGRAPH_MS).toBeLessThanOrEqual(600);
  });

  it('makes a whiff cost the cat more than the attack gained it', () => {
    // Not `> SCRUB_MS / 2`, which is what §10 claimed and what 700 against a
    // 1400ms scrub exactly fails. Dodging resets the hold anyway, so the reward
    // for a dodge is relocation, not banked progress — see the note on RECOVER_MS.
    // What must hold is that pouncing and missing is worse for the cat than not
    // pouncing, or the threat is free.
    expect(RECOVER_MS).toBeGreaterThan(TELEGRAPH_MS + LEAP_MS);
  });

  it('leaps fast enough to read as a pounce', () => {
    expect(LEAP_MS).toBeLessThanOrEqual(400);
  });
});

describe('the treat’s hold on the cat (§5.4)', () => {
  it('buys more than one complete scrub, or it buys nothing', () => {
    // The hard floor in the whole design: below SCRUB_MS the resource does not do
    // the one thing it exists to do.
    expect(LURE_MS).toBeGreaterThan(SCRUB_MS);
  });

  it('ends eating by returning to the stalk', () => {
    expect(nextPhase('eat', LURE_MS)).toBe('stalk');
    expect(nextPhase('eat', LURE_MS - 1)).toBe(null);
    expect(phaseDuration('eat')).toBe(LURE_MS);
  });

  it('never ends the walk to the treat on a clock', () => {
    // `fetch` ends on arrival. A timeout would let the cat give up on food it can
    // see, which is both wrong about cats and a silent way to void the resource.
    expect(phaseDuration('fetch')).toBe(Infinity);
    expect(nextPhase('fetch', 60_000)).toBe(null);
  });

  it('hurries for food and takes its time with you', () => {
    expect(FETCH_SPEED).toBeGreaterThan(STALK_SPEED);
  });
});

describe('canPounce', () => {
  it('is true only from a stalk', () => {
    expect(canPounce('stalk')).toBe(true);
    for (const p of ['telegraph', 'leap', 'recover', 'fetch', 'eat'] as const) {
      expect(canPounce(p)).toBe(false);
    }
  });

  it('is what makes a treat worth throwing', () => {
    // §5.3: a cat in fetch cannot pounce, and if that could be cancelled the
    // resource would be worthless. Asserted here rather than trusted to a
    // condition inside the loop.
    expect(canPounce('fetch')).toBe(false);
    expect(canPounce('eat')).toBe(false);
  });
});

describe('provoked', () => {
  it('waits until you are committed to a scrub', () => {
    expect(provoked(10, 0)).toBe(false);
    expect(provoked(10, POUNCE_THRESHOLD - 0.01)).toBe(false);
    expect(provoked(10, POUNCE_THRESHOLD)).toBe(true);
  });

  it('has to be close', () => {
    expect(provoked(POUNCE_RANGE, 1)).toBe(true);
    expect(provoked(POUNCE_RANGE + 1, 1)).toBe(false);
  });

  it('reaches further than the site cat’s idle chase, but not everywhere', () => {
    expect(POUNCE_RANGE).toBeGreaterThan(34); // SiteCat's chase trigger
    expect(POUNCE_RANGE).toBeLessThan(240); // nowhere safe would break pillar 2
  });
});

describe('the aim, and when it locks', () => {
  it('leads the whole commitment, not just the flight', () => {
    // Locking at the *end* of the telegraph deleted the telegraph: a cat that
    // re-aims until it jumps cannot be dodged during its wind-up. Locking at the
    // start means the lead has to cover wind-up plus flight.
    expect(AIM_LEAD_MS).toBe(TELEGRAPH_MS + LEAP_MS);
  });

  it('leaves a dodge window longer than human reaction time', () => {
    // The window is the telegraph, because the aim is already locked when it starts.
    expect(TELEGRAPH_MS).toBeGreaterThan(250);
  });

  it('lands late enough to read as deliberate, early enough not to feel robbed', () => {
    // Provoked at POUNCE_THRESHOLD, the pounce touches down this far into the hold.
    const landsAt = POUNCE_THRESHOLD + AIM_LEAD_MS / SCRUB_MS;
    expect(landsAt).toBeGreaterThan(0.6);
    expect(landsAt).toBeLessThan(0.9);
  });
});

describe('predict', () => {
  it('leads a moving cursor', () => {
    const p = predict(100, 100, 200, 0);
    expect(p.x).toBeGreaterThan(100);
    expect(p.y).toBeCloseTo(100, 6);
  });

  it('aims where you are when you are still', () => {
    expect(predict(100, 100, 0, 0)).toEqual({ x: 100, y: 100 });
  });

  it('caps the lead, so a flick cannot send the cat across the room', () => {
    const p = predict(0, 0, 9000, 9000);
    expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(PREDICT_CAP + 1e-9);
  });

  it('keeps the capped aim pointing the same way', () => {
    const p = predict(0, 0, 4000, 0);
    expect(p.y).toBe(0);
    expect(p.x).toBeGreaterThan(0);
  });
});

describe('leapPos and leapArc', () => {
  it('starts where it jumped from and ends where it aimed', () => {
    expect(leapPos(10, 200, 300, 120, 0)).toEqual({ x: 10, y: 200 });
    expect(leapPos(10, 200, 300, 120, 1)).toEqual({ x: 300, y: 120 });
  });

  it('goes over the top rather than sliding along the floor', () => {
    const mid = leapPos(0, 100, 200, 100, 0.5);
    expect(mid.x).toBeCloseTo(100, 6);
    expect(mid.y).toBeLessThan(100 - 20); // screen coords: up is less
  });

  it('has no lift at either end, so the landing is not a drop', () => {
    expect(leapArc(0)).toBeCloseTo(0, 6);
    expect(leapArc(1)).toBeCloseTo(0, 6);
    expect(leapArc(0.5)).toBeCloseTo(1, 6);
  });

  it('clamps outside 0..1 instead of flying off', () => {
    expect(leapPos(0, 0, 100, 0, 5)).toEqual({ x: 100, y: 0 });
    expect(leapPos(0, 0, 100, 0, -5)).toEqual({ x: 0, y: 0 });
    expect(leapArc(2)).toBeCloseTo(0, 6);
  });
});

describe('pounceHit', () => {
  it('lands on a cursor that stayed put', () => {
    expect(pounceHit(100, 100, 100, 100)).toBe(true);
    expect(pounceHit(100, 100, 120, 120)).toBe(true); // 28px
  });

  it('misses a cursor that moved away', () => {
    expect(pounceHit(100, 100, 100, 100 + HIT_RADIUS + 1)).toBe(false);
  });

  it('is dodgeable inside a leap — but only if you are moving', () => {
    // Dodging means covering HIT_RADIUS during LEAP_MS. That is ~177px/s, well
    // under a normal mouse flick and well over the 6px of drift a hold allows.
    const needed = (HIT_RADIUS / LEAP_MS) * 1000;
    expect(needed).toBeGreaterThan((STILL_PX / LEAP_MS) * 1000);
    expect(needed).toBeLessThan(600);
  });
});

describe('the opening grace', () => {
  it('covers the first scrub and not four of them', () => {
    // §7.4 asked for 6s. On the 8-claim board the query actually yields, 6s is
    // about four free scrubs — half the fight.
    expect(OPENING_GRACE_MS).toBeGreaterThan(SCRUB_MS);
    expect(OPENING_GRACE_MS).toBeLessThan(SCRUB_MS * 3);
  });
});

describe('auto-truce', () => {
  it('gives up sooner on a hidden tab than on a still pointer', () => {
    // A hidden tab means gone; a still pointer might be someone reading.
    expect(HIDDEN_TRUCE_MS).toBeLessThan(IDLE_TRUCE_MS);
  });

  it('is measured in seconds, not minutes — nobody returns mid-invasion', () => {
    expect(IDLE_TRUCE_MS).toBeLessThanOrEqual(60_000);
  });
});
