'use client';

/**
 * Reading progress bar + back-to-top button for long detail pages. Progress reflects how far
 * through the article you are; the button appears past the first screen. Both are motion-safe.
 *
 * Astro kept its scroll listener on `document` "registered ONCE for the session" with the elements
 * re-queried per navigation, because binding inside its page-load callback "would stack a fresh
 * listener on every navigation". Here the component only mounts on the pages that have it and
 * unmounts with them, so the listener's lifetime is the elements' lifetime and refs replace the
 * re-querying entirely.
 */
import { useEffect, useRef } from 'react';
import { motionReduced } from '@/lib/a11y-prefs';

export default function ReadingAids() {
  const bar = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      const pct = max > 0 ? Math.min(1, doc.scrollTop / max) : 0;
      if (bar.current) bar.current.style.width = `${(pct * 100).toFixed(1)}%`;
      btn.current?.classList.toggle('show', doc.scrollTop > doc.clientHeight * 0.6);
    };
    document.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => document.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <div className="reading-progress" data-progress aria-hidden="true" ref={bar} />
      <button
        type="button"
        className="to-top"
        data-to-top
        aria-label="Back to top"
        ref={btn}
        onClick={() => window.scrollTo({ top: 0, behavior: motionReduced() ? 'auto' : 'smooth' })}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </button>
    </>
  );
}
