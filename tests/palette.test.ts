import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The palette's contrast, asserted rather than trusted.
 *
 * `--color-secondary` was adopted from the uploaded Next.js drops, which proposed `#697b58`. That
 * value measures **4.19:1** against this site's ground — fine for a border or a dot, below AA for
 * text, and it would have been the only sub-AA colour in a palette whose others run 5.4 to 7.8.
 * It ships two percent darker for that reason, and the reason is the kind that gets lost: someone
 * comparing against the drop later will see a value that "isn't the one from the design" and
 * helpfully change it back.
 *
 * So the constraint is a test. Every colour the site uses *as text* is checked against the two
 * surfaces it can sit on, in both themes.
 */

const css = readFileSync(path.join(process.cwd(), 'src/styles/global.css'), 'utf8');

/** Read a token's value from a given block of the stylesheet. */
function token(name: string, occurrence = 0): string {
  const all = [...css.matchAll(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`, 'g'))];
  const hit = all[occurrence];
  if (!hit) throw new Error(`--${name} occurrence ${occurrence} not found in global.css`);
  return hit[1];
}

const luminance = (hex: string): number => {
  const h = hex.replace('#', '');
  const chan = [0, 2, 4]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * chan[0]! + 0.7152 * chan[1]! + 0.0722 * chan[2]!;
};

const contrast = (a: string, b: string): number => {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/** WCAG AA for normal-size text. */
const AA = 4.5;

describe('every text colour clears AA on the surfaces it sits on', () => {
  /* Occurrence 0 is the light `@theme` block; occurrence 1 is the dark override. */
  const light = {
    ground: token('color-ground'),
    surface: token('color-surface'),
    ink: token('color-ink'),
    muted: token('color-muted'),
    accent: token('color-accent'),
    signalText: token('color-signal-text'),
    secondary: token('color-secondary'),
  };
  const dark = {
    ground: token('color-ground', 1),
    surface: token('color-surface', 1),
    ink: token('color-ink', 1),
    muted: token('color-muted', 1),
    accent: token('color-accent', 1),
    secondary: token('color-secondary', 1),
  };

  for (const [name, value] of Object.entries(light)) {
    if (name === 'ground' || name === 'surface') continue;
    it(`light: --color-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)} on ground and surface`, () => {
      expect(contrast(value, light.ground), `${value} on ${light.ground}`).toBeGreaterThanOrEqual(AA);
      expect(contrast(value, light.surface), `${value} on ${light.surface}`).toBeGreaterThanOrEqual(AA);
    });
  }

  for (const [name, value] of Object.entries(dark)) {
    if (name === 'ground' || name === 'surface') continue;
    it(`dark: --color-${name} on ground and surface`, () => {
      expect(contrast(value, dark.ground), `${value} on ${dark.ground}`).toBeGreaterThanOrEqual(AA);
      expect(contrast(value, dark.surface), `${value} on ${dark.surface}`).toBeGreaterThanOrEqual(AA);
    });
  }

  /**
   * And the specific thing that would undo the adjustment: the drops' own value must still fail,
   * or this test has stopped meaning anything. If a future palette lightens the ground enough for
   * `#697b58` to pass, that is fine and this line should be deleted — deliberately, having looked.
   */
  it('records why the adopted green is not the one the drops proposed', () => {
    expect(contrast('#697b58', light.ground)).toBeLessThan(AA);
    expect(contrast(light.secondary, light.ground)).toBeGreaterThanOrEqual(AA);
  });
});
