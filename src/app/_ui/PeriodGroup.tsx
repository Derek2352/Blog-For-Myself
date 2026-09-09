/**
 * Renders one period bucket: reel-style header, then months, then items. Works for named periods
 * ("Summer 2026") and month fallbacks ("June 2026") alike — the month sub-headings only appear
 * inside named periods.
 *
 * `codes` is threaded through rather than fetched per card. Astro's cards each awaited
 * `entryCode()`, which was free because the map is memoised and a component may be async there. A
 * React component cannot await, so the page — which already has the map — passes it down. Same
 * numbers, one lookup, and the resolution stays where the data is.
 */
import EntryCard from './EntryCard';
import LogCard from './LogCard';
import type { PeriodGroupData } from '@/server/content';

export default function PeriodGroup({
  group,
  codes,
  headingLevel = 'h2',
  showCategory = false,
}: {
  group: PeriodGroupData;
  codes: Map<string, string>;
  headingLevel?: 'h2' | 'h3';
  showCategory?: boolean;
}) {
  const Heading = headingLevel;
  const MonthHeading = headingLevel === 'h2' ? 'h3' : 'h4';
  const headingId = `period-${group.ref.id}`;

  return (
    <section aria-labelledby={headingId} data-io-reveal>
      <header>
        <p className="kicker">
          {group.ref.kind === 'period' ? 'Reel' : 'Month'} · {group.ref.start} → {group.ref.end} ·{' '}
          {group.count} {group.count === 1 ? 'item' : 'items'}
        </p>
        {/* named periods get the full reel treatment; fallback months stay quieter */}
        <Heading
          id={headingId}
          className={`mt-1 font-display ${
            group.ref.kind === 'period' ? 'text-3xl sm:text-4xl' : 'text-2xl'
          }`}
        >
          {group.ref.label}
        </Heading>
        {group.ref.kind === 'period' && <div className="reel-ticks mt-3" aria-hidden="true" />}
      </header>

      {group.months.map((month) => (
        <div className="mt-6" key={month.key}>
          {group.ref.kind === 'period' && (
            <MonthHeading className="rail">
              {month.key} · {month.label}
            </MonthHeading>
          )}
          <div className="mt-3 grid grid-cols-1 gap-3">
            {month.items.map((item) =>
              item.type === 'entry' ? (
                <EntryCard
                  key={`e-${item.entry.id}`}
                  entry={item.entry}
                  code={codes.get(`entries:${item.entry.id}`) ?? 'E-000'}
                  compact
                  showCategory={showCategory}
                />
              ) : (
                <LogCard
                  key={`l-${item.log.id}`}
                  log={item.log}
                  code={codes.get(`logs:${item.log.id}`) ?? 'L-000'}
                  showCategory={showCategory}
                />
              ),
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
