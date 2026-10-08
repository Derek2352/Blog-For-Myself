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
  sortForCategory,
} from '@/server/content';
import { byPinnedOrder } from '@/lib/sort';
import { categoryBySlug } from '@/data/categories';
import { orientation } from '@/lib/images';
import { personSchema } from '@/lib/schema';
import { drawnKind } from '@/lib/cover-plate';
import { monthKey } from '@/lib/format';
import { SITE_URL } from '@/lib/site-url';
import { resolveWash } from '@/lib/wash';
import { roomOf } from '@/lib/rooms';
import EntryCard from './_ui/EntryCard';
import InkWash from './_ui/InkWash';
import HeroReel from './_ui/HeroReel';
import SectionHead from './_ui/SectionHead';

export const metadata: Metadata = { alternates: { canonical: '/' } };

/**
 * How many of a category's covers its browse panel shows. Three is a fan — enough to say "a body
 * of work" at a glance, few enough that each print is still big enough to recognise.
 */
const PRINTS = 3;

/** "2025", or "2025–2026" — the span a category's entries cover, read off their dates. */
function yearSpan(dates: Date[]): string {
  if (!dates.length) return '';
  const years = dates.map((d) => d.getUTCFullYear());
  const lo = Math.min(...years);
  const hi = Math.max(...years);
  return lo === hi ? String(lo) : `${lo}–${hi}`;
}

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
  const heroDrawn = hero ? drawnKind(hero.id) : undefined;
  const strip = (featured.length > 1 ? featured : entries).filter((e) => e !== hero).slice(0, 3);

  /* Every room with work in it, in tab order. The home page used to show only the four flagship
     categories as panels and leave the rest to the tab bar; the tab bar is gone (the work menu
     replaced it), so this is where all seven are walked past, as a list of rooms. */
  const browseCats = index.filter((c) => c.entryCount > 0);
  const subjects = browseCats.map((c) => {
    const own = sortForCategory(entries.filter((e) => e.data.category === c.slug));
    return {
      ...c,
      hue: resolveWash(c).hue,
      room: roomOf(c.slug, index),
      span: yearSpan(own.map((e) => e.data.date)),
      prints: own.slice(0, PRINTS).map((e) => ({
        id: e.id,
        cover: e.data.cover,
        drawn: drawnKind(e.id),
      })),
    };
  });

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
          context, so the wash would escape behind the page itself.

          The section is full-width and the column is a `.wrap` inside it, so the reel under the
          grid can run edge to edge. The ink stays inside the column: its canvas is sized by its
          parent, and its cost is proportional to its area (see `SLICE_MS` in ink-wash.ts). */}
      <section className="hero relative isolate">
        <div className="hero-grid wrap relative grid items-center gap-10 lg:grid-cols-[1fr_1.08fr] lg:gap-16">
        <InkWash />
        {/* The pane no longer rises as one block; its lines arrive in turn (`hero-in`, global.css).
            That is also a gift to the ink: the reserve is measured off this rectangle, and a pane
            that does not move is one the wash can measure the moment it mounts, rather than after
            waiting out a 600ms translate.

            The wrapper is for the scroll depth, and is a wrapper for a reason: an element has one
            `animation` at a time, so a scroll-linked drift on the pane itself would cancel its
            entrance. */}
        <div className="hero-copy">
          {/* `data-ink-reserve` tells the wash where the words are: it does not punch a hole — the
              ink still flows across this block — it caps the *tone* there, which is what lets the
              rest of the splash go near-black without ever putting a dark passage under a line of
              text. The cat's game reads the same attribute as the one block it may never claim
              (`PROTECTED_TREE`, src/lib/arena.ts). This used to be a frosted glass card as well;
              the words now stand on the page itself, the way a cover line does. */}
          <div className="hero-pane" data-ink-reserve>
            <p className="kicker hero-in" data-d="0">
              portfolio &amp; reflections · hong kong
            </p>
            {/* Name and tagline are one typographic unit, so the display face carries the thesis
              instead of spending its largest size on a greeting alone. */}
            <h1 className="mt-4 font-display">
              <span className="hero-in hero-focus block text-display" data-d="1">
                Hi — I’m Derek.
              </span>{' '}
              {/* The explicit space is not cosmetic: JSX strips whitespace between elements, and
                without it the h1's accessible name runs the two sentences together. */}
              <span
                className="hero-in hero-focus mt-3 block text-pretty text-turn italic text-muted"
                data-d="2"
              >
                Numbers by day, frames by night.
              </span>
            </h1>
            <p className="hero-in mt-7 max-w-(--measure-tight) text-lede text-muted" data-d="3">
              I study financial analysis &amp; FinTech, and I make AI-animated film and photographs
              — usually both at once. Each entry below is the whole story, not the one-line CV
              version.
            </p>
            <div className="hero-in mt-9 flex flex-wrap gap-3" data-d="4">
              <Link href="/timeline/" className="cta cta-primary">
                See the work
                <span aria-hidden="true" className="go-arrow">
                  →
                </span>
              </Link>
              <Link href="/about/" className="cta cta-quiet">
                More about me
              </Link>
            </div>
          </div>
        </div>
        {/* The reel, twice, and only ever one of them shown. On a phone the grid is one column
            and the featured cover comes a full screen after the words, so a reel under the grid
            would be the third thing on the page rather than part of the banner; there it runs
            between the words and the cover, where it catches the bottom of the first screen. On
            a wide screen it runs along the banner's foot. `display: none` keeps the hidden one's
            lazy images from loading at all. */}
        <HeroReel entries={entries} codes={codes} className="reel-inline lg:hidden" />
        {hero && (
          <div className="hero-art">
            <figure className="reveal-2">
              <Link href={entryHref(hero)} className="card group block">
                <div
                  className={`frame mat card-cover overflow-hidden${heroDrawn ? '' : ' blurup'}`}
                  data-drawn={heroDrawn}
                  data-vt="picture"
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
                  <span className="transition-colors group-hover:text-accent" data-vt="word">
                    {hero.data.title} →
                  </span>
                </figcaption>
              </Link>
            </figure>
          </div>
        )}
        </div>
        <HeroReel entries={entries} codes={codes} className="reel-foot hidden lg:block" />
      </section>

      {/* Selected work: the lead piece large, two beside it. */}
      {strip.length > 0 && (
        <section className="wrap reveal-3 mt-section" aria-labelledby="featured-h">
          <SectionHead
            id="featured-h"
            kicker="start here"
            title="Selected work"
            action={{ href: '/timeline/', label: 'Everything, in order' }}
          />
          <div className="featured-grid mt-10">
            {strip.map((entry, i) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                code={codes.get(`entries:${entry.id}`) ?? 'E-000'}
                feature={i === 0}
              />
            ))}
          </div>
        </section>
      )}

      {/* The rooms: every category as a numbered line on the wall — its name at the size of a
          section, what is in it, and its own covers fanned at the right, the ones its page opens
          with. The hue is the room's own wash, so walking in looks like the light the row hinted
          at. These were cream panels in a grid; a list reads as an exhibition plan, which is
          what it is. */}
      <section className="wrap mt-section" aria-labelledby="browse-h">
        <SectionHead id="browse-h" kicker="by subject" title="The rooms" />
        <ol className="rooms mt-6" data-io-stagger>
          {subjects.map((c) => (
            <li key={c.slug}>
              <Link
                href={categoryHref(c.slug)}
                prefetch={false}
                className="room-row group"
                style={{ ['--hue' as string]: String(c.hue) }}
              >
                <span className="room-num" aria-hidden="true">
                  {c.room.replace(/^Room /, '')}
                </span>
                <span className="room-text">
                  {/* The log count only appears when there is one, so no row advertises "0 logs". */}
                  <span className="rail">
                    {c.entryCount} {c.entryCount === 1 ? 'entry' : 'entries'}
                    {c.logCount > 0 && ` · ${c.logCount} ${c.logCount === 1 ? 'log' : 'logs'}`}
                    {c.span && ` · ${c.span}`}
                  </span>
                  {/* The room's name is what walks through the door: it grows into the title of
                      the page this row opens (src/app/_chrome/PageTransitions.tsx). */}
                  <h3 className="room-title font-display text-section" data-vt="word">
                    {c.label}
                  </h3>
                  <span className="room-blurb">{c.blurb}</span>
                </span>
                <span className="subject-sheet room-prints" aria-hidden="true" data-count={c.prints.length}>
                  {c.prints.map((p, i) => (
                    <span key={p.id} className="subject-print" data-i={i} data-drawn={p.drawn}>
                      <img
                        src={p.cover.src}
                        alt=""
                        width={p.cover.width}
                        height={p.cover.height}
                        loading="lazy"
                        decoding="async"
                      />
                    </span>
                  ))}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
