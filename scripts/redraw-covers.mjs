#!/usr/bin/env node
/**
 * npm run covers — redraw every *placeholder* cover from its entry's category hue.
 *
 * `placeholderSVG` is applied once, when an entry is created, so a change to it
 * leaves every existing plate on the old design. This is the catch-up pass, and it
 * is committed rather than thrown away because the generator will change again —
 * the first time it did, twenty-four files silently disagreed with it.
 *
 * **It never touches a real photograph.** The test is for the marker the generator
 * leaves in its own output, not for the filename: an entry whose `cover.svg` is a
 * genuine drawing keeps it.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { placeholderSVG, loadCategories, categoryHue } from './lib.mjs';
import { isPlateSVG } from './cover-plate.mjs';

const ROOT = fileURLToPath(new URL('../src/content/entries/', import.meta.url));
const { cats } = await loadCategories();
const dirs = (await readdir(ROOT, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);

let done = 0, skipped = 0;
for (const slug of dirs) {
  const md = join(ROOT, slug, 'index.md');
  const cover = join(ROOT, slug, 'images', 'cover.svg');
  if (!existsSync(cover)) { skipped++; continue; }
  const existing = await readFile(cover, 'utf8');
  /*
   * The fingerprint moved to `cover-plate.mjs` when the site needed the same answer for its dark
   * theme. It used to be a regex literal here, and the reason it is not one any more is the reason
   * the comment beside it gives: a second copy of the string is a second answer to one question.
   */
  if (!isPlateSVG(existing)) {
    console.log(`  keep  ${slug} (not a generated placeholder)`);
    skipped++;
    continue;
  }
  const category = (await readFile(md, 'utf8')).match(/^category:\s*"([^"]+)"/m)?.[1];
  const hue = categoryHue(cats, category);
  await writeFile(cover, placeholderSVG({ seed: slug, hue }));
  console.log(`  redraw ${slug.padEnd(42)} ${String(category).padEnd(14)} hue ${hue ?? '(hashed)'}`);
  done++;
}
console.log(`\nredrew ${done}, left alone ${skipped}`);
