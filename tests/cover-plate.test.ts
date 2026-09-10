import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  isGeneratedPlate,
  isCoverArt,
  isPlateAsset,
  drawnCounts,
} from '@/lib/cover-plate';
import { entrySchema } from '@/lib/content-schema';
import { ART_NAMES } from '../scripts/cover-art.mjs';

/**
 * The guard on a detector that answers about nothing.
 *
 * `src/lib/cover-plate.ts` used to read the covers with two `import.meta.glob(…, { eager: true })`
 * calls. That is the right answer under Astro and is **not an answer at all under Next**, which does
 * not implement the Vite API and evaluates it to `{}`. So from the cutover until the day an
 * illustration landed, both sets were empty, every call returned `false`, `data-plate` was written
 * onto nothing, and every drawn cover on the site glowed out of the dark theme — the exact bug that
 * rule had been written to fix, silently restored.
 *
 * Nothing went red. The build was clean, the types were right (`Record<string, string>` describes an
 * empty object perfectly well), and every unit test passed, because the tests all asked *"does the
 * detector recognise this string?"* — a question about the pure function, which was never broken.
 *
 * The tests below ask the other question: **is it looking at anything?** A count is the only shape
 * of assertion that catches this, because the failure was not a wrong answer.
 */
describe('the cover detectors are reading the repository', () => {
  const counts = drawnCounts();
  const entryDirs = readdirSync(path.join(process.cwd(), 'src', 'content', 'entries'), {
    withFileTypes: true,
  })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  it('finds drawn covers at all', () => {
    // Not "some number I wrote down": every entry with a `cover.svg` on disk has to be sorted into
    // exactly one of the two sets, so the expected total is derived from the tree and the assertion
    // survives entries being added, removed, or given real photographs.
    const withSvgCover = entryDirs.filter((id) => {
      try {
        readFileSync(path.join(process.cwd(), 'src', 'content', 'entries', id, 'images', 'cover.svg'));
        return true;
      } catch {
        return false;
      }
    });
    expect(withSvgCover.length).toBeGreaterThan(0);
    expect(counts.plates + counts.art).toBe(withSvgCover.length);
  });

  it('finds the portrait plate on the about page', () => {
    expect(counts.assetPlates).toBeGreaterThan(0);
    expect(isPlateAsset('portrait.svg')).toBe(true);
  });

  it('says no to a name that is not an entry', () => {
    // The other half of "is it looking at anything": a set that answered `true` to everything would
    // pass the counts above and invert every photograph on the site.
    expect(isGeneratedPlate('not-an-entry')).toBe(false);
    expect(isCoverArt('not-an-entry')).toBe(false);
    expect(isPlateAsset('portrait.jpg')).toBe(false);
  });

  it('never calls one cover both a plate and an illustration', () => {
    for (const id of entryDirs) {
      expect(isGeneratedPlate(id) && isCoverArt(id)).toBe(false);
    }
  });

  it('agrees with the frontmatter that asked for a drawing', () => {
    // The two are allowed to disagree — that is the whole point of reading the file, and the day a
    // photograph lands over an illustration they must. What may not happen is an entry asking for
    // art, `npm run covers` having been run, and the file still being a plate: that is the pipeline
    // being out of date, and it ships a cropped placeholder with a credit line missing.
    for (const id of entryDirs) {
      const md = readFileSync(
        path.join(process.cwd(), 'src', 'content', 'entries', id, 'index.md'),
        'utf8',
      );
      const asked = /^art:\s*"([^"]+)"/m.exec(md)?.[1];
      if (!asked) continue;
      expect(ART_NAMES).toContain(asked);
      expect(isCoverArt(id)).toBe(true);
    }
  });
});

/**
 * `art:` is validated against the registry rather than left free-form, for the same reason
 * `category` is: a name nothing answers to would build, publish, and draw a placeholder, with
 * nothing anywhere going red.
 */
describe('the art field', () => {
  const schema = entrySchema(z.string());
  const base = {
    title: 'T',
    category: 'competitions',
    date: '2026-01-01',
    summary: 'S',
    cover: './images/cover.svg',
  };

  it('is optional', () => {
    expect(schema.safeParse(base).success).toBe(true);
  });

  it('accepts every name the registry has', () => {
    for (const name of ART_NAMES) {
      expect(schema.safeParse({ ...base, art: name }).success).toBe(true);
    }
  });

  it('rejects a template that does not exist, and names the ones that do', () => {
    const bad = schema.safeParse({ ...base, art: 'split-the-bill' });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues[0].message).toContain(ART_NAMES[0]);
    }
  });
});
