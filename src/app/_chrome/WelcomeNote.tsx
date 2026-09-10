'use client';

/**
 * First-visit welcome note. Behaviour is `src/lib/welcome-note.ts`, shared with the Astro build.
 *
 * Mounted by the root layout, so it exists on every page — which is what the Astro version got
 * from `transition:persist`. `maybeWelcome` is called once on mount rather than per navigation:
 * `handledThisVisit` guarded that in Astro because `astro:page-load` fired on every swap, and here
 * the effect simply does not.
 */
import { useEffect } from 'react';
import { site } from '@/data/site';
import { maybeWelcome } from '@/lib/welcome-note';

export default function WelcomeNote() {
  useEffect(() => {
    maybeWelcome();
  }, []);

  return (
    <dialog id="welcome-note" className="welcome" aria-labelledby="welcome-h">
      <p className="kicker">first visit · a quick map</p>
      <h2 id="welcome-h" className="mt-2 font-display text-3xl leading-tight">Glad you’re here.</h2>
      <p className="mt-3 text-[0.95rem] leading-relaxed text-muted">
        Three ways in: each tab mixes big projects with small monthly notes, the timeline runs
        everything in one line, and the honest reflection at the end of each entry is the part
        worth staying for.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        {/* `autofocus` is set on the node by ref rather than passed as React's `autoFocus`.
            React's prop calls `.focus()` when the element mounts — but this dialog does not open
            for 700ms, so that would steal focus from the page on arrival, which is the opposite
            of "a note left on the desk, not a gate". The bare HTML attribute does nothing until
            `showModal()` runs its dialog-focusing steps, which is exactly what Astro's markup
            relied on. */}
        <button
          type="button"
          data-welcome-close
          ref={(el) => {
            el?.setAttribute('autofocus', '');
          }}
          className="rounded-(--radius-chip) bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
        >
          Look around
        </button>
        <a
          href="/timeline/"
          data-welcome-close
          className="rounded-(--radius-chip) border border-line px-4 py-2 text-sm transition-colors hover:border-accent hover:text-accent"
        >
          Take the timeline
        </a>
      </div>
      {/* Points at the card, not at both cats. The wandering cat has always been found on its own
          and needs no announcing; the card is the part nobody finds by accident. Naming both made
          a first-time reader hold two cats apart before meeting either — a disambiguation where
          the rest of this note keeps to single clean clauses. */}
      <p className="rail mt-5">ps · there's a cat in the bottom corner — tap it for a game</p>
      <p className="sr-only">{site.tagline}</p>
    </dialog>
  );
}
