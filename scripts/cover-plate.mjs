/**
 * One answer to "is this cover the plate we drew, or something somebody made?"
 *
 * `redraw-covers.mjs` has asked that question since the plate's first rewrite, and it learned the
 * hard way that the answer has to be a *fingerprint in the output* rather than the filename: the
 * first detector tested for `COVER · PENDING`, the very caption the rewrite was removing, so the
 * second run reported "redrew 0, left alone 24" and looked like a success. A detector that only
 * recognises the output it is replacing can run exactly once.
 *
 * The mark below is in every generation of the plate and in nothing a camera produces. It lives in
 * its own module — dependency-free, the way `photo-rules.mjs` is — because the *site* needs the same
 * answer now and must not drag `node:fs` and `node:readline` into the Astro build to get it. Two
 * copies of the string would be two answers to one question, which is how the caption detector went
 * wrong; `tests/images.test.ts` holds the generator and this detector to each other so a change to
 * the drawing that loses the mark fails a test instead of quietly un-recognising twenty-four files.
 *
 * **It is not the same question as `isPlaceholderCover()` in src/lib/images.ts**, which asks whether
 * an entry still *wants a photograph* — an SVG anybody drew by hand answers yes to that and no to
 * this. See the note there.
 */

/** The `<pattern>` that draws the ledger grid. Present in every plate the generator has ever made. */
export const PLATE_MARK = 'pattern id="ledger"';

/**
 * @param {string} svg the file's text
 * @returns {boolean} true when this is a plate we drew — *and* not an illustration
 *
 * The second half of that is a guarantee rather than a habit. The two categories drive opposite
 * layout decisions (see `ART_MARK` below), so an SVG that answered yes to both would be capped at
 * 13rem *and* credited as a finished drawing — the worst of each. Excluding art here makes them
 * mutually exclusive by construction, which means a future template is free to borrow the ledger
 * pattern (this entry's subject is literally a ledger) without silently reclassifying itself.
 */
export function isPlateSVG(svg) {
  return svg.includes(PLATE_MARK) && !svg.includes(ART_MARK);
}

/**
 * The other mark: `<svg data-cover-art="…">`, written by `coverArtSVG` in ./cover-art.mjs onto
 * every illustration it draws, and by nothing else.
 *
 * **Art and a plate are not the same object and the site treats them differently.** A plate is a
 * held-open slot — it says "a photograph belongs here and has not arrived", so the entry page caps
 * it at 13rem rather than putting a screen of empty frame between the summary and the writing. An
 * illustration is the finished cover; capping it would crop a drawing to a strip. Art also carries
 * a credit line, because a cover that depicts a product a competition was about must not be
 * mistaken for a screenshot of that product.
 *
 * The value after the mark is the template's name, so the file says which drawing it is without
 * anybody having to consult the frontmatter that asked for it.
 */
export const ART_MARK = 'data-cover-art="';

/** @param {string} svg the file's text @returns {boolean} true when this is an illustration we drew */
export function isArtSVG(svg) {
  return svg.includes(ART_MARK);
}

/**
 * The template that drew this file, or `null`.
 *
 * @param {string} svg the file's text
 * @returns {string | null}
 */
export function artTemplateOf(svg) {
  const at = svg.indexOf(ART_MARK);
  if (at < 0) return null;
  const from = at + ART_MARK.length;
  const end = svg.indexOf('"', from);
  return end < 0 ? null : svg.slice(from, end);
}
