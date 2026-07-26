/**
 * Theme helpers for the client.
 *
 * Light is the default: `.dark` is applied only when the visitor has explicitly
 * chosen it via the toggle (stored under `theme`). The site deliberately does
 * not follow `prefers-color-scheme` — a device in dark mode still lands on the
 * paper look the design is built around.
 */

/** localStorage key holding the visitor's explicit choice, if any. */
export const THEME_KEY = 'theme';

/** True when the visitor has opted into dark. Anything else (including no key) is light. */
export function darkChosen(): boolean {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark';
  } catch {
    return false;
  }
}

/**
 * Point <meta name="theme-color"> at the ground colour that is actually
 * rendering, so a phone's address bar matches the page in either theme.
 * Reads the live token rather than hardcoding hexes, which keeps the values in
 * one place (`--color-ground` in global.css).
 *
 * Base.astro carries an inline copy of this for the pre-paint pass, since an
 * `is:inline` script cannot import. Keep the two in step. That copy also has to
 * retry on DOMContentLoaded, because it runs before the stylesheet applies and
 * would otherwise read an empty token.
 */
export function syncThemeColor(): void {
  const ground = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-ground')
    .trim();
  if (ground) document.getElementById('theme-color')?.setAttribute('content', ground);
}
