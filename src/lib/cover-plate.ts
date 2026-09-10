/**
 * Which covers this project drew itself, and which of the two ways it drew them — read from the
 * files, at build time.
 *
 * The dark theme needs this (see the `[data-drawn]` rule in src/styles/global.css). A drawn cover
 * is a static SVG loaded through `<img>`, so no page CSS reaches inside it, and it is drawn in one
 * fixed light tone: on the dark theme it is a bright rectangle in a candlelit room. The fix is a
 * filter on the outside of the image, which means the page has to know which images may take it —
 * and getting that wrong is not a subtle bug. `invert(1) hue-rotate(180deg)` across a real
 * photograph is a negative.
 *
 * **Why the file and not a frontmatter flag.** The obvious design is a `coverPlaceholder` boolean
 * in the schema, written by `npm run covers` and by the entry creators. It would work, and it would
 * also be a claim that can go quietly false: somebody drops a photograph in by hand, the flag stays
 * `true`, and the site inverts their photograph until a human notices. Reading the SVG cannot lie —
 * the file either carries a generator's mark or it does not, and the answer changes in the same
 * commit as the file. (There *is* an `art:` field in the frontmatter now. It says what to draw, and
 * it is read by the generator, not by this. See the note on it in content-schema.ts.)
 *
 * ## How it reads them, and the bug that decided that
 *
 * This used to be two `import.meta.glob(…, { query: '?raw', eager: true })` calls, which is the
 * right answer under Astro and is **not an answer at all under Next**: `import.meta.glob` is a Vite
 * API, Next does not implement it, and what it does instead of failing is evaluate to `{}`. So from
 * the day this site left Astro until the day the illustration landed, both sets below were empty,
 * every call here returned `false`, `data-plate` was never written onto anything, and twenty-four
 * covers glowed out of the dark theme exactly as they had before that rule was ever written. The
 * build was clean. The type was right — `Record<string, string>` is a perfectly good type for an
 * empty object. Nothing anywhere went red.
 *
 * Two things follow, and both are in this file rather than in a note somewhere.
 *
 * 1. **`node:fs`, not a bundler feature.** The rest of the content layer already reads this same
 *    tree with `node:fs` (src/server/content-fs.ts), at build time, and these are the same files.
 *    The original objection to fs here — that it would drag `node:fs` and `node:readline` into the
 *    Astro build — belonged to a build that no longer exists. Reading synchronously at module scope
 *    keeps the callers synchronous, which matters because they are called inside render.
 * 2. **A test asserts the sets are not empty.** `tests/cover-plate.test.ts` fails if no plate is
 *    found, which is the shape the bug took: not a wrong answer, an answer about nothing. A
 *    detector with nothing to detect cannot fail on its own.
 *
 * **Not the same question as `isPlaceholderCover()`** in ./images.ts. That one asks *does this entry
 * still want a photograph?* — it tests the file extension, so an SVG anybody drew answers yes to it,
 * and only a plate answers yes to this.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { isPlateSVG, isArtSVG } from '../../scripts/cover-plate.mjs';

const ENTRIES = path.join(process.cwd(), 'src', 'content', 'entries');
const ASSETS = path.join(process.cwd(), 'src', 'assets');

/** The file's text, or `''` when there is no file — the same bytes `npm run covers` reads. */
const textOf = (file: string): string => {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
};

const dirsIn = (root: string): string[] => {
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
};

const filesIn = (root: string, ext: string): string[] => {
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith(ext))
      .map((d) => d.name);
  } catch {
    return [];
  }
};

/*
 * One pass over the entries, sorting each cover into at most one of the two sets. `cover.svg` and
 * nothing else: a cover that is a `.jpg` is a photograph, has no mark to carry, and is exactly the
 * image neither of these answers may ever be `true` for.
 */
