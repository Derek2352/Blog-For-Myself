import { describe, it, expect } from 'vitest';
import { isPlaceholderCover, orientation } from '@/lib/images';
// @ts-expect-error — plain .mjs authoring helper
import { placeholderSVG } from '../scripts/lib.mjs';
import { isPlateSVG, PLATE_MARK } from '../scripts/cover-plate.mjs';

describe('orientation', () => {
  it('classifies wide / tall / square', () => {
    expect(orientation({ width: 1600, height: 1000 })).toBe('wide');
    expect(orientation({ width: 900, height: 1400 })).toBe('tall');
    expect(orientation({ width: 1000, height: 1000 })).toBe('square');
  });

  it('treats near-square within tolerance as square', () => {
    expect(orientation({ width: 1050, height: 1000 })).toBe('square'); // ratio 1.05
    expect(orientation({ width: 1000, height: 1050 })).toBe('square'); // ratio 0.95
  });

  it('flips to wide/tall past the 1.1 / 0.9 thresholds', () => {
    expect(orientation({ width: 1200, height: 1000 })).toBe('wide'); // 1.2
    expect(orientation({ width: 1000, height: 1200 })).toBe('tall'); // 0.83
  });
});

describe('isPlaceholderCover', () => {
  it('spots the generated SVG placeholder', () => {
    expect(isPlaceholderCover({ src: '/src/content/entries/x/images/cover.svg' })).toBe(true);
    expect(isPlaceholderCover({ src: '/_astro/cover.Bx7f2a.svg', format: 'svg' })).toBe(true);
  });

  it('leaves real photographs alone', () => {
    expect(isPlaceholderCover({ src: '/_astro/cover.Bx7f2a.jpg', format: 'jpg' })).toBe(false);
    expect(isPlaceholderCover({ src: '/_astro/cover.Bx7f2a.webp' })).toBe(false);
    // a filename that merely mentions svg is not one
    expect(isPlaceholderCover({ src: '/_astro/svg-poster.png' })).toBe(false);
  });

  it('ignores a query string on the built URL', () => {
    expect(isPlaceholderCover({ src: '/_image?href=cover.svg&w=800' })).toBe(false);
    expect(isPlaceholderCover({ src: '/images/cover.svg?v=2' })).toBe(true);
  });
});

/**
 * The generator and the detector, held to each other.
 *
 * `redraw-covers.mjs` shipped once with a detector that tested for the caption the same commit was
 * deleting: it reported "redrew 0, left alone 24" and read as a success. Nothing caught that but a
 * human re-reading the output. Now the plate the generator draws *today* has to be one the detector
 * recognises, and a redesign that drops the mark fails here instead of quietly un-recognising
 * twenty-four covers — which since the dark theme also means twenty-four lightboxes coming back.
 */
describe('the plate the generator draws', () => {
  it('carries the mark the detector looks for', () => {
    const svg = placeholderSVG({ seed: 'some-entry', hue: 32 });
    expect(svg).toContain(PLATE_MARK);
    expect(isPlateSVG(svg)).toBe(true);
  });

  it('carries it whatever the hue and seed do to the drawing', () => {
    // Hue and seed move every colour and the grid's pitch — neither may take the mark with them.
    // An omitted hue is the `resolveWash()` fallback path, a different branch.
    for (const seed of ['a', 'wuyishan-seven-day-exchange', '']) {
      for (const hue of [0, 350, undefined]) {
        expect(isPlateSVG(placeholderSVG({ seed, hue }))).toBe(true);
      }
    }
  });

  it('grounds every plate at the same lightness, whatever the seed', () => {
    // The seeded ±4-point lightness lift is gone, and this is the guard on it coming back.
    //
    // It was not deleted on taste. `scratchpad/plate-sink.mjs` measured all twenty-one built
    // plates against the dark surface token: the lift put eleven of them more than 8 points off
    // it on some channel and the worst 23, because the dark theme reaches the plate through
    // `invert(1) hue-rotate(180deg)` and a lift that is invisible against a 96% page ground is
    // very visible against a 12% one. The honest band left was 3 points wide, which is under the
    // step the axis needed to be perceptible at all.
    //
    // Asserted on the *string* rather than on a rendering, because that is where the decision
    // lives and a unit test that needed a browser would not run in this suite. The regex takes
    // any hue and any saturation: neither is what this test is about, and pinning them here
    // would make an unrelated palette change fail in a file named after the detector.
    const grounds = new Set(
      ['a', 'b', 'seed-three', 'wuyishan-seven-day-exchange', ''].map((seed) => {
        // `fill=` picks out the ground rect specifically. The grid and the frame are the same
        // `hsl()` shape but arrive as `stroke=`, and a bare `hsl(` match reads the grid's 34%
        // — which is what the first version of this test did, and it failed for the right
        // reason before it ever guarded anything.
        const m = placeholderSVG({ seed, hue: 32 }).match(/fill="hsl\(\d+ \d+% ([\d.]+)%\)"/);
        return m?.[1];
      }),
    );
    expect(grounds.size).toBe(1);
    expect([...grounds][0]).toBe('88');
  });

  it('does not answer for something that is not a plate', () => {
    expect(isPlateSVG('<svg xmlns="http://www.w3.org/2000/svg"><rect width="9" height="9"/></svg>')).toBe(false);
    expect(isPlateSVG('')).toBe(false);
  });
});
