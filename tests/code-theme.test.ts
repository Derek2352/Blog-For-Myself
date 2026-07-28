import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain .mjs helper, no types needed for a colour table
import { PAPER_PALETTE, TOKEN_ROLES, paperLight, paperDark } from '../plugins/shiki-paper-theme.mjs';

/**
 * The syntax themes exist because the bundled Shiki ones fail WCAG AA on this
 * site's surfaces — `github-light`'s keyword red measured 4.46:1 on cream and
 * `github-dark`'s comment grey 3.31:1 on the dark surface. That's easy to
 * reintroduce by "just picking a nicer colour", so the contrast requirement
 * lives here rather than in a comment.
 */

/** WCAG relative luminance — the real piecewise sRGB curve, not a gamma approximation. */
function luminance(hex: string): number {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('code block syntax theme', () => {
  // The blocks render at ~14.9px, which is normal text: AA wants 4.5:1.
  const AA_NORMAL = 4.5;

  for (const mode of ['light', 'dark'] as const) {
    describe(mode, () => {
      const palette = PAPER_PALETTE[mode];

      for (const role of TOKEN_ROLES) {
        it(`${role} tokens meet AA against the ${mode} surface`, () => {
          expect(contrast(palette[role], palette.surface)).toBeGreaterThanOrEqual(AA_NORMAL);
        });
      }
    });
  }

  it('sanity-checks itself against known WCAG values', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
  });

  it('catches the GitHub colours this replaced', () => {
    // the two measured failures, kept as a regression guard on the method
    expect(contrast('#D73A49', PAPER_PALETTE.light.surface)).toBeLessThan(AA_NORMAL);
    expect(contrast('#6A737D', PAPER_PALETTE.dark.surface)).toBeLessThan(AA_NORMAL);
  });

  it('ships a light and a dark theme Shiki can consume', () => {
    for (const theme of [paperLight, paperDark]) {
      expect(theme.name).toMatch(/^paper-/);
      expect(theme.settings.length).toBeGreaterThan(1);
      // first entry must carry the default foreground, or unscoped text is unstyled
      expect(theme.settings[0].settings.foreground).toBeTruthy();
    }
    expect(paperLight.type).toBe('light');
    expect(paperDark.type).toBe('dark');
  });
});
