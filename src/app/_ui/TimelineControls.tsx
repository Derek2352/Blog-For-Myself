'use client';

/**
 * Filter by category, and reverse the order. Twenty-one entries with only a year rail is a list you
 * scroll; this is the one idea in the Next.js drops that is functional rather than decorative, and
 * the reason it matters here is specific — a stranger arriving from a CV usually wants *one* thread
 * ("show me the competitions"), and the site could only offer them all of it or a tab bar that
 * leaves the timeline entirely.
 *
 * ## Three decisions worth stating
 *
 * **It filters the DOM, not the data.** Every entry is server-rendered and present in the HTML; the
 * chips toggle a `hidden` attribute. So the page is complete without JavaScript, every entry is
 * still indexed by Pagefind and by a crawler, and there is no second copy of the list to keep in
 * step. The drops' version re-rendered from client state, which means a reader with no JS sees an
 * empty page and a crawler sees nothing.
 *
 * **The state lives in the URL.** `?only=competitions` is shareable, survives a reload, and gives
 * the back button something to do. Written with `replaceState` rather than a router push, because
 * a filter is not a navigation: it should not stack twenty history entries for twenty chips, and
 * it must not scroll the page back to the top mid-read.
 *
 * **The year markers are part of the list.** They are `<li>`s between entries, so filtering has to
 * hide any year left with nothing under it — otherwise "2025" sits above a gap. That is the whole
 * of `syncYears`, and it is the kind of thing that looks fine until the one category that skips a
 * year.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CategoryWithCounts } from '@/server/content';

export interface TimelineControlsProps {
  /** Categories that actually appear on the timeline, with their counts. */
  categories: { slug: string; label: string; count: number }[];
  total: number;
}

const ALL = 'all';

export default function TimelineControls({ categories, total }: TimelineControlsProps) {
  const [only, setOnly] = useState<string>(ALL);
  const [oldestFirst, setOldestFirst] = useState(false);
  const [ready, setReady] = useState(false);

  /** Read the opening state from the URL, once, before anything is painted differently. */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wanted = params.get('only');
    if (wanted && categories.some((c) => c.slug === wanted)) setOnly(wanted);
    if (params.get('order') === 'oldest') setOldestFirst(true);
    setReady(true);
  }, [categories]);

  /**
   * Apply the current state to the rendered list.
   *
   * Everything here is a DOM read/write on server-rendered nodes rather than a re-render, which is
   * what keeps the no-JS page whole. `data-cat` and `data-year` are stamped by the page.
   */
  const apply = useCallback((cat: string, oldest: boolean) => {
    const list = document.querySelector<HTMLOListElement>('[data-timeline]');
    if (!list) return;

    let shown = 0;
    for (const li of list.querySelectorAll<HTMLLIElement>('li[data-cat]')) {
      const match = cat === ALL || li.dataset.cat === cat;
      li.hidden = !match;
      if (match) shown++;
    }

    /* A year marker with nothing left under it is a heading for an empty section. */
    const years = [...list.querySelectorAll<HTMLLIElement>('li[data-year]')];
    for (const marker of years) {
      let next = marker.nextElementSibling as HTMLElement | null;
      let any = false;
      while (next && !next.hasAttribute('data-year')) {
        if (next.hasAttribute('data-cat') && !(next as HTMLLIElement).hidden) {
          any = true;
          break;
        }
        next = next.nextElementSibling as HTMLElement | null;
      }
      marker.hidden = !any;
    }

    /**
     * The jump rail lists the same years and is a different element, so it has to be told.
     *
     * Missed on the first pass, and missed by the first version of `timeline-filter.mjs` too: the
     * harness walked the year markers *inside* the list and reported clean while the rail beside it
     * still offered 2025 on a filter that showed only 2026. A link that jumps to a hidden heading
     * is worse than no link, because it looks like the page is broken rather than filtered. Found
     * by looking at a screenshot after the checks were green, which is the argument for still
     * looking.
     */
    for (const link of document.querySelectorAll<HTMLAnchorElement>('.jump-rail a[data-jump]')) {
      const marker = document.getElementById(link.dataset.jump ?? '');
      link.hidden = !marker || (marker as HTMLElement).hidden;
    }

    /* Reversing is a flex order flip on the list itself, so the DOM order — which is the reading
       order, and the order a crawler sees — never changes. */
    list.style.display = 'flex';
    list.style.flexDirection = oldest ? 'column-reverse' : 'column';

    const count = document.querySelector('[data-timeline-count]');
    if (count) count.textContent = String(shown);
    return shown;
  }, []);

  useEffect(() => {
    if (!ready) return;
    apply(only, oldestFirst);
    const params = new URLSearchParams(window.location.search);
    only === ALL ? params.delete('only') : params.set('only', only);
    oldestFirst ? params.set('order', 'oldest') : params.delete('order');
    const q = params.toString();
    window.history.replaceState(null, '', q ? `?${q}` : window.location.pathname);
  }, [only, oldestFirst, ready, apply]);

  const chip = (slug: string, label: string, count?: number) => {
    const active = only === slug;
    return (
      <button
        key={slug}
        type="button"
        data-filter={slug}
        onClick={() => setOnly(slug)}
        aria-pressed={active}
        /* The count is decoration *of* the label, not part of it. Left to be read as text it
           concatenates into "Competitions & Awards 3", which a screen reader announces as the
           button's name — a name that changes whenever an entry is filed. The spoken name is
           stated here and the digits are hidden below. */
        aria-label={count === undefined ? label : `${label}, ${count} ${count === 1 ? 'entry' : 'entries'}`}
        className={[
          'rail inline-flex min-h-7 items-center gap-1.5 rounded-(--radius-chip) border px-2.5 py-1 transition-colors',
          active
            ? 'border-secondary bg-secondary text-accent-ink'
            : 'border-line text-muted hover:border-secondary hover:text-secondary',
        ].join(' ')}
      >
        {label}
        {count !== undefined && (
          <span aria-hidden="true" className={active ? 'opacity-70' : 'text-muted/70'}>
            {count}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-2 border-y border-line py-3">
      {/* A group label, because a bare row of buttons does not say what pressing one does. */}
      <span className="rail mr-1 text-muted">filter</span>
      {chip(ALL, 'Everything', total)}
      {categories.map((c) => chip(c.slug, c.label, c.count))}
      <button
        type="button"
        data-sort
        onClick={() => setOldestFirst((v) => !v)}
        aria-pressed={oldestFirst}
        className="rail ml-auto inline-flex min-h-7 items-center gap-1.5 rounded-(--radius-chip) border border-line px-2.5 py-1 text-muted transition-colors hover:border-secondary hover:text-secondary"
      >
        {oldestFirst ? 'oldest first' : 'newest first'}
        <span aria-hidden="true">{oldestFirst ? '↑' : '↓'}</span>
      </button>
    </div>
  );
}
