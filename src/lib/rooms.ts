/**
 * The exhibition's floor plan: each category with something in it is a room, numbered in tab order.
 *
 * Numbered from the same list everywhere it appears — the home page's subject panels and the
 * category page's own heading — so "Room III" on the way in is "Room III" when you arrive. An empty
 * category is not a room: it has nothing hung in it, and numbering it would leave a gap in the walk.
 */
const NUMERALS: [number, string][] = [
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

/** 1 → "I", 14 → "XIV". Rooms, not years: nothing here goes past a few dozen. */
export function roman(n: number): string {
  let out = '';
  let left = Math.floor(n);
  for (const [value, glyph] of NUMERALS) {
    while (left >= value) {
      out += glyph;
      left -= value;
    }
  }
  return out;
}

/**
 * The room label for `slug`, or `''` when it is not a room.
 *
 * @param index categories in tab order with their counts — `getCategoryIndex()` as returned.
 */
export function roomOf(slug: string, index: { slug: string; entryCount: number }[]): string {
  const rooms = index.filter((c) => c.entryCount > 0);
  const at = rooms.findIndex((c) => c.slug === slug);
  return at < 0 ? '' : `Room ${roman(at + 1)}`;
}
