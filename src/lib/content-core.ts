/**
 * Everything the site does with content that does not depend on where the content came from.
 *
 * ## Why this is a separate file
 *
 * `content.ts` used to be one file: it fetched from `astro:content` *and* held every derivation
 * built on top — the category sort, the mixed feed, the period grouping, related entries, tag
 * counts, the archival index codes, the href builders. When the Next build needed the same
 * derivations it had two options, and one of them was a trap: copy the file and swap the fetch.
 * That produces two implementations of `groupByPeriod`, and the day one is fixed is the day the
 * two views of the same archive stop agreeing — with nothing failing, because each is
 * self-consistent.
 *
 * So the split is by *dependency*, not by convenience. Fetching is framework-specific and lives
 * with each framework. Everything below is written against **structural types** — "something with
 * an id and a data.date" — so it accepts Astro's `CollectionEntry` and the filesystem loader's
 * `Loaded<FsEntry>` without either knowing about the other, and without an adapter in between.
 * `sort.ts` already worked this way; this is the same idea applied to the rest.
 *
 * The generics are not decoration. Each helper is generic in its *input* type and returns that
 * same type, so a page that passes Astro entries gets Astro entries back, with covers still typed
 * as `ImageMetadata`. A version written against the structural type directly would compile and
 * then quietly widen every call site.
 */
import { categories, type Category } from '@/data/categories';
import { resolvePeriod, type PeriodRef } from './periods';
import { monthKey, monthLabelFromKey } from './format';
import { byPinnedOrder, byDateDesc } from './sort';

/* ------------------------------------------------------------------ *
 * The shapes — the least each helper needs to know.
 * ------------------------------------------------------------------ */

/** The frontmatter fields the derivations below actually read on an entry. */
export interface CoreEntryData {
  date: Date;
  category: string;
  tags: string[];
  draft: boolean;
  order?: number;
}

/** The same, for a log. */
export interface CoreLogData {
  date: Date;
  category: string;
  tags: string[];
  draft: boolean;
}

/** An item as both loaders return it: an id, its frontmatter, and the raw body. */
export interface CoreItem<D> {
  id: string;
  data: D;
  body?: string;
}

export type CoreEntry = CoreItem<CoreEntryData>;
export type CoreLog = CoreItem<CoreLogData>;

const dateDesc = <T extends { date: Date }>(a: T, b: T) => b.date.getTime() - a.date.getTime();

/** Newest first — the site's default order, applied by both loaders after fetching. */
export const newestFirst = <T extends CoreItem<{ date: Date }>>(items: T[]): T[] =>
  [...items].sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

/* ------------------------------------------------------------------ *
 * Ordering
 * ------------------------------------------------------------------ */

/**
 * Category-grid sort: entries with a manual `order` pin first (ascending), everything else
 * newest-first behind them.
 */
export function sortForCategory<T extends CoreEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => byPinnedOrder(a, b) || byDateDesc(a, b));
}

/* ------------------------------------------------------------------ *
 * Index codes — the signature "archival index" (E-014 / L-003).
 * ------------------------------------------------------------------ */

/**
 * Build the code map from the **complete** lists, drafts included.
 *
 * Drafts count, and that is the whole subtlety: the codes are positions in a chronological
 * sequence, so excluding drafts would renumber every later item the moment one is published, and
 * a code printed on a page that has been shared is a promise. It also keeps dev and production
 * agreeing, which is why the callers pass everything rather than their filtered list.
 */
export function indexCodes(allEntries: CoreEntry[], allLogs: CoreLog[]): Map<string, string> {
  const map = new Map<string, string>();
  const num = (i: number) => String(i + 1).padStart(3, '0');
  const chrono = <T extends CoreItem<{ date: Date }>>(items: T[]) =>
    [...items].sort(
      (a, b) => a.data.date.getTime() - b.data.date.getTime() || a.id.localeCompare(b.id),
    );
  chrono(allEntries).forEach((e, i) => map.set(`entries:${e.id}`, `E-${num(i)}`));
  chrono(allLogs).forEach((l, i) => map.set(`logs:${l.id}`, `L-${num(i)}`));
  return map;
}

/* ------------------------------------------------------------------ *
 * Navigation — derived, never hardcoded.
 * ------------------------------------------------------------------ */

export interface CategoryWithCounts extends Category {
  entryCount: number;
  logCount: number;
}

/** Every category (in tab order) with its visible-item counts. */
export function categoryIndex(entries: CoreEntry[], logs: CoreLog[]): CategoryWithCounts[] {
  return [...categories]
    .sort((a, b) => a.order - b.order)
    .map((c) => ({
      ...c,
      entryCount: entries.filter((e) => e.data.category === c.slug).length,
      logCount: logs.filter((l) => l.data.category === c.slug).length,
    }));
}

/** Tabs = categories with at least one visible entry or log. */
export const navCategories = (entries: CoreEntry[], logs: CoreLog[]): CategoryWithCounts[] =>
  categoryIndex(entries, logs).filter((c) => c.entryCount + c.logCount > 0);

/* ------------------------------------------------------------------ *
 * Mixed feed (entries + logs) and period → month grouping.
 * ------------------------------------------------------------------ */

