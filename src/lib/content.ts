import { getCollection, type CollectionEntry } from 'astro:content';
import { categories, type Category } from '@/data/categories';
import { resolvePeriod, type PeriodRef } from './periods';
import { monthKey, monthLabelFromKey } from './format';

export type Entry = CollectionEntry<'entries'>;
export type Log = CollectionEntry<'logs'>;

/**
 * Draft policy: drafts render in `npm run dev` (with a DRAFT badge) so you
 * can preview them, and are excluded from production builds. Publishing =
 * setting `draft: false`.
 *
 * `npm run build:drafts` (SHOW_DRAFTS=1) builds a preview that keeps
 * drafts in — for a second, private deploy to review on your phone.
 * Preview builds carry a visible watermark strip (see Base.astro).
 */
const showDrafts = import.meta.env.DEV || process.env.SHOW_DRAFTS === '1';

/** True on a drafts-included production build — used for the watermark. */
export const isDraftPreviewBuild = !import.meta.env.DEV && process.env.SHOW_DRAFTS === '1';

const dateDesc = <T extends { date: Date }>(a: T, b: T) =>
  b.date.getTime() - a.date.getTime();

/** All visible entries, newest first. */
export async function getEntries(): Promise<Entry[]> {
  const all = await getCollection('entries', (e) => showDrafts || !e.data.draft);
  return all.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

/** All visible logs, newest first. */
export async function getLogs(): Promise<Log[]> {
  const all = await getCollection('logs', (l) => showDrafts || !l.data.draft);
  return all.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

/**
 * Category-grid sort: entries with a manual `order` pin first (ascending),
 * everything else newest-first behind them.
 */
export function sortForCategory(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => {
    const ao = a.data.order ?? Number.POSITIVE_INFINITY;
    const bo = b.data.order ?? Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    return b.data.date.getTime() - a.data.date.getTime();
  });
}

/* ------------------------------------------------------------------ *
 * Index codes — the signature "archival index" (E-014 / L-003).
 * Derived from content only: all items (drafts included, so codes stay
 * stable between dev and production), sorted by date then id.
 * ------------------------------------------------------------------ */
let codesPromise: Promise<Map<string, string>> | null = null;

function indexCodes(): Promise<Map<string, string>> {
  codesPromise ??= (async () => {
    const map = new Map<string, string>();
    const num = (i: number) => String(i + 1).padStart(3, '0');
    const chrono = <T extends Entry | Log>(items: T[]) =>
      [...items].sort(
        (a, b) =>
          a.data.date.getTime() - b.data.date.getTime() || a.id.localeCompare(b.id),
      );
    chrono(await getCollection('entries')).forEach((e, i) =>
      map.set(`entries:${e.id}`, `E-${num(i)}`),
    );
    chrono(await getCollection('logs')).forEach((l, i) =>
      map.set(`logs:${l.id}`, `L-${num(i)}`),
    );
    return map;
  })();
  return codesPromise;
}

export async function entryCode(entry: Entry): Promise<string> {
  return (await indexCodes()).get(`entries:${entry.id}`) ?? 'E-000';
}

export async function logCode(log: Log): Promise<string> {
  return (await indexCodes()).get(`logs:${log.id}`) ?? 'L-000';
}

/* ------------------------------------------------------------------ *
 * Navigation — derived, never hardcoded.
 * ------------------------------------------------------------------ */
export interface CategoryWithCounts extends Category {
  entryCount: number;
  logCount: number;
}

/** Every category (in tab order) with its visible-item counts. */
export async function getCategoryIndex(): Promise<CategoryWithCounts[]> {
  const [entries, logs] = await Promise.all([getEntries(), getLogs()]);
  return [...categories]
    .sort((a, b) => a.order - b.order)
    .map((c) => ({
      ...c,
      entryCount: entries.filter((e) => e.data.category === c.slug).length,
      logCount: logs.filter((l) => l.data.category === c.slug).length,
    }));
}

/** Tabs = categories with at least one visible entry or log. */
export async function getNavCategories(): Promise<CategoryWithCounts[]> {
  return (await getCategoryIndex()).filter((c) => c.entryCount + c.logCount > 0);
}

/* ------------------------------------------------------------------ *
 * Mixed feed (entries + logs) and period → month grouping.
 * ------------------------------------------------------------------ */
export type FeedItem =
  | { type: 'entry'; date: Date; entry: Entry }
  | { type: 'log'; date: Date; log: Log };

export function toFeed(entries: Entry[], logs: Log[]): FeedItem[] {
  const items: FeedItem[] = [
    ...entries.map((entry) => ({ type: 'entry' as const, date: entry.data.date, entry })),
    ...logs.map((log) => ({ type: 'log' as const, date: log.data.date, log })),
  ];
  return items.sort(dateDesc);
}

export interface MonthGroup {
  key: string; // "2026-07"
  label: string; // "July 2026"
  items: FeedItem[];
}

export interface PeriodGroupData {
  ref: PeriodRef;
  months: MonthGroup[];
  count: number;
}

/** Group a feed period → month → items, everything newest-first. */
export function groupByPeriod(items: FeedItem[]): PeriodGroupData[] {
  const groups = new Map<string, { ref: PeriodRef; months: Map<string, FeedItem[]> }>();
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
export async function relatedEntries(entry: Entry, limit = 3): Promise<Entry[]> {
  const all = await getEntries();
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

/** Union of all tags across visible entries + logs, alphabetical. */
export async function allTags(): Promise<string[]> {
  const [entries, logs] = await Promise.all([getEntries(), getLogs()]);
  const tags = new Set<string>();
  for (const e of entries) e.data.tags.forEach((t) => tags.add(t));
  for (const l of logs) l.data.tags.forEach((t) => tags.add(t));
  return [...tags].sort((a, b) => a.localeCompare(b));
}

/* ------------------------------------------------------------------ *
 * Hrefs. A log with no body is a terminal card — no dead detail page.
 * ------------------------------------------------------------------ */
export const logHasBody = (log: Log): boolean =>
  !!log.body && log.body.trim().length > 0;

export const entryHref = (entry: Entry): string => `/entry/${entry.id}/`;
export const logHref = (log: Log): string | undefined =>
  logHasBody(log) ? `/log/${log.id}/` : undefined;
export const categoryHref = (slug: string): string => `/${slug}/`;
export const tagHref = (tag: string): string => `/tags/${tag}/`;
