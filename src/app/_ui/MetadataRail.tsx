/**
 * The index rail for an entry: archival code, timecode-style dates, role, organization, location,
 * tags, links. Mono labels, quiet values — the signature element in its full form.
 */
import Link from 'next/link';
import type { Entry } from '@/server/content';
import { categoryHref, reflectionWritten } from '@/lib/content-core';
import { categoryBySlug } from '@/data/categories';
import { resolvePeriod } from '@/lib/periods';
import { railRange, humanRange, monthKey, readingTime } from '@/lib/format';
import TagChip from './TagChip';
import LinkPill from './LinkPill';

export default function MetadataRail({ entry, code }: { entry: Entry; code: string }) {
  const d = entry.data;
  const category = categoryBySlug(d.category);
  const period = resolvePeriod(d.date);
  const hasReflection = reflectionWritten(entry);
  const readTime = hasReflection && entry.body ? readingTime(entry.body) : null;

  return (
    <aside
      className="self-start border-t border-line lg:sticky lg:top-6 lg:order-1"
      aria-label="Entry metadata"
    >
      <dl className="divide-y divide-line text-sm">
        <div className="py-3">
          <dt className="rail">Index</dt>
          <dd className="mt-1 font-mono text-sm tracking-wide">{code}</dd>
        </div>
        <div className="py-3">
          <dt className="rail">Date</dt>
          <dd className="mt-1 font-mono text-sm tracking-wide">{railRange(d.date, d.endDate)}</dd>
          <dd className="mt-0.5 text-muted">{humanRange(d.date, d.endDate)}</dd>
        </div>
        {readTime && (
          <div className="py-3">
            <dt className="rail">Read</dt>
            <dd className="mt-1">{readTime}</dd>
          </div>
        )}
        <div className="py-3">
          <dt className="rail">Period</dt>
          <dd className="mt-1">
            <Link href={`/monthly/#period-${period.id}`} className="transition-colors hover:text-accent">
              {period.label}
            </Link>
          </dd>
        </div>
        {d.updated && (
          <div className="py-3">
            <dt className="rail">Reflection updated</dt>
            <dd className="mt-1 font-mono text-sm tracking-wide">{monthKey(d.updated)}</dd>
          </div>
        )}
        {category && (
          <div className="py-3">
            <dt className="rail">Category</dt>
            <dd className="mt-1">
              <Link href={categoryHref(category.slug)} className="transition-colors hover:text-accent">
                {category.label}
              </Link>
            </dd>
          </div>
        )}
        {d.role && (
          <div className="hidden py-3 lg:block">
            <dt className="rail">Role</dt>
            <dd className="mt-1">{d.role}</dd>
          </div>
        )}
        {d.organization && (
          <div className="py-3">
            <dt className="rail">Organization</dt>
            <dd className="mt-1">{d.organization}</dd>
          </div>
        )}
        {d.location && (
          <div className="py-3">
            <dt className="rail">Location</dt>
            <dd className="mt-1">{d.location}</dd>
          </div>
        )}
        {d.tags.length > 0 && (
          <div className="hidden py-3 lg:block">
            <dt className="rail">Tags</dt>
            <dd className="mt-1.5 flex flex-wrap gap-1.5">
              {d.tags.map((tag) => (
                <TagChip key={tag} tag={tag} />
              ))}
            </dd>
          </div>
        )}
        {d.links.length > 0 && (
          <div className="py-3">
            <dt className="rail">Links</dt>
            <dd className="mt-1.5 flex flex-wrap gap-1.5">
              {d.links.map((link) => (
                <LinkPill key={link.url} label={link.label} url={link.url} />
              ))}
            </dd>
          </div>
        )}
      </dl>
    </aside>
  );
}
