/**
 * Which entries are still wearing the drawn plate rather than a photograph — read from the files
 * themselves, at build time.
 *
 * The dark theme needs this (see the `[data-plate]` rule in src/styles/global.css). The plate is a
 * static SVG loaded through `<img>`, so no page CSS reaches inside it, and it is drawn in one fixed
 * light tone: on the dark theme it is a bright rectangle in a candlelit room. The fix is a filter on
 * the outside of the image, which means the page has to know which images may take it — and getting
 * that wrong is not a subtle bug. `invert(1) hue-rotate(180deg)` across a real photograph is a
 * negative.
 *
 * **Why the file and not a frontmatter flag.** The obvious design is a `coverPlaceholder` boolean in
 * the schema, written by `npm run covers` and by the entry creators. It would work, and it would
 * also be a claim that can go quietly false: somebody drops a photograph in by hand, the flag stays
 * `true`, and the site inverts their photograph until a human notices. Reading the SVG cannot lie —
 * the plate either carries the generator's mark or it does not, and the answer changes in the same
 * commit as the file. `import.meta.glob` does that at build time, so the cost is twenty-four small
 * strings read once during the build and nothing at all in the browser.
 *
 * **Not the same question as `isPlaceholderCover()`** in ./images.ts. That one asks *does this entry
 * still want a photograph?* — an SVG somebody drew by hand answers yes to it, and no to this.
 */
import { isPlateSVG } from '../../scripts/cover-plate.mjs';

// `?raw` keeps this to the file's text — the same bytes `npm run covers` reads. It is a separate
// module in the graph from the `image()` asset the schema resolves, so nothing here disturbs the
// hashing, sizing or emitting of the cover itself.
const covers = import.meta.glob('/src/content/entries/**/images/cover.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const ID = /\/entries\/(.+)\/images\/cover\.svg$/;

const plates = new Set(
  Object.entries(covers)
    .filter(([, svg]) => isPlateSVG(svg))
    .map(([path]) => path.match(ID)?.[1])
    .filter((id): id is string => Boolean(id)),
);

/**
 * True when this entry's cover is a plate the generator drew.
 *
 * @param entryId the collection id — the entry's folder name, which is also the path segment the
 *                glob keys carry, so the two cannot disagree about who an entry is.
 */
export function isGeneratedPlate(entryId: string): boolean {
  return plates.has(entryId);
}

// The same question for the loose assets outside the content collections. Only `/about/`'s portrait
// asks it today, and it asks for the same reason an entry does: `npm run covers` draws that plate,
// so on the dark theme it needs the filter, and on the day a real portrait replaces it the filter
// must stop — inverting a photograph of a person is the worst version of this bug on the site.
//
// Globbing `*.svg` and nothing else is the whole guard. A photograph arrives as `portrait.jpg` (or
// `.webp`, or `.avif`), `about.astro`'s import moves to it, and this map simply has no entry under
// that name — so the answer is already `false` before anyone remembers there was a flag to clear.
// Reading a JPEG as `?raw` to ask it whether it is an SVG would be the drift this file exists to
// avoid, in a more expensive form.
const assets = import.meta.glob('/src/assets/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const assetPlates = new Set(
  Object.entries(assets)
    .filter(([, svg]) => isPlateSVG(svg))
    .map(([path]) => path.slice(path.lastIndexOf('/') + 1)),
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
