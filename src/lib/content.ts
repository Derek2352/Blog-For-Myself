/**
 * The Astro build's view of the content.
 *
 * This file used to be the whole content layer. Every derivation it held now lives in
 * `content-core.ts`, written against structural types so the Next build's filesystem loader can
 * use the identical code — see that file's header for why copying it instead would have been the
 * expensive mistake. What is left here is the part that is genuinely Astro's: `getCollection`, the
 * draft policy that reads `import.meta.env`, and the promise-shaped API the sixteen `.astro` pages
 * already call.
 *
 * **The public API is unchanged on purpose.** Not one page was edited when this was split. A
 * refactor that also moves call sites cannot tell you whether the refactor was correct, because
 * everything changed at once; keeping the surface identical means the existing build, the 549
 * tests and the harness fleet are all still measuring the same thing.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import {
  categoryIndex,
  indexCodes,
  navCategories,
  newestFirst,
  relatedTo,
  sortForCategory,
  allTagsIn,
  tagCountsIn,
  type CategoryWithCounts,
  type FeedItem as CoreFeedItem,
  type MonthGroup as CoreMonthGroup,
  type PeriodGroupData as CorePeriodGroupData,
} from './content-core';

export type Entry = CollectionEntry<'entries'>;
export type Log = CollectionEntry<'logs'>;

/* Re-exported so the pages' imports keep working unchanged — the split is an internal detail, and
   a page should not have to know which half of the content layer a helper ended up in. */
export {
  sortForCategory,
  groupByPeriod,
  toFeed,
  logHasBody,
  reflectionWritten,
  entryHref,
  logHref,
  categoryHref,
  tagHref,
} from './content-core';
export type { CategoryWithCounts } from './content-core';

/**
 * The three feed types, **bound to Astro's entry and log**.
 *
 * `content-core` declares them generic with structural defaults, so a bare `PeriodGroupData` there
 * means "some item with a date" — correct for the core, wrong here. Re-exporting them unbound
 * silently widened `PeriodGroup.astro`'s props from `CollectionEntry` to the structural type, and
 * the component then had no `collection` field to hand on. Naming the arguments once, here, is
 * what keeps every `.astro` page seeing exactly the types it saw before the split.
 */
export type FeedItem = CoreFeedItem<Entry, Log>;
export type MonthGroup = CoreMonthGroup<Entry, Log>;
export type PeriodGroupData = CorePeriodGroupData<Entry, Log>;

/**
 * Draft policy: drafts render in `npm run dev` (with a DRAFT badge) so you can preview them, and
 * are excluded from production builds. Publishing = setting `draft: false`.
 *
 * `npm run build:drafts` (SHOW_DRAFTS=1) builds a preview that keeps drafts in — for a second,
 * private deploy to review on your phone. Preview builds carry a visible watermark strip (see
 * Base.astro).
 */
const showDrafts = import.meta.env.DEV || process.env.SHOW_DRAFTS === '1';

/** True on a drafts-included production build — used for the watermark. */
export const isDraftPreviewBuild = !import.meta.env.DEV && process.env.SHOW_DRAFTS === '1';

/** All visible entries, newest first. */
export async function getEntries(): Promise<Entry[]> {
  return newestFirst(await getCollection('entries', (e) => showDrafts || !e.data.draft));
}

/** All visible logs, newest first. */
export async function getLogs(): Promise<Log[]> {
  return newestFirst(await getCollection('logs', (l) => showDrafts || !l.data.draft));
}

/* ------------------------------------------------------------------ *
 * Index codes — memoised, because every card on every page asks for one.
 * ------------------------------------------------------------------ */
let codesPromise: Promise<Map<string, string>> | null = null;

function codes(): Promise<Map<string, string>> {
  /* Built from the *unfiltered* collections: a code is a position in a chronological sequence, so
     leaving drafts out would renumber every later item the moment one is published. */
  codesPromise ??= (async () =>
    indexCodes(await getCollection('entries'), await getCollection('logs')))();
  return codesPromise;
}

export async function entryCode(entry: Entry): Promise<string> {
  return (await codes()).get(`entries:${entry.id}`) ?? 'E-000';
}

export async function logCode(log: Log): Promise<string> {
  return (await codes()).get(`logs:${log.id}`) ?? 'L-000';
}

/* ------------------------------------------------------------------ *
 * Navigation — derived, never hardcoded.
 * ------------------------------------------------------------------ */

/** Every category (in tab order) with its visible-item counts. */
export async function getCategoryIndex(): Promise<CategoryWithCounts[]> {
  const [entries, logs] = await Promise.all([getEntries(), getLogs()]);
  return categoryIndex(entries, logs);
}

/** Tabs = categories with at least one visible entry or log. */
export async function getNavCategories(): Promise<CategoryWithCounts[]> {
  const [entries, logs] = await Promise.all([getEntries(), getLogs()]);
  return navCategories(entries, logs);
}

export interface NavCategory extends CategoryWithCounts {
  /** Top few entries for the hover flyout (grid order). */
  entries: Entry[];
}

/**
 * Nav categories with their leading entries attached — powers the tab-bar hover flyout. Derived
 * from content; no hardcoded sub-navigation.
 */
export async function getNavTree(limit = 8): Promise<NavCategory[]> {
  const [allEntries, nav] = await Promise.all([getEntries(), getNavCategories()]);
  return nav.map((c) => ({
    ...c,
    entries: sortForCategory(allEntries.filter((e) => e.data.category === c.slug)).slice(0, limit),
  }));
}

/* ------------------------------------------------------------------ *
 * Derivations that need the whole set fetched first.
 * ------------------------------------------------------------------ */

export async function relatedEntries(entry: Entry, limit = 3): Promise<Entry[]> {
  return relatedTo(entry, await getEntries(), limit);
}

/** Union of all tags across visible entries + logs, alphabetical. */
export async function allTags(): Promise<string[]> {
  const [entries, logs] = await Promise.all([getEntries(), getLogs()]);
  return allTagsIn(entries, logs);
}

/** The same tags with usage counts, busiest first. See `tagCountsIn` for why both orders exist. */
export async function tagCounts(): Promise<{ tag: string; count: number }[]> {
  const [entries, logs] = await Promise.all([getEntries(), getLogs()]);
  return tagCountsIn(entries, logs);
}
