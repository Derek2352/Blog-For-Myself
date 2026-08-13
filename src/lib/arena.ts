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
  'a, button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"]), [contenteditable]';

/**
 * Never *intercepted*, which is a different question from never claimed.
 *
 * A click belongs to the page when it lands on something the page does something with. It
 * belongs to the fight otherwise (§5.4).
 *
 * Conflating this with `PROTECTED` was a real bug, found in 0.7 and invisible until then:
 * `Base.astro` renders `<main id="main" tabindex="-1">` as the skip-link target, `[tabindex]`
 * matched it, and so **every click anywhere in the page content silently refused to throw** —
 * while the crosshair cursor promised the opposite. The whole content area looked throwable
 * and only the thin strips outside `main` were. Worse, the step-3 harness hid it: it scanned
 * for a legal point, found one of those strips, and reported the mechanic working.
 *
 * `tabindex="-1"` is the difference. It means "focusable by script, not by tab", which is
 * exactly what a skip target is and exactly what neither rule should care about.
 */
export const INTERACTIVE =
  'a[href], button, input, select, textarea, summary, label, [contenteditable]';

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

/**
 * Fewest and most elements a board may contain.
 *
 * Added in 0.6, and it is a **correction to the build, not a new idea**: §4 says the
 * arena is "viewport bounds + queried list of claimable elements", and I built the queried
 * list against the whole *document*. On the homepage those are nearly the same thing. On
 * `/timeline/` they are not: it deals 24 claims, past §10's own stated ceiling of 20, and
 * a fight there ran 124 seconds without finishing. The game is called Whose Screen Is It.
 *
 * So the board prefers what is **on screen** when the fight opens, extends downward when
 * the screen alone cannot hold a game, and is capped because past twenty claims the page
 * really is unreadable and pillar 2 goes with it.
 *
 * Both numbers were tuned by playing both ends. A screen-*only* board deals about 8
 * candidates at 1280×900, so 55% of it is **four claims and a nine-second fight** — at
 * §10's own "over before it starts" floor. So the floor here is what a *game* needs
 * (10 candidates → the 6 opening claims §10 records for the homepage) and the ceiling is
 * what a *page* can survive. In between, screen first.
 *
 * **Corrected in 1.3 — smaller, because the fight got longer.** B gives every stance a
 * regrow clock, and churn costs time: a board that used to clear in two minutes now
 * takes three, on top of the playtest's "the pace is slow". Derived from the reclaim
 * rate rather than picked: a player reclaims about one claim per ~2s, so the board is
 * sized to what a *shorter* fight needs (10 → 6 opening claims) and the ceiling follows
 * it down (14). §10's "under four claims the fight is over before it starts" still
 * holds — 10 × 0.55 = 5.5 stays comfortably above 4.
 */
export const MIN_BOARD = 10;
export const MAX_BOARD = 14;

/**
 * Which candidates make up the board, given which of them are on screen.
 *
 * Document order in, document order out, so a claim's tilt stays tied to where it sits on
 * the page rather than to how it was chosen.
 */
export function boardSlice(inView: readonly boolean[], min = MIN_BOARD, max = MAX_BOARD): number[] {
  const seen = inView.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  const rest = inView.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  const chosen = seen.slice(0, max);
  // borrow from just past the fold only when the screen alone cannot hold a game
  for (const i of rest) {
    if (chosen.length >= min) break;
    chosen.push(i);
  }
  return chosen.sort((a, b) => a - b);
}

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

/**
 * `[PH 260]` ms — the longest a touch can last and still be a **tap** rather than a hold (§3).
 *
 * On a mouse the two verbs are two events and cannot be confused: `click` throws a treat,
 * dwelling scrubs, and nothing about one produces the other. A finger does both with the same
 * gesture, because `click` also fires when a *hold* ends — so without this, scrubbing a claim
 * spent a paw every single time the finger came off.
 *
 * Comfortably above a real tap (~80–150ms) and far below `SCRUB_MS`, so a slow thumb is still a
 * tap and a deliberate hold is never one.
 *
 * It splits **both** touch questions, which is why it is one number and not two: `isTap` asks
 * whether a lift should throw, and `isWorking` asks whether the click that ended the touch should
 * be swallowed. On a claim those are exact complements — every touch is one or the other — and a
 * test pins that, because two thresholds drifting apart would leave a duration that neither
 * throws nor works.
 */
export const TAP_MS = 260;

/**
 * Fraction of a scrub completed after holding still this long.
 *
 * `over` defaults to `SCRUB_MS` — the player's hold, unchanged since 0.3 and the number every
 * measurement in §5.2/§10 is about. It is a parameter because 2.0 gave the *kitten* a different one
 * (`KITTEN_WORK_MS`), for a reason that is about the cat rather than about patience: see §15.
 */
export function scrubProgress(heldMs: number, over = SCRUB_MS): number {
  if (!(heldMs > 0)) return 0;
  return heldMs >= over ? 1 : heldMs / over;
}

/**
 * Was that touch a **tap**? (§3's one button, on one finger.)
 *
 * Duration alone, deliberately. A first version also required "achieved nothing", on the theory
 * that a hold the cat interrupted early should not read as a tap — but an interrupted hold does
 * not *end* early: the finger stays down and the player keeps holding, so the touch is long
 * whatever the cat did. The extra term bought nothing and cost correctness, because scrub progress
 * begins on the first frame, so a 90ms tap on a claim counted as "scrubbed" and could neither
 * throw nor navigate.
 */
export function isTap(heldMs: number): boolean {
  return heldMs <= TAP_MS;
}

/**
 * Was that touch the player **working on a claim** rather than pressing the page?
 *
 * The question the click has to answer, and it cannot be answered by looking at the DOM: §5.1
 * allows a claim inside a link, on touch a hold ends in a `click`, and by the time that click
 * arrives a *completed* hold has already freed the element — so "is there a claim under this"
 * reads false at exactly the moment it matters, and the page navigates out from under a fight the
 * player just won. What the touch *was* has to be remembered while it happens.
 *
 * `onClaim` is set for any frame the hold had a claim under it; the duration is what separates
 * working from pressing. So a hold on a claimed link is swallowed, while a brief tap on the same
 * link still navigates — §11 promises the page keeps working, and this is the line that keeps
 * both promises at once.
 */
export function isWorking(heldMs: number, onClaim: boolean): boolean {
  return onClaim && heldMs > TAP_MS;
}

/** Has the pointer stayed put? Distance, not per-axis, or diagonals cheat. */
export function stillEnough(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) <= STILL_PX;
}

/* ------------------------------------------------------------------ *
 * Pounce — the threat that makes holding still a decision (§5.3)
 * ------------------------------------------------------------------ */

/**
 * The boss's whole state machine. One phase at a time, by construction — §5.3's
 * "two pounces queued" edge case is impossible if there is only ever one of these.
 *
 * `fetch` and `eat` are the treat's doing (§5.4), and they are the only phases the
 * *player* can put the cat into. Two of them rather than one `lure`, because they
 * end for different reasons: `fetch` ends on arrival, `eat` ends on a clock.
 */
export type Phase = 'stalk' | 'telegraph' | 'leap' | 'recover' | 'fetch' | 'eat';

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

