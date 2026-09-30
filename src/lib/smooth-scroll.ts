/**
 * The page's one smooth scroller, and the two things anything else may ask of it.
 *
 * A module rather than a context because the callers are not all React: the page transitions are
 * started from a click listener, and they need to stop a glide in progress *before* the router
 * moves, not a render later. There is at most one instance — it scrolls the window — and it is
 * owned by src/app/_chrome/SmoothScroll.tsx, which creates and destroys it.
 */
import type Lenis from 'lenis';

let instance: Lenis | null = null;

export function setSmoothScroll(next: Lenis | null): void {
  instance = next;
}

/**
 * Stop any glide where it is and make the scroller agree with the page's real position.
 *
 * This is the whole difference between a navigation that lands at the top of the new page and one
 * that lands wherever the old page's glide was headed: the scroller keeps writing its target every
 * frame until it arrives, so a click mid-glide followed by the router's scroll to the top would be
 * overwritten a frame later. `immediate` with the current position as the target ends the glide
 * without moving anything.
 */
export function settleScroll(): void {
  instance?.scrollTo(window.scrollY, { immediate: true, force: true });
}

/** Re-measure after the page underneath changed height — a new route, mostly. */
export function remeasureScroll(): void {
  instance?.resize();
}
