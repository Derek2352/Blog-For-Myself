/**
 * Accessibility preferences — the single source of truth for the reader
 * toggles in the header popover.
 *
 * Each pref maps to `localStorage["a11y-<key>"]` ('1' = on) and an
 * `.a11y-<key>` class on <html> (styled in src/styles/global.css).
 *
 * Adding a toggle = adding one object here. The popover markup, the
 * apply-on-navigation loop (A11yControls.astro) and the pre-paint loop
 * (Base.astro) all derive from this list, so they can never drift apart —
 * previously the same key list was written out in all three places.
 */
export interface A11yPref {
  /** Storage-key suffix and `a11y-<key>` class name. */
  key: string;
  /** Checkbox label shown in the popover. */
  label: string;
  /** Section heading the toggle sits under. */
  group: string;
}

export const A11Y_PREFS: readonly A11yPref[] = [
  { key: 'large', label: 'Larger text', group: 'Reading' },
  { key: 'contrast', label: 'Higher contrast', group: 'Reading' },
  { key: 'underline', label: 'Underline links', group: 'Reading' },
  { key: 'motion', label: 'Reduce motion', group: 'Reading' },
  { key: 'noshortcuts', label: 'Disable keyboard shortcuts', group: 'Input' },
];

/** Just the keys, for the loops that toggle classes from storage. */
export const A11Y_KEYS: readonly string[] = A11Y_PREFS.map((p) => p.key);

/** Prefs bucketed by section, sections in first-appearance order. */
export function a11yGroups(): { group: string; prefs: A11yPref[] }[] {
  const groups: { group: string; prefs: A11yPref[] }[] = [];
  for (const pref of A11Y_PREFS) {
    const bucket = groups.find((g) => g.group === pref.group);
    if (bucket) bucket.prefs.push(pref);
    else groups.push({ group: pref.group, prefs: [pref] });
  }
  return groups;
}

/* ------------------------------------------------------------------ *
 * Client-side helpers. These read the live DOM, so only call them from
 * browser code (component <script> blocks) — never during SSR.
 * ------------------------------------------------------------------ */

/**
 * True when motion should stand down — either the OS asks for reduced
 * motion, or the reader ticked "Reduce motion". Every animated surface
 * (the cat, reading aids, the paper-plane nav) checks this one predicate.
 */
export const motionReduced = (): boolean =>
  matchMedia('(prefers-reduced-motion: reduce)').matches ||
  document.documentElement.classList.contains('a11y-motion');

/**
 * True when the reader turned keyboard shortcuts off (WCAG 2.1.4), so the
 * "/" jump-to-search and the ←/→ entry nav stay silent.
 */
export const shortcutsDisabled = (): boolean =>
  document.documentElement.classList.contains('a11y-noshortcuts');
