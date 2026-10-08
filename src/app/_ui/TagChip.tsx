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
       * In the App Router `false` means never, on hover as well: the hover handler returns early
       * when prefetch is off (node_modules/next/dist/client/app-dir/link.js). This note used to
       * promise a hover prefetch, which is what `false` means in the Pages Router. So the page is
       * fetched when it is opened — ~46 KB with an ETag behind it, which is not slow, only no
       * longer speculative.
       *
       * Applied to the components that appear in *bulk* — this, EntryCard, TimelineItem, LogCard —
       * and to the work menu, whose panel brings every room into view at once; deliberately not to
       * the header's own links, where three links cost little and are the ones a reader most often
       * takes.
       */
      prefetch={false}
      className={`rail inline-flex min-h-6 items-center rounded-full border px-2.5 py-0.5 transition-colors [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:px-3 hover:border-secondary hover:text-secondary ${
        muted ? 'border-line/60 text-muted' : 'border-line'
      }`}
    >
      #{tag}
      {count !== undefined && <span className="ml-1 text-muted">·&nbsp;{count}</span>}
    </Link>
  );
}
