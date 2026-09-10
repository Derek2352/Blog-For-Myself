/**
 * Home — the hero, the featured strip, and the browse-by-subject grid.
 *
 * Replaces the placeholder that proved the pipeline in the first commit of this migration. Every
 * derived decision on it — which entry leads, how many browse columns, whether a log count is
 * printed — comes from the same helpers the Astro page used.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  getEntries,
  getCategoryIndex,
  getCodes,
  entryHref,
  categoryHref,
} from '@/server/content';
import { byPinnedOrder } from '@/lib/sort';
import { categoryBySlug } from '@/data/categories';
import { orientation } from '@/lib/images';
import { personSchema } from '@/lib/schema';
import { isGeneratedPlate, isCoverArt } from '@/lib/cover-plate';
import { monthKey } from '@/lib/format';
import { balancedCols } from '@/lib/layout';
import { SITE_URL } from '@/lib/site-url';
import EntryCard from './_ui/EntryCard';
import InkWash from './_ui/InkWash';

export const metadata: Metadata = { alternates: { canonical: '/' } };

/**
 * Column count follows the card count, so the last row is never a single card beside empty cells.
 * The classes are written out because Tailwind reads source text — an interpolated
 * `lg:grid-cols-${n}` would never be generated.
 */
const BROWSE_COLS: Record<number, string> = {
  1: '',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
};

