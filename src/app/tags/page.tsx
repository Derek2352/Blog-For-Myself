import type { Metadata } from 'next';
import { tagHref } from '@/lib/content-core';
import Link from 'next/link';
import PageTitle from '../_ui/PageTitle';
import { tagCounts } from '@/server/content';
import TagChip from '../_ui/TagChip';
import PageWash from '../_chrome/PageWash';

/**
 * This page opens by saying *"The same interests keep surfacing across categories"* — and then
 * printed forty-eight identical chips, of which **thirty-five lead to a page with one entry on
 * it**. A thread that runs through one thing is not a thread, and a page cannot make a claim its
 * own contents contradict at a glance.
 *
 * So the recurrence is drawn. Tags on more than one entry lead, with their count; the singles
 * follow in quieter type under a label that says what they are. Nothing is hidden — an index is
 * complete or it is not an index, and a one-entry tag page is a perfectly good destination from
 * the entry that carries it — but the two are no longer presented as the same kind of thing.
 *
 * Both halves stay **alphabetical**, unlike `/search/`'s starting threads which are busiest first.
 * The orders answer different questions: there you arrive with nothing and want to be handed a
 * word, here you arrive with the word and want to find it.
 */
export const metadata: Metadata = {
  title: 'Tags',
  description: 'Every tag across entries and logs.',
  alternates: { canonical: '/tags/' },
};

const byName = (a: { tag: string }, b: { tag: string }) => a.tag.localeCompare(b.tag);

export default async function TagsPage() {
  const counts = await tagCounts();
  const recurring = counts.filter((t) => t.count > 1).sort(byName);
  const once = counts.filter((t) => t.count === 1).sort(byName);

  return (
    <>
      <PageWash hue={26} />
      <div className="wrap max-w-5xl py-10">
        <header>
          <p className="kicker">tags</p>
          <PageTitle tail="run through.">Threads that</PageTitle>
          <p className="mt-5 text-lede text-muted">
            The same interests keep surfacing across categories. Pull a thread:
          </p>
        </header>
        {/* This page is a single div with no <section>, so the automatic text reveal finds
            nothing to hold on to. Stagger the chips instead — the same settle the entry and
            category grids use. */}
        {/* The threads that recur, as words rather than chips: set in the display face and sized
            by how often they come back, so the page's own claim — the same interests keep
            surfacing — is something a reader sees before reading a number. */}
        {recurring.length > 0 && (
          <ul className="tag-cloud mt-10" data-io-stagger>
            {recurring.map(({ tag, count }) => (
              <li key={tag}>
                <Link href={tagHref(tag)} prefetch={false} className="tag-word" style={{ ['--w' as string]: String(count) }}>
                  <span className="tag-hash" aria-hidden="true">#</span>
                  {tag}
                  <sup className="tag-count">{count}</sup>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {once.length > 0 && (
          <>
            <p className="kicker mt-14">and once each, so far</p>
            <div className="mt-3 flex flex-wrap gap-2" data-io-stagger>
              {once.map(({ tag }) => (
                <TagChip key={tag} tag={tag} muted />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
