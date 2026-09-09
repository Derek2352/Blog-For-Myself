'use client';

/**
 * Dark-mode toggle. Persists to localStorage; the layout's boot script applies it pre-paint.
 *
 * The Astro version re-attached its click handler inside an `astro:page-load` listener, which was
 * safe only because the router replaced the button element on every swap — a fresh element cannot
 * accumulate handlers. Here the button is never replaced, so that shape would add a listener per
 * navigation. React's own binding is the fix, and it removes the reason the listener existed.
 *
 * `mounted` guards the pressed state rather than the button: the server render has no idea what is
 * in localStorage, so rendering `aria-pressed` before hydration would emit a value that is wrong
 * half the time and mismatch. The button itself is present from the first byte — it just does not
 * claim a state until it can know one.
 */
import { useEffect, useState } from 'react';
import { THEME_KEY, syncThemeColor } from '@/lib/theme';

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    setMounted(true);
    /* Belt and braces: the pre-paint pass in the layout already does this, but if it ran before
       the stylesheet applied it would have read an empty token. */
    syncThemeColor();
  }, []);

  /* There is deliberately no prefers-color-scheme listener. Light is the default, so following a
     live OS switch would drag a visitor who never chose into dark and quietly defeat that default.
     Dark is opt-in through this button. */
  const toggle = () => {
    const next = document.documentElement.classList.toggle('dark');
    try {
      localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
    } catch {}
    setDark(next);
    syncThemeColor();
  };

  return (
    <button
      id="theme-toggle"
      type="button"
      onClick={toggle}
      aria-pressed={mounted ? dark : undefined}
      className="tap-safe inline-flex size-8 items-center justify-center border border-line text-muted transition-colors hover:border-muted hover:text-ink"
      aria-label="Toggle dark mode"
    >
      <svg
        className="size-4 dark:hidden"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
      <svg
        className="hidden size-4 dark:block"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41" />
      </svg>
    </button>
  );
}