export default async function HomePage() {
  const [entries, index, codes] = await Promise.all([
    getEntries(),
    getCategoryIndex(),
    getCodes(),
  ]);

  /* An author-pinned `order` leads, so the hero is an intentional choice rather than an accident
     of the newest date; entries are already newest-first, so the rest of the featured set falls in
     date order behind the pin. */
  const featured = entries.filter((e) => e.data.featured).sort(byPinnedOrder);
  const hero = featured[0] ?? entries[0];
  const heroCode = hero ? (codes.get(`entries:${hero.id}`) ?? '') : '';
  /* The same plate handling as the card and the entry page, and this is the copy that got missed
     in Astro: the hero is the largest cover on the site and the first one anyone sees, so a plate
     here unfiltered was a pale rectangle glowing out of the dark theme while every card below it
     sat correctly sunk into the ground. `data-drawn` is what `global.css` filters on, and `blurup`
     comes off with it, because a flat drawn plate has nothing to preview.

     An illustration takes the same two, for the same two reasons: it is drawn in the plate's own
     measured ground so the filter lands, and it is flat, so there is nothing to blur up from. */
  const heroDrawn = hero
    ? isGeneratedPlate(hero.id)
      ? 'plate'
      : isCoverArt(hero.id)
        ? 'art'
        : undefined
    : undefined;
  const strip = (featured.length > 1 ? featured : entries).filter((e) => e !== hero).slice(0, 3);

  const catIndex = index.filter((c) => c.entryCount + c.logCount > 0);
  /* Lead the browse with flagship categories only. The rest are reachable from the tab bar;
     listing them here as well named every category three times over. */
  const primaryCats = catIndex.filter((c) => c.primary);
  const browseCats = primaryCats.length ? primaryCats : catIndex;
  const browseCols = BROWSE_COLS[balancedCols(browseCats.length)] ?? BROWSE_COLS[3];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(personSchema(new URL(SITE_URL))).replace(/</g, '\\u003c'),
        }}
      />
      {/* Hero: photography leads; the rail annotates; the ink washes behind both. `isolate` is
          load-bearing now the canvas sits at z-index -1 — `relative` alone opens no stacking
          context, so the wash would escape behind the page itself. */}
      <section className="wrap relative isolate grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
        <InkWash />
        {/* One element, two jobs, deliberately the same rectangle.

            `data-ink-reserve` tells the wash where the words are: it does not punch a hole — the
            ink still flows across this block — it caps the *tone* there, which is what lets the
            rest of the splash go near-black without ever putting a dark passage under a line of
            text.

            `.glass` is the pane that cap was already implying. Keeping both on one div means the
            frosted rectangle and the capped rectangle cannot drift apart. */}
        <div className="reveal glass" data-ink-reserve>
          <p className="kicker">portfolio &amp; reflections · hong kong</p>
          {/* Name and tagline are one typographic unit, so the display face carries the thesis
              instead of spending its largest size on a greeting alone. */}
          <h1 className="mt-3 font-display leading-[1.05]">
            <span className="block text-4xl sm:text-5xl lg:text-[3.4rem]">Hi — I’m Derek.</span>{' '}
            {/* The explicit space is not cosmetic. JSX strips whitespace between elements, so
                without it the h1's accessible name reads "Hi — I’m Derek.Numbers by day" with the
                sentences run together — the two spans are `block`, so nothing looks wrong, and the
                only place the fault shows is a screen reader. Astro kept the source newline and got
                this for free; the parity harness caught the difference by comparing textContent. */}
            <span className="mt-2 block text-pretty text-2xl italic text-muted sm:text-3xl lg:text-[2.1rem]">
              Numbers by day, frames by night.
            </span>
          </h1>
          <p className="mt-5 max-w-[48ch] text-lg leading-relaxed text-muted">
            I study financial analysis &amp; FinTech, and I make AI-animated film and photographs —
            usually both at once. Each entry below is the whole story, not the one-line CV version.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/timeline/"
              className="rounded-(--radius-chip) bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
            >
              See the work
            </Link>
            <Link
              href="/about/"
              className="rounded-(--radius-chip) border border-line px-4 py-2 text-sm transition-colors hover:border-accent hover:text-accent"
            >
              More about me
            </Link>
          </div>
        </div>
        {hero && (
          <figure className="reveal-2">
            <Link href={entryHref(hero)} className="card group block">
              <div
                className={`frame card-cover overflow-hidden${heroDrawn ? '' : ' blurup'}`}
                data-drawn={heroDrawn}
              >
                <img
                  src={hero.data.cover.src}
                  alt=""
                  width={hero.data.cover.width}
                  height={hero.data.cover.height}
                  className={`aspect-[16/10] w-full ${
                    orientation(hero.data.cover) === 'wide' ? 'object-cover' : 'object-contain'
                  }`}
                  loading="eager"
                  fetchPriority="high"
                />
              </div>
              <figcaption className="rail mt-3 flex flex-wrap justify-between gap-x-4 gap-y-1">
                <span>
                  {heroCode} · {monthKey(hero.data.date)} ·{' '}
                  {categoryBySlug(hero.data.category)?.label ?? hero.data.category}
                </span>
                <span className="transition-colors group-hover:text-accent">
                  {hero.data.title} →
                </span>
              </figcaption>
            </Link>
          </figure>
        )}
      </section>

      {/* Featured entries */}
      {strip.length > 0 && (
        <section className="wrap reveal-3 mt-6" aria-labelledby="featured-h">
          <p className="kicker">best place to start</p>
          <h2 id="featured-h" className="mt-1 font-display text-3xl">
            Start with these
          </h2>
          <div className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {strip.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                code={codes.get(`entries:${entry.id}`) ?? 'E-000'}
              />
            ))}
          </div>
        </section>
      )}

      {/* Browse: flagship categories lead; the rest sit in the tab bar rather than being listed
          again here. */}
      <section className="wrap mt-20" aria-labelledby="browse-h">
        <p className="kicker">by category</p>
        <h2 id="browse-h" className="mt-1 font-display text-3xl">
          Or wander by subject
        </h2>
        <ul className={`mt-6 grid list-none gap-4 p-0 ${browseCols}`} data-io-stagger>
          {browseCats.map((c) => (
            <li key={c.slug}>
              {/* Clean cream panels: these used to carry their own texture and hue wash on top of
                  the page's, which was one layer too many. */}
              <Link
                href={categoryHref(c.slug)}
                className="panel lift group block h-full p-5 transition-colors hover:border-accent"
              >
                {/* The log count only appears when there is one. Every category currently has
                    zero, so this line read "3 entries · 0 logs" eight times over — a card whose
                    second fact is always the same nothing, advertising a feature the visitor
                    cannot use. The counts start showing themselves again the moment there is
                    something to count. */}
                <p className="rail">
                  {c.entryCount} {c.entryCount === 1 ? 'entry' : 'entries'}
                  {c.logCount > 0 && ` · ${c.logCount} ${c.logCount === 1 ? 'log' : 'logs'}`}
                </p>
                <h3 className="mt-2 font-display text-2xl transition-colors group-hover:text-accent">
                  {c.label}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{c.blurb}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
