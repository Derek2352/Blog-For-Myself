#!/usr/bin/env node
/**
 * npm run covers — redraw every *placeholder* cover from its entry's category hue,
 * and the about page's portrait plate along with them.
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
/*
 * The portrait on `/about/` is the same kind of object and now lives under the same rule.
 *
 * It used to be a hand-written SVG of its own: a near-black rectangle reading PORTRAIT above
 * REPLACE ME. That is a note to the author displayed to the audience, and it was the highest
 * contrast shape on an otherwise pale page — the one thing the eye went to on the page whose
 * whole job is a first impression. It also had nothing to do with the twenty-four plates it sat
 * beside, so it never inherited the dark-theme filter and never would have.
 *
 * Drawing it from `placeholderSVG` fixes all three at once: it becomes light sand in the site's
 * own hand, it carries `PLATE_MARK` so `[data-plate]` reaches it in the dark, and it says nothing
 * — which is what the covers do, and why they read as deliberate rather than unfinished. The
 * honest admission stays in the `alt` text on `about.astro`, where a reader who needs it gets it
 * and a visitor is not lectured about the author's TODO list.
 *
 * 4:5 because that is the frame a portrait photograph will arrive in, so the slot does not
 * change shape on the day it is replaced. Hue 32 is the `hue` `about.astro` passes to `Base`,
 * kept in step for the same reason category hues are: a plate that disagrees with its page is
 * visible, and a hardcoded number that agrees by luck is not.
 */
const PORTRAIT = fileURLToPath(new URL('../src/assets/portrait.svg', import.meta.url));
if (!existsSync(PORTRAIT)) {
  console.log('\n  keep  portrait.svg (no file — about.astro will fail its import first)');
} else if (!isPlateSVG(await readFile(PORTRAIT, 'utf8'))) {
  console.log('\n  keep  portrait.svg (a real portrait has landed)');
  skipped++;
} else {
  await writeFile(PORTRAIT, placeholderSVG({ seed: 'portrait', hue: 32, width: 900, height: 1125 }));
  console.log('\n  redraw portrait.svg'.padEnd(52) + 'about'.padEnd(14) + 'hue 32');
  done++;
}

console.log(`\nredrew ${done}, left alone ${skipped}`);
