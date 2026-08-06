/**
 * The arena — steps 0 and 1 of `docs/cat-boss-gdd.md` §12.
 *
 * Step 0 is the toggle: one visible control that turns the arena on and off and
 * tells the truth about which state you are in. Step 1 is the fun hypothesis on
 * its own — **Claim + Scrub, no cat, no treats** — because if reclaiming a page
 * by dwelling on it isn't satisfying, that is the whole design failing cheaply,
 * and it should fail before a boss is written on top of it.
 *
 * DOM-free on purpose, the same bargain `cat-game.ts` makes: the arena's rules
 * can be tested without an Astro runtime, and the DOM work lives in
 * `components/CatArena.astro`.
 *
 * **Nothing here touches storage.** The GDD (§13.4, v0.2) specified a durable
 * `localStorage` opt-out beside a session-only opt-in. Building it showed the
 * entry could not change any observable behaviour: the arena is off at every page
 * load *because* "on" is session-only, so a stored "off" only ever agreed with
 * the default. Cut rather than shipped as reassuring dead code — see the v0.3
 * changelog. The cat's game still writes nothing, anywhere.
 */
import { mulberry32 } from './ink';

/* ------------------------------------------------------------------ *
 * The board (§4.1) — queried, never authored
 * ------------------------------------------------------------------ */

/**
 * What the cat may claim. Page furniture, not authored arena markup: a new
 * category page is a new board with no code change, and the fight is provably
 * *of* the page rather than lifted onto it (pillar 1).
 */
export const CLAIMABLE =
  '[data-ink-reserve], .panel, .frame, .card, .kicker, .rail, h1, h2, figure';

/**
 * Never claimable **itself** — §11: the fight does not touch anything you can
 * tab to. Deliberately not extended to descendants: a `.frame` inside a card
 * link is fair game, because tilting it leaves the link focusable, clickable and
 * exactly where it was.
 */
export const PROTECTED =
  'a, button, input, select, textarea, summary, [tabindex], [contenteditable]';

/**
 * Never claimable **anywhere inside**. Exclusion always wins here, and the
 * subtree matters as much as the element:
 *
 * - `header`, `.tabbar` — the way out is not part of the game.
 * - `.glass` — the hero pane stays legible, so the page can never become
 *   unreadable (pillar 2). It matches `CLAIMABLE` too (`[data-ink-reserve]` *is*
 *   `.glass`), and self-matching alone would still have let the cat claim the
 *   `h1` and `.kicker` *inside* it, which is the same failure by another route.
 * - the cat's own furniture — `.cat-caption` wears `.rail`, so without this the
 *   first press had the cat claiming its own score chip.
 */
export const PROTECTED_TREE = 'header, .tabbar, .glass, #site-cat, #cat-hud, #cat-treat, #cat-scrub';

/**
 * Smallest claim worth making, in px². A `.rail` line is ~2000px² and reads
 * fine; below this are the sprite stubs and empty spans, which would look like
 * the game doing nothing.
 */
export const MIN_CLAIM_AREA = 900;

/** Is this rect worth claiming? */
export function bigEnough(w: number, h: number): boolean {
  return w > 0 && h > 0 && w * h >= MIN_CLAIM_AREA;
}

/**
 * Drop any candidate that sits inside another candidate.
 *
 * Claims are transforms, and transforms compound: on the homepage `figure`
 * contains `.frame`, so claiming both tilts the image twice and scrubbing the
 * inner one leaves it visibly still claimed by the outer. Outermost wins, which
 * also makes each claim a bigger, more legible target.
 *
 * Takes its own `contains` so it stays testable without a DOM.
 */
export function dropNested<T>(items: T[], contains: (outer: T, inner: T) => boolean): T[] {
  return items.filter((inner) => !items.some((outer) => outer !== inner && contains(outer, inner)));
}

/* ------------------------------------------------------------------ *
 * Claiming
 * ------------------------------------------------------------------ */

/**
 * `[PH 0.55]` — how much of the board the cat holds at the opening whistle.
 * "Invaded, not unusable" (§10). 1.0 would break pillar 2 by making the page
 * unreadable; below ~0.3 there is nothing to push back against.
 */
export const INITIAL_CLAIM_FRACTION = 0.55;