export type FeedItem<E extends CoreEntry = CoreEntry, L extends CoreLog = CoreLog> =
  | { type: 'entry'; date: Date; entry: E }
  | { type: 'log'; date: Date; log: L };

export function toFeed<E extends CoreEntry, L extends CoreLog>(
  entries: E[],
  logs: L[],
): FeedItem<E, L>[] {
  const items: FeedItem<E, L>[] = [
    ...entries.map((entry) => ({ type: 'entry' as const, date: entry.data.date, entry })),
    ...logs.map((log) => ({ type: 'log' as const, date: log.data.date, log })),
  ];
  return items.sort(dateDesc);
}

export interface MonthGroup<E extends CoreEntry = CoreEntry, L extends CoreLog = CoreLog> {
  key: string; // "2026-07"
  label: string; // "July 2026"
  items: FeedItem<E, L>[];
}

export interface PeriodGroupData<E extends CoreEntry = CoreEntry, L extends CoreLog = CoreLog> {
  ref: PeriodRef;
  months: MonthGroup<E, L>[];
  count: number;
}

/** Group a feed period → month → items, everything newest-first. */
export function groupByPeriod<E extends CoreEntry, L extends CoreLog>(
  items: FeedItem<E, L>[],
): PeriodGroupData<E, L>[] {
  const groups = new Map<string, { ref: PeriodRef; months: Map<string, FeedItem<E, L>[]> }>();
  for (const item of items) {
    const ref = resolvePeriod(item.date);
    let group = groups.get(ref.id);
    if (!group) {
      group = { ref, months: new Map() };
      groups.set(ref.id, group);
    }
    const key = monthKey(item.date);
    const month = group.months.get(key) ?? [];
    month.push(item);
    group.months.set(key, month);
  }
  return [...groups.values()]
    .map((group) => ({
      ref: group.ref,
      count: [...group.months.values()].reduce((n, arr) => n + arr.length, 0),
      months: [...group.months.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([key, monthItems]) => ({
          key,
          label: monthLabelFromKey(key),
          items: monthItems.sort(dateDesc),
        })),
    }))
    .sort((a, b) => b.ref.end.localeCompare(a.ref.end));
}

/* ------------------------------------------------------------------ *
 * Related entries: same category or shared tags, best matches first.
 * ------------------------------------------------------------------ */
export function relatedTo<T extends CoreEntry>(entry: CoreEntry, all: T[], limit = 3): T[] {
  return all
    .filter((e) => e.id !== entry.id)
    .map((e) => ({
      e,
      score:
        (e.data.category === entry.data.category ? 2 : 0) +
        e.data.tags.filter((t) => entry.data.tags.includes(t)).length,
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.e.data.date.getTime() - a.e.data.date.getTime())
    .slice(0, limit)
    .map((x) => x.e);
}

/* ------------------------------------------------------------------ *
 * Tags
 * ------------------------------------------------------------------ */

/** Union of all tags across visible entries + logs, alphabetical. */
export function allTagsIn(entries: CoreEntry[], logs: CoreLog[]): string[] {
  const tags = new Set<string>();
  for (const e of entries) e.data.tags.forEach((t) => tags.add(t));
  for (const l of logs) l.data.tags.forEach((t) => tags.add(t));
  return [...tags].sort((a, b) => a.localeCompare(b));
}

/**
 * The same tags, carrying how often each is used, busiest first.
 *
 * `/tags/` wants them alphabetical because it is an *index* — you arrive knowing the word and need
 * to find it. `/search/` wants them by weight because you arrive knowing nothing and need
 * somewhere to start, and the busiest thread is the likeliest to have what a stranger came for.
 * Same data, two orders, one source — which is why this returns counts rather than a second
 * hand-kept list of "featured" tags that would go stale the first time an entry is filed.
 *
 * Ties break alphabetically so the order is stable across builds: a run of tags used once each
 * would otherwise shuffle with `Set` insertion order, and a page that reorders itself for no
 * visible reason is a diff nobody can review.
 */
export function tagCountsIn(
  entries: CoreEntry[],
  logs: CoreLog[],
): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of entries) e.data.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1));
  for (const l of logs) l.data.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1));
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/* ------------------------------------------------------------------ *
 * Hrefs. A log with no body is a terminal card — no dead detail page.
 * ------------------------------------------------------------------ */

export const logHasBody = (log: CoreLog): boolean =>
  !!log.body && log.body.replace(/<!--[\s\S]*?-->/g, '').trim().length > 0;

/**
 * True once an entry's reflection has real prose — i.e. the body contains more than the four
 * template headings and comments. Unwritten reflections get a graceful placeholder instead of four
 * bare headings.
 */
export const reflectionWritten = (entry: CoreEntry): boolean =>
  !!entry.body &&
  entry.body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^##\s.*$/gm, '')
    .trim().length > 0;

export const entryHref = (entry: CoreItem<unknown>): string => `/entry/${entry.id}/`;
export const logHref = (log: CoreLog): string | undefined =>
  logHasBody(log) ? `/log/${log.id}/` : undefined;
export const categoryHref = (slug: string): string => `/${slug}/`;
export const tagHref = (tag: string): string => `/tags/${tag}/`;
