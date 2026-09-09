import type { Metadata } from 'next';
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
      <div className="wrap max-w-3xl py-10">
        <header>
          <p className="kicker">tags</p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">Threads that run through</h1>
          <p className="mt-3 text-muted">
            The same interests keep surfacing across categories. Pull a thread:
          </p>
        </header>
        {/* This page is a single div with no <section>, so the automatic text reveal finds
            nothing to hold on to. Stagger the chips instead — the same settle the entry and
            category grids use. */}
        {recurring.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2" data-io-stagger>
            {recurring.map(({ tag, count }) => (
              <TagChip key={tag} tag={tag} count={count} />
            ))}
          </div>
        )}
        {once.length > 0 && (
          <>
            <p className="kicker mt-10">and once each, so far</p>
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
