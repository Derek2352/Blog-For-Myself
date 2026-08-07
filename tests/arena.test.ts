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
    // unreadable. The board is 55% claimed, so the floor has to leave 4+ claims.
    expect(MIN_BOARD * INITIAL_CLAIM_FRACTION).toBeGreaterThanOrEqual(4);
    expect(MAX_BOARD).toBeLessThanOrEqual(20);
    expect(MIN_BOARD).toBeLessThanOrEqual(MAX_BOARD);
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
    const claims = [11, 10, 11, 10, 11, 10];
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

  it('gives exactly one stance a regrowing board and one a floor it will not leave', () => {
    expect(all.filter((s) => STANCES[s].regrowMs > 0)).toEqual(['siege']);
    expect(all.filter((s) => STANCES[s].pin)).toEqual(['siege']);
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

  it('says nothing at all when nothing is happening', () => {
    expect(pickLine(base)).toBe(null);
  });

  it('puts endings above everything else', () => {
    // Territory 0.1 would otherwise fire `rattled-10`.
    expect(pickLine({ ...base, territory: 0.1, ending: 'win' })).toBe('win-clean');
    expect(pickLine({ ...base, territory: 1, ammo: 0, ending: 'lose' })).toBe('lose');
  });

  it('notices the collar on a win, because doing both is the point (§7.1)', () => {
    expect(pickLine({ ...base, ending: 'win', collared: true, spent: 2 })).toBe('win-both');
    expect(pickLine({ ...base, ending: 'win', collared: false, spent: 2 })).toBe('win');
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