const plates = new Set<string>();
const art = new Set<string>();
for (const id of dirsIn(ENTRIES)) {
  const svg = textOf(path.join(ENTRIES, id, 'images', 'cover.svg'));
  if (!svg) continue;
  if (isArtSVG(svg)) art.add(id);
  else if (isPlateSVG(svg)) plates.add(id);
}

/**
 * True when this entry's cover is a plate the generator drew — a slot held open for a photograph
 * that has not arrived.
 *
 * @param entryId the collection id — the entry's folder name, which is also the directory name
 *                read above, so the two cannot disagree about who an entry is.
 */
export function isGeneratedPlate(entryId: string): boolean {
  return plates.has(entryId);
}

/**
 * True when this entry's cover is an **illustration** the generator drew, rather than the plate.
 *
 * Three things hang off the answer, and each is a different kind of wrong when it is missed:
 *
 * 1. **The 13rem height cap does not apply.** That cap exists so a placeholder does not put a
 *    screen of empty frame between the summary and the first sentence. An illustration is the
 *    finished cover; cropping one to a strip loses the drawing.
 * 2. **It earns a credit line.** A cover depicting the product a competition was about will be
 *    read as a screenshot of that product unless something says otherwise, and on a page a
 *    recruiter reads, that misreading is not harmless.
 * 3. **The `alt` describes the drawing** rather than repeating the title the heading beside it
 *    already carries.
 *
 * What it does *not* change is the dark theme. Art takes the same `invert(1) hue-rotate(180deg)`
 * as the plate, because scripts/cover-art.mjs derives its ground and its ink from `placeholderSVG`'s
 * own measured values rather than picking a palette of its own — see the palette note there.
 * `scratchpad/art-sink.mjs` measures the result instead of trusting it.
 *
 * The frontmatter's `art:` is what *asked* for the drawing, and the entry page reads it too, for
 * the `alt` and the credit that live on the template. Both are needed and they answer different
 * questions: the frontmatter names the template, this says the drawing is actually in the file.
 * Drop a photograph over it and this goes false, the frontmatter stops mattering, and the page
 * reverts to treating the cover as a photograph on its own.
 */
export function isCoverArt(entryId: string): boolean {
  return art.has(entryId);
}

/*
 * The same question for the loose assets outside the content collections. Only `/about/`'s portrait
 * asks it today, and it asks for the same reason an entry does: `npm run covers` draws that plate,
 * so on the dark theme it needs the filter, and on the day a real portrait replaces it the filter
 * must stop — inverting a photograph of a person is the worst version of this bug on the site.
 *
 * Reading `*.svg` and nothing else is the whole guard. A photograph arrives as `portrait.jpg` (or
 * `.webp`, or `.avif`), the about page's import moves to it, and this map simply has no entry under
 * that name — so the answer is already `false` before anyone remembers there was a flag to clear.
 * Reading a JPEG as text to ask it whether it is an SVG would be the drift this file exists to
 * avoid, in a more expensive form.
 */
const assetPlates = new Set(
  filesIn(ASSETS, '.svg').filter((file) => isPlateSVG(textOf(path.join(ASSETS, file)))),
);

/**
 * True when `src/assets/<file>` is a plate the generator drew.
 *
 * @param file the asset's bare filename, e.g. `portrait.svg`. Bare rather than a path because the
 *             caller has already imported the asset by name and a second, longer spelling of the
 *             same name is a second thing to keep in step.
 */
export function isPlateAsset(file: string): boolean {
  return assetPlates.has(file);
}

/**
 * How many of each were found. Exported for `tests/cover-plate.test.ts` and for nothing else.
 *
 * The bug this file records was not a wrong answer, it was an answer about an empty set — so the
 * test that guards against its return has to be able to see the set, not just query it. A count of
 * zero plates on a repository with twenty-three of them is the whole assertion.
 */
export const drawnCounts = () => ({
  plates: plates.size,
  art: art.size,
  assetPlates: assetPlates.size,
});
