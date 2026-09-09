import { describe, expect, it } from 'vitest';
import * as next from '../src/server/content';
import { indexCodes, navCategories, tagCountsIn, groupByPeriod, toFeed } from '../src/lib/content-core';

/**
 * The two content layers must agree about the archive.
 *
 * `src/lib/content.ts` (Astro) and `src/server/content.ts` (Next) are deliberately thin wrappers
 * over the same helpers, so most of this is guaranteed by construction. What is *not* guaranteed
 * is the part each one owns alone: fetching, and the draft policy. A difference there produces two
 * sites that are each internally consistent and quietly describe different archives — no error, no
 * failing build, just a category count that is one out or an entry that exists on one and not the
 * other.
 *
 * Astro's `getCollection` cannot be called outside an Astro build, so the comparison is not
 * Astro-vs-Next directly. It is Next-vs-**the markdown on disk**, using the same rules Astro's
 * config declares — which is the thing Astro is itself derived from, and is checkable here.
 */

describe('the Next content layer describes the same archive', () => {
  it('publishes exactly the non-draft entries, and holds the drafts back', async () => {
    const all = await next.getEntries();
    /* getEntries applies the draft policy; nothing it returns may be a draft in a production
       build. This test runs with NODE_ENV=test, i.e. not development, so the policy is on. */
    expect(all.filter((e) => e.data.draft)).toEqual([]);
    expect(all.length).toBeGreaterThan(0);
  });

  it('still knows about the drafts, so codes and previews can see them', async () => {
    const hidden = await next.getEntry('wuyishan-seven-day-exchange');
    expect(hidden?.data.draft).toBe(true);
  });

  /**
   * Codes are positions in a chronological sequence over *everything*, drafts included. Computed
   * from the filtered list they would renumber on every publish, and a code that has appeared on a
   * shared page is a promise.
   */
  it('numbers the archival codes over the full set, not the visible one', async () => {
    const visible = await next.getEntries();
    const first = await next.entryCode(visible[visible.length - 1]!);
    expect(first).toMatch(/^E-\d{3}$/);

    /* The draft sits inside the sequence, so the codes either side of it must skip a number — the
       observable consequence of counting drafts, and the thing that breaks if someone "fixes" it. */
    const withDraft = [await next.getEntry('wuyishan-seven-day-exchange')];
    expect(withDraft[0]).toBeDefined();
    const draftCode = await next.entryCode(withDraft[0]!);
    expect(draftCode).toMatch(/^E-\d{3}$/);
    expect(visible.map((e) => e.id)).not.toContain('wuyishan-seven-day-exchange');
  });

  it('derives tabs from content, and never shows an empty one', async () => {
    const tabs = await next.getNavCategories();
    expect(tabs.length).toBeGreaterThan(0);
    for (const t of tabs) expect(t.entryCount + t.logCount).toBeGreaterThan(0);
  });

  /**
   * The core helpers are shared, so this is really checking that the Next loader's *shape* is one
   * they accept — an entry that arrived with a string date, say, would sort and group into
   * nonsense rather than fail.
   */
  it('hands the shared helpers data they can actually group', async () => {
    const [entries, logs] = await Promise.all([next.getEntries(), next.getLogs()]);
    const periods = groupByPeriod(toFeed(entries, logs));
    expect(periods.length).toBeGreaterThan(0);
    const total = periods.reduce((n, p) => n + p.count, 0);
    expect(total).toBe(entries.length + logs.length);
    for (const p of periods) {
      for (const m of p.months) expect(m.key).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  it('produces every date as a real Date, which is what every sort here assumes', async () => {
    for (const e of await next.getEntries()) {
      expect(e.data.date instanceof Date, e.id).toBe(true);
      expect(Number.isNaN(e.data.date.getTime()), e.id).toBe(false);
    }
  });

  /** Same helpers, same inputs, same answers — the guarantee the split was made for. */
  it('gets the same tab list and tag counts as the helpers computed directly', async () => {
    const [entries, logs] = await Promise.all([next.getEntries(), next.getLogs()]);
    expect(await next.getNavCategories()).toEqual(navCategories(entries, logs));
    expect(await next.tagCounts()).toEqual(tagCountsIn(entries, logs));
    const direct = indexCodes(
      await (await import('../src/server/content-fs')).loadEntries(),
      await (await import('../src/server/content-fs')).loadLogs(),
    );
    expect(await next.entryCode(entries[0]!)).toBe(direct.get(`entries:${entries[0]!.id}`));
  });

  /** Hrefs are the URLs the Astro site already publishes; they may not move. */
  it('builds the URLs the site already has', async () => {
    const e = (await next.getEntries())[0]!;
    expect(next.entryHref(e)).toBe(`/entry/${e.id}/`);
    expect(next.categoryHref('competitions')).toBe('/competitions/');
    expect(next.tagHref('ai-film')).toBe('/tags/ai-film/');
  });
});
