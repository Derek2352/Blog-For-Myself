import { describe, it, expect } from 'vitest';
import { resolveWash, HUE_WHEEL, isWarmHue, WARM_RANGE, WARM_WRAP } from '@/lib/wash';
import { categories } from '@/data/categories';

describe('resolveWash', () => {
  it('uses the declared hue when provided', () => {
    expect(resolveWash({ slug: 'competitions', hue: 12 })).toEqual({ hue: 12 });
  });

  it('falls back to a hue from the warm wheel when undeclared', () => {
    const { hue } = resolveWash({ slug: 'brand-new-tab' });
    expect(HUE_WHEEL).toContain(hue as (typeof HUE_WHEEL)[number]);
  });

  it('is deterministic — same slug always yields the same wash', () => {
    expect(resolveWash({ slug: 'music-and-sound' })).toEqual(resolveWash({ slug: 'music-and-sound' }));
  });

  it('never produces an undefined hue, even for slugs that hash large', () => {
    // a signed >> once made this negative, indexing off the end of the wheel
    for (const slug of ['a', 'zzzzzzzzzzzzzzzzzzzz', 'a-very-long-category-slug-indeed', '2026-summer']) {
      const { hue } = resolveWash({ slug });
      expect(typeof hue).toBe('number');
      expect(Number.isFinite(hue)).toBe(true);
    }
  });
});

describe('the warm band is actually enforced', () => {
  it('every hue on the fallback wheel is warm', () => {
    for (const hue of HUE_WHEEL) {
      expect(isWarmHue(hue), `wheel hue ${hue} is outside the warm band`).toBe(true);
    }
  });

  it('every declared category hue is warm', () => {
    // Guards the design decision: violet 285, cyan 195 and green 150 used to
    // ship here and put a cool cast on half the site. A future off-palette hue
    // should fail here rather than quietly reaching the page.
    for (const c of categories) {
      if (c.hue === undefined) continue;
      expect(isWarmHue(c.hue), `category "${c.slug}" hue ${c.hue} is outside the warm band`).toBe(true);
    }
  });

  it('rejects the cool hues that caused the problem', () => {
    for (const cool of [95, 150, 195, 222, 285]) expect(isWarmHue(cool)).toBe(false);
  });

  it('accepts amber through wine, including the wrap past 340', () => {
    for (const warm of [WARM_RANGE.min, 20, 32, 44, WARM_RANGE.max, WARM_WRAP.min, 350]) {
      expect(isWarmHue(warm)).toBe(true);
    }
  });
});
