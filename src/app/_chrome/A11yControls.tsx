'use client';

/**
 * Accessibility mode — a small popover of reader toggles (larger text, high contrast, underline
 * links, reduce motion, shortcuts off). Choices persist to localStorage and are applied to `<html>`
 * before first paint by the layout's boot script. The toggles themselves are declared once in
 * `src/lib/a11y-prefs.ts` — add one there and it appears here.
 *
 * The Astro version carried a comment explaining that outside-click and Escape had to be bound on
 * `document` exactly once, because binding them inside its per-navigation setup "would stack a new
 * pair on every page load and leave old ones firing against detached header nodes". That hazard is
 * gone rather than handled: this component mounts once in the layout and its effect owns its own
 * cleanup. Worth naming, because it is the second place in the migration where a real bug the
 * Astro code had to defend against simply stops being expressible.
 */
import { useEffect, useRef, useState } from 'react';
import { a11yGroups, A11Y_KEYS } from '@/lib/a11y-prefs';
import styles from './A11yControls.module.css';

const read = (key: string): boolean => {
  try {
    return localStorage.getItem(`a11y-${key}`) === '1';
  } catch {
    return false;
  }
};

export default function A11yControls() {
  const groups = a11yGroups();
  const [open, setOpen] = useState(false);
  const [on, setOn] = useState<Record<string, boolean>>({});
  const root = useRef<HTMLDivElement>(null);

  /* Reflect stored state into the checkboxes once mounted. Rendering them checked on the server
     is impossible — localStorage is a client fact — so they start unchecked and correct
     themselves, which is also what the Astro version did. */
  useEffect(() => {
    setOn(Object.fromEntries(A11Y_KEYS.map((k) => [k, read(k)])));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const set = (key: string, value: boolean) => {
    try {
      localStorage.setItem(`a11y-${key}`, value ? '1' : '0');
    } catch {}
    document.documentElement.classList.toggle(`a11y-${key}`, value);
    setOn((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className={styles.a11y} data-a11y ref={root}>
      <button
        type="button"
        className="tap-safe inline-flex size-8 items-center justify-center border border-line text-muted transition-colors hover:border-muted hover:text-ink"
        aria-label="Accessibility options"
        aria-expanded={open}
        aria-controls="a11y-menu"
        data-a11y-toggle
        onClick={(e) => {
          /* The outside-click listener is on `document`, so without this the same click that
             opens the popover immediately closes it again. */
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="17"
          height="17"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="4" r="1.4" fill="currentColor" stroke="none" />
          <path d="M4 8h16M12 8v8m0 0-3 4m3-4 3 4" />
        </svg>
      </button>
      <div className={styles.menu} id="a11y-menu" role="group" aria-label="Accessibility" hidden={!open}>
        {groups.map((section, i) => (
          <div key={section.group}>
            <p className={`rail px-1 pb-1${i > 0 ? ' pt-2' : ''}`}>{section.group}</p>
            {section.prefs.map((pref) => (
              <label key={pref.key}>
                <input
                  type="checkbox"
                  data-a11y-opt={pref.key}
                  checked={on[pref.key] ?? false}
                  onChange={(e) => set(pref.key, e.currentTarget.checked)}
                />{' '}
                {pref.label}
              </label>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
