/**
 * One frame on the /timeline reel: mono month + index code in the gutter, title/role/summary in
 * the body.
 */
import Link from 'next/link';
import type { Entry } from '@/server/content';
import { entryHref } from '@/lib/content-core';
import { categoryBySlug } from '@/data/categories';
import { monthKey } from '@/lib/format';

export default function TimelineItem({ entry, code }: { entry: Entry; code: string }) {
  const category = categoryBySlug(entry.data.category);
  return (
    <li
      className="grid grid-cols-[5.2rem_1fr] gap-4 border-b border-line py-5 sm:grid-cols-[6.5rem_1fr] sm:gap-6"
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
        <h3 className="font-display text-xl leading-snug sm:text-2xl">
          <Link href={entryHref(entry)} className="transition-colors hover:text-accent">
            {entry.data.title}
          </Link>
        </h3>
        <p className="rail mt-1">
          {category?.label}
          {entry.data.role && ` · ${entry.data.role}`}
          {entry.data.draft && <span className="text-signal-text"> · draft</span>}
        </p>
        <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted">
          {entry.data.summary}
        </p>
      </div>
    </li>
  );
}
