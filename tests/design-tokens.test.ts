/**
 * The design system's promises, checked on every build.
 *
 * src/design/tokens.mjs makes four claims that matter more than any one value in it: the CSS the site
 * ships is the CSS it describes; every colour is one a screen can show exactly; its ramps behave like
 * ramps; and every pairing of text and ground the site sets can be read, in both themes. Each of those
 * fails quietly when it fails — a stale stylesheet looks fine, a sub-AA grey looks "subtle" — so each
 * is a test rather than a habit. A fifth pins the identity: the handful of colours the site is
 * recognised by stay exactly what they were, so a refactor of the system cannot re-brand it by accident.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as T from '../src/design/tokens.mjs';
import { contrast, hexToOklch, inGamut, oklchToHex } from '../src/design/color.mjs';
import { render } from '../scripts/build-tokens.mjs';

type Lch = [number, number, number];
const ramps = T.RAMPS as unknown as Record<string, Record<string, Lch>>;
const themes = T.THEMES as unknown as Record<'light' | 'dark', Record<string, string>>;
const pairs = T.PAIRS as unknown as [string, string, keyof typeof T.LEVELS][];

describe('the design tokens', () => {
  it('ship exactly as described — src/styles/tokens.css is generated and current', () => {
    expect(readFileSync('src/styles/tokens.css', 'utf8'), 'run `npm run tokens`').toBe(render());
  });

  it('are all inside sRGB, so the hex shipped is the colour designed', () => {
    const out: string[] = [];
    for (const [name, ramp] of Object.entries(ramps))
      for (const [step, lch] of Object.entries(ramp)) if (!inGamut(lch)) out.push(`${name}.${step}`);
    expect(out).toEqual([]);
  });

  it('step down in lightness along every ramp, with no two steps the same', () => {
    for (const [name, ramp] of Object.entries(ramps)) {
      const L = Object.values(ramp).map((c) => c[0]);
      for (let i = 1; i < L.length; i++) expect(L[i], `${name} step ${i}`).toBeLessThan(L[i - 1]);
    }
  });

  it('give every role a value in both themes, and only roles that are documented', () => {
    const roles = Object.keys(T.ROLES).sort();
    expect(Object.keys(themes.light).sort()).toEqual(roles);
    expect(Object.keys(themes.dark).sort()).toEqual(roles);
    for (const theme of ['light', 'dark'] as const)
      for (const ref of Object.values(themes[theme])) expect(() => T.resolve(ref), ref).not.toThrow();
  });

  for (const theme of ['light', 'dark'] as const) {
    it(`meet the contrast every pairing needs in the ${theme} theme`, () => {
      const short: string[] = [];
      for (const [fg, bg, level] of pairs) {
        const r = contrast(T.resolve(themes[theme][fg]), T.resolve(themes[theme][bg]));
        if (r < T.LEVELS[level]) short.push(`${fg} on ${bg}: ${r.toFixed(2)} < ${T.LEVELS[level]}`);
      }
      expect(short).toEqual([]);
    });
  }

  /*
   * The colours the site is recognised by. These are the values it shipped with before the system
   * existed, and they are pinned here so that a change to them is a decision someone makes in this
   * file, in a diff, rather than a side effect of re-tuning a ramp.
   */
  it('keep the identity: paper, ink, the ledger wine, amber and sage are what they always were', () => {
    const hex = (theme: 'light' | 'dark', role: string) => oklchToHex(T.resolve(themes[theme][role]));
    expect({
      ground: hex('light', 'ground'),
      surface: hex('light', 'surface'),
      ink: hex('light', 'ink'),
      muted: hex('light', 'muted'),
      line: hex('light', 'line'),
      accent: hex('light', 'accent'),
      signal: hex('light', 'signal'),
      secondary: hex('light', 'secondary'),
    }).toEqual({
      ground: '#f9f4ea',
      surface: '#fffcf5',
      ink: '#2a241e',
      muted: '#6e6257',
      line: '#e8e0d2',
      accent: '#8e2f45',
      signal: '#e8a13a',
      secondary: '#647554',
    });
  });

  /*
   * Carried over from tests/palette.test.ts, which this file replaced. `--color-secondary` was
   * adopted from the uploaded Next.js drops, which proposed `#697b58` — 4.19:1 on this ground: fine
   * for a border or a dot, below AA for text. It ships two percent darker for that reason, and the
   * reason is the kind that gets lost: someone comparing against the drop later will see a value that
   * "isn't the one from the design" and helpfully change it back. If a future ground makes `#697b58`
   * pass, delete this — deliberately, having looked.
   */
  it('records why taxonomy’s sage is not the green the drops proposed', () => {
    const ground = T.resolve(themes.light.ground);
    expect(contrast(hexToOklch('#697b58'), ground)).toBeLessThan(T.LEVELS.text);
    expect(contrast(T.resolve(themes.light.secondary), ground)).toBeGreaterThanOrEqual(T.LEVELS.text);
  });
});

describe('the colour arithmetic', () => {
  it('round-trips sRGB through OKLCH', () => {
    for (const hex of ['#f9f4ea', '#2a241e', '#8e2f45', '#e8a13a', '#647554', '#000000', '#ffffff'])
      expect(oklchToHex(hexToOklch(hex))).toBe(hex);
  });

  it('measures contrast the way WCAG defines it', () => {
    expect(contrast([0, 0, 0], [1, 0, 0])).toBeCloseTo(21, 5);
    expect(contrast([0.5, 0, 0], [0.5, 0, 0])).toBe(1);
  });
});
