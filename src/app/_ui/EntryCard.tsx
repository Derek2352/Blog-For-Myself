/**
 * Card for a substantial entry. Two variants:
 *  - default: cover-led grid card (category pages, featured, related)
 *  - compact: horizontal row (monthly groupings, dense lists)
 *
 * Alt text on the card cover is intentionally empty: the adjacent title is the accessible name, so
 * screen readers hear it once. Detail pages carry full alt.
 *
 * **A plain `<img>`, not `next/image`.** A static export runs the image component unoptimized, so
 * it would emit the same tag with more machinery; and every cover on this site is an SVG, for
 * which a srcset is meaningless — Astro's `widths={[480, 800, 1200]}` was generating raster
 * variants of a vector. Width and height still come from the loader's `measure()`, which is the
 * part that mattered: they are what reserve the card's space before the cover loads.
 *
 * **What travels when a card is clicked.** `data-vt="picture"` marks the cover and `data-vt="word"`
 * the title: src/app/_chrome/PageTransitions.tsx lifts both, and the card comes apart into the page —
 * the cover grows into the entry's cover and the title into its heading (the cover stays with the old
 * page when the entry's would land off the bottom of the screen). Astro did the cover as
 * `transition:name={`cover-${id}`}`, and it was lost with the move to the App Router until the site
 * ran its own transitions.
 */
import Link from 'next/link';
import type { Entry } from '@/server/content';
import { entryHref } from '@/lib/content-core';
import { categoryBySlug } from '@/data/categories';
import { humanRange } from '@/lib/format';
import { orientation } from '@/lib/images';
import { drawnKind } from '@/lib/cover-plate';

export interface EntryCardProps {
  entry: Entry;
  /** The archival code (E-014). Resolved by the page, which already has the map open. */
  code: string;
  compact?: boolean;
  /** Show the category label (useful in mixed, cross-category contexts). */
  showCategory?: boolean;
  /** Eager-load the cover (above-the-fold cards only). */
  eager?: boolean;
  /** The lead card of a set: a larger title, and the whole summary rather than three lines. */
  feature?: boolean;
}

export default function EntryCard({
  entry,
  code,
  compact = false,
  showCategory = false,
  eager = false,
  feature = false,
}: EntryCardProps) {
  const href = entryHref(entry);
  const category = categoryBySlug(entry.data.category);
  const range = humanRange(entry.data.date, entry.data.endDate);
  // wide covers fill the card frame; tall/square ones sit matted on the surface
  const coverFit = orientation(entry.data.cover) === 'wide' ? 'object-cover' : 'object-contain';
  /* A cover this project drew rather than photographed — the plate, or an illustration. Both are
     drawn in the same measured palette, so the dark theme sinks both into the ground with the same
     filter (see the `[data-drawn]` rule in global.css) — unless it was rendered, when it carries
     its own dark picture and the filter stays off (`drawnKind`). The card does not care which it
     is; the entry page does, and asks separately. */
  const drawn = drawnKind(entry.id);
  const cover = entry.data.cover;

  if (compact) {
    return (
      <article className="card card-row group">
        <Link href={href} prefetch={false} className="flex items-center gap-5 py-4">
          <div
            className="card-cover frame h-20 w-32 shrink-0 overflow-hidden"
            data-drawn={drawn}
            data-vt="picture"
          >
            <img
              src={cover.src}
              alt=""
              width={cover.width}
              height={cover.height}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
          <div className="min-w-0">
            <p className="rail">
              {range}
              {showCategory && category && ` · ${category.label}`}
              {entry.data.draft && <span className="text-signal-text"> · draft</span>}
              <span aria-hidden="true"> · </span>
              <span aria-hidden="true">{code}</span>
            </p>
            <h3
              className="mt-1 font-display text-heading transition-colors group-hover:text-accent"
              data-vt="word"
            >
              {entry.data.title}
            </h3>
            <p className="mt-0.5 truncate text-sm text-muted">{entry.data.summary}</p>
          </div>
        </Link>
      </article>
    );
  }

  return (
    /* min-w-0: the meta line below never wraps, so without it a grid track sized `1fr` grows to
       fit the longest role and the card pushes past the viewport on a phone. */
    <article className={`card lift group min-w-0${feature ? ' card-feature' : ''}`}>
      <Link href={href} prefetch={false} className="block">
        <div className="frame mat card-cover overflow-hidden" data-drawn={drawn} data-vt="picture">
          <img
            src={cover.src}
            alt=""
            width={cover.width}
            height={cover.height}
            className={`aspect-[16/10] w-full ${coverFit}`}
            loading={eager ? 'eager' : 'lazy'}
          />
        </div>
        {/* The label under a print, in the order a reader asks: what is it, when, what was I —
            then the catalogue number, set apart on the right where a gallery puts it. One line
            always; the role is the only part that gives way (the full string in `title`). */}
        <p className="rail card-label">
          <span className="card-label-main">
            <span className="shrink-0">{range}</span>
            {entry.data.role && (
              <>
                <span aria-hidden="true" className="shrink-0">
                  ·
                </span>
                <span className="min-w-0 truncate" title={entry.data.role}>
                  {entry.data.role}
                </span>
              </>
            )}
            {entry.data.draft && <span className="shrink-0 text-signal-text">· draft</span>}
          </span>
          <span aria-hidden="true" className="card-code">
            {code}
          </span>
        </p>
        <h3
          className={`card-title font-display transition-colors group-hover:text-accent ${feature ? 'text-section' : 'text-heading'}`}
          data-vt="word"
        >
          <span className="link-draw">{entry.data.title}</span>
        </h3>
        <p className={`card-summary text-small text-muted${feature ? ' card-summary-full' : ''}`}>{entry.data.summary}</p>
        {showCategory && category && <p className="rail mt-2 text-secondary">{category.label}</p>}
      </Link>
    </article>
  );
}
