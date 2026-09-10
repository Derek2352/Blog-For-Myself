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
 * `transition:name={`cover-${id}`}` is gone with the view transitions — the cover no longer morphs
 * into the entry page's hero. Noted here because the class it paired with, `.card-cover`, is still
 * doing the rest of the styling and looks untouched.
 */
import Link from 'next/link';
import type { Entry } from '@/server/content';
import { entryHref } from '@/lib/content-core';
import { categoryBySlug } from '@/data/categories';
import { humanRange } from '@/lib/format';
import { orientation } from '@/lib/images';
import { isGeneratedPlate, isCoverArt } from '@/lib/cover-plate';

export interface EntryCardProps {
  entry: Entry;
  /** The archival code (E-014). Resolved by the page, which already has the map open. */
  code: string;
  compact?: boolean;
  /** Show the category label (useful in mixed, cross-category contexts). */
  showCategory?: boolean;
  /** Eager-load the cover (above-the-fold cards only). */
  eager?: boolean;
}

export default function EntryCard({
  entry,
  code,
  compact = false,
  showCategory = false,
  eager = false,
}: EntryCardProps) {
  const href = entryHref(entry);
  const category = categoryBySlug(entry.data.category);
  const range = humanRange(entry.data.date, entry.data.endDate);
  // wide covers fill the card frame; tall/square ones sit matted on the surface
  const coverFit = orientation(entry.data.cover) === 'wide' ? 'object-cover' : 'object-contain';
  /* A cover this project drew rather than photographed — the plate, or an illustration. Both are
     drawn in the same measured palette, so the dark theme sinks both into the ground with the same
     filter (see the `[data-drawn]` rule in global.css). The card does not care which it is; the
     entry page does, and asks separately. */
  const drawn = isGeneratedPlate(entry.id) ? 'plate' : isCoverArt(entry.id) ? 'art' : undefined;
  const cover = entry.data.cover;

  if (compact) {
    return (
      <article className="card panel group transition-colors hover:border-muted">
        <Link href={href} className="flex items-center gap-4 p-3">
          <div
            className="card-cover h-16 w-24 shrink-0 overflow-hidden rounded-(--radius-chip) border border-line"
            data-drawn={drawn}
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
            <h3 className="mt-0.5 font-display text-lg leading-snug transition-colors group-hover:text-accent">
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
    <article className="card lift group min-w-0">
      <Link href={href} className="block">
        <div className="frame card-cover overflow-hidden" data-drawn={drawn}>
          <img
            src={cover.src}
            alt=""
            width={cover.width}
            height={cover.height}
            className={`aspect-[16/10] w-full ${coverFit}`}
            loading={eager ? 'eager' : 'lazy'}
          />
        </div>
        {/* One line, always. This used to wrap, and a role long enough to push the code onto a
            second row dropped that card's title below its neighbours' — three cards side by side
            with three different title baselines. Now the role is the only shrinkable part: date
            and code hold their place, and the role gets whatever is left before it ellipsizes
            (the full string stays in the title attribute). */}
        <p className="rail mt-3 flex flex-nowrap items-baseline gap-x-2">
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
          <span aria-hidden="true" className="shrink-0">
            ·
          </span>
          <span aria-hidden="true" className="shrink-0">
            {code}
          </span>
        </p>
        <h3 className="mt-1.5 font-display text-[1.35rem] leading-tight transition-colors group-hover:text-accent">
          {entry.data.title}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{entry.data.summary}</p>
        {showCategory && category && <p className="rail mt-2 text-secondary">{category.label}</p>}
      </Link>
    </article>
  );
}
