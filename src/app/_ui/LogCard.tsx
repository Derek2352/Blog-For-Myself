/**
 * Card for a light monthly log. Deliberately quieter than EntryCard: smaller, sans-serif title,
 * surface panel. A log with no body is a terminal card (no detail link) — no dead pages.
 */
import Link from 'next/link';
import type { Log } from '@/server/content';
import { logHref } from '@/lib/content-core';
import { categoryBySlug } from '@/data/categories';
import KindBadge from './KindBadge';
import { isoDay } from '@/lib/format';

export default function LogCard({
  log,
  code,
  showCategory = false,
}: {
  log: Log;
  /** The archival code (L-003), resolved by the page. */
  code: string;
  showCategory?: boolean;
}) {
  const href = logHref(log);
  const category = categoryBySlug(log.data.category);

  return (
    <article className="log-row flex gap-5 py-4">
      {log.data.image && (
        <div className="frame size-16 shrink-0 overflow-hidden">
          <img
            src={log.data.image.src}
            alt=""
            width={log.data.image.width}
            height={log.data.image.height}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="rail flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{code}</span>
          <span>{isoDay(log.data.date)}</span>
          <KindBadge kind={log.data.kind} />
          {showCategory && category && <span>{category.label}</span>}
          {log.data.draft && <span className="text-signal-text">draft</span>}
        </p>
        <h3 className="mt-1 font-display text-heading">
          {href ? (
            <Link href={href} prefetch={false} className="transition-colors hover:text-accent">
              {log.data.title}
            </Link>
          ) : (
            log.data.title
          )}
        </h3>
        {log.data.summary && <p className="mt-1 text-small text-muted">{log.data.summary}</p>}
        {log.data.link && (
          <a
            href={log.data.link}
            target="_blank"
            rel="noopener"
            className="rail mt-1.5 inline-block transition-colors hover:text-accent"
          >
            link ↗
          </a>
        )}
      </div>
    </article>
  );
}
