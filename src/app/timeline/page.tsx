/**
 * /timeline — every entry across all categories in one chronological reel, newest first, with year
 * markers. The one place the numbering/reel treatment runs at full strength.
 */
import type { Metadata } from 'next';
import PageTitle from '../_ui/PageTitle';
import TimelineControls from '../_ui/TimelineControls';
import { getEntries, getCodes, getCategoryIndex, type Entry } from '@/server/content';
import TimelineItem from '../_ui/TimelineItem';
import JumpRail from '../_ui/JumpRail';
import PageWash from '../_chrome/PageWash';

export const metadata: Metadata = {
  title: 'Timeline',
  description: 'Every entry across all categories, in one chronological reel.',
  alternates: { canonical: '/timeline/' },
};

type Row = { type: 'year'; year: number } | { type: 'entry'; entry: Entry };

export default async function TimelinePage() {
  const [entries, codes, index] = await Promise.all([getEntries(), getCodes(), getCategoryIndex()]);

  /* Only the categories that actually appear on this page, with the count each one filters to —
     offering a chip that resolves to nothing is the same fault as an empty category in the tab
     bar, which `getNavCategories` already refuses to do. */
  const present = index
    .map((c) => ({
      slug: c.slug,
      label: c.label,
      count: entries.filter((e) => e.data.category === c.slug).length,
    }))
    .filter((c) => c.count > 0);

  const rows: Row[] = [];
  const years: number[] = [];
  let currentYear: number | null = null;
  for (const entry of entries) {
    const year = entry.data.date.getUTCFullYear();
    if (year !== currentYear) {
      rows.push({ type: 'year', year });
      years.push(year);
      currentYear = year;
    }
    rows.push({ type: 'entry', entry });
  }

  return (
    <>
      <PageWash hue={350} />
      <div className="wrap py-10">
        <header className="max-w-3xl">
          <p className="kicker">
            <span data-timeline-count>{entries.length}</span> of {entries.length} entries
          </p>
          <PageTitle tail="so far.">The story,</PageTitle>
        </header>

        <TimelineControls categories={present} total={entries.length} />

        <h2 className="sr-only">All entries, newest first</h2>
        <div className="mt-10 gap-8 lg:grid lg:grid-cols-[4rem_1fr]">
          <JumpRail
            label="Jump to year"
            items={years.map((y) => ({ id: `year-${y}`, label: String(y) }))}
          />
          <div className="relative pl-6 sm:pl-9">
            <div className="reel-ticks-v absolute bottom-0 left-0 top-0" aria-hidden="true" />
            <ol className="list-none p-0" data-timeline>
              {rows.map((row) =>
                row.type === 'year' ? (
                  <li
                    key={`y-${row.year}`}
                    id={`year-${row.year}`}
                    data-year={row.year}
                    className="scroll-mt-24 pb-1 pt-8 first:pt-0"
                  >
                    <p className="font-display text-3xl text-muted" aria-label={`Year ${row.year}`}>
                      {row.year}
                    </p>
                  </li>
                ) : (
                  <TimelineItem
                    key={row.entry.id}
                    entry={row.entry}
                    code={codes.get(`entries:${row.entry.id}`) ?? 'E-000'}
                  />
                ),
              )}
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}
