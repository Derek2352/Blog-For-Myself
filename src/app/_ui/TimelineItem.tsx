/**
 * One frame on the /timeline reel: mono month + index code in the gutter, title/role/summary in
 * the body, and the entry's own still life at the right.
 *
 * The cover came in when the covers became pictures worth looking at: a timeline of twenty-one
 * text blocks read as a changelog, and the same list with each entry's photograph beside it reads
 * as a contact sheet of the year — which is what a reel of the work should be. The picture is a
 * second way into the same page, so it is hidden from the accessibility tree and the tab order;
 * the title stays the one link a keyboard or a screen reader meets.
 */
import Link from 'next/link';
import type { Entry } from '@/server/content';
import { entryHref } from '@/lib/content-core';
import { categoryBySlug } from '@/data/categories';
import { monthKey } from '@/lib/format';
import { drawnKind } from '@/lib/cover-plate';

export default function TimelineItem({ entry, code }: { entry: Entry; code: string }) {
  const category = categoryBySlug(entry.data.category);
  const href = entryHref(entry);
  const cover = entry.data.cover;
  return (
    <li
      className="timeline-item group"
      /* Read by TimelineControls, which filters these nodes in place rather than re-rendering the
         list — see that component for why the server-rendered DOM is the source of truth. */
      data-cat={entry.data.category}
      data-io-reveal
    >
      <div className="rail pt-1">
        <p>{monthKey(entry.data.date)}</p>
        <p className="mt-0.5 text-accent">{code}</p>
      </div>
      <div className="min-w-0">
        <h3 className="font-display text-heading">
          <Link href={href} prefetch={false} className="transition-colors hover:text-accent group-hover:text-accent">
            {entry.data.title}
          </Link>
        </h3>
        <p className="rail mt-1.5">
          {category?.label}
          {entry.data.role && ` · ${entry.data.role}`}
          {entry.data.draft && <span className="text-signal-text"> · draft</span>}
        </p>
        <p className="mt-2 max-w-prose text-small text-muted">{entry.data.summary}</p>
      </div>
      <Link href={href} prefetch={false} className="timeline-thumb frame" aria-hidden="true" tabIndex={-1} data-drawn={drawnKind(entry.id)}>
        <img src={cover.src} alt="" width={cover.width} height={cover.height} loading="lazy" decoding="async" />
      </Link>
    </li>
  );
}
