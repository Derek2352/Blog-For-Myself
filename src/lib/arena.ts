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
 * Pounce — the threat that makes holding still a decision (§5.3)
 * ------------------------------------------------------------------ */

/**
 * The boss's whole state machine. Four phases, one at a time, by construction —
 * §5.3's "two pounces queued" edge case is impossible if there is only ever one
 * of these.
 */
export type Phase = 'stalk' | 'telegraph' | 'leap' | 'recover';

/** `[PH 420]` ms of wind-up. Human reaction is ~250ms; the rest is read time. */
export const TELEGRAPH_MS = 420;

/** `[PH 260]` ms in the air. Longer than ~400 and it reads as a stroll. */
export const LEAP_MS = 260;

/**
 * `[PH 700]` ms helpless after landing — the player's free window.
 *
 * §10 justified this as "must exceed `SCRUB_MS/2` so a whiff is a real reward",
 * and at 700 against a 1400ms scrub it is *exactly* half, which buys half a scrub
 * and completes nothing. Working through it, the rationale was aiming at the wrong
 * thing anyway:
 *
 * - Dodging means moving, and moving resets the hold (`stillEnough`). So a dodge
 *   never banks progress, whatever this number is.
 * - What a dodge actually buys is **relocation**. The cat lands where you *were*
 *   and has to walk back at `STALK_SPEED`, so the free window is this plus travel
 *   — and how much travel is the player's decision, which is the interesting part.
 *
 * So the property worth holding is narrower: a whiff must cost the cat more than
 * the attack gained it (`> TELEGRAPH_MS + LEAP_MS`). That is what the test asserts,
 * and it is why raising the telegraph without raising this would quietly make
 * pouncing free.
 */
export const RECOVER_MS = 700;

/** `[PH 90]` px. ~2.5× the existing `chase` trigger (34px) in `SiteCat.astro`. */
export const POUNCE_RANGE = 90;

/**
 * `[PH 0.35]` — how far into a scrub the cat waits before committing.
 *
 * The point is that it looks like it is *reading* you: interrupting a scrub that
 * had barely started would feel arbitrary, and interrupting one at 0.9 feels like
 * being robbed. Anything above this is fair game, and the cat prefers later.
 */
export const POUNCE_THRESHOLD = 0.35;

/** How close the landing has to be to the cursor to count as a hit, in px. */
export const HIT_RADIUS = 46;

/**
 * `[PH 170]` px/s while stalking.
 *
 * Deliberately slower than a hand: fleeing has to work, because "move the pointer"
 * is one of only three inputs (§3). The cost of fleeing is that you cannot scrub
 * while you do it, which is the whole tension — not that the cat can be outrun.
 * The site cat walks at 42px/s; a boss at 42px/s never arrives.
 */
export const STALK_SPEED = 170;

/**
 * `[PH 2500]` ms of grace at the start, aggression pinned to nothing.
 *
 * §7.4 asked for 6s and this is 2.5s, deliberately: 0.1 assumed a much larger
 * board, and on the 8-claim board the query actually yields, 6s of grace covers
 * about four scrubs — half the fight, unloseable. 2.5s covers the first one,
 * which is what "guaranteed first success" was after.
 */
export const OPENING_GRACE_MS = 2500;

/** How many freed elements a landed pounce takes back. */
export const RECLAIM_ON_HIT = 1;

/** How long a phase lasts. `stalk` ends on a decision, not a clock. */
export function phaseDuration(phase: Phase): number {
  if (phase === 'telegraph') return TELEGRAPH_MS;
  if (phase === 'leap') return LEAP_MS;
  if (phase === 'recover') return RECOVER_MS;
  return Infinity;
}

/**
 * What this phase becomes once `elapsed` has passed, or null to stay put.
 *
 * Driven by elapsed *time*, never by an accumulated `dt`, which is what makes
 * §5.3's failure state unreachable: a leap cannot begin before the telegraph is
 * over no matter how badly the frame rate collapses.
 */
export function nextPhase(phase: Phase, elapsed: number): Phase | null {
  if (elapsed < phaseDuration(phase)) return null;
  if (phase === 'telegraph') return 'leap';
  if (phase === 'leap') return 'recover';
  if (phase === 'recover') return 'stalk';
  return null;
}

/** Will the cat commit? Close enough, and you are far enough into a scrub. */
export function provoked(distance: number, progress: number): boolean {
  return distance <= POUNCE_RANGE && progress >= POUNCE_THRESHOLD;
}

/** Farthest ahead of the cursor the cat is allowed to aim, in px. */
export const PREDICT_CAP = 120;

/**
 * How far ahead the cat aims — and, more importantly, *when it stops being able to
 * change its mind*: the aim is locked when the telegraph **begins**.
 *
 * Built it the other way first, locking at the end of the telegraph, and that
 * quietly deleted the telegraph. A cat that re-aims until the instant it jumps
 * cannot be dodged during its wind-up: moving just moves the target. The only real
 * dodge window was the 260ms flight, which is human reaction time with nothing to
 * spare — and §5.3's "long enough to dodge if you're watching" was describing a
 * window that did not exist.
 *
 * Locked at the start, the telegraph is what it looks like: 420ms of "I have decided
 * where you are". Which also makes the prediction lead the whole wind-up plus the
 * flight, so a player fleeing in a straight line gets read and cut off, and changing
 * direction beats it. That is the difference between a cat and a homing missile.
 */
export const AIM_LEAD_MS = TELEGRAPH_MS + LEAP_MS;

/**
 * Where the cat aims: the cursor's *predicted* position at touchdown.
 *
 * Capped, because an unbounded lead on a fast flick sends the cat across the
 * screen to somewhere the cursor was never going, which reads as a bug rather
 * than as being outsmarted.
 */
export function predict(x: number, y: number, vx: number, vy: number, ms = LEAP_MS): { x: number; y: number } {
  const lx = (vx * ms) / 1000;
  const ly = (vy * ms) / 1000;
  const lead = Math.hypot(lx, ly);
  const k = lead > PREDICT_CAP ? PREDICT_CAP / lead : 1;
  return { x: x + lx * k, y: y + ly * k };
}

/**
 * Height above the straight line, 0..1, at `t` through the leap. A hop.
 *
 * A parabola rather than `sin(πt)`, which is the obvious choice and is wrong in a
 * small way: `Math.sin(Math.PI)` is 1.2e-16, not 0, so a leap never quite landed on
 * its target. `4t(1-t)` is exactly 0 at both ends and exactly 1 in the middle, and
 * it is a cheaper thing to evaluate every frame.
 */
export function leapArc(t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return 4 * c * (1 - c);
}

/** How high the hop goes, in px. */
export const LEAP_HEIGHT = 42;

/** Where the cat is, `t` of the way through a leap from `a` to `b`. */
export function leapPos(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  t: number,
): { x: number; y: number } {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return {
    x: ax + (bx - ax) * c,
    // screen coordinates, so "up" is a subtraction
    y: ay + (by - ay) * c - leapArc(c) * LEAP_HEIGHT,
  };
}

/**
 * Did it land on you?
 *
 * Measured against where the cat *aimed*, not where it ended up following you:
 * §5.3 is explicit that the cat lands where it committed and whiffs if you moved.
 * A dodge has to be the player's read, and a cat that adjusts mid-air is a dice
 * roll with extra steps.
 */
export function pounceHit(landX: number, landY: number, curX: number, curY: number): boolean {
  return Math.hypot(landX - curX, landY - curY) <= HIT_RADIUS;
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
