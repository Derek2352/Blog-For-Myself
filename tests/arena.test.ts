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

describe('auto-truce', () => {
  it('gives up sooner on a hidden tab than on a still pointer', () => {
    // A hidden tab means gone; a still pointer might be someone reading.
    expect(HIDDEN_TRUCE_MS).toBeLessThan(IDLE_TRUCE_MS);
  });

  it('is measured in seconds, not minutes — nobody returns mid-invasion', () => {
    expect(IDLE_TRUCE_MS).toBeLessThanOrEqual(60_000);
  });
});
