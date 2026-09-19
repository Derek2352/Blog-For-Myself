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
      /*
       * **No viewport prefetching.** Next's App Router prefetches every `<Link>` that scrolls into
       * view, and in a static export each prefetch pulls a *whole HTML page* — about 46 KB
       * compressed here. On `/tags/` that is 78 of them: measured at 646 KB of the page's 952 KB,
       * 68% of a phone's download spent on pages the reader will not open.
       *
       * `false` does not mean "never". It turns off the *viewport* prefetch and keeps the one on
       * hover, which is the right split: a desktop reader still gets the instant navigation,
       * because hover is a statement of intent, and a phone — where there is no hover — stops
       * paying for a guess. The actual navigation is ~46 KB with an ETag behind it, so nothing here
       * is slow; it is only no longer speculative.
       *
       * Applied to the components that appear in *bulk* — this, EntryCard, TimelineItem, LogCard —
       * and deliberately not to the header or the tab bar, where five links cost little and are the
       * ones a reader most often takes.
       */
      prefetch={false}
      className={`rail inline-flex min-h-6 items-center rounded-(--radius-chip) border px-2 py-0.5 transition-colors [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:px-3 hover:border-secondary hover:text-secondary ${
        muted ? 'border-line/60 text-muted' : 'border-line'
      }`}
    >
      #{tag}
      {count !== undefined && <span className="ml-1 text-muted">·&nbsp;{count}</span>}
    </Link>
  );
}
