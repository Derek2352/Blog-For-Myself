/**
 * Build-time integrity checks for the two hand-edited data files.
 * Runs when the content config loads (i.e. on every dev start and build),
 * so a bad edit fails loudly with a message that says exactly what to fix
 * — instead of silently mis-grouping pages months later.
 */
import { categories, RESERVED_SLUGS } from '@/data/categories';
import { periods } from '@/data/periods';

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const fail = (msg: string): never => {
  throw new Error(`[data] ${msg}`);
};

export function validateData(): void {
  // ---- categories.ts ----
  const seenSlugs = new Set<string>();
  const seenOrders = new Map<number, string>();
  for (const c of categories) {
    if (!SLUG_RE.test(c.slug)) {
      fail(`Category slug "${c.slug}" must be lowercase kebab-case (a-z, 0-9, hyphens).`);
    }
    if ((RESERVED_SLUGS as readonly string[]).includes(c.slug)) {
      fail(
        `Category slug "${c.slug}" collides with a fixed route. Rename it (reserved: ${RESERVED_SLUGS.join(', ')}).`,
      );
    }
    if (seenSlugs.has(c.slug)) fail(`Duplicate category slug "${c.slug}" in categories.ts.`);
    seenSlugs.add(c.slug);
    if (seenOrders.has(c.order)) {
      console.warn(
        `[data] Warning: categories "${seenOrders.get(c.order)}" and "${c.slug}" share order ${c.order} — tab order will be arbitrary between them.`,
      );
    }
    seenOrders.set(c.order, c.slug);
  }

  // ---- periods.ts ----
  const seenPeriodIds = new Set<string>();
  const ranges: { id: string; start: number; end: number }[] = [];
  for (const p of periods) {
    if (!SLUG_RE.test(p.id)) {
      fail(`Period id "${p.id}" must be lowercase kebab-case.`);
    }
    if (p.id.startsWith('m-')) {
      fail(`Period id "${p.id}" may not start with "m-" (reserved for month fallbacks).`);
    }
    if (seenPeriodIds.has(p.id)) fail(`Duplicate period id "${p.id}" in periods.ts.`);
    seenPeriodIds.add(p.id);
    if (!DAY_RE.test(p.start) || !DAY_RE.test(p.end)) {
      fail(`Period "${p.id}" dates must be ISO days (YYYY-MM-DD). Got start=${p.start} end=${p.end}.`);
    }
    const start = Date.parse(`${p.start}T00:00:00Z`);
    const end = Date.parse(`${p.end}T00:00:00Z`);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      fail(`Period "${p.id}" has an unparseable date (start=${p.start}, end=${p.end}).`);
    }
    if (end < start) {
      fail(`Period "${p.id}" ends (${p.end}) before it starts (${p.start}). Swap the dates.`);
    }
    ranges.push({ id: p.id, start, end });
  }
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      const a = ranges[i]!;
      const b = ranges[j]!;
      if (a.start <= b.end && b.start <= a.end) {
        console.warn(
          `[data] Warning: periods "${a.id}" and "${b.id}" overlap — items in the overlap group under whichever is listed first.`,
        );
      }
    }
  }
}
