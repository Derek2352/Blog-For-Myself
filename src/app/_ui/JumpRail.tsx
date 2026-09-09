'use client';

/**
 * Sticky anchor rail for long index pages — `/timeline` (years) and `/monthly` (periods).
 * Highlights whichever section is currently in view.
 *
 * Renders nothing for a single item: a rail with one target is noise. Each `item.id` must match
 * the `id` of an element on the page.
 *
 * ## Which section is the reader in?
 *
 * **The rail used to answer that almost never**, and the history is kept because the fix is not
 * obvious and the second attempt was also wrong. Measured on `/monthly/` with
 * `scratchpad/rail-spy.mjs`: nothing at all was marked at scroll 0, at 1200 or at 2400 — and at
 * the very bottom `October 2025` lit up and then **stayed lit all the way back to the top**.
 *
 * Two causes. `getElementById` returned the **heading**, because `PeriodGroup` puts the id on the
 * `<h2>` and points the section at it with `aria-labelledby` — correct markup, and not what the
 * observer assumed. A heading is ~40px tall against a band 10% of the viewport high, so it
 * intersected for about 130px of scroll; a section is in that band the whole time you read it. And
 * the callback only ever *set* a mark, so nothing cleared it when the last target left.
 *
 * **The observer went too, and that took a second measurement to see.** Keeping it as a cheap
 * trigger looked right: the moments its entries flip are the moments the answer changes. They are
 * not, when the target is small. Jump 400px on `/timeline/` and the 2026 marker goes from *below*
 * the band to *above* it in one frame — `isIntersecting` is false on both sides, no callback
 * fires, and the rail marks nothing. `rail-spy.mjs` reported exactly that: eleven-item `/monthly/`
 * fixed and two-item `/timeline/` still blank everywhere. A boolean that happens to be equal
 * before and after is not a way to detect that something moved.
 *
 * So the answer is computed from the rects: the current target is the **last one whose top has
 * passed the reading line**. That is "the one I am inside" on `/monthly/`, where targets are tall
 * sections, and "the last year I scrolled past" on `/timeline/`, where they are 40px `<li>`
 * markers — one rule, both shapes, and right in the gaps where nothing intersects anything.
 */
import { useEffect, useRef } from 'react';

export interface JumpItem {
  id: string;
  label: string;
}

/** Matches the old `-10%` rootMargin: the line the eye reads at, not the top of the window. */
const READING_LINE = 0.2;

export default function JumpRail({ items, label }: { items: JumpItem[]; label: string }) {
  const nav = useRef<HTMLElement>(null);

  useEffect(() => {
    const links = [...(nav.current?.querySelectorAll<HTMLAnchorElement>('a[data-jump]') ?? [])];
    if (!links.length) return;

    /* The id may be on the heading or on the region itself, depending on the page. `closest` takes
       whichever is there rather than requiring every caller to agree with this file — `/timeline/`
       and `/monthly/` build their sections in different components. */
    const pairs = links
      .map((a) => {
        const el = document.getElementById(a.dataset.jump!);
        return el ? { link: a, region: (el.closest('section') ?? el) as HTMLElement } : null;
      })
      .filter((p): p is { link: HTMLAnchorElement; region: HTMLElement } => p !== null);
    if (!pairs.length) return;

    const paint = () => {
      const line = window.innerHeight * READING_LINE;
      let current: HTMLAnchorElement | null = null;
      for (const { link, region } of pairs) {
        if (region.getBoundingClientRect().top <= line) current = link;
      }
      /* `current` is null above the first section — at the top of the page the reader is in the
         page's own header, not in a period, and saying nothing is the honest answer there. */
      for (const { link } of pairs) link.classList.toggle('here', link === current);
    };

    let queued = 0;
    const onScroll = () => {
      if (queued) return;
      queued = requestAnimationFrame(() => {
        queued = 0;
        paint();
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    /* Once up front, so a page restored mid-scroll (a back navigation, a `#hash` landing) is
       marked before the reader touches anything. */
    paint();
    return () => {
      if (queued) cancelAnimationFrame(queued);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [items]);

  if (items.length <= 1) return null;

  return (
    <nav className="jump-rail hidden lg:flex" aria-label={label} ref={nav}>
      {items.map((item) => (
        <a key={item.id} href={`#${item.id}`} data-jump={item.id}>
          {item.label}
        </a>
      ))}
    </nav>
  );
}