/**
 * How soon after the fight opens the cat speaks its first line.
 *
 * `[PH 1600]` ms, and it has to be **shorter than `OPENING_GRACE_MS`** — the playtest
 * that shipped 1.3 found a fight that opened in silence and then said the wrong thing:
 * with no line due in the opening state, the first words a confused player ever heard
 * were support-idle's "you can stop any time." at 8s. The teach line (§8) is the fix,
 * and this number is what makes it land inside the safe window where §5.3 guarantees
 * the cat cannot pounce. It is also the handoff: the curtain reveal ends around this
 * point (§14.3), so the opening line arrives as the page becomes visible.
 *
 * A test pins the relationship (OPENING_LINE_MS < OPENING_GRACE_MS) so a future tuning
 * pass cannot push the tutorial outside the window it exists for.
 */
export const OPENING_LINE_MS = 1600;

/** How many freed elements a landed pounce takes back. */
export const RECLAIM_ON_HIT = 1;

/**
 * How long a phase lasts.
 *
 * `stalk` and `fetch` are both `Infinity` and for the same reason: they end on
 * something happening (a decision, an arrival), not on a clock running out.
 */
export function phaseDuration(phase: Phase): number {
  if (phase === 'telegraph') return TELEGRAPH_MS;
  if (phase === 'leap') return LEAP_MS;
  if (phase === 'recover') return RECOVER_MS;
  if (phase === 'eat') return LURE_MS;
  return Infinity;
}

/**
 * What this phase becomes once `elapsed` has passed, or null to stay put.
 *
 * Driven by elapsed *time*, never by an accumulated `dt`, which is what makes
 * §5.3's failure state unreachable: a leap cannot begin before the telegraph is
 * over no matter how badly the frame rate collapses.
 */
export function nextPhase(phase: Phase, elapsed: number, scale = 1): Phase | null {
  if (elapsed < phaseDuration(phase) * scale) return null;
  if (phase === 'telegraph') return 'leap';
  if (phase === 'leap') return 'recover';
  if (phase === 'recover') return 'stalk';
  if (phase === 'eat') return 'stalk';
  return null;
}

/**
 * Will the cat commit? Close enough, and you are far enough into a scrub.
 *
 * `patience` is a stance's addition to the threshold (§9.3) — Sleepy waits until you have
 * nearly finished before it can be bothered.
 */
export function provoked(distance: number, progress: number, patience = 0): boolean {
  return distance <= POUNCE_RANGE && progress >= POUNCE_THRESHOLD + patience;
}

/**
 * Can the cat start a pounce right now?
 *
 * Only from a stalk, which is where the treat's entire value comes from: §5.3 is
 * explicit that a cat in `fetch` cannot pounce, and if that could be cancelled the
 * resource would be worthless. Written as one predicate rather than a condition
 * inside the loop so the guarantee is testable and cannot be quietly widened.
 */
