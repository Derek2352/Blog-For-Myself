/**
 * Category page — routes are generated from `src/data/categories.ts` alone. Adding a category
 * object there creates this page; nothing here is category-specific. Two sections: the entries
 * grid, then that category's monthly log grouped period → month.
 */
import type { Metadata } from 'next';
import PageTitle from '../_ui/PageTitle';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { categories, RESERVED_SLUGS, categoryBySlug } from '@/data/categories';
import {
  categoryHref,
  getCategoryIndex,
  getCodes,
  getEntries,
  getLogs,
  sortForCategory,
  toFeed,
  groupByPeriod,
} from '@/server/content';
import { resolveWash } from '@/lib/wash';
import EntryCard from '../_ui/EntryCard';
import PeriodGroup from '../_ui/PeriodGroup';
import PageWash from '../_chrome/PageWash';

/**
 * The collision guard Astro ran inside `getStaticPaths`, kept and kept *throwing*.
 *
 * A category slug that matches a fixed route — `about`, `search`, `tags` — would silently shadow
 * or be shadowed by that page depending on which router resolved first. Failing the build with the
 * offending name is the only outcome that cannot be missed.
 */
export function generateStaticParams() {
  for (const c of categories) {
    if ((RESERVED_SLUGS as readonly string[]).includes(c.slug)) {
      throw new Error(
        `Category slug "${c.slug}" collides with a fixed route. Rename it in src/data/categories.ts (reserved: ${RESERVED_SLUGS.join(', ')}).`,
      );
    }
  }
  return categories.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category: slug } = await params;
  const category = categoryBySlug(slug);
  if (!category) return {};
  const [entries, logs] = await Promise.all([getEntries(), getLogs()]);
  const empty =
    entries.filter((e) => e.data.category === slug).length === 0 &&
    logs.filter((l) => l.data.category === slug).length === 0;
  return {
    title: category.label,
    description: category.blurb || undefined,
    alternates: { canonical: categoryHref(slug) },
    openGraph: { images: [{ url: `/og/category/${slug}.png` }] },
    /* A category with nothing filed under it is thin, not secret: `noindex, follow`. It was in
       the sitemap with no robots meta at all, so a page whose entire content is "Nothing here
       yet." was being offered to search engines while being unreachable by clicking. Read off the
       page's own contents, so the flag lifts by itself the day something lands here. */
    ...(empty ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: slug } = await params;
  const category = categoryBySlug(slug);
  if (!category) notFound();

  const [allEntries, allLogs, codes, index] = await Promise.all([
    getEntries(),
    getLogs(),
    getCodes(),
    getCategoryIndex(),
  ]);
  const entries = sortForCategory(allEntries.filter((e) => e.data.category === slug));
  const logs = allLogs.filter((l) => l.data.category === slug);
  const logGroups = groupByPeriod(toFeed([], logs));
  const wash = resolveWash(category);

  /**
   * Somewhere to go when this page has nothing. Only *populated* categories are offered — sending
   * a visitor from one empty category to another would be the page repeating the problem it is
   * apologising for. Busiest first, and the cap is the whole list: there are eight categories, so
   * an empty page can offer at most seven, which is a row of chips rather than a decision.
   */
  const siblings =
    entries.length > 0
      ? []
      : index
          .filter((c) => c.slug !== slug && c.entryCount > 0)
          .sort((a, b) => b.entryCount - a.entryCount || a.label.localeCompare(b.label));

  return (
    <>
      <PageWash hue={wash.hue} tab={slug} />
      <div className="wrap py-10">
        <header className="max-w-3xl">
          <p className="kicker">Index / {category.slug}</p>
          <PageTitle>{category.label}</PageTitle>
          {category.blurb && (
            <p className="mt-3 text-lg leading-relaxed text-muted">{category.blurb}</p>
          )}
          {/* Same rule as the browse cards on the home page: a count of nothing is not a fact
              worth printing. Every category reads "0 logs" today, so this line spent half its
              width telling eight different pages the same absence. */}
          {(entries.length > 0 || logs.length > 0) && (
            <p className="rail mt-4">
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
              {logs.length > 0 && ` · ${logs.length} ${logs.length === 1 ? 'log' : 'logs'}`}
            </p>
          )}
        </header>

        <section className="mt-10" aria-labelledby="entries-h">
          <h2 id="entries-h" className="sr-only">
            Entries
          </h2>
          {entries.length > 0 ? (
            <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3" data-io-stagger>
              {entries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  code={codes.get(`entries:${entry.id}`) ?? 'E-000'}
                />
              ))}
            </div>
          ) : (
            <div className="max-w-prose">
              <p className="font-display text-2xl italic leading-snug">Nothing here yet.</p>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                This part of the site is still being filled in. The{' '}
                <Link href="/timeline/" className="text-accent hover:underline">
                  timeline
                </Link>{' '}
                has everything published so far.
              </p>
            </div>
          )}
        </section>

        {/* The recovery path. Measured at 1280, an empty category was 900px tall — exactly one
            viewport — with 212px of nothing between the last sentence and the footer. A visitor
            who lands on an empty category wants a category that is not empty, and "the timeline
            has everything" is a list of *everything*, which hands somebody who asked a narrow
            question the widest possible answer.

            Counts included, unlike the home page's browse cards where the count is decoration:
            here the count *is* the recommendation, because the one thing this visitor now knows
            is that a category on this site can be empty. */}
        {siblings.length > 0 && (
          <section className="mt-12" aria-labelledby="siblings-h">
            <h2 id="siblings-h" className="kicker">
              these have things in them
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2" data-io-stagger>
              {siblings.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={categoryHref(c.slug)}
                    className="rail inline-flex min-h-6 items-center rounded-(--radius-chip) border border-line px-2 py-0.5 transition-colors hover:border-accent hover:text-accent"
                  >
                    {c.label} · {c.entryCount}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* The monthly log is a *secondary* section, and that is what decides whether its empty
            state ships. The entries section above keeps its "Nothing here yet" because entries are
            the reason the page exists. This one used to spend a kicker, a 3xl heading and a
            sentence saying "No monthly notes filed under this one yet" on all eight categories,
            none of which has ever had a log — a section whose only content is an apology for
            itself, leaving roughly five hundred pixels of nothing above the footer.

            Astro kept the author's hint behind `import.meta.env.DEV`. A static export has no
            equivalent a reader could never reach, so it is left out entirely: `npm run new-log` is
            documented in the README, and a dev-only string nobody sees is not worth a branch that
            ships. */}
        {logGroups.length > 0 && (
          <section className="mt-20" aria-labelledby="monthly-log-h">
            <p className="kicker">Monthly log</p>
            <h2 id="monthly-log-h" className="mt-1 font-display text-3xl">
              Small things, monthly
            </h2>
            <div className="mt-8 space-y-12">
              {logGroups.map((group) => (
                <PeriodGroup key={group.ref.id} group={group} codes={codes} headingLevel="h3" />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
