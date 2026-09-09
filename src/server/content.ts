/**
 * The Next build's view of the content — the mirror of `src/lib/content.ts`.
 *
 * Both files are thin. Each fetches in the way its framework fetches, then hands the result to the
 * same helpers in `content-core.ts`. Everything a reader actually sees — the order of a category
 * grid, which tabs exist, how the timeline groups into periods and months, what an entry's
 * archival code is, which entries count as related — is computed by code neither of them owns.
 *
 * That is the whole design. While both builds are alive there is exactly one place to change a
 * derivation, and no way for the two sites to disagree about the archive without a test failing.
 *
 * The one asymmetry worth naming: Astro's `getCollection` is already memoised by its content
 * layer, so `content.ts` only caches the index codes. Here every call would re-read and re-measure
 * the whole tree, and a static export calls these once per page — 85 pages against 28 markdown
 * files and 27 SVGs. So the loaders are memoised at module scope, which is safe precisely because
 * this only ever runs in a build: there is no server, no request, and nothing to invalidate.
 */
import { loadEntries, loadLogs, type FsEntry, type FsLog, type Loaded } from './content-fs';
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
} from '@/lib/content-core';

export type Entry = Loaded<FsEntry>;
export type Log = Loaded<FsLog>;

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
} from '@/lib/content-core';
export type { CategoryWithCounts } from '@/lib/content-core';

/** Bound to this build's entry and log, for the same reason `content.ts` binds them to Astro's. */
export type FeedItem = CoreFeedItem<Entry, Log>;
export type MonthGroup = CoreMonthGroup<Entry, Log>;
export type PeriodGroupData = CorePeriodGroupData<Entry, Log>;

/**
 * Draft policy, matching Astro's: drafts show in `next dev`, and are excluded from a production
 * build unless `SHOW_DRAFTS=1` asks for the private preview.
 *
 * `process.env.NODE_ENV` rather than `import.meta.env.DEV`, which is Vite's and does not exist
 * here — the only line in either file that could not simply have been copied.
 */
const showDrafts = process.env.NODE_ENV === 'development' || process.env.SHOW_DRAFTS === '1';

/** True on a drafts-included production build — used for the watermark. */
export const isDraftPreviewBuild =
  process.env.NODE_ENV !== 'development' && process.env.SHOW_DRAFTS === '1';

/* Memoised for the build; see the header. */
let allEntriesP: Promise<Entry[]> | null = null;
let allLogsP: Promise<Log[]> | null = null;
const allEntries = () => (allEntriesP ??= loadEntries());
const allLogs = () => (allLogsP ??= loadLogs());

/** All visible entries, newest first. */
export async function getEntries(): Promise<Entry[]> {
  return newestFirst((await allEntries()).filter((e) => showDrafts || !e.data.draft));
}

/** All visible logs, newest first. */
export async function getLogs(): Promise<Log[]> {
  return newestFirst((await allLogs()).filter((l) => showDrafts || !l.data.draft));
}

/* Codes come from the unfiltered lists — a code is a position in a sequence, so hiding drafts
   would renumber everything after one the moment it is published. */
let codesP: Promise<Map<string, string>> | null = null;
const codes = () => (codesP ??= (async () => indexCodes(await allEntries(), await allLogs()))());

export async function entryCode(entry: Entry): Promise<string> {
  return (await codes()).get(`entries:${entry.id}`) ?? 'E-000';
}

export async function logCode(log: Log): Promise<string> {
  return (await codes()).get(`logs:${log.id}`) ?? 'L-000';
}

export async function getCategoryIndex(): Promise<CategoryWithCounts[]> {
  return categoryIndex(await getEntries(), await getLogs());
}

export async function getNavCategories(): Promise<CategoryWithCounts[]> {
  return navCategories(await getEntries(), await getLogs());
}

export interface NavCategory extends CategoryWithCounts {
  entries: Entry[];
}

export async function getNavTree(limit = 8): Promise<NavCategory[]> {
  const [entries, nav] = await Promise.all([getEntries(), getNavCategories()]);
  return nav.map((c) => ({
    ...c,
    entries: sortForCategory(entries.filter((e) => e.data.category === c.slug)).slice(0, limit),
  }));
}

export async function relatedEntries(entry: Entry, limit = 3): Promise<Entry[]> {
  return relatedTo(entry, await getEntries(), limit);
}

export async function allTags(): Promise<string[]> {
  return allTagsIn(await getEntries(), await getLogs());
}

export async function tagCounts(): Promise<{ tag: string; count: number }[]> {
  return tagCountsIn(await getEntries(), await getLogs());
}

/** One entry by slug, drafts included — the detail page decides what to do with a draft. */
export async function getEntry(slug: string): Promise<Entry | undefined> {
  return (await allEntries()).find((e) => e.id === slug);
}

/** One log by slug, same contract. */
export async function getLog(slug: string): Promise<Log | undefined> {
  return (await allLogs()).find((l) => l.id === slug);
}
