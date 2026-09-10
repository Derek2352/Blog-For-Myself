#!/usr/bin/env node
/**
 * npm run covers — redraw every cover this project drew itself, from its entry's category hue, and
 * the about page's portrait plate along with them.
 *
 * A generator is applied once, when an entry is created, so a change to it leaves every existing
 * file on the old design. This is the catch-up pass, and it is committed rather than thrown away
 * because the generators will change again — the first time one did, twenty-four files silently
 * disagreed with it.
 *
 * **It never touches a real photograph.** The test is for the marks the generators leave in their
 * own output, not for the filename: an entry whose `cover.svg` is somebody's own drawing keeps it.
 *
 * Two generators now. `placeholderSVG` draws the plate — a slot held open for a photograph, which
 * is what twenty-three entries want. `coverArtSVG` draws an illustration, for the one entry whose
 * photograph is never arriving; `art:` in the frontmatter is how an entry asks for it, and which
 * one runs is decided per entry below.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { placeholderSVG, loadCategories, categoryHue } from './lib.mjs';
import { isPlateSVG, isArtSVG } from './cover-plate.mjs';
import { coverArtSVG } from './cover-art.mjs';

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
   * The fingerprints moved to `cover-plate.mjs` when the site needed the same answers for its dark
   * theme. They used to be regex literals here, and the reason they are not is the reason the
   * comment beside them gives: a second copy of the string is a second answer to one question.
   *
   * **Ours to redraw covers both kinds of drawing.** It was `isPlateSVG` alone until illustrations
   * existed, and leaving it that way would have made an illustration a one-shot: drawn once when
   * an entry was created, then frozen while every plate on the site moved on — which is the exact
   * failure this whole script exists to undo, restored in a new place.
   */
  if (!isPlateSVG(existing) && !isArtSVG(existing)) {
    console.log(`  keep  ${slug} (not a generated cover)`);
    skipped++;
    continue;
  }
  const front = await readFile(md, 'utf8');
  const category = front.match(/^category:\s*"([^"]+)"/m)?.[1];
  const hue = categoryHue(cats, category);
  /*
   * `art:` is read from the same frontmatter the hue is, by the same kind of line-anchored match,
   * and it is the *only* thing that decides which generator runs. Not the current file's contents:
   * an entry that has `art:` and is still wearing a plate has to be able to become the drawing, and
   * an entry whose `art:` was removed has to be able to go back to a plate. Reading the instruction
   * rather than the artefact is what makes both directions work from one pass.
   *
   * An unknown name throws out of `coverArtSVG` and takes the whole run with it. That is deliberate
   * — the schema rejects it too, so the only way to arrive here is a template deleted out from
   * under an entry, and the loud version of that is a stack trace at authoring time rather than a
   * cover that quietly reverts to a placeholder.
   */
  const art = front.match(/^art:\s*"([^"]+)"/m)?.[1];
  await writeFile(cover, art ? coverArtSVG({ template: art, hue }) : placeholderSVG({ seed: slug, hue }));
  console.log(
    `  ${art ? 'draw  ' : 'redraw'} ${slug.padEnd(42)} ${String(category).padEnd(14)} hue ${hue ?? '(hashed)'}${art ? `  art: ${art}` : ''}`,
  );
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
 * own hand, it carries `PLATE_MARK` so `[data-drawn]` reaches it in the dark, and it says nothing
 * — which is what the covers do, and why they read as deliberate rather than unfinished. The
 * honest admission stays in the `alt` text on the about page, where a reader who needs it gets it
 * and a visitor is not lectured about the author's TODO list.
 *
 * 4:5 because that is the frame a portrait photograph will arrive in, so the slot does not
 * change shape on the day it is replaced. Hue 32 is the `hue` the about page washes with,
 * kept in step for the same reason category hues are: a plate that disagrees with its page is
 * visible, and a hardcoded number that agrees by luck is not.
 */
const PORTRAIT = fileURLToPath(new URL('../src/assets/portrait.svg', import.meta.url));
if (!existsSync(PORTRAIT)) {
  console.log('\n  keep  portrait.svg (no file — the about page will fail its import first)');
} else if (!isPlateSVG(await readFile(PORTRAIT, 'utf8'))) {
  console.log('\n  keep  portrait.svg (a real portrait has landed)');
  skipped++;
} else {
  await writeFile(PORTRAIT, placeholderSVG({ seed: 'portrait', hue: 32, width: 900, height: 1125 }));
  console.log('\n  redraw portrait.svg'.padEnd(52) + 'about'.padEnd(14) + 'hue 32');
  done++;
}

console.log(`\nredrew ${done}, left alone ${skipped}`);
