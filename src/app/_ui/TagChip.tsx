import Link from 'next/link';
import { tagHref } from '@/lib/content-core';

export default function TagChip({
  tag,
  count,
  muted = false,
}: {
  tag: string;
  /**
   * How many entries carry this tag, when the caller has a reason to show it.
   *
   * Optional rather than always-on: `/search/` uses these chips as *starting points* and a number
   * there is noise on a choice the visitor is making blind, while `/tags/` uses them as an *index*
   * where recurrence is the whole subject of the page's own opening sentence. Same component, and
   * the difference is the caller's, which is where it belongs.
   */
  count?: number;
  /** Quieter type for the tail of the index — see `/tags/` for what earns it. */
  muted?: boolean;
}) {
  return (
    <Link
      href={tagHref(tag)}
      className={`rail inline-flex min-h-6 items-center rounded-(--radius-chip) border px-2 py-0.5 transition-colors hover:border-accent hover:text-accent ${
        muted ? 'border-line/60 text-muted' : 'border-line'
      }`}
    >
      #{tag}
      {count !== undefined && <span className="ml-1 text-muted">·&nbsp;{count}</span>}
    </Link>
  );
}
