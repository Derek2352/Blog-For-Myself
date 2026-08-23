import { describe, it, expect } from 'vitest';
import {
  CLAIMABLE,
  PROTECTED,
  PROTECTED_TREE,
  INTERACTIVE,
  MIN_CLAIM_AREA,
  MIN_BOARD,
  MAX_BOARD,
  boardSlice,
  MAX_TILT,
  INITIAL_CLAIM_FRACTION,
  SCRUB_MS,
  STILL_PX,
  TAP_MS,
  isTap,
  isWorking,
  regrowInterval,
  LAST_STAND_REGROW,
  swatLands,
  SWAT_RADIUS,
  SWAT_STUN_MS,
  sweepPartner,
  SIEGE_SWEEP_EVERY,
  AMBUSH_PIN_MS,
  AMBUSH_PIN_PX,
  TRICKSTER_DOUBLE,
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
  OPENING_LINE_MS,
  LURE_MS,
  FETCH_SPEED,
  phaseDuration,
  canPounce,
  isWon,
  isLost,
  STANCES,
  pickStance,
  TREAT_SPECS,
  treatSpec,
  LINES,
  LINE_MS,
  LINE_GAP_MS,
  pickLine,
  lineText,
  type FightState,
  type Mood,
  mood,
  aggression,
  telegraphScale,
  patienceFor,
  talkGap,
  AGGRO_BORED,
  AGGRO_EVEN,
  AGGRO_DESPERATE,
  AGGRO_PATIENCE,
  MAX_THRESHOLD,
  BORED_ENTER,
  BORED_LEAVE,
  DESPERATE_ENTER,
  DESPERATE_LEAVE,
  GROOM_EVERY_MS,
  GROOM_MS,
  LADDER_FLOOR,
  nextRung,
  ammoCap,
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
import { TREATS } from '@/lib/cat-game';

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
    for (const sel of ['a', 'button', 'input', 'select', 'textarea']) {
      expect(PROTECTED.split(/,\s*/)).toContain(sel);
    }
    // ...but "in the tab order" is the actual test, which is why this one is qualified.
    expect(PROTECTED.split(/,\s*/)).toContain('[tabindex]:not([tabindex="-1"])');
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

  it('does not treat a skip-link target as focusable furniture', () => {
    // `Base.astro` renders `<main id="main" tabindex="-1">`. A bare `[tabindex]` matches it,
    // and `tabindex="-1"` means "focusable by script, not by tab" — so it is neither in the
    // tab order this rule protects nor something a click belongs to.
    expect(PROTECTED).toContain('[tabindex]:not([tabindex="-1"])');
    expect(PROTECTED.split(/,\s*/)).not.toContain('[tabindex]');
  });

  it('separates "never claim this" from "never intercept this click"', () => {
    /*
     * The bug this pins down: the click handler used PROTECTED, PROTECTED matched
     * `<main tabindex="-1">`, and so no click anywhere in the page content ever threw a
     * treat — while the crosshair cursor said it would. Two questions, two lists.
     */
    expect(INTERACTIVE).toContain('a[href]');
    expect(INTERACTIVE).not.toContain('tabindex');
    expect(INTERACTIVE).toContain('label'); // clicking a label focuses its control
    expect(INTERACTIVE).not.toBe(PROTECTED);
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

describe('boardSlice — the fight is over the screen (§4)', () => {
  const v = (n: number, m: number) => [...Array(n).fill(true), ...Array(m).fill(false)];

  // Explicit bounds, so these say what the function does rather than drifting every time
  // the tuning moves. The constants get their own check below.
  it('takes what is on screen when that is enough', () => {
    expect(boardSlice(v(10, 30), 4, 20)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('borrows from below the fold only when the screen is too thin for a game', () => {
    expect(boardSlice(v(3, 20), 8, 20)).toHaveLength(8);
    expect(boardSlice(v(3, 20), 8, 20).slice(0, 3)).toEqual([0, 1, 2]);
  });

  it('caps the board, because past twenty the page is unreadable', () => {
    expect(boardSlice(v(40, 0), 8, 12)).toHaveLength(12);
  });

  it('is tuned inside the design’s own bounds', () => {
    // §10: under four claims the fight is over before it starts; over twenty the page is
    // unreadable. The board is 55% claimed, so the floor has to leave 4+ claims. 1.3 shrank
    // both numbers (14/20 → 10/14) because every stance now regrows, and churn costs time —
    // see the note on `MIN_BOARD`.
    expect(MIN_BOARD * INITIAL_CLAIM_FRACTION).toBeGreaterThanOrEqual(4);
    expect(MAX_BOARD).toBeLessThanOrEqual(20);
    expect(MIN_BOARD).toBeLessThanOrEqual(MAX_BOARD);
    // 1.3: the board shrank. Both constants moved together, and the floor stayed above the
    // "over before it starts" line rather than riding it.
    expect(MIN_BOARD).toBeLessThan(14);
    expect(MAX_BOARD).toBeLessThan(20);
  });

  it('keeps document order, so a claim’s tilt belongs to its place on the page', () => {
    const mixed = [false, true, false, true, true, false, true];
    const got = boardSlice(mixed, 2, 16);
    expect([...got].sort((a, b) => a - b)).toEqual(got);
  });

  it('survives a page with nothing claimable', () => {
    expect(boardSlice([])).toEqual([]);
  });

  it('never invents an index', () => {
    const got = boardSlice(v(5, 5));
    for (const i of got) expect(i).toBeLessThan(10);
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

describe('one finger, two verbs (§3, touch mode in 1.2)', () => {
  it('calls a quick touch a tap, and a hold not', () => {
    expect(isTap(90)).toBe(true);
    expect(isTap(TAP_MS)).toBe(true);
    expect(isTap(TAP_MS + 1)).toBe(false);
    expect(isTap(SCRUB_MS)).toBe(false);
  });

  it('leaves daylight between a real tap and the core verb', () => {
    // A human tap is ~80-150ms; anything at or under TAP_MS must be a tap, and TAP_MS must sit
    // far enough below SCRUB_MS that a deliberate hold can never be mistaken for one.
    expect(TAP_MS).toBeGreaterThan(150);
    expect(TAP_MS).toBeLessThan(SCRUB_MS / 3);
  });

  /*
   * `isWorking` is the one that keeps §11's promise and §5.2's verb at the same time. §5.1 allows
   * a claim inside a link; on touch a hold ends in a `click`; so without this the core verb
   * navigated off the page. The two conditions have to be *both*, and each rules out a different
   * way of getting it wrong.
   */
  it('swallows the click that ends a hold on a claim', () => {
    expect(isWorking(SCRUB_MS, true)).toBe(true);
    expect(isWorking(TAP_MS + 1, true)).toBe(true);
  });

  it('but never a tap — §11 promises a link still navigates', () => {
    expect(isWorking(90, true)).toBe(false);
    expect(isWorking(TAP_MS, true)).toBe(false);
  });

  it('and never a long press on something the fight does not own', () => {
    // A reader resting a finger on an ordinary link is not playing, and the page must keep
    // working. Gating on duration alone would have broken every long-press on the site.
    expect(isWorking(4000, false)).toBe(false);
  });

  it('the two verbs cannot both fire, and cannot both decline', () => {
    // On a claim, every duration is exactly one of "tap" (throws) or "working" (swallowed).
    for (const held of [0, 50, TAP_MS - 1, TAP_MS, TAP_MS + 1, 900, SCRUB_MS, 9000]) {
      expect(isTap(held) !== isWorking(held, true), `held=${held}`).toBe(true);
    }
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

  it('speaks the first line inside the grace — the teach line must land while the cat cannot pounce', () => {
    // 1.3: the playtest's opening was silent, then wrong. The teach line (§8) is only a
    // safe context if it arrives inside OPENING_GRACE_MS, where §5.3 guarantees the cat
    // cannot pounce — so the first-line delay is pinned below the grace by test.
    expect(OPENING_LINE_MS).toBeGreaterThan(0);
    expect(OPENING_LINE_MS).toBeLessThan(OPENING_GRACE_MS);
  });
});

describe('aggression (§7.3) — difficulty as characterisation', () => {
  const all = Object.keys(STANCES) as (keyof typeof STANCES)[];
  const st = (over: Partial<FightState> = {}): FightState => ({
    territory: 0.5,
    ammo: 0,
    spent: 0,
    freed: 0,
    interrupts: 0,
    idleMs: 0,
    staleMs: 0,
    collared: false,
    mood: 'even',
    rung: 0,
    found: 3,
    ...over,
  });

  it('pities a player who is behind and out of options', () => {
    expect(mood(st({ territory: 0.85, ammo: 0 }))).toBe('bored');
  });

  it('but not one who still has a treat in hand', () => {
    // Being pitied while you still have a move reads as condescension, not mercy.
    expect(mood(st({ territory: 0.85, ammo: 2 }))).toBe('even');
  });

  it('gets desperate when it is the one losing the page', () => {
    expect(mood(st({ territory: 0.15 }))).toBe('desperate');
  });

  it('is even in the middle', () => {
    expect(mood(st({ territory: 0.5 }))).toBe('even');
  });

  it('does not flap at a boundary', () => {
    /*
     * The check this whole hysteresis exists for. Territory moves one claim at a time and
     * the board is 14–20 wide, so a fight traded around the bored threshold steps back and
     * forth across it — and without memory the wind-up length, the walking speed and the
     * grooming would all strobe on alternate exchanges.
     */
    const series = [0.72, 0.66, 0.71, 0.65, 0.69, 0.63, 0.68];
    let m: Mood = 'even';
    let changes = 0;
    for (const territory of series) {
      const next = mood(st({ territory }), m);
      if (next !== m) changes++;
      m = next;
    }
    expect(changes).toBe(1);
    expect(m).toBe('bored');
  });

  it('does let go once the player is genuinely back in it', () => {
    // "Genuinely" is the word the band widened to earn: one claim back no longer lifts the
    // mercy, three do. These sit clear of the boundaries rather than on them.
    expect(mood(st({ territory: 0.5 }), 'bored')).toBe('even');
    expect(mood(st({ territory: 0.45 }), 'desperate')).toBe('even');
    // and still holds on just inside the band
    expect(mood(st({ territory: 0.6 }), 'bored')).toBe('bored');
    expect(mood(st({ territory: 0.3 }), 'desperate')).toBe('desperate');
  });

  it('leaves the boundaries in an order that makes hysteresis mean anything', () => {
    expect(BORED_LEAVE).toBeLessThan(BORED_ENTER);
    expect(DESPERATE_LEAVE).toBeGreaterThan(DESPERATE_ENTER);
    // and the two tiers cannot overlap, or a state would be both
    expect(DESPERATE_LEAVE).toBeLessThan(BORED_LEAVE);
  });

  it('makes the band wider than the thing it is damping', () => {
    /*
     * The check the first attempt at these numbers failed, and it failed in a browser rather
     * than here because nothing tied the band to the board. 0.62/0.70 is 0.08 wide, which on
     * a 15-claim board is 1.2 claims — narrower than one trade, so the tier flipped on
     * alternate exchanges and the harness recorded `even→bored→even→bored→even`.
     *
     * A hysteresis band has to be measured in the units of the signal it smooths. Territory
     * moves one claim at a time on a board that is never smaller than `MIN_BOARD`.
     */
    expect((BORED_ENTER - BORED_LEAVE) * MIN_BOARD).toBeGreaterThanOrEqual(2);
    expect((DESPERATE_LEAVE - DESPERATE_ENTER) * MIN_BOARD).toBeGreaterThanOrEqual(2);
  });

  it('does not flap when a single claim trades back and forth', () => {
    // The concrete version of the rule above, on the smallest board the query ever deals.
    // 8 and 7 claims on a 10-claim board straddle the bored enter threshold (0.72): one
    // claim back and forth must not strobe the tier.
    const claims = [8, 7, 8, 7, 8, 7];
    let m: Mood = 'even';
    let changes = 0;
    for (const c of claims) {
      const next = mood(st({ territory: c / MIN_BOARD }), m);
      if (next !== m) changes++;
      m = next;
    }
    expect(changes).toBe(1);
  });

  it('eases off without becoming a walkover', () => {
    // §10: below about 0.4 the cat stops being a threat, and a boss that has given up is
    // not merciful, it is over.
    expect(AGGRO_BORED).toBeGreaterThan(0.4);
    expect(AGGRO_BORED).toBeLessThan(AGGRO_EVEN);
    expect(AGGRO_DESPERATE).toBeGreaterThan(AGGRO_EVEN);
  });

  it('only ever shortens the wind-up, never stretches it', () => {
    // The rule the whiff invariant below depends on. A bored cat's tell is that it does
    // less, not that it does the same thing slowly.
    for (const a of [0.4, AGGRO_BORED, 0.9, AGGRO_EVEN, 1.2, AGGRO_DESPERATE, 2]) {
      expect(telegraphScale(a), String(a)).toBeLessThanOrEqual(1);
    }
    expect(telegraphScale(AGGRO_BORED)).toBe(1);
    expect(telegraphScale(AGGRO_DESPERATE)).toBeLessThan(1);
  });

  it('keeps a whiff costly for every stance at every mood', () => {
    /*
     * The check that decided the shape of this feature, written before the code settled.
     *
     * §10 requires a whiff to cost the cat more than the attack gained it. Scaling the
     * *recovery* by aggression as well — the symmetric, obvious-looking choice — fails
     * here: at 1.4 siege comes up 60ms short, and trickster and sleepy scrape through on
     * 10ms and 35ms, margins thin enough to be noise. Repairing that means retuning three
     * of four stances' recovery to accommodate a §7.3 feature. Clamping the telegraph
     * scale to 1 instead costs nothing and leaves 140ms at the worst point in the space.
     */
    for (const s of all) {
      const spec = STANCES[s];
      for (const m of ['bored', 'even', 'desperate'] as Mood[]) {
        const tele = TELEGRAPH_MS * spec.telegraph * telegraphScale(aggression(m));
        expect(RECOVER_MS * spec.recover, `${s} / ${m}`).toBeGreaterThan(tele + LEAP_MS);
      }
    }
  });

  it('still leaves a reactable telegraph when the cat is desperate', () => {
    // §5.3's floor does not get to be suspended because the cat is behind.
    for (const s of all) {
      const tele = TELEGRAPH_MS * STANCES[s].telegraph * telegraphScale(AGGRO_DESPERATE);
      expect(tele, s).toBeGreaterThan(230);
    }
  });

  it('makes a bored cat wait and a desperate one commit early', () => {
    expect(patienceFor(0, AGGRO_BORED)).toBeGreaterThan(0);
    expect(patienceFor(0, AGGRO_DESPERATE)).toBeLessThan(0);
    expect(patienceFor(0, AGGRO_EVEN)).toBe(0);
  });

  it('never makes the pounce unreachable, however patient', () => {
    /*
     * `provoked` needs progress >= POUNCE_THRESHOLD + patience, and progress caps at 1 —
     * so a composed threshold of 1.0 does not make the pounce rare, it deletes it. A bored
     * sleepy cat lands there exactly. Rare is the design; never is a mechanic switching
     * itself off.
     */
    for (const s of all) {
      for (const m of ['bored', 'even', 'desperate'] as Mood[]) {
        const threshold = POUNCE_THRESHOLD + patienceFor(STANCES[s].patience, aggression(m));
        expect(threshold, `${s} / ${m}`).toBeLessThanOrEqual(MAX_THRESHOLD);
        expect(threshold, `${s} / ${m}`).toBeGreaterThan(0);
      }
    }
    // and the clamp is doing real work, not sitting decorative
    expect(POUNCE_THRESHOLD + STANCES.sleepy.patience + (1 - AGGRO_BORED) * AGGRO_PATIENCE)
      .toBeGreaterThan(MAX_THRESHOLD);
  });

  it('crowds you when desperate and goes quiet when bored', () => {
    expect(talkGap(AGGRO_DESPERATE)).toBeLessThan(LINE_GAP_MS);
    expect(talkGap(AGGRO_BORED)).toBeGreaterThan(LINE_GAP_MS);
    // Still a gap, though: §8's rule is that the cat must not narrate, in any mood.
    expect(talkGap(AGGRO_DESPERATE)).toBeGreaterThan(600);
  });

  it('grooms rarely enough to read as boredom rather than a stuck loop', () => {
    expect(GROOM_EVERY_MS).toBeGreaterThan(GROOM_MS * 2);
  });
});

describe('stances (§9.3)', () => {
  const all = Object.keys(STANCES) as (keyof typeof STANCES)[];

  it('is deterministic per fight, so a board can be replayed', () => {
    expect(pickStance(9182)).toBe(pickStance(9182));
  });

  it('deals every stance across enough fights', () => {
    const seen = new Set(Array.from({ length: 400 }, (_, i) => pickStance(i * 7919 + 3)));
    expect(seen.size).toBe(all.length);
  });

  it('keeps the joke fight rare — a gift, not an expectation', () => {
    const n = 3000;
    const sleepy = Array.from({ length: n }, (_, i) => pickStance(i * 2654435761)).filter(
      (s) => s === 'sleepy',
    ).length;
    expect(sleepy / n).toBeLessThan(0.2);
  });

  it('never makes a telegraph unreactable, whatever the stance', () => {
    // The one hard floor: §5.3's telegraph must stay long enough to dodge, or a stance
    // turns the game off rather than changing it.
    for (const s of all) {
      expect(TELEGRAPH_MS * STANCES[s].telegraph, s).toBeGreaterThan(300);
    }
  });

  it('never makes a whiff free for the cat', () => {
    for (const s of all) {
      const spec = STANCES[s];
      expect(RECOVER_MS * spec.recover, s).toBeGreaterThan(TELEGRAPH_MS * spec.telegraph + LEAP_MS);
    }
  });

  it('changes the numbers, never the verbs', () => {
    // Every stance is expressible as multipliers plus two behavioural switches. A stance
    // with its own mechanic would be a different game, not a different opponent.
    for (const s of all) {
      expect(Object.keys(STANCES[s]).sort()).toEqual(
        ['feint', 'patience', 'pin', 'recover', 'regrowMs', 'stalk', 'telegraph'].sort(),
      );
    }
  });

  it('gives every stance a clock except the gift, and one a floor it will not leave', () => {
    // 1.3: the playtest found ~61% of fights had no clock — only siege regrew, so keeping
    // your distance cost nothing and the cat was scenery. Now ambush and trickster regrow
    // too (derived from the reclaim rate, see §10), and only sleepy — "a gift, and rare
    // enough to be a story" (§9.3) — keeps regrowMs 0, because a gift with a clock is not
    // a gift.
    expect(all.filter((s) => STANCES[s].regrowMs > 0)).toEqual(['ambush', 'siege', 'trickster']);
    expect(all.filter((s) => STANCES[s].pin)).toEqual(['siege']);
  });

  it('keeps the regrow slower than the reclaim rate — the treatless floor must stay winnable', () => {
    // Derived in 1.3, not invented: a player reclaims about one claim per ~2s (§10), so a
    // regrow faster than ~2000ms is unwinnable for a treatless fight (the arena8 gate) and
    // one much slower is decoration. Every regrowing stance sits inside the band.
    for (const s of all) {
      if (STANCES[s].regrowMs === 0) continue;
      expect(STANCES[s].regrowMs, s).toBeGreaterThan(2000);
      expect(STANCES[s].regrowMs, s).toBeLessThan(2 * 9000);
    }
  });

  it('only the trickster feints, and not most of the time', () => {
    expect(all.filter((s) => STANCES[s].feint > 0)).toEqual(['trickster']);
    expect(STANCES.trickster.feint).toBeLessThan(0.5);
  });

  it('scales phase durations rather than replacing them', () => {
    expect(nextPhase('telegraph', TELEGRAPH_MS, 1.6)).toBe(null);
    expect(nextPhase('telegraph', TELEGRAPH_MS * 1.6, 1.6)).toBe('leap');
  });

  it('lets a patient stance ignore a scrub it would otherwise interrupt', () => {
    expect(provoked(20, POUNCE_THRESHOLD)).toBe(true);
    expect(provoked(20, POUNCE_THRESHOLD, STANCES.sleepy.patience)).toBe(false);
    expect(provoked(20, 0.95, STANCES.sleepy.patience)).toBe(true);
  });
});

describe('the last stand (§7.3 completed, 1.4)', () => {
  /*
   * The defect this closes: `telegraphScale` made the desperate tier shorten the *wind-up*, but
   * 1.0 measured fleeing as the counter the fight is actually built on — so the tier escalated
   * the one threat a good player has already opted out of, and the regrow clock that *does*
   * reach a distant player never moved. The fight got calmest exactly when it should tighten.
   */
  it('shortens the regrow clock when the cat is cornered, and only then', () => {
    expect(regrowInterval(15000, 'desperate')).toBeLessThan(15000);
    expect(regrowInterval(15000, 'even')).toBe(15000);
  });

  it('leaves the bored tier alone — a sulking cat does less, not more', () => {
    // §7.3: the bored cat's tell is that it *does less*. A bored cat regrowing faster than an
    // even one would be doing more while pretending to sulk.
    expect(regrowInterval(15000, 'bored')).toBe(15000);
  });

  it('never gives sleepy a clock it was designed not to have', () => {
    // §9.3 calls sleepy "a gift, and rare enough to be a story". A gift with a clock is not one,
    // and 0 must survive the multiply rather than becoming a very fast clock.
    expect(STANCES.sleepy.regrowMs).toBe(0);
    expect(regrowInterval(0, 'desperate')).toBe(0);
  });

  it('is pressure, not a treadmill — the §9.4 floor is the binding constraint', () => {
    /*
     * The bound that matters, stated as arithmetic rather than trusted to the browser. §9.4
     * promises the bottom rung is winnable with no treats, and `arena8` section 4 measures it.
     * A player reclaims one claim per `SCRUB_MS` plus travel; if a cornered clock ticked faster
     * than that, the endgame would be unwinnable by positioning alone and the floor would fail.
     */
    for (const s of Object.keys(STANCES) as (keyof typeof STANCES)[]) {
      const base = STANCES[s].regrowMs;
      if (base === 0) continue;
      expect(regrowInterval(base, 'desperate'), s).toBeGreaterThan(SCRUB_MS);
    }
    // ...and it has to actually change something, or the tier is decorative again.
    expect(LAST_STAND_REGROW).toBeLessThan(0.85);
    expect(LAST_STAND_REGROW).toBeGreaterThan(0.3);
  });
});

describe('the sweep pays for itself (§9.3 vs §9.4, 1.4)', () => {
  /*
   * The defect this closes was found in a browser and is the reason `regrowInterval` takes a third
   * argument at all. §9.3's sweep took two claims on the beat and left the clock alone, which
   * raised siege's rate from 1 claim per 9000ms to 1.5 — and flee-and-scrub then plateaued at six
   * claims for ten straight exchanges, 0.167 claims/s of regrow against 0.164 of reclaiming. A
   * fight that can be neither won nor lost is worse than one that can be lost.
   *
   * The fix is arithmetic rather than tuning: the cat waits one interval per claim it took, so the
   * long-run rate is what 1.3 measured however the cadence is set. These tests are that invariant,
   * because it is the thing protecting §9.4's floor from §9.3's moment.
   */
  it('charges one interval per claim taken', () => {
    expect(regrowInterval(9000, 'even', 2)).toBe(2 * regrowInterval(9000, 'even', 1));
    expect(regrowInterval(9000, 'desperate', 2)).toBe(2 * regrowInterval(9000, 'desperate', 1));
  });

  it('defaults to one, so every caller that does not sweep is unchanged', () => {
    expect(regrowInterval(9000, 'even')).toBe(regrowInterval(9000, 'even', 1));
    // ...and a tick that took nothing still pays a full interval rather than none: a free retry
    // every frame is how a clock stops being a clock.
    expect(regrowInterval(9000, 'even', 0)).toBe(regrowInterval(9000, 'even', 1));
  });

  it('keeps siege’s long-run rate equal to a stance that never sweeps', () => {
    /*
     * The invariant stated the way the plateau disproved it: claims per millisecond over a whole
     * sweep cycle. `SIEGE_SWEEP_EVERY` sets the texture, and this says it cannot set the
     * difficulty — every cadence has to bill out to the same rate.
     */
    const base = STANCES.siege.regrowMs;
    const rate = (every: number) => {
      let claims = 0;
      let ms = 0;
      for (let tick = 1; tick <= every; tick++) {
        const took = tick % every === 0 ? 2 : 1;
        claims += took;
        ms += regrowInterval(base, 'even', took);
      }
      return claims / ms;
    };
    const plain = 1 / base;
    for (const every of [2, 3, 4]) expect(rate(every)).toBeCloseTo(plain, 10);
    expect(rate(SIEGE_SWEEP_EVERY)).toBeCloseTo(plain, 10);
  });

  it('still lets the last stand be the one thing that raises the rate', () => {
    // The sweep is rate-neutral; §7.3's cornered clock is not, and that asymmetry is the design.
    // Pressure comes from the mood the player *caused* by winning, never from the stance roll.
    expect(regrowInterval(9000, 'desperate', 2)).toBeLessThan(regrowInterval(9000, 'even', 2));
  });
});

describe('the counter — a second target for the throw (§5.4, 1.4)', () => {
  it('only lands during recovery, which is the whole design', () => {
    // §5.3 spends the telegraph teaching you to read a wind-up, and until 1.4 that reading
    // only bought a dodge. This gives the same tell a second use: it marks the punishable
    // moment. Any other phase must refuse, or "throw at the cat" becomes a spell.
    expect(swatLands('recover', 10)).toBe(true);
    for (const p of ['stalk', 'telegraph', 'leap', 'fetch', 'eat'] as const) {
      expect(swatLands(p, 10), p).toBe(false);
    }
  });

  it('has to be aimed', () => {
    expect(swatLands('recover', SWAT_RADIUS)).toBe(true);
    expect(swatLands('recover', SWAT_RADIUS + 1)).toBe(false);
  });

  it('is more forgiving than the cat’s own pounce, deliberately', () => {
    // The cat commits blind (§5.3) and gets the tighter radius; the player is throwing at a
    // stationary animal and paying a treat for the attempt.
    expect(SWAT_RADIUS).toBeGreaterThan(HIT_RADIUS);
  });

  it('buys most of a hold, never a guaranteed one', () => {
    /*
     * §3 rejects any addition that does not add a decision, so this must not dominate fleeing.
     * A stun long enough to guarantee a fresh claim from nothing would make the counter
     * strictly better than positioning; long enough to finish a hold already under way is a
     * trade. `RECOVER_MS + SWAT_STUN_MS` therefore straddles `SCRUB_MS`.
     */
    expect(RECOVER_MS + SWAT_STUN_MS).toBeGreaterThan(SCRUB_MS);
    expect(SWAT_STUN_MS).toBeLessThan(SCRUB_MS);
  });
});

describe('signature moves (§9.3, 1.4)', () => {
  it('takes the neighbour next door, so a sweep reads as a wall moving', () => {
    // `arena.order` is document order, so neighbouring indices are neighbouring page furniture.
    expect(sweepPartner(3, [3], 10)).toBe(4);
  });

  it('falls back to the other side when the next one is already held', () => {
    expect(sweepPartner(3, [3, 4], 10)).toBe(2);
  });

  it('reaches past a run of held claims rather than giving up at the first', () => {
    /*
     * Asserted as the *property*, because my first version of this hardcoded `6` and the
     * function correctly returned `1` — it expands outward from the seed and 1 is two steps
     * away where 6 is three. Both extend the wall (2 is already held, so taking 1 grows the
     * block {2,3,4,5} to {1..5}); the nearer one makes the tighter wall. What actually matters
     * is that it found a free index at all and grew the run, which is what this now says.
     */
    const taken = [3, 4, 5, 2];
    const got = sweepPartner(3, taken, 10);
    expect(taken).not.toContain(got);
    expect(got).toBeGreaterThanOrEqual(0);
    // contiguous with the block it is extending, on one side or the other
    expect(taken.includes(got - 1) || taken.includes(got + 1)).toBe(true);
  });

  it('reports no partner rather than inventing one, at the edges and when full', () => {
    expect(sweepPartner(0, [0], 1)).toBe(-1);
    expect(sweepPartner(2, [0, 1, 2, 3, 4], 5)).toBe(-1);
  });

  it('never returns the claim it was given, or anything out of bounds', () => {
    for (let i = 0; i < 12; i++) {
      const got = sweepPartner(i, [i], 12);
      expect(got, `i=${i}`).not.toBe(i);
      expect(got >= 0 && got < 12, `i=${i} → ${got}`).toBe(true);
    }
  });

  it('sweeps on a beat the player can learn, not every tick', () => {
    // Every tick is just a faster clock wearing a costume, and `regrowMs` already exists for
    // that. A beat can be anticipated, which is what makes it a signature rather than a rate.
    expect(SIEGE_SWEEP_EVERY).toBeGreaterThan(1);
  });

  it('pins for less than the reward the player buys with a feather', () => {
    // A punishment the player suffered should not out-last an effect they spent a treat on.
    expect(AMBUSH_PIN_MS).toBeLessThan(TREAT_SPECS.feather.anchorMs);
    expect(AMBUSH_PIN_PX).toBeGreaterThan(0);
  });

  it('doubles only a minority of feints, or the tell stops carrying information', () => {
    expect(TRICKSTER_DOUBLE).toBeLessThan(0.5);
    expect(STANCES.trickster.feint).toBeGreaterThan(0);
  });
});

describe('loadout (§9.5)', () => {
  const kinds = Object.keys(TREAT_SPECS);

  it('covers every treat the site can hide', () => {
    for (const t of TREATS) expect(kinds).toContain(t);
  });

  it('every treat buys at least one full scrub of immunity', () => {
    // §5.4's floor. A treat that cannot cover one hold is not a resource.
    for (const t of kinds) expect(treatSpec(t).immuneMs, t).toBeGreaterThanOrEqual(SCRUB_MS);
  });

  it('no treat is strictly best — the stated balance risk, as a test', () => {
    // §9.5: "if one treat is strictly best, players will tab-hunt for it and the site's
    // exploration incentive inverts". So for each treat there must be another that beats
    // it on some axis.
    const axes = (s: ReturnType<typeof treatSpec>) => [
      s.lureMs,
      s.immuneMs,
      s.anchorPx * s.anchorMs,
      s.telegraphMul,
      1 / s.slowMul,
      s.slowMs,
    ];
    for (const a of kinds) {
      const beaten = kinds.some((b) => {
        if (b === a) return false;
        const A = axes(treatSpec(a));
        const B = axes(treatSpec(b));
        return B.some((v, i) => v > A[i]!);
      });
      expect(beaten, `${a} is dominated by nothing`).toBe(true);
    }
  });

  it('the biscuit’s two clocks are what §9.5 actually describes', () => {
    // "shortest interrupt immunity but cat stays put longest" only makes sense as two
    // numbers: it can pounce again sooner, and it is stuck there far longer.
    const b = treatSpec('biscuit');
    expect(b.immuneMs).toBeLessThan(b.lureMs);
    expect(b.lureMs).toBe(Math.max(...kinds.map((k) => treatSpec(k).lureMs)));
    expect(b.immuneMs).toBe(Math.min(...kinds.map((k) => treatSpec(k).immuneMs)));
  });

  it('only the feather and the biscuit anchor it in place', () => {
    expect(kinds.filter((k) => treatSpec(k).anchorMs > 0).sort()).toEqual(['biscuit', 'feather']);
  });

  it('falls back to the plain treat for anything unknown', () => {
    expect(treatSpec('sardine')).toEqual(treatSpec('fish'));
  });
});

describe('the ending conditions', () => {
  it('is won when the cat holds nothing', () => {
    expect(isWon(0, 15)).toBe(true);
    expect(isWon(1, 15)).toBe(false);
  });

  it('is lost only when the cat has everything AND you have nothing to throw', () => {
    // §2 names both conditions. Territory at 100% with a treat in hand is a bad
    // position, not a loss — you can always dig out while you have ammo, which is what
    // keeps "spend it or save it" live to the end.
    expect(isLost(15, 15, 0)).toBe(true);
    expect(isLost(15, 15, 1)).toBe(false);
    expect(isLost(14, 15, 0)).toBe(false);
  });

  it('neither fires on a board with nothing to fight over', () => {
    expect(isWon(0, 0)).toBe(false);
    expect(isLost(0, 0, 0)).toBe(false);
  });
});

describe('the handicap ladder (§9.4)', () => {
  // Its own base state: the §8 block's is scoped to that describe, and reaching across would
  // couple two sets of tests through a shared literal.
  const base: FightState = {
    territory: 0.55,
    ammo: 2,
    spent: 0,
    freed: 0,
    interrupts: 0,
    idleMs: 0,
    staleMs: 0,
    collared: false,
    mood: 'even',
    rung: 0,
    found: 3,
  };

  it('rises on a win — that is the whole ratchet', () => {
    expect(nextRung(0, 'win', 5)).toBe(1);
    expect(nextRung(2, 'win', 5)).toBe(3);
  });

  it('eases back down on a loss, so nobody is stranded', () => {
    /*
     * §7.2: losing costs nothing permanent. A pure ratchet reads as a truer difficulty
     * setting, and it can leave somebody on a rung they beat once by luck — which is the one
     * thing this fight must never do to a reader.
     */
    expect(nextRung(3, 'lose', 5)).toBe(2);
    expect(nextRung(0, 'lose', 5)).toBe(LADDER_FLOOR);
  });

  it('ignores a truce, because an interruption is not a result', () => {
    expect(nextRung(2, 'truce', 5)).toBe(2);
    expect(nextRung(2, 'truce-recover', 5)).toBe(2);
    expect(nextRung(2, undefined, 5)).toBe(2);
  });

  it('never climbs past the treats you actually found', () => {
    // Otherwise the ladder would punish the exploration §9.5 rewards: a visitor who found two
    // treats could be handicapped three, i.e. handed a fight with negative ammo.
    expect(nextRung(2, 'win', 2)).toBe(2);
    expect(nextRung(0, 'win', 0)).toBe(0);
  });

  it('never goes below the floor', () => {
    expect(nextRung(LADDER_FLOOR, 'lose', 5)).toBe(LADDER_FLOOR);
    expect(nextRung(LADDER_FLOOR - 3, 'lose', 5)).toBe(LADDER_FLOOR);
  });

  it('bottoms out where §9.4 says it does', () => {
    // "Bottoms out at zero treats — a pure-skill fight for whoever wants it." A constant
    // rather than a literal because whether that fight is *winnable* is measured, not assumed.
    expect(LADDER_FLOOR).toBe(0);
  });

  it('hands out one fewer treat per rung', () => {
    expect(ammoCap(5, 0)).toBe(5);
    expect(ammoCap(5, 2)).toBe(3);
    expect(ammoCap(5, 5)).toBe(0);
  });

  it('never returns a negative cap, however the two disagree', () => {
    // Read straight into a loop that withholds paws from the end of a list; a negative count
    // there would slice from the wrong end and withhold the ones it meant to keep.
    expect(ammoCap(2, 5)).toBe(0);
    expect(ammoCap(0, 3)).toBe(0);
    expect(ammoCap(3, -2)).toBe(3);
  });

  it('still offers the rematch when the win was clean', () => {
    /*
     * The bug this pins, found in a browser and not here. Winning without spending a treat is
     * the *commonest* way a good player wins — the flee-and-scrub counter needs no treats — and
     * `win-clean` sat directly above `win-again`, so §9.4's offer was suppressed for exactly
     * the visitor most likely to want the next rung. The clean line now carries the question.
     */
    const clean = { ...base, ending: 'win' as const, spent: 0, freed: 5, rung: 0, found: 3 };
    expect(pickLine(clean)).toBe('win-clean');
    expect(lineText('win-clean')).toMatch(/again/);
  });

  it('always says something as a handicapped fight opens, however the rung was reached', () => {
    // `win-both` and `win-floor` can both outrank the offer, so a visitor can arrive at a
    // harder fight without having been asked. The opening line is the reliable channel, and
    // must therefore not claim they agreed to anything.
    expect(lineText('rung-open')).not.toMatch(/asked|agreed/);
    expect(pickLine({ ...base, rung: 1, freed: 0, spent: 0 })).toBe('rung-open');
  });

  it('offers a rematch on a win, and stops offering at the top', () => {
    const won = (rung: number, found: number): FightState => ({
      ...base,
      territory: 0,
      ammo: 0,
      spent: 1,
      freed: 4,
      rung,
      found,
      ending: 'win',
    });
    expect(pickLine(won(0, 3))).toBe('win-again');
    expect(pickLine(won(2, 3))).toBe('win-again');
    // Every treat withheld and still beaten: the top of the ladder, and it outranks the collar.
    expect(pickLine(won(3, 3))).toBe('win-floor');
  });

  it('says something as a handicapped fight opens, and teaches a normal one', () => {
    // 1.3: a normal opening is no longer silent — the teach line is the whole fix. The
    // laddered opening still outranks it: explaining the withheld paw beats re-teaching
    // the verb to someone who has already fought.
    const opening = (rung: number) => ({ ...base, rung, freed: 0, spent: 0, territory: 0.55 });
    expect(pickLine(opening(1))).toBe('rung-open');
    // Whichever game it is — 2.6 gave the default its own teach line, so the check names both
    // rather than relying on whatever an unspecified state happens to mean this version.
    expect(pickLine(opening(0))).toBe('teach-swipe');
    expect(pickLine({ ...opening(0), manual: true })).toBe('teach-hold');
  });

  it('stops explaining the terms once the fight is actually under way', () => {
    // Gated on nothing having happened yet, or the cat would keep explaining the terms.
    // (The dead-band filler below still fires at this territory — that is a different line.)
    expect(pickLine({ ...base, rung: 1, freed: 1, spent: 0, territory: 0.55 })).not.toBe('rung-open');
  });

  it('hands a paw back on a loss without gloating about it', () => {
    expect(pickLine({ ...base, ending: 'lose', rung: 2 })).toBe('lose-rung');
    expect(pickLine({ ...base, ending: 'lose', rung: 0 })).toBe('lose');
  });
});

describe('the cat’s writing (§8)', () => {
  const base: FightState = {
    territory: 0.55,
    ammo: 0,
    spent: 0,
    freed: 0,
    interrupts: 0,
    idleMs: 0,
    staleMs: 0,
    collared: false,
    mood: 'even',
    rung: 0,
    found: 3,
  };

  it('never says more than seven words', () => {
    for (const l of LINES) {
      expect(l.text.split(/\s+/).length, l.id).toBeLessThanOrEqual(7);
    }
  });

  it('never shouts', () => {
    for (const l of LINES) expect(l.text, l.id).not.toContain('!');
  });

  it('stays lower-case — this cat does not use capitals', () => {
    for (const l of LINES) expect(l.text, l.id).toBe(l.text.toLowerCase());
  });

  it('has no duplicate ids or repeated lines', () => {
    expect(new Set(LINES.map((l) => l.id)).size).toBe(LINES.length);
    expect(new Set(LINES.map((l) => l.text)).size).toBe(LINES.length);
  });

  it('uses real apostrophes, since it sits in prose on a typographic page', () => {
    for (const l of LINES) expect(l.text, l.id).not.toContain("'");
  });

  it('teaches the verb at the opening — the first line a confused player ever hears', () => {
    /*
     * 1.3's whole reason to exist: the playtest's cold visitor opened a fight at territory
     * 0.55 with nothing freed and nothing spent, and the cat said *nothing* — the state sat
     * in the dead band between rattled-50 and bluff-75, so the first words the player ever
     * heard were support-idle's "you can stop any time." at 8 seconds. The opening is no
     * longer silent: the teach line fires there and only there.
     */
    // Each game teaches its own verb: the default is shoving the cat (§16), manual is holding a
    // claim (§3). Both are checked, because "the opening is not silent" is the claim and it has to
    // hold for whichever game the visitor met.
    expect(pickLine(base)).toBe('teach-swipe');
    expect(pickLine({ ...base, manual: true })).toBe('teach-hold');
    // ...and only there: once the player has done anything, the tutorial is done.
    for (const teach of ['teach-swipe', 'teach-hold']) {
      const g = teach === 'teach-hold' ? { manual: true } : {};
      expect(pickLine({ ...base, ...g, freed: 1 })).not.toBe(teach);
      expect(pickLine({ ...base, ...g, spent: 1 })).not.toBe(teach);
      expect(pickLine({ ...base, ...g, ending: 'truce' as const })).not.toBe(teach);
    }
  });

  it('does not hand the opening to support-idle — mercy is for someone who tried', () => {
    // The playtest's exact failure: idle > 8s used to fire "you can stop any time." to a
    // player who had not started. Re-gated so it only reads as mercy after an attempt —
    // and the teach line above it wins the opening even when the clock has run.
    expect(pickLine({ ...base, idleMs: 9000 })).toBe('teach-swipe');
    expect(pickLine({ ...base, idleMs: 9000, manual: true })).toBe('teach-hold');
    expect(pickLine({ ...base, idleMs: 9000, spent: 1, freed: 1 })).toBe('support-idle');
  });

  it('has no line that silence can hide behind — the dead band is filled', () => {
    /*
     * 1.3's inverse check. The 1.2 reachability sweep asked "is every line reachable" and
     * could not see the hole: every line was reachable, and the state space still had a gap
     * where a normal fight actually lives — territory 0.5–0.75 with nothing else due said
     * nothing. So this sweeps live states (no ending) and asserts none maps to silence.
     */
    const moods = ['bored', 'even', 'desperate'] as const;
    for (const territory of [0, 0.08, 0.15, 0.3, 0.45, 0.5, 0.51, 0.55, 0.6, 0.7, 0.74, 0.75, 0.8, 0.92, 1])
      for (const ammo of [0, 1, 3])
        for (const spent of [0, 1, 3])
          for (const interrupts of [0, 1, 2, 3])
            for (const idleMs of [0, 9000])
              for (const staleMs of [0, 25_000])
                for (const mood of moods)
                  for (const [rung, found] of [
                    [0, 0],
                    [0, 3],
                    [1, 3],
                    [3, 3],
                  ] as const) {
                    const id = pickLine({
                      territory,
                      ammo,
                      spent,
                      freed: spent,
                      interrupts,
                      idleMs,
                      staleMs,
                      collared: false,
                      mood,
                      rung,
                      found,
                    });
                    expect(id, `territory=${territory} ammo=${ammo} spent=${spent} interrupts=${interrupts} idle=${idleMs} stale=${staleMs} mood=${mood} rung=${rung}`).not.toBeNull();
                  }
  });

  it('puts endings above everything else', () => {
    // Territory 0.1 would otherwise fire `rattled-10`.
    expect(pickLine({ ...base, territory: 0.1, ending: 'win' })).toBe('win-clean');
    expect(pickLine({ ...base, territory: 1, ammo: 0, ending: 'lose' })).toBe('lose');
  });

  it('notices the collar on a win, because doing both is the point (§7.1)', () => {
    expect(pickLine({ ...base, ending: 'win', collared: true, spent: 2 })).toBe('win-both');
    /*
     * Changed in 1.0, and the new answer is the right one: an uncollared win with a rung still
     * to climb gets §9.4's offer rather than the generic sign-off. The collar still outranks
     * it — earning both paths is a bigger moment than a rematch.
     */
    expect(pickLine({ ...base, ending: 'win', collared: false, spent: 2 })).toBe('win-again');
  });

  it('keeps a plain win line for a visitor with no treats to be offered', () => {
    // The reachability check. With the ladder's offer above it, the only way to the generic
    // line is a fight where there was never anything to hold back.
    expect(pickLine({ ...base, ending: 'win', spent: 0, found: 0, rung: 0 })).toBe('win');
  });

  it('has a different truce line for running away mid-pounce', () => {
    expect(pickLine({ ...base, ending: 'truce' })).toBe('truce');
    expect(pickLine({ ...base, ending: 'truce-recover' })).toBe('truce-recover');
  });

  it('gets rattled as it loses ground, and bluffs while it is ahead', () => {
    expect(pickLine({ ...base, territory: 0.08 })).toBe('rattled-10');
    expect(pickLine({ ...base, territory: 0.45 })).toBe('rattled-50');
    // Ammo in hand and one already thrown: the player is still in the fight, so the cat
    // is free to gloat. Empty-handed, the kind lines take precedence — see below.
    expect(pickLine({ ...base, territory: 0.92, ammo: 1, spent: 1 })).toBe('bluff-90');
  });

  it('is kind rather than smug when the player has no way forward', () => {
    /*
     * The order these two sit in is the characterisation. A bluff-first table had the cat
     * saying "you are making this loud" to somebody with nothing left to try.
     *
     * The mood is computed rather than written in, and that is the point of doing it this
     * way: §8.2's lines gate on the tier now, and a test that hands them a hand-written
     * `mood` could happily assert behaviour for a state the fight can never produce.
     */
    const losing = { ...base, territory: 0.92, ammo: 0 };
    expect(mood(losing)).toBe('bored');
    expect(pickLine({ ...losing, mood: mood(losing) })).toBe('support-none');
    const losing2 = { ...base, territory: 0.8, ammo: 0 };
    expect(pickLine({ ...losing2, mood: mood(losing2) })).toBe('support-none');
  });

  it('saves the specific kind line for the player who spent everything', () => {
    // `support-last` is a subset of `support-none`, so it only reads as a priority if it
    // sits above it. Ordered the other way it was reachable only via repeat-suppression.
    const spent = { ...base, territory: 0.8, ammo: 0, spent: 3, freed: 2 };
    expect(pickLine({ ...spent, mood: mood(spent) })).toBe('support-last');
  });

  it('teaches the throw, which nothing else in the build does', () => {
    // §7.4 wants treats explained by the cat asking for one. Fires only when you have
    // something to throw and have not worked out that you could.
    expect(pickLine({ ...base, territory: 0.8, ammo: 2, spent: 0 })).toBe('support-bribe');
    // and not once you have already thrown one
    expect(pickLine({ ...base, territory: 0.8, ammo: 1, spent: 1 })).not.toBe('support-bribe');
  });


  it('does not say the same thing twice running', () => {
    const s = { ...base, territory: 0.08 };
    expect(pickLine(s)).toBe('rattled-10');
    expect(pickLine(s, 'rattled-10')).not.toBe('rattled-10');
  });

  it('will repeat an ending, because there is nothing after it', () => {
    expect(pickLine({ ...base, ending: 'truce' }, 'truce')).toBe('truce');
  });

  it('resolves every id to words', () => {
    for (const l of LINES) expect(lineText(l.id)).toBe(l.text);
    expect(lineText('nope')).toBe('');
  });

  /*
   * Every line has a state that reaches it — swept, not spot-checked.
   *
   * 1.0 shipped a line nobody could ever hear: §9.4's rematch offer went in above `win-clean`,
   * which catches the commonest good-player win, and the offer was never made to the visitor
   * most likely to want it. It was found in a browser, by winning a fight and reading the
   * ribbon. The tests around this one each assert *a* state maps to *a* line, which is the
   * wrong shape for catching a shadow: a line stops being reachable because of what sits above
   * it, and no test that names its own expected answer is looking at that.
   *
   * `pickLine` returns the first `when` that is true, so shadowing is a property of the whole
   * ordered table and only a sweep over the table can see it. This is not proof of coverage —
   * the grid is coarse and the state space is not — but any line that survives 170k-odd states
   * without once being chosen is either dead or gated on something the fight cannot produce,
   * and both are worth a red line.
   */
  /*
   * **A generous explicit timeout, because this test's runtime is a property of the machine.**
   * The grid is tens of thousands of `pickLine` calls by design — 1.4's note above explains why a
   * coarse one invents shadows — and it measured 4214ms against vitest's 5000ms default. That is a
   * test that passes alone and fails while a browser harness is running beside it, which is the
   * least useful kind of red line: it says nothing about the code and it teaches everybody to
   * re-run and shrug. Caught exactly that way, mid-2.0, with the fleet in the background.
   */
  it('has no line that nothing can reach — the shadowing check 1.0 needed', { timeout: 30_000 }, () => {
    const seen = new Set<string>();
    const endings = [undefined, 'win', 'lose', 'truce', 'truce-recover'] as const;
    const moods = ['bored', 'even', 'desperate'] as const;
    // Every axis a `when` reads has to vary, including down to nothing. A first attempt pinned
    // `idleMs` at 9000 across the whole grid, and `support-idle` — which sits above eleven
    // other lines — then shadowed all of them and the sweep accused the writing of what the
    // sweep was doing. A coarse grid does not just miss states; it invents shadows.
    for (const ending of endings)
      for (const territory of [0, 0.08, 0.15, 0.3, 0.45, 0.55, 0.6, 0.8, 0.92, 1])
        for (const ammo of [0, 1, 3])
          for (const spent of [0, 1, 3])
            for (const collared of [false, true])
              for (const mood of moods)
                for (const idleMs of [0, 9000])
                  for (const staleMs of [0, 25_000])
                    for (const interrupts of [0, 1, 2, 3])
                      // Its own axis, not derived from another. Tying it to `interrupts === 2`
                      // hid `bluff-misses`, which needs exactly that value — the same coupling
                      // mistake as pinning `staleMs`, one loop over.
                      for (const lastStand of [false, true])
                        for (const [rung, found] of [
                          [0, 0],
                          [0, 3],
                          [1, 3],
                          [3, 3],
                        ] as const) {
                        const id = pickLine({
                          territory,
                          ammo,
                          spent,
                          freed: spent,
                          interrupts,
                          idleMs,
                          staleMs,
                          collared,
                          mood,
                          rung,
                          found,
                          // 1.4: an *event* axis, so this sweep can reach an event line at all.
                          // It reported `last-stand` unreachable until it varied this, and was
                          // right to — a field it never sets is a branch it never takes.
                          lastStand,
                          ...(ending ? { ending } : {}),
                        });
                        if (id) seen.add(id);
                      }
    /*
     * §15's axes get their own pass (2.0), and the shape of this is the lesson rather than the code.
     *
     * A round beat and a mode are caused by things none of the axes above describe — the board
     * turning over, and which game the visitor chose — so they have to be varied, or the five lines
     * that depend on them are branches the sweep never takes. But folding them into the grid above
     * multiplies it eightfold for the sake of five lines, and it timed out at five seconds when I
     * did exactly that. Independent axes deserve an independent pass: 1.4 learned the first half of
     * this (`lastStand` derived from `interrupts` hid `bluff-misses`), and this is the other half.
     */
    for (const round of [undefined, 'clear', 'record', 'again'] as const)
      for (const manual of [false, true])
        for (const territory of [0, 0.55, 0.8])
          for (const ending of [undefined, 'win'] as const) {
            const id = pickLine({
              territory,
              ammo: 1,
              spent: 0,
              freed: 0,
              interrupts: 0,
              idleMs: 0,
              staleMs: 0,
              collared: false,
              mood: 'even',
              rung: 0,
              found: 1,
              lastStand: false,
              manual,
              ...(round ? { round } : {}),
              ...(ending ? { ending } : {}),
            });
            if (id) seen.add(id);
          }
    const unreachable = LINES.filter((l) => !seen.has(l.id)).map((l) => l.id);
    expect(unreachable, `unreachable: ${unreachable.join(', ')}`).toEqual([]);
  });

  /*
   * The sweep above cannot catch this, and 1.4 proved it by nearly shipping the bug.
   *
   * That sweep varies `mood` and `territory` **independently**, but the game *derives* one from
   * the other — `mood()` enters the desperate tier at territory ≤ 0.2. So a line gated on
   * `desperate` with no upper territory bound is reachable in the sweep's abstract state space
   * and, in play, wins every single time a deeper `rattled-*` line is due. 1.4's `last-stand`
   * was written exactly that way first, and would have silently killed `rattled-10`.
   *
   * This is the same defect as 1.0's `win-clean` shadowing the rematch offer: every line
   * reachable, every gate correct in isolation, and one branch that real play always takes. So
   * this sweep uses the **real** `mood()` rather than a free variable, which is the only way to
   * ask "what does a fight actually say".
   */
  it('has no line that only unreachable *combinations* can reach', { timeout: 30_000 }, () => {
    const seen = new Set<string>();
    for (const ending of [undefined, 'win', 'lose', 'truce', 'truce-recover'] as const)
      for (let t = 0; t <= 100; t++)
        for (const ammo of [0, 2])
          for (const spent of [0, 2])
            for (const freed of [0, 3])
              for (const collared of [false, true])
                // interrupts 2 exactly: `support-interrupts` fires at >=3 and sits *above*
                // `bluff-misses`, so 3 alone hides it. staleMs likewise — pinned at 0 the first
                // time, which reported `support-stale` dead when only the grid was.
                for (const interrupts of [0, 1, 2, 3])
                  for (const idleMs of [0, 9000])
                    for (const staleMs of [0, 25_000])
                    /*
                     * 2.0: §15's round beats, and they get their own loop for the reason 1.4
                     * learned the hard way when `lastStand: interrupts === 2` quietly hid
                     * `bluff-misses` — a field derived from another field is a field that cannot
                     * be varied. A round beat is caused by the *board turning over*, which none
                     * of the axes above describe, so it is independent of every one of them.
                     */
                    for (const round of [undefined, 'clear', 'record', 'again'] as const)
                    for (const [rung, found] of [
                      [0, 0],
                      [1, 3],
                      [3, 3],
                    ] as const) {
                      const territory = t / 100;
                      const partial = {
                        territory,
                        ammo,
                        spent,
                        freed,
                        interrupts,
                        idleMs,
                        staleMs,
                        collared,
                        rung,
                        found,
                        // the last stand is an event, so it has to be swept as one
                        lastStand: interrupts === 2 && t <= 20,
                        ...(ending ? { ending } : {}),
                      };
                      // mood is not a free variable in the game — it is a function of this state
                      const m = mood({ ...partial, mood: 'even' } as FightState);
                      const id = pickLine({ ...partial, mood: m } as FightState);
                      if (id) seen.add(id);
                    }
    /*
     * §15's axes get their own pass (2.0), and the shape of this is the lesson rather than the code.
     *
     * A round beat and a mode are caused by things none of the axes above describe — the board
     * turning over, and which game the visitor chose — so they have to be varied, or the five lines
     * that depend on them are branches the sweep never takes. But folding them into the grid above
     * multiplies it eightfold for the sake of five lines, and it timed out at five seconds when I
     * did exactly that. Independent axes deserve an independent pass: 1.4 learned the first half of
     * this (`lastStand` derived from `interrupts` hid `bluff-misses`), and this is the other half.
     */
    for (const round of [undefined, 'clear', 'record', 'again'] as const)
      for (const manual of [false, true])
        for (const territory of [0, 0.55, 0.8])
          for (const ending of [undefined, 'win'] as const) {
            const id = pickLine({
              territory,
              ammo: 1,
              spent: 0,
              freed: 0,
              interrupts: 0,
              idleMs: 0,
              staleMs: 0,
              collared: false,
              mood: 'even',
              rung: 0,
              found: 1,
              lastStand: false,
              manual,
              ...(round ? { round } : {}),
              ...(ending ? { ending } : {}),
            });
            if (id) seen.add(id);
          }
    const dead = LINES.filter((l) => !seen.has(l.id)).map((l) => l.id);
    expect(dead, `never said in a real fight: ${dead.join(', ')}`).toEqual([]);
  });
});

describe('dialogue pacing', () => {
  it('leaves silence between lines, so the cat is not narrating', () => {
    expect(LINE_GAP_MS).toBeGreaterThan(600);
  });

  it('holds a line long enough to read twice', () => {
    // Seven words at a slow reading pace is ~1.2s.
    expect(LINE_MS).toBeGreaterThan(2000);
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
