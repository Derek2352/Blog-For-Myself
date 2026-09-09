'use client';

/**
 * Pagefind's UI, mounted.
 *
 * Pagefind indexes *built HTML*, so it is entirely framework-agnostic: the same binary that ran
 * `pagefind --site dist` after `astro build` now runs `pagefind --site out` after `next build`, and
 * the index it produces is the same shape. Nothing about this component's behaviour changed in the
 * port; only where the index comes from.
 *
 * It is loaded dynamically at runtime rather than imported, because the module does not exist
 * until after the build that indexes the pages it will search — a chicken-and-egg the bundler
 * cannot be asked to resolve.
 */
import { useEffect, useState } from 'react';

declare global {
  interface Window {
    PagefindUI?: new (opts: Record<string, unknown>) => unknown;
  }
}

export default function PagefindSearch() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let observer: MutationObserver | null = null;
    let cancelled = false;

    (async () => {
      try {
        /**
         * Loaded through a variable, and both halves of that are deliberate.
         *
         * `webpackIgnore` stops the bundler trying to resolve a file that does not exist yet:
         * `pagefind --site out` runs *after* the build that bundles this module, so at bundle
         * time there is genuinely nothing on disk. And the specifier is a variable rather than a
         * literal because TypeScript resolves literal import paths too — a `declare module` for
         * it does not match, since `/pagefind/...` reads as an absolute path rather than a bare
         * specifier, so the only honest way to say "this appears later, at exactly this URL" is
         * to keep it out of the static graph entirely.
         */
        const PAGEFIND_UI = '/pagefind/pagefind-ui.js';
        await import(/* webpackIgnore: true */ PAGEFIND_UI);
        if (cancelled) return;
        new window.PagefindUI!({
          element: '#search',
          showSubResults: true,
          showImages: false,
          autofocus: true,
        });

        /* Pagefind labels its box with a placeholder only, which disappears once you type. Add a
           persistent accessible name and keep it applied across Pagefind's re-renders
           (WCAG 3.3.2 Labels or Instructions / 4.1.2). */
        const nameInput = () => {
          const inp = document.querySelector('#search input[type="text"]');
          if (inp && inp.getAttribute('aria-label') !== 'Search entries and logs') {
            inp.setAttribute('aria-label', 'Search entries and logs');
          }
        };
        const searchEl = document.getElementById('search');
        if (searchEl) {
          observer = new MutationObserver(nameInput);
          observer.observe(searchEl, { childList: true, subtree: true });
        }
        requestAnimationFrame(nameInput);

        /* Stand the starting threads down while a query is live. Keyed on the input's value rather
           than on Pagefind's results markup: a query with no matches still means the visitor has
           told us what they want, and the suggestions would be sitting under "no results for X"
           pretending to be them. Restored on clearing the box, because that is the visitor asking
           the original question again. */
        const syncStarters = () => {
          const inp = document.querySelector<HTMLInputElement>('#search input[type="text"]');
          const starters = document.getElementById('search-start');
          if (starters) starters.hidden = !!inp && inp.value.trim().length > 0;
        };
        searchEl?.addEventListener('input', syncStarters);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, []);

  return (
    <>
      <link rel="stylesheet" href="/pagefind/pagefind-ui.css" />
      <div id="search" className="mt-8" />
      {/* Unhidden only when the index fails to load. On the deployed site that means something
          actually broke, so a visitor is handed somewhere to go rather than shell commands. */}
      {failed && (
        <p className="mt-8 text-muted">
          Search isn’t loading right now. The{' '}
          <a href="/timeline/" className="text-accent hover:underline">
            timeline
          </a>{' '}
          lists everything in one place, and{' '}
          <a href="/tags/" className="text-accent hover:underline">
            tags
          </a>{' '}
          group it by subject.
        </p>
      )}
    </>
  );
}
