import { describe, it, expect } from 'vitest';
import {
  TREATS,
  LEVELS,
  MAX_LEVEL,
  resolveTreat,
  levelFor,
  levelName,
  captionFor,
  tallyFor,
  isComplete,
} from '@/lib/cat-game';
import { categories } from '@/data/categories';

describe('resolveTreat', () => {
  it('always returns a treat from the wheel', () => {
    for (const c of categories) {
      expect(TREATS).toContain(resolveTreat(c.slug));
    }
  });

  it('is deterministic — a tab hides the same treat every time', () => {
    expect(resolveTreat('competitions')).toBe(resolveTreat('competitions'));
    expect(resolveTreat('leisure-time')).toBe(resolveTreat('leisure-time'));
  });

  it('never returns undefined, including for slugs that hash large', () => {
    for (const slug of ['a', '', 'zzzzzzzzzzzzzzzzzzzzzzzz', 'a-very-long-category-slug', '2026-summer']) {
      expect(TREATS).toContain(resolveTreat(slug));
    }
  });

  it('spreads across the wheel rather than collapsing onto one shape', () => {
    const seen = new Set(
      ['competitions', 'creative-ai', 'study-trips', 'experience', 'leadership', 'community'].map(resolveTreat),
    );
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('levelFor', () => {
  it('starts at nothing', () => {
    expect(levelFor(0, 6)).toBe(0);
  });

  it('tops out only when everything is found', () => {
    expect(levelFor(6, 6)).toBe(MAX_LEVEL);
    expect(levelFor(5, 6)).toBeLessThan(MAX_LEVEL);
  });

  it('never decreases as more is found', () => {
    for (const total of [1, 3, 6, 8, 12]) {
      let prev = -1;
      for (let found = 0; found <= total; found++) {
        const lv = levelFor(found, total);
        expect(lv).toBeGreaterThanOrEqual(prev);
        prev = lv;
      }
    }
  });

  it('scales to totals other than six, so a new tab cannot strand the top rung', () => {
    // publishing a 7th or 8th category must still be completable, and must not
    // hand out a level beyond the ladder
    for (const total of [1, 2, 5, 7, 9, 20]) {
      expect(levelFor(total, total)).toBe(MAX_LEVEL);
      expect(levelFor(Math.floor(total / 2), total)).toBeLessThanOrEqual(MAX_LEVEL);
    }
  });

  it('returns 0 rather than NaN when there is nothing to collect', () => {
    // an all-empty site: every category filtered out of the tab bar
    expect(levelFor(0, 0)).toBe(0);
    expect(Number.isNaN(levelFor(0, 0))).toBe(false);
    expect(levelFor(3, 0)).toBe(0);
  });

  it('clamps a found count above the total', () => {
    expect(levelFor(99, 6)).toBe(MAX_LEVEL);
  });

  it('never returns an index outside the ladder', () => {
    for (const [f, t] of [[0, 0], [1, 1], [3, 6], [7, 6], [-2, 6], [4, 9]] as const) {
      const lv = levelFor(f, t);
      expect(lv).toBeGreaterThanOrEqual(0);
      expect(lv).toBeLessThanOrEqual(MAX_LEVEL);
      expect(LEVELS[lv]).toBeTypeOf('string');
    }
  });
});

describe('levelName / captionFor', () => {
  it('names the extremes', () => {
    expect(levelName(0, 6)).toBe('keeping its distance');
    expect(levelName(6, 6)).toBe('yours');
  });

  it('formats the caption', () => {
    expect(captionFor(3, 6)).toBe(`3 / 6 · ${levelName(3, 6)}`);
    expect(captionFor(0, 6)).toBe('0 / 6 · keeping its distance');
    expect(captionFor(6, 6)).toBe('6 / 6 · yours');
  });

  it('does not print more found than exist', () => {
    expect(captionFor(9, 6)).toBe('6 / 6 · yours');
  });
});

describe('tallyFor', () => {
  it('names what the dots are counting', () => {
    // the whole reason this exists: paws alone said nothing
    expect(tallyFor(2, 7)).toContain('treats');
  });

  it('reads as a tally at both ends', () => {
    expect(tallyFor(0, 7)).toBe('0 / 7 treats');
    expect(tallyFor(7, 7)).toBe('7 / 7 treats');
  });

  it('clamps rather than printing nonsense', () => {
    expect(tallyFor(9, 6)).toBe('6 / 6 treats');
    expect(tallyFor(-3, 6)).toBe('0 / 6 treats');
    expect(tallyFor(1, -2)).toBe('0 / 0 treats');
  });

  it('survives a site with nothing to collect', () => {
    expect(tallyFor(0, 0)).toBe('0 / 0 treats');
  });
});

describe('isComplete', () => {
  it('is true only when all treats are found', () => {
    expect(isComplete(6, 6)).toBe(true);
    expect(isComplete(5, 6)).toBe(false);
  });

  it('is false on a site with nothing to collect', () => {
    expect(isComplete(0, 0)).toBe(false);
  });
});
