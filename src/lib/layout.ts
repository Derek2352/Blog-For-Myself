/**
 * Small layout arithmetic that depends on how much content there is.
 *
 * The site's rule is that adding content never means editing code, which
 * includes not having to notice that the number of cards now looks wrong in the
 * grid it was given. A three-column grid holding four cards leaves one stranded
 * alone on the second row beside two empty cells — the same "lonely last item"
 * that made the tab bar read as broken.
 */

/**
 * Column count for a grid of `n` cards, avoiding a last row of exactly one.
 *
 * Prefers three columns and steps down to two when three would strand a card;
 * below three cards the count is simply the number of cards. Some counts can't
 * be saved (seven orphans at both three and two), and those keep the preferred
 * three rather than dropping to something worse.
 */
export function balancedCols(n: number, preferred = 3): number {
  if (n <= 0) return 1;
  if (n < preferred) return n;
  for (let c = preferred; c >= 2; c--) {
    if (n % c !== 1) return c;
  }
  return preferred;
}
