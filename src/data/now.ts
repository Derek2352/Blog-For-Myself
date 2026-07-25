/**
 * The "right now" line on the homepage — a tiny personal pulse.
 * Update it whenever you add your monthly logs (same ritual, one minute).
 * Keep items short and honest; three or four reads best.
 */
export const now = {
  /** e.g. "2026-07" — shown after the items */
  updated: "2026-07",
  /**
   * Empty = the whole "now →" line is hidden on the homepage (nothing else to
   * change). Only fill this in if you'll actually keep it current: a line that
   * still says last year's month reads as an abandoned site, which is worse
   * than no line at all. Keep items short, honest, and in your own voice —
   * and never use it for internal to-dos, since visitors read it too.
   */
  items: [] as string[],
};
