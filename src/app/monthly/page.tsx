/**
 * /monthly — everything (entries + logs) grouped period → month, newest first. Periods come from
 * `src/data/periods.ts`; months without a defined period group under their own month header
 * automatically.
 */
import type { Metadata } from 'next';
import { getEntries, getLogs, getCodes, toFeed, groupByPeriod } from '@/server/content';
import PeriodGroup from '../_ui/PeriodGroup';
import JumpRail from '../_ui/JumpRail';
import PageWash from '../_chrome/PageWash';

export const metadata: Metadata = {
  title: 'Monthly log & highlights',
  description:
    'Everything — entries and monthly logs — grouped by period and month, newest first.',
  alternates: { canonical: '/monthly/' },
};

export default async function MonthlyPage() {
  const [entries, logs, codes] = await Promise.all([getEntries(), getLogs(), getCodes()]);
  const groups = groupByPeriod(toFeed(entries, logs));

  return (
    <>
      <PageWash hue={32} />
      <div className="wrap py-10">
        <header className="max-w-3xl">
          <p className="kicker">Period → month → item</p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">Monthly log &amp; highlights</h1>
          <p className="mt-3 text-lg leading-relaxed text-muted">
            The full roll: substantial entries and small monthly things, side by side. Months group
            into named periods (like Summer 2026) where one is defined, and stand alone where not.
          </p>
        </header>

        {groups.length > 0 ? (
          <div className="mt-12 gap-8 lg:grid lg:grid-cols-[10rem_1fr]">
            <JumpRail
              label="Jump to period"
              items={groups.map((group) => ({
                id: `period-${group.ref.id}`,
                label: group.ref.label,
              }))}
            />
            <div className="min-w-0 space-y-16">
              {groups.map((group) => (
                <PeriodGroup key={group.ref.id} group={group} codes={codes} showCategory />
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-8 text-muted">Nothing here yet.</p>
        )}
      </div>
    </>
  );
}
