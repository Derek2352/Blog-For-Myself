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

/** @param {string} svg the file's text @returns {boolean} true when this is a plate we drew */
export function isPlateSVG(svg) {
  return svg.includes(PLATE_MARK);
}
