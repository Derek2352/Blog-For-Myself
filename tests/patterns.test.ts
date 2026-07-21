import { describe, it, expect } from 'vitest';
import { resolveTexture, PATTERN_NAMES, HUE_WHEEL } from '@/lib/patterns';

describe('resolveTexture', () => {
  it('uses declared pattern + hue when provided', () => {
    const t = resolveTexture({ slug: 'competitions', pattern: 'hatch', hue: 8 });
    expect(t).toEqual({ pattern: 'hatch', hue: 8 });
  });

  it('falls back to a valid pattern + hue from the slug when undeclared', () => {
    const t = resolveTexture({ slug: 'brand-new-tab' });
    expect(PATTERN_NAMES).toContain(t.pattern);
    expect(HUE_WHEEL).toContain(t.hue as (typeof HUE_WHEEL)[number]);
  });

  it('is deterministic — same slug always yields the same texture', () => {
    const a = resolveTexture({ slug: 'music-and-sound' });
    const b = resolveTexture({ slug: 'music-and-sound' });
    expect(a).toEqual(b);
  });

  it('lets a declared value win even if only one is set', () => {
    const t = resolveTexture({ slug: 'x', pattern: 'waves' });
    expect(t.pattern).toBe('waves');
    expect(HUE_WHEEL).toContain(t.hue as (typeof HUE_WHEEL)[number]); // hue still hashed
  });
});
