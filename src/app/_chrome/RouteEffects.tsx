'use client';

/**
 * The four behaviours Astro attached to `astro:page-load` / `astro:after-swap`.
 *
 * Astro's `<ClientRouter />` swaps documents and fires its own lifecycle events, and `Base.astro`
 * hung four things off them: the scroll-reveal observer, the image blur-up, the sticky header, and
 * the focus-and-announce that tells a screen-reader user the page changed. None of those events
 * exist here. The App Router's equivalent signal is `usePathname()` changing, so this component
 * lives in the root layout — mounted once, never unmounted — and re-runs the same work when the
 * path does.
 *
 * The logic below is deliberately a **transcription**, not a rewrite. Every rule in it was arrived
 * at by someone watching the page misbehave, and re-deriving them in React idiom would be
 * re-deriving the bugs. Where a comment explains why a rule exists, the comment came with it.
 */
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { motionReduced } from '@/lib/a11y-prefs';

const REVEAL_SEL = '[data-io-reveal], [data-io-stagger], [data-io-text]';

const revealAll = () =>
  document.querySelectorAll(REVEAL_SEL).forEach((el) => el.classList.add('io-in'));

/**
 * Tag content blocks so they arrive as the reader reaches them.
 *
 * Two rules earn their keep. **Only below the fold**: the CSS drops opacity to 0 the moment the
 * attribute lands, so tagging something already on screen would blink it out and fade it back on
 * every page load. And **leaf-most wins**: a candidate that contains another candidate is dropped,
 * which gives paragraph-level arrival inside a reflection and section-level arrival on pages
 * without prose, never both nested.
 */
function markTextReveals(): void {
  const fold = window.innerHeight;
  const candidates = [
    ...document.querySelectorAll<HTMLElement>('.prose-reflection > *, main section'),
  ].filter((el) => {
    if (el.hasAttribute('data-io-reveal') || el.hasAttribute('data-io-text')) return false;
    // staggered grids animate their own children; the sticky jump rail must not move at all
    if (el.closest('[data-io-stagger], .jump-rail')) return false;
    const box = el.getBoundingClientRect();
    if (box.height === 0) return false;
    return box.top > fold; // strictly below the first screen
  });
  // drop any candidate that wraps another — keep the innermost
  const leaves = candidates.filter(
    (el) => !candidates.some((other) => other !== el && el.contains(other)),
  );
  for (const el of leaves) el.setAttribute('data-io-text', '');
}

export default function RouteEffects() {
  const pathname = usePathname();
  /* Astro tracked this in a module-scope `let`, which survived its document swaps. A ref is the
     same lifetime here: one instance in the root layout, so it persists across navigations while
     staying out of React's render cycle. */
  const lastY = useRef(0);

  /* Reveals and blur-up: re-run per navigation, because the new page has new nodes. */
  useEffect(() => {
    let io: IntersectionObserver | null = null;
    /* `motionReduced()` covers the OS setting *and* the site's own toggle, which reveals used to
       ignore entirely — the toggle only zeroes transition durations, so a block that never
       scrolled into view stayed invisible. */
    if (motionReduced() || !('IntersectionObserver' in window)) {
      revealAll();
    } else {
      markTextReveals();
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              e.target.classList.add('io-in');
              io?.unobserve(e.target);
            }
          }
        },
        /* Trigger a little *before* a block scrolls in rather than 8% after, so prose has settled
           by the time the eye arrives. Text that catches up late reads as jank, which is the
           opposite of the point. */
        { rootMargin: '0px 0px 6% 0px' },
      );
      const observer = io;
      document
        .querySelectorAll(REVEAL_SEL)
        .forEach((el) => !el.classList.contains('io-in') && observer.observe(el));
    }

    // Blur-up: fade each image in once it has decoded.
    document.querySelectorAll<HTMLImageElement>('.blurup img').forEach((img) => {
      if (img.complete) img.classList.add('loaded');
      else img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
    });

    /* Astro had to retire the previous page's observer by hand, because elements that never
       scrolled into view stayed observed and each navigation left another observer alive holding
       detached nodes. An effect cleanup is the same fix, and this time the language enforces it. */
    return () => io?.disconnect();
  }, [pathname]);

  /**
   * Sticky header: hide on scroll-down, show on scroll-up.
   *
   * Registered once rather than per navigation — Astro registered it on `document` for the same
   * reason — and the header element is re-queried each frame so a swapped page still works.
   */
  useEffect(() => {
    const onScroll = () => {
      const header = document.querySelector<HTMLElement>('body > header');
      if (!header) return;
      const y = window.scrollY;
      if (y <= 80) {
        header.classList.remove('header-tucked', 'header-scrolled');
      } else if (y > lastY.current + 5) {
        if (!motionReduced()) header.classList.add('header-tucked');
        header.classList.add('header-scrolled');
      } else if (y < lastY.current - 5) {
        header.classList.remove('header-tucked');
        header.classList.add('header-scrolled');
      }
      lastY.current = y;
    };
    document.addEventListener('scroll', onScroll, { passive: true });
    return () => document.removeEventListener('scroll', onScroll);
  }, []);

  /* A new page must not inherit the previous one's tucked header or scroll position. */
  useEffect(() => {
    lastY.current = window.scrollY;
    document.querySelector<HTMLElement>('body > header')?.classList.remove('header-tucked');
  }, [pathname]);

  /**
   * Move focus to `<main>` and announce the new title, so screen-reader users learn the page
   * changed — a client-side navigation is otherwise silent.
   *
   * Skipped on the very first render: on a full page load the browser has already announced the
   * document, and stealing focus to `<main>` there would drop the visitor past the header on
   * arrival. Astro got this free, because `astro:after-swap` only fires on a *swap*.
   */
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const announce = document.querySelector('[data-route-announce]');
    if (announce) announce.textContent = document.title.replace(/ — .*/, '');
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [pathname]);

  return null;
}
