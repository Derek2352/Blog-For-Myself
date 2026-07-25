/**
 * Sort helpers for content lists.
 *
 * Kept separate from lib/content.ts (which imports `astro:content` and so
 * can't run under plain Vitest) precisely so this logic stays unit-testable.
 */

/** Anything carrying an optional author-set `order` pin in its frontmatter. */
export interface Orderable {
  data: { order?: number | undefined };
}

/**
 * Comparator: items with a manual `order` pin sort first, ascending. Two
 * unpinned items tie (0), so a following comparator — or the array's existing
 * order — decides.
 *
 * The explicit 0 matters: `Infinity - Infinity` is NaN, and a NaN comparator
 * result leaves ordering to the engine rather than expressing "these tie".
 */
export const byPinnedOrder = (a: Orderable, b: Orderable): number => {
  const ao = a.data.order ?? Number.POSITIVE_INFINITY;
  const bo = b.data.order ?? Number.POSITIVE_INFINITY;
  return ao === bo ? 0 : ao - bo;
};

/** Newest first, by a `date` in frontmatter. */
export const byDateDesc = (a: { data: { date: Date } }, b: { data: { date: Date } }): number =>
  b.data.date.getTime() - a.data.date.getTime();