/**
 * Which candidates start claimed, as indices into the queried list.
 *
 * Deterministic from `seed`, so a board is reproducible — a fight that cannot be
 * replayed cannot be tuned, and §9.2's daily seed needs this anyway. A shuffle
 * rather than a stride: taking every other element put every claim in reading
 * order, which read as a rendering fault rather than an invasion.
 *
 * Always leaves at least one free and claims at least one: a fully claimed page
 * is unreadable, and a fully free one makes the button look broken.
 */
export function pickClaims(count: number, fraction: number, seed: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return fraction > 0 ? [0] : [];
  const rand = mulberry32(seed);
  const order = [...Array(count).keys()];
  // Fisher-Yates, downward, so each draw is uniform over what is left
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const want = Math.min(count - 1, Math.max(1, Math.round(count * fraction)));
  return order.slice(0, want).sort((a, b) => a - b);
}

/** Biggest tilt a claim gets, in degrees. */
export const MAX_TILT = 0.5;

/**
 * Per-claim tilt, deterministic and *small*.
 *
 * 0.5° looks like a nudge rather than a glitch, and the ceiling is load-bearing
 * for more than taste: rotating a full-width block widens it, and a wide block
 * tilted 2° pushes past the viewport and hands a phone a horizontal scrollbar.
 * The arena also clips the root while it runs (see `CatArena.astro`) — belt and
 * braces, because an easter egg must not be able to break the page's layout.
 *
 * The tilt is a garnish and not the read: what actually says "the cat has this"
 * is the wash and the dashed edge, both of which live in `CatArena.astro`'s
 * stylesheet, because nothing here computes with them. Same split the glass pane
 * uses — CSS values stay in CSS, and the GDD's tuning table is where they are
 * argued over.
 */
export function claimTilt(index: number, seed: number): number {
  const r = mulberry32((seed ^ (index * 0x9e3779b9)) >>> 0)();
  return (r * 2 - 1) * MAX_TILT;
}

/* ------------------------------------------------------------------ *
 * Scrubbing — the core verb (§5.2)
 * ------------------------------------------------------------------ */

/**
 * `[PH 1400]` ms of holding still to take one claim back.
 *
 * Long enough that a pounce could plausibly arrive and interrupt it, which is
 * the whole tension once §5.3 exists. Under 900ms the pounce becomes irrelevant;
 * over ~2200ms it is tedium. Tuned as a set with `RECOVER_MS` and treat lure
 * durations (§10), none of which exist yet — so this number is a starting point,
 * not a finding.
 */
export const SCRUB_MS = 1400;

/**
 * How far the pointer may drift and still count as still, in px.
 *
 * Not zero: a hand on a trackpad is never perfectly still, and a mouse on a
 * textured surface jitters a pixel or two. Zero tolerance made the mechanic feel
 * broken rather than demanding.
 */
export const STILL_PX = 6;

/** Fraction of a scrub completed after holding still this long. */
export function scrubProgress(heldMs: number): number {
  if (!(heldMs > 0)) return 0;
  return heldMs >= SCRUB_MS ? 1 : heldMs / SCRUB_MS;
}

/** Has the pointer stayed put? Distance, not per-axis, or diagonals cheat. */
export function stillEnough(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) <= STILL_PX;
}

/* ------------------------------------------------------------------ *
 * Score, and the HUD line
 * ------------------------------------------------------------------ */

/** The cat's share of the board, 0..1 — the single axis the fight is fought on. */
export function territory(claimed: number, total: number): number {
  if (total <= 0) return 0;
  const c = Math.max(0, Math.min(claimed, total));
  return c / total;
}

/** True once the page is entirely the visitor's again. */
export function isCleared(claimed: number, total: number): boolean {
  return total > 0 && claimed <= 0;
}

/**
 * The line under the paw row while a fight is on. Replaces the treat tally for
 * the duration and is put back on truce — the HUD is aria-hidden furniture, so
 * it may say either thing, but it must never say nothing.
 */
export function arenaCaption(claimed: number, total: number): string {
  if (total <= 0) return 'nothing to fight over';
  if (isCleared(claimed, total)) return 'the page is yours';
  const freed = Math.max(0, total - Math.max(0, claimed));
  return `${freed} / ${total} reclaimed`;
}

/* ------------------------------------------------------------------ *
 * Auto-truce (§11) — nobody comes back to a page mid-invasion
 * ------------------------------------------------------------------ */

/** Tab hidden this long ends the fight by itself. */
export const HIDDEN_TRUCE_MS = 10_000;

/** Pointer gone this long does too — a fight nobody is playing is over. */
export const IDLE_TRUCE_MS = 20_000;