export function canPounce(phase: Phase): boolean {
  return phase === 'stalk';
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
 * The counter (§5.4, 1.4) — a second target for the throw
 * ------------------------------------------------------------------ */

/**
 * `[PH 64]` px — how near the cat a treat has to land to be a swat rather than a lure.
 *
 * Slightly wider than `HIT_RADIUS` (46), and deliberately: the cat's own pounce gets the
 * tighter number because it is the aggressor and §5.3 makes it commit blind. The player is
 * throwing at a *stationary, recovering* animal and paying a treat for the attempt, so the
 * window is forgiving in the direction that rewards reading the whiff.
 */
export const SWAT_RADIUS = 64;

/**
 * `[PH 900]` ms added to a recovery that gets swatted.
 *
 * Derived from what it has to buy, not chosen for feel: `SCRUB_MS` is 1400, and `RECOVER_MS`
 * is 700, so a bare whiff already gifts half a hold. This has to turn that into *most* of
 * one without turning it into all of one — a stun that guarantees a free claim would make the
 * counter strictly better than fleeing, which is the failure mode §3 warns about. 700 + 900
 * = 1600ms of stillness against a 1400ms hold: enough to finish a claim you were already
 * part-way through, not enough to start and finish a fresh one from nothing.
 */
export const SWAT_STUN_MS = 900;

/**
 * Does a treat landing here, now, count as a counter-attack?
 *
 * **Recover only**, and that is the whole design rather than a safety check. §5.3 spends the
 * telegraph teaching you to read a wind-up, and until 1.4 that reading only ever bought you a
 * dodge — the knowledge had one use. This gives it a second: the same tell now also marks the
 * moment the cat is *punishable*, so the player who learned §5.3 has something to do with it
 * besides run. §7.4 wants one mechanic found by exploration; nothing announces this.
 *
 * Pure, and separate from `pounceHit`, because they are different questions with different
 * radii and only one of them is the player's to aim.
 */
export function swatLands(phase: Phase, dist: number, radius = SWAT_RADIUS): boolean {
  return phase === 'recover' && dist <= radius;
}

/* ------------------------------------------------------------------ *
 * Stances (§9.3) — same verbs, different counter-play
 * ------------------------------------------------------------------ */

export type Stance = 'ambush' | 'siege' | 'trickster' | 'sleepy';

/**
 * How a stance bends the fight. Multipliers on the numbers above, never new numbers:
 * §9.3's promise is *same verbs, different counter-play*, and a stance that introduced a
 * mechanic would be a different game rather than a different opponent.
 *
 * `pin` is the one exception, and it is what makes Siege a stance rather than a difficulty
 * setting: the cat refuses to leave the floor, so it barely threatens you and the board
 * fights back instead.
 */
export interface StanceSpec {
  /** Multiplier on `TELEGRAPH_MS` — under 1 is harder to dodge. */
  telegraph: number;
  /** Multiplier on `RECOVER_MS` — over 1 makes a whiff a bigger gift. */
  recover: number;
  /** Multiplier on `STALK_SPEED`. */
  stalk: number;
  /** Added to `POUNCE_THRESHOLD`: how committed you must be before it bothers. */
  patience: number;
  /** Chance a telegraph is a feint (§9.3's Trickster). */
  feint: number;
  /** Stays on the floor, moving in x only. */
  pin: boolean;
  /** Claims regrow this often, ms. 0 = never. */
  regrowMs: number;
}

export const STANCES: Record<Stance, StanceSpec> = {
  /**
   * Short wind-up, long regret. Counter: scrub beside it and punish the whiff.
   *
   * `regrowMs` added in 1.3 — every stance has a clock now. Derived from the reclaim
   * rate (a player takes ~1 claim per 2s): 15000ms is the slowest clock that still
   * counts as a clock (§9.3: beyond 15000 it is decoration). Faster values were tried
   * and measured: 4000ms and 6000ms made the treatless floor unwinnable outright;
   * 8000ms — *faster* than siege's 9000 — put the mobile stances below the floor the
   * arena8 harness measured (the harness reclaims at ~6s/claim once travel and dodging
   * count, so a regrow at 8s nets out at zero and the treatless fight truces without a
   * win); 12000ms still left the fight in the treadmill when pounces landed. 15000 is
   * where the treatless fight clears: a lone claim regrows in fifteen seconds, which is
   * inside the player's window, and the mobile stances keep their identity — they
   * threaten with the pounce, siege threatens with the board, and siege keeps the
   * faster regrow as the stance built around it.
   */
  ambush: { telegraph: 0.78, recover: 1.45, stalk: 1, patience: 0, feint: 0, pin: false, regrowMs: 15000 },
  /**
   * Never leaves the bottom edge, and the page grows back. Counter: clear top-down and
   * accept the churn — the cat is barely a threat up there, which is the trade.
   *
   * `regrowMs` 9000 is the stance's identity clock and it is deliberately not touched by
   * 1.3: siege is built around regrow, so it keeps the slow, relentless version while the
   * mobile stances gain the faster one.
   */
  siege: { telegraph: 1, recover: 1, stalk: 1.15, patience: 0, feint: 0, pin: true, regrowMs: 9000 },
  /**
   * Fakes a third of its wind-ups. Counter: learn the tell (there is one — see §9.3).
   *
   * `recover` is 1.2 and not 1.0 because of an invariant, not a feel: a whiff has to cost
   * the cat more than the attack gained it, and a slightly longer telegraph (1.1) plus the
   * leap already came to 722ms against a 700ms recovery. A trickster whose failed pounces
   * were *free* would have no reason ever to stop pouncing. Caught by the test, which is
   * the only reason that inequality is stated as one.
   *
   * `regrowMs` 15000, same derivation as ambush: every stance gets a clock, and a feinting
   * cat that also regrows is the trickster's counter-play — the page slips away while you
   * try to read its bluffs.
   */
  trickster: { telegraph: 1.1, recover: 1.2, stalk: 1, patience: 0, feint: 0.3, pin: false, regrowMs: 15000 },
  /**
   * Barely fights. A gift, and rare enough to be a story rather than a let-down.
   *
   * `recover` had to rise with the telegraph to keep the whiff invariant: a long wind-up is
   * only generous if missing still costs the cat more than trying. Otherwise the sleepiest
   * stance would be the one that pounces most often, which is nobody's idea of sleepy.
   *
   * `regrowMs` stays 0 for the same reason the plan gives for not touching it: §9.3 calls
   * sleepy "a gift, and rare enough to be a story" — and a gift with a clock is not a gift.
   */
  sleepy: { telegraph: 1.6, recover: 1.55, stalk: 0.55, patience: 0.35, feint: 0, pin: false, regrowMs: 0 },
};

/**
 * How often Sleepy turns up. `[PH 0.08]`.
 *
 * Rare on purpose: a joke fight is a good memory and a bad expectation. Common enough to
 * be told about, not common enough to be what the game *is*.
 */
export const SLEEPY_CHANCE = 0.08;

/* ------------------------------------------------------------------ *
 * Signature moves (§9.3, 1.4) — one identity move per stance
 * ------------------------------------------------------------------ */

/**
 * `[PH 2]` — siege regrows **two** claims every this-many-th tick, not one.
 *
 * §9.3 gives siege the line "it cannot leave the floor, so the board has to do its fighting
 * for it", and until 1.4 that meant one clock and nothing else — the stance with the most
 * distinctive premise had the least distinctive *moment*. This is the moment: every other
 * regrow, the walls come in from two sides at once.
 *
 * Every *other* rather than every one, because the point is a beat the player can learn to
 * anticipate. Every tick is just a faster clock wearing a costume, and `regrowMs` already
 * exists for that. Adjacency does the rest of the work — see `sweepPartner`.
 *
 * This number sets the sweep's *texture* and deliberately not its *rate*: `regrowInterval`
 * charges the cat one interval per claim it takes, so two-on-the-beat and one-every-tick regrow
 * the same amount of board per minute. That separation is what lets this be tuned by feel — the
 * first version of it could not be, because every value of it was also a difficulty setting.
 */
export const SIEGE_SWEEP_EVERY = 2;

/**
 * Which claim a sweep takes alongside the first: the nearest **unclaimed neighbour in document
 * order**, preferring the side that keeps the pair contiguous.
 *
 * Document order is the right adjacency here and it is not an approximation. `arena.order` is
 * built in document order (`candidates()` preserves it, which `boardSlice` documents as the
 * reason it sorts), so neighbouring indices are neighbouring *page furniture* — a heading and
 * the paragraph under it, two cards in a row. Taking a random second claim would read as the
 * clock ticking twice; taking the one next door reads as a wall moving, which is the fiction
 * §9.3 asks for.
 *
 * Pure and index-based so it is testable without a DOM: `taken` is the set of indices already
 * claimed, `total` the board size. Returns -1 when the board has no contiguous neighbour left,
 * which is a normal endgame state and not a failure.
 */
export function sweepPartner(index: number, taken: readonly number[], total: number): number {
  const held = new Set(taken);
  for (let step = 1; step < total; step++) {
    const after = index + step;
    if (after < total && !held.has(after)) return after;
    const before = index - step;
    if (before >= 0 && !held.has(before)) return before;
  }
  return -1;
}

/**
 * `[PH 2600]` ms an ambush cat guards the ground it just took.
 *
 * §9.3's ambush is "the one that actually hunts you", and a landed pounce was worth exactly
 * one element — the same as siege's clock ticking, from a stance that had to earn it by
 * reading you and committing. So a hit now also *pins* it: it holds position over the claim it
 * stole, and re-taking that claim means either waiting it out or spending a treat to lure it
 * off. A hit becomes a positional problem instead of a subtraction.
 *
 * Reuses `boss.anchor*` — the machinery treats already use to keep the cat near a biscuit —
 * so this adds a trigger, not a system. Shorter than the feather's 5000ms anchor because that
 * one is a reward the player *bought* and this one is a punishment they suffered.
 */
export const AMBUSH_PIN_MS = 2600;

/** `[PH 90]` px the pinned cat may stray from the claim it is guarding. Matches biscuit's leash. */
export const AMBUSH_PIN_PX = 90;

/**
 * `[PH 0.35]` — how often a trickster follows a bluff *straight* into the real thing.
 *
 * §9.3 says the trickster's tell "can be learned, which means it has to be missable the first
 * few times", and its feint already does that once. This makes the lesson recursive: having
 * learned that a shallow gather means nothing, you relax — and this is the stance that
 * punishes relaxing. The double is what stops "read the tell" collapsing into a rule you can
 * apply without attention.
 *
 * Below the feint rate (0.3 → this fires on a third of feints) so the bluff stays mostly a
 * bluff. If it were common the feint would just *be* the wind-up and §9.3's tell would carry
 * no information at all.
 */
export const TRICKSTER_DOUBLE = 0.35;

/** This fight's stance, deterministic from its seed so a board can be replayed. */
export function pickStance(seed: number): Stance {
  const rand = mulberry32(seed >>> 0);
  if (rand() < SLEEPY_CHANCE) return 'sleepy';
  const rest: Stance[] = ['ambush', 'siege', 'trickster'];
  return rest[Math.floor(rand() * rest.length)] ?? 'ambush';
}

/* ------------------------------------------------------------------ *
 * Loadout (§9.5) — which pages you read decides your kit
 * ------------------------------------------------------------------ */

/**
 * What a treat does, by type.
 *
 * `immuneMs` splits from `lureMs` for the biscuit, which §9.5 describes as "shortest
 * interrupt immunity but cat stays put longest" — two different clocks, and reading them as
 * one is why that line looks self-contradictory. So: **immune** is how long it cannot
 * pounce, **lure** is how long it stays at the treat, and after immunity ends it is anchored
 * where it sits. That anchor is one mechanism serving two treats, since it is also what
 * the feather's "plays with it where it lands" means.
 */
export interface TreatSpec {
  /** Total time the cat is occupied at the treat. */
  lureMs: number;
  /** Of which this much cannot be interrupted by a pounce. */
  immuneMs: number;
  /** After eating, it will not stray this far from the spot, for `anchorMs`. */
  anchorPx: number;
  anchorMs: number;
  /** Multiplier on the next telegraph only (the bell startles it). */
  telegraphMul: number;
  /** Multiplier on stalk speed, and for how long (yarn tangles its feet). */
  slowMul: number;
  slowMs: number;
}

const PLAIN = { anchorPx: 0, anchorMs: 0, telegraphMul: 1, slowMul: 1, slowMs: 0 };

export const TREAT_SPECS: Record<string, TreatSpec> = {
  /** The baseline: nothing clever, the longest clean window. */
  fish: { ...PLAIN, lureMs: 3000, immuneMs: 3000 },
  /** Short, but the cat is rattled: its next wind-up is twice as easy to read. */
  bell: { ...PLAIN, lureMs: 1800, immuneMs: 1800, telegraphMul: 2 },
  /** Tangles its feet, so it comes back slowly — the window outlasts the lure. */
  yarn: { ...PLAIN, lureMs: 2200, immuneMs: 2200, slowMul: 0.5, slowMs: 4000 },
  /** It plays with this where it lands: a no-go zone you place. */
  feather: { ...PLAIN, lureMs: 2600, immuneMs: 2600, anchorPx: 150, anchorMs: 5000 },
  /** Slow to eat: it can pounce again sooner, but it is stuck there far longer. */
  biscuit: { lureMs: 4000, immuneMs: 1600, anchorPx: 90, anchorMs: 2400, telegraphMul: 1, slowMul: 1, slowMs: 0 },
};

/** The spec for a treat, falling back to the plain one for anything unknown. */
export function treatSpec(kind: string): TreatSpec {
  return TREAT_SPECS[kind] ?? TREAT_SPECS.fish!;
}

/* ------------------------------------------------------------------ *
 * Treats — exploration, spent (§5.4)
 * ------------------------------------------------------------------ */

/**
 * `[PH 3000]` ms of head-down eating, once the cat reaches the treat.
 *
 * §5.4's success condition is the whole justification: *a thrown treat reliably buys
 * one complete scrub.* Below `SCRUB_MS` the resource does nothing at all, so this is
 * one of the few numbers here with a hard floor rather than a taste range. The cat is
 * out of the fight for this **plus** the walk over, which is the player's to place.
 */
export const LURE_MS = 3000;

/** `[PH 320]` ms for the treat to arc from the HUD to where you pointed. */
export const THROW_ARC_MS = 320;

/**
 * `[PH 186]` px/s going to a treat — noticeably faster than the `STALK_SPEED` 170.
 *
 * Lifted from `SiteCat.astro`'s own fetch speed, where the comment reads "it can see
 * food; a stroll across the room read as a stall". Same animal, same appetite, and
 * the contrast with stalking is characterisation: it hurries for food and takes its
 * time with you.
 */
export const FETCH_SPEED = 186;

/** How close the cat has to get to the treat to start eating, in px. */
export const FETCH_REACH = 14;

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
 * The fight is over and you took the page back.
 *
 * Measured against the **board**, not against the opening claim count: the cat can take
 * ground it never held (see `RECLAIM_ON_HIT`'s note), so "all of it" has to mean all of
 * what could ever be claimed.
 */
export function isWon(claimed: number, board: number): boolean {
  return board > 0 && claimed <= 0;
}

/**
 * The fight is over and the cat has all of it.
 *
 * **Both** conditions, per §2: every claimable thing taken *and* nothing left to throw.
 * Territory at 100% with a treat still in hand is not a loss, it is a bad position — you
 * can always dig out while you have ammo, which is what keeps "spend it or save it" a
 * live question right to the end.
 */
export function isLost(claimed: number, board: number, ammo: number): boolean {
  return board > 0 && claimed >= board && ammo <= 0;
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
 * Dialogue (§8) — the cat is bluffing, not malevolent
 * ------------------------------------------------------------------ */

/** How long a line stays up. `[PH 2600]` ms — read twice, at seven words. */
export const LINE_MS = 2600;

/**
 * `[PH 1200]` ms of silence between lines.
 *
 * The failure mode this exists to prevent is a cat that narrates. A gap makes each line
 * an event; without one, the ribbon becomes a log and the writing stops landing.
 */
export const LINE_GAP_MS = 1200;

/** The beat after a win before the page comes back. */
export const WIN_BEAT_MS = 2200;

/** The beat after a loss. Shorter: nobody wants to sit in it. */
export const LOSE_BEAT_MS = 1600;

/**
 * `[PH 1500]` ms between one round and the next (§15, 2.0).
 *
 * Shorter than `WIN_BEAT_MS`, and the difference is the whole distinction between a round and a
 * fight. A win beat is an *exit*: the cat takes one thing back, says its line, and the page is
 * handed over — 2200ms of theatre for something that is finishing. A round beat is a **breath**:
 * long enough to read four words and see the number go up, short enough that the next board arrives
 * while the visitor is still watching the same thing happen. The T-Rex restarts before you have
 * finished being annoyed, and that is why it is easy to keep playing.
 *
 * "Broken looks like": under ~800ms the round line cannot be read and the board changing looks like
 * a glitch; over `WIN_BEAT_MS` the endless mode acquires a loading screen between every round,
 * which is the one thing an idle game cannot afford.
 */
export const ROUND_BEAT_MS = 1500;

/* ------------------------------------------------------------------ *
 * Aggression (§7.3) — difficulty as characterisation
 * ------------------------------------------------------------------ */

/**
 * How the cat is taking the fight. Three tiers, not a curve, and that is the design.
 *
 * §7.3's whole argument is that the scaling is *expressed as behaviour* rather than
 * hidden in the numbers: a losing player sees the cat easing off and reads it as the cat
 * pitying them, which is in character and does the same job as an invisible fudge. A
 * continuous ramp would be smoother and would be exactly the invisible fudge this exists
 * to replace — you cannot read a drift. Each tier here has a tell you can see.
 */
export type Mood = 'bored' | 'even' | 'desperate';

/**
 * `[PH 0.6]` — the cat is far ahead and you have nothing left to throw.
 *
 * Visible mercy without becoming a walkover. Below about 0.4 the cat stops being a
 * threat at all, and a boss that has given up is not merciful, it is over.
 */
export const AGGRO_BORED = 0.6;

/** Baseline. Everything built through step 6 is this tier. */
export const AGGRO_EVEN = 1;

/**
 * `[PH 1.4]` — the cat is losing the page.
 *
 * This is the counter-pressure 0.7 found missing. No stance's pounce can take the page
 * from a stationary player, so once you are ahead every exchange is yours; at this tier
 * the animal you pushed under 20% winds up faster and commits earlier, and the endgame
 * costs something again.
 */
export const AGGRO_DESPERATE = 1.4;

/*
 * Tier boundaries, entered and left at different points **on purpose**.
 *
 * Territory moves one claim at a time and the board is 14–20 wide, so a single scrub shifts
 * it by 5–7 points. A boundary at exactly 0.70 flips the cat in and out of bored on
 * alternate exchanges — the wind-up length, the walking speed and the grooming would all
 * strobe, and a difficulty that changes every two seconds is not readable as anything.
 *
 * The **width** of the band is the part that has to be checked against the board rather than
 * chosen for looking about right, and the first attempt was not: 0.62/0.70 is 0.08 wide,
 * which on a 15-claim board is **1.2 claims**. A band narrower than the step size of the
 * thing it damps is not hysteresis, it is a rounding difference — and the browser harness
 * duly recorded `even→bored→even→bored→even` across four trades. At least two claims wide on
 * the *smallest* board is the rule, which `MIN_BOARD` fixes at 0.15; there is a test.
 *
 * Two claims is also the right answer in fiction, not just in arithmetic: mercy that
 * evaporates the instant you take one thing back was never mercy.
 */
export const BORED_ENTER = 0.72;
export const BORED_LEAVE = 0.51;
export const DESPERATE_ENTER = 0.2;
export const DESPERATE_LEAVE = 0.42;

/**
 * Which tier the fight is in, given which one it was in.
 *
 * `was` is not an optimisation — it is the hysteresis, and without it this function
 * cannot be correct. Bored additionally requires an empty hand: a player who is behind
 * but still holding treats has a move to make, and being pitied while you still have
 * options reads as condescension rather than mercy.
 */
export function mood(s: FightState, was: Mood = 'even'): Mood {
  const bored = was === 'bored' ? s.territory >= BORED_LEAVE : s.territory >= BORED_ENTER;
  if (bored && s.ammo === 0) return 'bored';
  const desperate =
    was === 'desperate' ? s.territory <= DESPERATE_LEAVE : s.territory <= DESPERATE_ENTER;
  return desperate ? 'desperate' : 'even';
}

/** The scalar for a tier. */
export function aggression(m: Mood): number {
  if (m === 'bored') return AGGRO_BORED;
  if (m === 'desperate') return AGGRO_DESPERATE;
  return AGGRO_EVEN;
}

/**
 * What aggression does to the wind-up — **shortens it, and never the reverse.**
 *
 * The load-bearing decision of this step, and it is about an invariant rather than about
 * feel. §10 requires a whiff to cost the cat more than the attack gained it
 * (`recover > telegraph + LEAP_MS`), and the symmetric choice — scale the recovery by the
 * same factor as the telegraph — breaks it. Worked through at 1.4: ambush keeps 231ms of
 * margin, **siege comes up 60ms short**, and trickster and sleepy scrape through on 10ms
 * and 35ms — thin enough to be noise. Repairing that means raising three of four stances'
 * recovery, which is retuning §9.3 to accommodate a §7.3 feature.
 *
 * Clamping to 1 costs nothing and fixes all of it — the thinnest margin anywhere in the
 * space becomes siege's 140ms. The telegraph only ever shrinks, so the
 * invariant only ever gets easier, and a dodge stays rewarded exactly when it matters most
 * — against a desperate cat. It is also the more faithful reading of §7.3, which names
 * "faster telegraph" for the desperate tier and says nothing about the bored one. A bored
 * cat's tell is that it *does less*, not that it does the same thing slowly.
 */
export function telegraphScale(a: number): number {
  return 1 / Math.max(1, a);
}

/**
 * `[PH 0.55]` — how much of its regrow clock a cornered cat keeps.
 *
 * **The other half of "desperate", and the half that was missing.** §7.3's table promises the
 * desperate tier is "faster telegraph, more taunting", and 0.9 delivered exactly that: the
 * wind-up shortens by `telegraphScale`. But 1.0 then measured the fight's real counter and it
 * is *fleeing* — hold further away than `SAFE_FLEE_PX` and the pounce provably cannot reach
 * you. So the tier's one escalation was an escalation of the threat a good player has already
 * opted out of, and the regrow clock — the only pressure that reaches a distant player — stayed
 * fixed at whatever the stance set. The result is that the fight got *calmest* at the moment it
 * should be tightest: the tester's "the pace is slow" is loudest at the end, when the cat is
 * cornered and out of ideas.
 *
 * So the walls close faster instead. This is the pressure that does not care where you stand.
 *
 * **Why 0.55 and not less:** the floor is not negotiable. §9.4 promises the bottom rung is "a
 * pure-skill fight for whoever wants it" and `arena8` section 4 measures it, so this number is
 * bounded above by "no felt climax" and below by "a treatless fight stops being winnable". At
 * ambush's 15000ms base that is 8250ms cornered, against a player who reclaims roughly one
 * claim per 2s of holding plus travel — pressure that is felt and out-run, which is the whole
 * intent. Verified, not assumed: see 1.4's ship-gate note.
 *
 * "Broken looks like": at ≤0.3 the endgame becomes a treadmill and the floor fails; at ≥0.85
 * nothing changes and the tier is decorative again — which is the state this fixes.
 */
export const LAST_STAND_REGROW = 0.55;

/**
 * The regrow interval this mood deserves.
 *
 * A function rather than a constant on the stance, because the clock is now two things
 * multiplied: the stance's *identity* (siege's 9000 vs a leaper's 15000 — §9.3) and the mood's
 * *urgency*. Keeping them separate means the last stand cannot quietly retune §9.3, which is
 * the mistake 0.9 explicitly avoided when it clamped `telegraphScale`.
 *
 * Bored is untouched on purpose. §7.3 makes the bored cat's tell that it *does less*, and a
 * bored cat that regrew faster than an even one would be doing more while pretending to sulk.
 *
 * **`claims` is the sweep's price, and it is the reason the sweep is safe.** The cat waits one
 * interval *per claim it took*, so a sweep of two is followed by a double wait. Measured before
 * it was written: the first version of §9.3's sweep simply took two on the beat and left the
 * clock alone, which raised siege's rate to 1.5 claims per 9000ms — and a browser run of
 * flee-and-scrub against it plateaued dead level at six claims for ten straight exchanges,
 * 0.167 claims/s of regrow against 0.164 claims/s of reclaiming. The player could not lose and
 * could not win, which is worse than either.
 *
 * Charging an interval per claim makes the long-run rate *identical* to 1.3's — 3 claims per
 * 3 intervals, whatever the cadence — so the sweep changes the fight's texture (a squeeze, then
 * a lull) and provably not its arithmetic. §9.4's floor is therefore undisturbed by construction
 * rather than by measurement, which is the only kind of safety worth having under a rule that
 * says the bottom rung must stay winnable.
 */
export function regrowInterval(baseMs: number, m: Mood, claims = 1): number {
  if (baseMs <= 0) return baseMs; // sleepy has no clock at all, and keeps not having one
  const urgency = m === 'desperate' ? LAST_STAND_REGROW : 1;
  return Math.round(baseMs * urgency * Math.max(1, claims));
}

/**
 * The most patient a cat is ever allowed to be.
 *
 * `provoked` needs `progress >= POUNCE_THRESHOLD + patience`, and progress is capped at 1
 * — so a composed threshold of 1.0 does not make the pounce rare, it removes it. A bored
 * sleepy cat lands there exactly (0.35 base + 0.35 stance + 0.30 mood). Rare is the
 * design; never is a mechanic switching itself off.
 */
export const MAX_THRESHOLD = 0.9;

/** How much of the threshold the mood moves. `[PH 0.75]` — ±0.3 across the tier range. */
export const AGGRO_PATIENCE = 0.75;

/**
 * The stance's patience and the mood's, composed and clamped.
 *
 * A bored cat waits until you have nearly finished before it can be bothered; a desperate
 * one commits as soon as you have started.
 */
export function patienceFor(stancePatience: number, a: number): number {
  const want = stancePatience + (1 - a) * AGGRO_PATIENCE;
  const ceiling = MAX_THRESHOLD - POUNCE_THRESHOLD;
  return Math.max(-POUNCE_THRESHOLD, Math.min(ceiling, want));
}

/**
 * Silence between lines, scaled by mood — desperate is "more taunting" (§7.3).
 *
 * The bored end matters as much as the loud one: a cat that has stopped trying and is
 * grooming itself should also be *quieter*, or the mercy comes with a running commentary.
 */
export function talkGap(a: number): number {
  return LINE_GAP_MS / a;
}

/**
 * `[PH 5200]` ms between a bored cat's grooming beats.
 *
 * The animation itself runs 1.5s (`cat-groom` in `SiteCat.astro`), so this leaves a clear
 * gap between them. Much shorter and the cat is *constantly* washing, which reads as a
 * broken loop rather than as an animal that has lost interest in you.
 */
export const GROOM_EVERY_MS = 5200;

/**
 * `[PH 1500]` ms of washing, during which the cat neither travels nor pounces.
 *
 * Mirrors `cat-groom`'s duration in `SiteCat.astro`, and the coupling is loose on purpose:
 * nothing breaks if the two drift apart, the pause just outlasts the animation or ends a
 * little early. What must not drift is the *idea* — that this is a pause the player can
 * see, not a class that gets set while the cat carries on marching at them.
 */
export const GROOM_MS = 1500;

/* ------------------------------------------------------------------ *
 * The handicap ladder (§9.4)
 * ------------------------------------------------------------------ */

/**
 * The bottom of the ladder — how many treats the hardest fight leaves you.
 *
 * `[PH 0]`. §9.4 says it bottoms out at zero, "a pure-skill fight for whoever wants it", and
 * that is what this is set to — but it is a constant rather than a literal `0` because
 * whether a no-treat fight is *winnable* is a measured question, not an assumed one. Step 7
 * found that a player who never spends anything reclaims ground at about the rate a landed
 * pounce takes it back. See the note in §9.4 for what the measurement said.
 */
export const LADDER_FLOOR = 0;

/**
 * Where the ladder goes after a fight ends.
 *
 * Up on a win, down on a loss, unchanged on a truce — a truce is not a result, and §8.4
 * already treats it as its own kind of ending rather than a quiet loss.
 *
 * Down on a loss is the decision that keeps §7.2's promise that losing costs nothing
 * permanent. A pure ratchet would be a truer reading of "self-selected difficulty", but it can
 * strand somebody on a rung they beat once by luck, and being stuck is the one thing this
 * fight is not allowed to do to a reader. The selection is still the player's: the rung only
 * ever *rises* by winning, and nothing makes you press the button again.
 *
 * `found` is the ceiling and it moves with exploration, so a visitor who has found two treats
 * can never be handicapped three. Without that the ladder would punish the very thing §9.5
 * rewards.
 */
export function nextRung(rung: number, ending: FightState['ending'], found: number): number {
  const ceiling = Math.max(LADDER_FLOOR, found);
  const want = ending === 'win' ? rung + 1 : ending === 'lose' ? rung - 1 : rung;
  return Math.max(LADDER_FLOOR, Math.min(ceiling, want));
}

/**
 * How many treats a fight at this rung starts with.
 *
 * Never below zero however the rung and the found-set disagree: this is read straight into a
 * loop that withholds paws, and a negative count there would withhold from the wrong end.
 */
export function ammoCap(found: number, rung: number): number {
  return Math.max(0, found - Math.max(0, rung));
}

/** What the cat is reacting to, gathered once per frame. */
export interface FightState {
  /** Cat's share of the board, 0..1. */
  territory: number;
  /** Treats in hand. */
  ammo: number;
  /** Treats thrown so far this fight. */
  spent: number;
  /** Claims the visitor has taken back this fight. */
  freed: number;
  /** Consecutive interrupted scrubs. */
  interrupts: number;
  /** ms since the pointer last moved. */
  idleMs: number;
  /** ms since territory last changed either way. */
  staleMs: number;
  /** Already has the collar from the patient path. */
  collared: boolean;
  /** Which tier the fight is in (§7.3). Carried here so §8.2 can gate on it directly. */
  mood: Mood;
  /**
   * Which rung of §9.4's ladder this fight is being fought on — how many paws the cat is
   * holding back. Zero for a first fight. Here for the same reason `mood` is: the ending is
   * where the ladder asks its question, so the writing has to be able to see it.
   */
  rung: number;
  /**
   * How many treats the visitor had found when this fight opened — the ladder's ceiling.
   *
   * Not the same as `ammo`, which is what is left *after* the rung withholds some and after
   * spending. The writing needs the difference: "is there another paw left to take" is
   * `rung < found`, and offering a harder rematch to somebody already fighting with nothing
   * would be the cat promising something it cannot deliver.
   */
  found: number;
  /**
   * True from the moment the cat *enters* the desperate tier until the dialogue spends it (§7.3,
   * 1.4) — or until the cat stops being cornered, whichever comes first.
   *
   * An **event**, not a state, and that distinction is why it exists. §8's table is
   * priority-ordered over fight *states*, and the last stand is a moment — so writing it as a
   * territory band put it in direct competition with §8.3's rattled ladder and silently killed
   * `rattled-20`, whose whole band it occupied. Narrowing the band was not available either:
   * territory moves in steps of `1 / board`, so on a 14-element board a band under ~0.07 wide is
   * *narrower than one claim* and can be stepped straight over — which is the bug 0.9 recorded
   * against the mood hysteresis, in the same units.
   *
   * So the transition is signalled instead of inferred, the way `ending` is. `stepMood` already
   * knows the tier changed; this carries that one fact into the writing.
   *
   * **Optional here, one-shot at the caller, and the handover is the part that bit.** An event is
   * only worth anything if somebody spends it, and the first version let *any* reader clear it —
   * so the once-a-frame mood pass consumed it while the dialogue was still inside §8's talk gap,
   * and the line was dropped almost every time. Only the writing side spends it now.
   */
  lastStand?: boolean;
  /** Which ending, if the fight is ending. */
  ending?: 'win' | 'lose' | 'truce' | 'truce-recover';
  /**
   * Is this commander mode (§15, 2.0)?
   *
   * The dialogue has to know, because two lines in this table teach a *verb* and the two modes have
   * different ones. Nothing else in §8 branches on it: the cat's voice is the cat's voice whoever is
   * holding the claims, and a second script for the same animal would be a worse document as well as
   * a worse fight.
   */
  commanding?: boolean;
  /**
   * Which round beat is playing, in commander mode (§15, 2.0).
   *
   * Separate from `ending` because a round turning over is the opposite of an ending: the fight
   * continues, the cat has not left, and nothing about the page is being handed back. Folding it
   * into `ending` would have made every `s.ending === 'win'` check in this table describe a round
   * clear as well — including §9.4's rematch offer, which would then be offered every twenty
   * seconds to somebody who is not being asked to fight again because they never stopped.
   */
  round?: 'clear' | 'record' | 'again';
}

/**
 * Every line the cat can say, in priority order.
 *
 * The whole script in one array on purpose: §8's rules (seven words, lower-case, no
 * exclamation marks) are only enforceable if the writing lives somewhere a test can read
 * all of it, and the *voice* is only checkable by reading it as a block. Tone is the
 * spec here — a housecat doing a dragon impression — so a line that reads as cruel is a
 * bug even if it fires correctly.
 *
 * `when` gets the state and returns whether this line is due. Order is priority: endings
 * first, then losing badly, then winning, then the kind ones.
 */
export const LINES: readonly { id: string; text: string; when: (s: FightState) => boolean }[] = [
  /*
   * ---- 8.4 endings, and §9.4's ladder
   *
   * The ladder has no menu and no button, so **these lines are the whole of it**: the offer of
   * a harder rematch is a sentence, and the acceptance is pressing the toggle again. That
   * makes the ordering here load-bearing rather than tidy — a rung line placed under the
   * generic `win` would never be reached, which is the trap `support-last` fell into in 0.9.
   *
   * `rung` is the rung the fight was *fought* on; `finish` advances it afterwards. So "is
   * there another paw left to take" reads as `rung < found`.
   */
  {
    // The top of the ladder: every treat withheld, and you won anyway. Rarer than the collar,
    // so it outranks it.
    id: 'win-floor',
    text: 'i kept everything. you still won.',
    when: (s) => s.ending === 'win' && s.found > 0 && s.rung >= s.found,
  },
  { id: 'win-both', text: 'both, then. show-off.', when: (s) => s.ending === 'win' && s.collared },
  {
    /*
     * `found > 0` added in 1.0, and it does two jobs.
     *
     * It keeps the generic `win` below reachable: with the ladder's offer sitting above it,
     * every other win path was caught by floor, collar, clean or again, and "keep it. it's
     * drafty anyway." became a line that could never fire. The case left for it is the one
     * this gate opens — a visitor who found no treats at all, and so was never offered
     * anything to hold back.
     *
     * And it makes the line mean what it says. Not bribing the cat is restraint; having
     * nothing to bribe it with is not, and crediting somebody with a choice they never had
     * is the kind of small dishonesty §8's tone rules exist to catch.
     *
     * The line **carries the offer itself**, and that was a bug found in a browser rather than
     * here. Winning without spending a treat is the commonest way a good player wins — the
     * flee-and-scrub counter §5.2 is built around needs no treats at all — so this line sat
     * directly on top of `win-again` and suppressed §9.4's offer for exactly the visitor most
     * likely to want the next rung. Two sentences rather than two lines: appending the question
     * keeps both jobs and keeps every win line reachable.
     */
    id: 'win-clean',
    text: 'you didn’t even bribe me. again?',
    when: (s) => s.ending === 'win' && s.spent === 0 && s.found > 0 && s.rung < s.found,
  },
  {
    // §9.4's offer. Not a prompt, not a modal — the terms for a fight you may never take.
    id: 'win-again',
    text: 'again? i keep one back.',
    when: (s) => s.ending === 'win' && s.rung < s.found,
  },
  { id: 'win', text: 'keep it. it’s drafty anyway.', when: (s) => s.ending === 'win' },
  {
    // The rung easing back down, said without making a thing of it (§7.2: losing costs
    // nothing permanent, and a cat that gloated here would be a different animal).
    id: 'lose-rung',
    text: 'take one back. go on.',
    when: (s) => s.ending === 'lose' && s.rung > 0,
  },
  { id: 'lose', text: 'you may read on. quietly.', when: (s) => s.ending === 'lose' },
  { id: 'truce-recover', text: '…that was cowardly. respect.', when: (s) => s.ending === 'truce-recover' },
  { id: 'truce', text: 'sensible.', when: (s) => s.ending === 'truce' },

  /*
   * ---- §15's round beats (2.0), which are not endings
   *
   * A round is not a fight, so these sit apart from the four lines above and say something the
   * endings cannot: the cat is *still here*. It has just lost a board and the next one is already
   * being dealt, which is the difference between "keep it, it's drafty anyway" and "the next one's
   * mine" — one is a cat leaving and the other is a cat rolling its sleeves up.
   *
   * They are said by id rather than chosen (`clearRound` and `restartRound` call `say` directly at
   * the exact moment the board turns over), and they live in this table anyway because §8 is meant
   * to be the one place the cat's voice is written down. The `when` clauses keep that honest: a line
   * with no reachable state would be a line nobody can audit.
   */
  {
    id: 'round-record',
    text: 'nobody’s got this far. yet.',
    when: (s) => s.round === 'record',
  },
  {
    id: 'round-clear',
    text: 'fine. the next one’s mine.',
    when: (s) => s.round === 'clear',
  },
  {
    id: 'round-again',
    text: 'told you. from the top.',
    when: (s) => s.round === 'again',
  },

  /*
   * ---- §9.4, at the top of a laddered fight
   *
   * The handicap is revealed *as the fight opens* rather than before the press, so something
   * has to say what the withheld paw in the HUD means. Gated on nothing having happened yet,
   * which is only true in the opening seconds — and on a normal fight it never fires at all,
   * because `rung` is 0.
   */
  {
    id: 'rung-open',
    // Not "you asked for this one": `win-both` and `win-floor` can both outrank the offer, so a
    // visitor may arrive at a harder fight without having been asked anything. A line that
    // presumes the offer was heard would be the cat inventing a conversation. This one states
    // the fact, which is true however you got here — and it is the reliable channel, because
    // unlike the win lines it always fires when the rung is raised.
    text: 'one of yours stays with me.',
    when: (s) => !s.ending && s.rung > 0 && s.freed === 0 && s.spent === 0,
  },

  /*
   * ---- 8.2 supporting, when the player is losing
   *
   * Above the bluffing lines, deliberately, and the tests are what found it: at 80%
   * territory with an empty-handed player, a bluff-first order had the cat gloating —
   * "you are making this loud" — at somebody who had nothing left to try. Both categories
   * describe the *same* state from two sides, so §8.1 and §8.2 can only be told apart by
   * who is stuck: **being kind beats gloating whenever the player has no way forward.**
   * Pillar 3 says this cat is bluffing, not malevolent, and priority order is where that
   * is either true or not.
   *
   * §8.2 gates these on "aggression drops to the bored tier". Through 0.8 that tier did
   * not exist — the comment here said "until step 5" and step 5 came and went — so these
   * fired on the conditions *underneath* it: losing, out of options, nothing changing.
   * Step 7 built the tier, so the two that are really about it now say so, and the cat's
   * words and its behaviour change together instead of merely correlating.
   *
   * Not all of them moved. `support-bribe` fires while you still have treats, which is
   * exactly the case `mood` refuses to call bored; the idle and stale lines are about a
   * fight nobody is playing, which can happen in any tier.
   */
  /*
   * The specific one first. Both are bored-tier lines now, and "spent everything and took
   * ground with it" is a subset of "bored" — so ordered the other way round it would only
   * ever be reachable through the repeat-suppression path in `pickLine`, which is not a
   * priority, it is an accident. The generic line is the fallback it sounds like.
   */
  { id: 'support-last', text: 'spending everything. bold.', when: (s) => s.mood === 'bored' && s.spent > 0 && s.freed > 0 },
  { id: 'support-none', text: 'i’ll wait. go find a fish.', when: (s) => s.mood === 'bored' },
  {
    // Added in 0.6. §7.4 wants treats explained by the cat asking for one rather than by
    // a tooltip, and until now nothing taught the throw at all — the crosshair says where
    // you *can* throw and nothing about why you would. This is that line.
    //
    // Deliberately *not* a bored-tier line: it fires while you still have treats, which is
    // the one case `mood` refuses to call bored. Being pitied while you still have options
    // reads as condescension; being asked for a bribe reads as an opening.
    id: 'support-bribe',
    text: 'you could just bribe me.',
    when: (s) => s.ammo > 0 && s.spent === 0 && s.territory > 0.7,
  },
  {
    // Added in 1.3 — the playtest's core finding: nothing teaches the verb.
    // A cold visitor's opening state (territory 0.55, nothing freed, nothing spent) fell
    // in the dead band between rattled-50 (≤0.5) and bluff-75 (≥0.75), so the fight opened
    // in silence and the first thing the cat ever said was support-idle — "you can stop
    // any time." — to somebody who had not started. This line is the missing §7.4 row:
    // gated on the opening (no ending, freed === 0, spent === 0, territory above the dead
    // band's lower edge) and placed above support-idle so it wins the opening seconds,
    // inside OPENING_GRACE_MS where the cat provably cannot pounce — each mechanic in a
    // safe context, exactly as §7.4 asks.
    id: 'teach-hold',
    text: 'hold still on it. it comes back.',
    when: (s) => !s.ending && !s.commanding && s.freed === 0 && s.spent === 0 && s.territory > 0.5,
  },
  {
    /*
     * The same row for the other game (§15, 2.0).
     *
     * A commander is never told to hold anything, because holding is not one of their verbs — the
     * kittens do it. Left ungated, 1.3's teach line taught the wrong game to every visitor who met
     * the default mode, which a browser run showed it doing over and over while a kitten worked
     * beside the words.
     *
     * What it teaches instead is the *only* thing worth knowing: pointing is allowed. Not "you must
     * point" — the mode's whole promise is that the round resolves either way — so the line names
     * the option and leaves it there. Same gate as above (the cold opening, inside the grace), so a
     * visitor who has already given an order never sees it.
     */
    id: 'teach-order',
    text: 'point at one. they’ll fetch it.',
    when: (s) => !s.ending && !!s.commanding && s.freed === 0 && s.spent === 0 && s.territory > 0.5,
  },
  {
    // Re-gated in 1.3: "you can stop any time" must read as mercy to someone who has
    // tried, not as dismissal to someone who has not started. A confused player's first
    // feedback is now the teach line above, and idle mercy waits until the fight has
    // actually been attempted.
    id: 'support-idle',
    text: 'you can stop any time.',
    when: (s) => s.idleMs > 8000 && (s.freed > 0 || s.spent > 0),
  },
  { id: 'support-stale', text: 'we could both sit down.', when: (s) => s.staleMs > 20000 },
  { id: 'support-interrupts', text: 'that one was mine. mostly.', when: (s) => s.interrupts >= 3 },

  // ---- 8.3 rattled, while losing
  /*
   * The last stand's own line (1.4), and it sits *above* `rattled-10` deliberately.
   *
   * §7.3's desperate tier now speeds the regrow clock as well as the wind-up, and a mechanic the
   * player can feel should be a mechanic the player is told about — otherwise the walls closing
   * faster reads as the game glitching rather than as the cat trying. The rattled lines below are
   * about *losing ground*; this one is about the cat deciding not to.
   *
   * Gated on the tier rather than on territory alone, so it cannot fire while the cat is merely
   * behind: `mood` is hysteretic, so this speaks exactly when the faster clock is actually
   * running. It stays in character — §8's cat bluffs, it does not rage — so this is a threat
   * delivered flatly, which at seven words is the most menacing register available.
   *
   * **Gated on the transition, not on territory — and that is a correction, not a preference.**
   * Written first as `mood === 'desperate' && territory <= 0.2`, this shadowed §8.3's ladder:
   * the tier *enters* at 0.2, so in real play every territory low enough for `rattled-20` or
   * `rattled-10` is also desperate, and an unbounded gate wins every time one of them is due.
   * `rattled-20` lost its entire band. 1.2's reachability sweep cannot see this — it varies
   * `mood` and `territory` independently while the game derives one from the other — so 1.4 adds
   * a second sweep that uses the real `mood()`, and that is what caught it.
   *
   * Narrowing the band was not a fix: territory moves by `1 / board`, so on a 14-element board any
   * band under ~0.07 is narrower than a single claim and can be stepped clean over. 0.9 recorded
   * that same arithmetic against the mood hysteresis. An event needs an event's signal, so
   * `lastStand` carries it — and the cat threatens **once**, on the way in, which is the better
   * read anyway: you announce a last stand, you do not narrate it.
   */
  {
    id: 'last-stand',
    text: 'the walls come in now.',
    when: (s) => !s.ending && !!s.lastStand,
  },
  { id: 'rattled-10', text: 'fine. fine.', when: (s) => s.territory <= 0.1 },
  { id: 'rattled-20', text: 'this was my spot first.', when: (s) => s.territory <= 0.2 },
  { id: 'rattled-35', text: 'i am letting you have it.', when: (s) => s.territory <= 0.35 },
  { id: 'rattled-50', text: 'that one didn’t count.', when: (s) => s.territory <= 0.5 },

  // ---- 8.1 bluffing, while winning
  { id: 'bluff-100', text: 'as it was. as it should be.', when: (s) => s.territory >= 1 },
  { id: 'bluff-90', text: 'i could do this all day.', when: (s) => s.territory >= 0.9 },
  { id: 'bluff-hit', text: 'mine. still mine.', when: (s) => s.interrupts >= 1 && s.territory > 0.6 },
  { id: 'bluff-misses', text: 'try holding stiller. or don’t.', when: (s) => s.interrupts >= 2 },
  { id: 'bluff-75', text: 'you are making this loud.', when: (s) => s.territory >= 0.75 },

  /*
   * ---- 1.3: the dead band (0.5–0.75 territory) ----
   *
   * The 1.2 reachability sweep asked "is every line reachable" and could not see the hole
   * this fills: every line is reachable, and the state space still had a gap where a normal
   * fight actually lives. rattled fires at ≤0.5, bluffing at ≥0.75, and a mid-fight at 0.6
   * with nothing else due said nothing — silence in the middle of a live fight. This line
   * is the inverse check's answer. It sits **last**, below every specific line, so it only
   * fires when nothing more interesting is due — the guarantee is that the band maps to a
   * line, not that the cat stops having favourites.
   */
  { id: 'even-hold', text: 'i like it here.', when: (s) => !s.ending && s.territory > 0.5 && s.territory < 0.75 },
];

/**
 * The line to say now, or null for silence.
 *
 * `last` suppresses an immediate repeat: the same words twice running read as a stuck
 * ribbon rather than as a cat with a limited vocabulary, and the second-choice line is
 * always more interesting than the first one again.
 */
export function pickLine(s: FightState, last?: string): string | null {
  const due = LINES.filter((l) => l.when(s));
  if (!due.length) return null;
  const fresh = due.find((l) => l.id !== last);
  // An ending is worth repeating; nothing else is.
  if (!fresh) return s.ending ? (due[0]?.id ?? null) : null;
  return fresh.id;
}

/** The words for an id. */
export function lineText(id: string): string {
  return LINES.find((l) => l.id === id)?.text ?? '';
}

/* ------------------------------------------------------------------ *
 * Auto-truce (§11) — nobody comes back to a page mid-invasion
 * ------------------------------------------------------------------ */

/** Tab hidden this long ends the fight by itself. */
export const HIDDEN_TRUCE_MS = 10_000;

/** Pointer gone this long does too — a fight nobody is playing is over. */
export const IDLE_TRUCE_MS = 20_000;
