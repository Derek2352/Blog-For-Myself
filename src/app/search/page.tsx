/**
 * /search — client-side full-text search over entries and logs, powered by Pagefind. The index is
 * generated after the build (see `build:next`), so it exists in a production preview and not in
 * `next dev`.
 */
import type { Metadata } from 'next';
import PageTitle from '../_ui/PageTitle';
import Link from 'next/link';
import { getCategoryIndex, getEntries, getLogs, tagCounts } from '@/server/content';
import TagChip from '../_ui/TagChip';
import PagefindSearch from '../_ui/PagefindSearch';
import PageWash from '../_chrome/PageWash';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search every entry and log on this site.',
  alternates: { canonical: '/search/' },
};

/**
 * `[PH 10]` threads. Two rows at 1280 and about four on a 390px phone — enough that the row reads
 * as a sample of a larger set rather than as the whole of it, and few enough that it is scanned
 * rather than read. The full index is one link away and says so.
 */
const STARTERS = 10;

export default async function SearchPage() {
  /**
   * What a searcher needs before they can search: what is in here, and a thread to pull.
   *
   * Measured, this page was a heading, a box and **327px of nothing** above the footer at 1280 —
   * the only page on the site that does not fill its own viewport (`scratchpad/tail-gap.mjs`). A
   * void is a fair design for a search page whose corpus the visitor already knows. This one is a
   * stranger's first stop from a CV, and it asked them to guess a word.
   *
   * The counts are read rather than written down, so the sentence cannot go stale the day an entry
   * is filed. The starting threads come from `tagCounts()` busiest-first, which is a different
   * question from `/tags/`'s alphabetical index and therefore not a second copy of it: that page is
   * for finding a word you have, this row is for being handed one.
   */
  const [entries, logs, tags, cats] = await Promise.all([
    getEntries(),
    getLogs(),
    tagCounts(),
    getCategoryIndex(),
  ]);
  const liveCats = cats.filter((c) => c.entryCount + c.logCount > 0);
  const starters = tags.slice(0, STARTERS);

  return (
    <>
      <PageWash hue={45} />
      <div className="wrap max-w-3xl py-10">
        <header>
          <p className="kicker">search</p>
          <PageTitle tail="again.">Find it</PageTitle>
          <p className="mt-3 text-muted">
            Every entry and log, searchable — competitions, trips, tools, places.
          </p>
        </header>

        <PagefindSearch />

        {/* Static, so it is there for a reader with no JavaScript too — the `<noscript>` below used
            to be the only place on this page that said where else to go, which meant the help was
            visible exactly to the people whose search box worked. It hides itself once something
            is typed, because at that point the visitor has said what they want and a list of other
            things to want is in the way. */}
        <section id="search-start" className="mt-10" aria-labelledby="search-start-h">
          <h2 id="search-start-h" className="kicker">
            or start from a thread
          </h2>
          <div className="mt-3 flex flex-wrap gap-2" data-io-stagger>
            {starters.map(({ tag }) => (
              <TagChip key={tag} tag={tag} />
            ))}
          </div>
          {/* `max-w-prose` because this is running text, not a caption. Measured at `max-w-3xl` it
              ran to **82 characters** a line (`scratchpad/measure.mjs`) — the page's own prose
              elsewhere sits at 65–68, and past about 85 the eye starts losing the start of the next
              line. Small type in a wide container is the usual way this happens: the 3xl cap was
              set for the search results, which are a list. */}
          <p className="mt-5 max-w-prose text-sm leading-relaxed text-muted">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            {logs.length > 0 && ` and ${logs.length} ${logs.length === 1 ? 'log' : 'logs'}`} across{' '}
            {liveCats.length} categories, under {tags.length} tags. The{' '}
            <Link href="/timeline/" className="text-accent hover:underline">
              timeline
            </Link>{' '}
            lists every one in date order, and{' '}
            <Link href="/tags/" className="text-accent hover:underline">
              tags
            </Link>{' '}
            has the full index.
          </p>
        </section>

        {/* Without JavaScript, none of the above can run — including the very script that unhides
            the fallback. Measured: this page rendered a heading, the promise "every entry and log,
            searchable", and then an empty void, because the only route to the apology was the route
            that was broken. A `<noscript>` is the one message that cannot depend on the thing that
            failed. */}
        <noscript>
          <p className="mt-8 text-muted">
            Search needs JavaScript — it reads an index in your browser rather than on a server.
            Everything is still reachable without it: the{' '}
            <a href="/timeline/" className="text-accent underline">
              timeline
            </a>{' '}
            lists every entry and log in one line, and{' '}
            <a href="/tags/" className="text-accent underline">
              tags
            </a>{' '}
            group them by subject.
          </p>
        </noscript>
      </div>
    </>
  );
}
