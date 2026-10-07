import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import {
  darkOf,
  darkVector,
  isRenderedSVG,
  lightRenderOf,
  renderedFrom,
  sceneKey,
  vectorInside,
  vectorKey,
  wrapRender,
} from '../scripts/art-render.mjs';
import { isArtSVG, isPlateSVG, artTemplateOf } from '../scripts/cover-plate.mjs';
import { CAT_PARTS, catKey } from '../scripts/render-cat.mjs';
import sprite from '../src/assets/cat/sprite.json';

/**
 * The art is built in Blender now (art/blender/diorama.py, scripts/render-art.mjs). Rendering
 * needs Blender and minutes, so tests never render; they hold the *contract* — what a rendered
 * file must contain, that every drawing on the site has been rendered from the drawing it carries,
 * and that the dark palette is the dark theme's filter applied to colours.
 */
const ROOT = process.cwd();
const read = (f: string) => readFileSync(path.join(ROOT, f), 'utf8');

describe('the dark palette', () => {
  it('is the dark theme filter, computed on colours', () => {
    // The values global.css records for the filter on the plate's own colours.
    expect(darkOf([0x8e, 0x2f, 0x45])).toEqual([255, 164, 186]);
    const [r, g, b] = darkOf([232, 225, 216]); // hsl(32 24% 88%)-ish ground
    expect(Math.abs(r - 37) + Math.abs(g - 29) + Math.abs(b - 22)).toBeLessThan(12);
  });

  it('rewrites each colour exactly once', () => {
    /* Two chained passes (hsl → hex, then hex → dark) inverted every hsl() twice and the first dark
       renders came out light. A colour that went through twice would come back near its start. */
    const once = darkVector('<rect fill="hsl(26 18% 88%)" stroke="#8e2f45"/>');
    expect(once).toBe('<rect fill="#231d18" stroke="#ffa4ba"/>');
  });
});

describe('a rendered file', () => {
  const vector =
    '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000" role="img" data-cover-art="skyline">' +
    '<title>Concept illustration: a skyline.</title><rect width="1600" height="1000" fill="hsl(26 18% 88%)"/>' +
    '<text x="96" y="916" fill="hsl(26 22% 34%)">EDITORIAL CONCEPT</text></svg>';
  const light = Buffer.from('light-bytes');
  const dark = Buffer.from('dark-bytes');
  const svg = wrapRender({ vector, light, dark, transforms: [[1, 0, 0, 0.9, 4, 6]] });

  it('keeps every mark the drawing had, so the detectors answer as before', () => {
    expect(isRenderedSVG(svg)).toBe(true);
    expect(isArtSVG(svg)).toBe(true);
    expect(artTemplateOf(svg)).toBe('skyline');
    expect(svg).toContain('<title>Concept illustration: a skyline.</title>');
    expect(svg).toContain('viewBox="0 0 1600 1000"');
  });

  it('carries the drawing it was made from, and says which', () => {
    expect(vectorInside(svg)).toBe(vector);
    expect(renderedFrom(svg)).toBe(vectorKey(vector));
  });

  it('holds both themes and hands the light one to the share cards', () => {
    expect(lightRenderOf(svg)?.toString()).toBe('light-bytes');
    expect(svg).toMatch(/@media \(prefers-color-scheme:dark\)/);
    // Text from the drawing is carried over only when asked; covers drop it (the scene letters
    // its own location).
    expect(svg.match(/EDITORIAL CONCEPT/g)).toHaveLength(2);
    expect(svg).toContain('matrix(1 0 0 0.9 4 6)');
    const bare = wrapRender({ vector, light, dark, key: 'abc123', title: 'A still life.', texts: false });
    expect(bare).not.toContain('EDITORIAL CONCEPT');
    expect(bare).toContain('<title>A still life.</title>');
    expect(renderedFrom(bare)).toBe('abc123');
  });

  it('keeps a plate a plate', () => {
    const plate = vector.replace(' data-cover-art="skyline"', '').replace('<rect', '<defs><pattern id="ledger"/></defs><rect');
    const wrapped = wrapRender({ vector: plate, light, dark });
    expect(isPlateSVG(wrapped)).toBe(true);
    expect(isArtSVG(wrapped)).toBe(false);
  });
});

describe('every drawing on the site', () => {
  const entries = path.join(ROOT, 'src/content/entries');
  // Every cover that draws art, and the portrait slot. (Gallery placeholders are not art: they wait
  // for screenshots, and stay flat so they read as what they are.)
  const files = readdirSync(entries)
    .filter((slug) => existsSync(path.join(entries, slug, 'index.md')) && /^art:/m.test(readFileSync(path.join(entries, slug, 'index.md'), 'utf8')))
    .map((slug) => path.join(entries, slug, 'images', 'cover.svg'))
    .concat(path.join(ROOT, 'src/assets/portrait.svg'));

  it('is rendered, from the drawing it carries and the current scene builder', () => {
    const scenes = read('art/blender/scenes.py');
    /* A drawing changed by `npm run covers` goes back to vector until `npm run art` builds it
       again — which this catches, as does a render whose recorded source has been edited by hand. */
    for (const f of files) {
      const svg = readFileSync(f, 'utf8');
      const rel = path.relative(ROOT, f);
      expect(isRenderedSVG(svg), `${rel} — run npm run art`).toBe(true);
      const vector = vectorInside(svg);
      expect(vector, rel).not.toBeNull();
      expect(renderedFrom(svg), `${rel} — run npm run art`).toBe(sceneKey(vector!, scenes));
    }
  });

  it('draws the template its entry asks for', () => {
    for (const slug of readdirSync(entries)) {
      const md = path.join(entries, slug, 'index.md');
      if (!existsSync(md)) continue;
      const asked = /^art:\s*"([^"]+)"/m.exec(readFileSync(md, 'utf8'))?.[1];
      if (!asked) continue;
      const svg = readFileSync(path.join(entries, slug, 'images', 'cover.svg'), 'utf8');
      expect(artTemplateOf(vectorInside(svg) ?? svg), slug).toBe(asked);
    }
  });
});

describe('the cat', () => {
  it('has a shaded sheet per theme covering all nine parts', () => {
    expect(Object.keys(sprite.rects).sort()).toEqual(Object.keys(CAT_PARTS).sort());
    for (const t of ['light', 'dark']) expect(existsSync(path.join(ROOT, `src/assets/cat/cat-${t}.webp`))).toBe(true);
    for (const [x, y, w, h] of Object.values(sprite.rects)) {
      expect(x + w).toBeLessThanOrEqual(sprite.width);
      expect(y + h).toBeLessThanOrEqual(sprite.height);
    }
  });

  it('was rendered from the outlines, inks and renderer it is shown with', () => {
    expect(sprite.key, 'run npm run art').toBe(catKey());
  });

  it('is filled with its shading in both cat drawings, part by part', () => {
    for (const f of ['src/app/_chrome/SiteCat.tsx', 'src/app/_chrome/CatCard.tsx']) {
      const src = read(f);
      for (const part of ['tail', 'body', 'head', 'ear-far', 'ear-near']) expect(src, `${f} ${part}`).toContain(`catFill('${part}')`);
      expect(src, f).toContain('catFill(`leg-${i}` as CatPart)');
    }
  });
});

describe('the app icons', () => {
  it('were rendered from the current favicon and renderer', () => {
    const key = vectorKey(read('public/favicon.svg') + read('art/blender/diorama.py'));
    expect(read('art/icon.key').trim(), 'run npm run art').toBe(key);
  });
});
