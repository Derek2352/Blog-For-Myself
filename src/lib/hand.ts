/**
 * The invisible hand — GDD §16. The player's one verb: swipe across the cat's path and shove it
 * off course, while the kittens get on with their work by themselves.
 *
 * **Why this module exists.** Every existing lever on the cat is a *clock* or a *leash*: a treat
 * lures it somewhere (`fetch`), slows it (`slowMul`), leashes it to a radius (`anchorPx`), stretches
 * its telegraph (`telegraphMul`), or stuns it (`SWAT_STUN_MS`). Mood and round scale its speed and
 * its patience; stances scale its stalk. **Nothing in the game displaces the cat.** A deflection is
 * genuinely new movement, so it gets its own pure module rather than another special case inside
 * `stepBoss`.
 *
 * **Pure and DOM-free**, like `arena.ts`, `squad.ts` and `card.ts` — the geometry is the part worth
 * unit-testing, and it is the part that has to be right before anything is judged by eye.
 *
 * **The one design idea, stated once.** The impulse is the component of the swipe *perpendicular to
 * the cat's heading*. A flick across its path shoves it hard; a flick along its path barely moves
 * it. That is what makes the gesture read as **a gust of wind rather than a button** — the cat is
 * not being commanded, it is being interfered with, and the angle you choose is the whole skill.
 */
import { CARD_SCALE } from './card';

/* ------------------------------------------------------------------ *
 * Constants. Distances are in *card* pixels (already scaled), because the hand only ever exists on
 * the card — there is no page game left to share them with.
 * ------------------------------------------------------------------ */

/**
 * How fast the pointer must travel to count as a swipe, in card px/s.
 *
 * The floor has to sit clearly above two things that are not swipes: a hand resting and drifting,
 * and the slow tracking movement of someone reading the board. `CARD_STALK_SPEED` is 34px/s and a
 * desperate cat reaches ~48px/s, so anything at or below the cat's own top speed would let a
 * cursor merely *following* the cat deflect it continuously. 240px/s is ~5× the cat's fastest walk
 * — deliberate, but nowhere near a violent flick.
 */
export const SWIPE_MIN_SPEED = 240;

/**
 * How near the cat the swipe must pass, in card px.
 *
 * The sprite is 28×18, so its half-diagonal is ~16.6px. 20px means "you have to actually cross the
 * animal", with a couple of pixels of forgiveness for a finger — but not so much that a swipe
 * anywhere on a 318×217 board connects. Compare `SWAT_RADIUS * CARD_SCALE` = 12.8px, which is
 * tighter because a thrown treat is aimed at leisure and a swipe is not.
 */
export const SWIPE_RADIUS = 20;

/** How long one shove takes to spend itself. Long enough to read as a push, short enough that the
 *  cat's own intent takes back over quickly — this is interference, not remote control. */
export const IMPULSE_MS = 420;

/**
 * **Peak speed** of the shove, in card px per second — a velocity, not a distance.
 *
 * The distinction is not pedantry: the first draft called this `IMPULSE_PX` and described it as a
 * displacement while `veer` returned it as a velocity. At 26 the arithmetic below gives 7.3px of
 * actual travel, against the cat's own 14px of walk over the same 420ms — **the shove would have
 * been half the speed of the thing it was supposed to interrupt**, and invisible. The unit test for
 * legibility is what surfaced it, before anything was judged by eye.
 *
 * 90px/s is ~2.6× `CARD_STALK_SPEED` (34) and ~1.9× a desperate cat's 48 — decisively faster than
 * the cat can walk, which is what makes a shove feel like a shove.
 */
export const IMPULSE_SPEED = 90;

/**
 * How far one shove actually moves the cat, in card px. **Derived, not chosen.**
 *
 * The impulse decays as `1 − t²`, and ∫₀¹(1 − t²)dt = 2/3, so travel is `peak × ⅔ × duration`.
 * Stating it as a constant means the number the design cares about — "about half a tile" — is
 * checkable, and it moves on its own if either input changes rather than silently going stale.
 * A tile is ~96×46 on a 318×217 board, so ~25px is half a tile's height: plainly visible, and well
 * short of a teleport.
 */
export const IMPULSE_TRAVEL_PX = IMPULSE_SPEED * (2 / 3) * (IMPULSE_MS / 1000);

/**
 * The smallest shove worth having, in card px/s — the along-the-path **dead zone**.
 *
 * `veer` returns `IMPULSE_SPEED · |sin θ|`, so a swipe exactly down the cat's heading returns zero and
 * a swipe one degree off returns 1.6px/s: a shove too small to see, arriving with the full recoil
 * flash and the full sound. The card's guard was `v.x === 0 && v.y === 0`, an equality test on a
 * floating-point rejection, so in practice it never fired at all — `scratchpad/hand.mjs` §1 found a
 * flick aimed exactly along the heading landing a shove of ~1e-14px/s, loudly.
 *
 * `0.15 · IMPULSE_SPEED` is |sin θ| ≥ 0.15, a dead zone about 8.6° either side of the cat's line. Below
 * that the gesture is simply not a shove: nothing moves, nothing flashes, nothing sounds. That matters
 * beyond tidiness, because **an acknowledgement of something that did not happen is worse than no
 * acknowledgement** — it teaches the player the wrong rule and then contradicts it.
 *
 * Wide enough to be a real zone rather than a mathematical point; narrow enough that the smooth
 * `|sin θ|` ramp the mechanic is built on survives everywhere else.
 */
export const SHOVE_MIN = IMPULSE_SPEED * 0.15;

/**
 * What fraction of its own stride the cat keeps at the height of a shove.
 *
 * The card's walk is **homing** — it re-aims at the cat's quarry every frame — so a sideways impulse
 * is not something the cat carries, it is an error the cat corrects, and it corrects harder the closer
 * it is to what it is chasing. `tests/hand.test.ts` integrates that branch with the real constants: a
 * bare impulse keeps 25.7px of its nominal 25.2 at 140px from the quarry and only 15.8px at 10px.
 *
 * This constant is one of two remedies for that gap (the other, the heading blend, lives in the card
 * because it is about `stepBoss`'s aim rather than about the gesture). At the peak of the impulse the
 * cat keeps this much of its own stride, easing back to all of it as the impulse decays: worst case
 * 15.8px → 23.0px, best case unchanged, so the shove stops depending on where the cat is standing.
 *
 * `0.35` rather than `0` because a cat stopped dead reads as *paused*, and this is interference, not a
 * pause button — a third of a stride keeps it visibly trying to get where it was going.
 *
 * It is also the more honest physics, which is the real reason it is a separate term rather than a
 * bigger `IMPULSE_SPEED`. A gust does not add sideways speed to something with perfect traction; it
 * takes the traction away. The push and the lost footing are one event.
 */
export const SHOVE_FOOTING = 0.35;

/**
 * Minimum gap between two effective swipes.
 *
 * Without a cooldown, scrubbing the pointer in small fast circles over the cat pins it in place
 * forever and the game stops being a decision — it becomes a fidget with no failure state. A gap
 * slightly longer than the impulse itself means shoves cannot overlap, so the cat always gets a
 * moment of its own movement back between them.
 */
export const SWIPE_COOLDOWN_MS = 460;

/* ------------------------------------------------------------------ *
 * Geometry
 * ------------------------------------------------------------------ */

/** Pointer speed over one segment, in px/s. `0` for a zero-length tick, so callers need no guard. */
export function swipeSpeed(dx: number, dy: number, dtMs: number): number {
  if (dtMs <= 0) return 0;
  return (Math.hypot(dx, dy) / dtMs) * 1000;
}

/** Is this movement a swipe rather than a drift? */
export function isSwipe(speed: number): boolean {
  return speed >= SWIPE_MIN_SPEED;
}

/**
 * Did the pointer's segment pass within `radius` of the cat?
 *
 * Point-to-**segment** distance, not point-to-point, and that is the whole reason this is a
 * function rather than a `Math.hypot` at the call site. A genuine flick covers far more ground in
 * one frame than the sprite is wide: at 900px/s a 16ms frame is 14px, and a fast one is 40px. Testing
 * only where the pointer *landed* would let the swipe tunnel straight through the cat and miss, so
 * the faster you flicked the less it would work — exactly backwards.
 */
export function segmentHit(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  radius = SWIPE_RADIUS,
): boolean {
  const vx = bx - ax;
  const vy = by - ay;
  const len2 = vx * vx + vy * vy;
  // Degenerate segment (no movement): fall back to the point distance.
  if (len2 === 0) return Math.hypot(cx - ax, cy - ay) <= radius;
  // Projection of C onto AB, clamped to the segment so the ends do not reach past themselves.
  const t = Math.max(0, Math.min(1, ((cx - ax) * vx + (cy - ay) * vy) / len2));
  return Math.hypot(cx - (ax + t * vx), cy - (ay + t * vy)) <= radius;
}

/**
 * The impulse a swipe imparts: the part of it that is **across** the cat's heading.
 *
 * Returns a velocity in px/s, to be decayed by `impulseAt`. A swipe perpendicular to the heading
 * gives the full `strength`; one parallel to it gives nothing. A cat with no heading (standing
 * still) has no "across", so the swipe pushes along its own direction at full strength — shoving a
 * stationary cat should still work, and there is no axis to be perpendicular to.
 */
export function veer(
  headingX: number,
  headingY: number,
  swipeX: number,
  swipeY: number,
  strength = IMPULSE_SPEED,
): { x: number; y: number } {
  const sLen = Math.hypot(swipeX, swipeY);
  if (sLen === 0) return { x: 0, y: 0 };
  const sx = swipeX / sLen;
  const sy = swipeY / sLen;

  const hLen = Math.hypot(headingX, headingY);
  if (hLen === 0) return { x: sx * strength, y: sy * strength };
  const hx = headingX / hLen;
  const hy = headingY / hLen;

  // Remove the component of the swipe that runs along the heading; what is left is the shove.
  // Because (sx, sy) is a *unit* vector, this rejection already has magnitude |sin θ| — so
  // multiplying by `strength` gives `strength · |sin θ|` in the perpendicular direction, and the
  // design rule ("across shoves, along does not") is the arithmetic itself rather than a fudge
  // factor applied on top of it.
  const along = sx * hx + sy * hy;
  const px = sx - along * hx;
  const py = sy - along * hy;
  return { x: px * strength, y: py * strength };
}

/**
 * How much of the impulse is left, `1` → `0` over `IMPULSE_MS`.
 *
 * Ease-out (1 − t²): the shove lands hard and trails off, which is how a push feels. A linear decay
 * reads as the cat being dragged on a rail.
 */
export function impulseAt(elapsedMs: number, over = IMPULSE_MS): number {
  if (elapsedMs <= 0) return 1;
  if (elapsedMs >= over) return 0;
  const t = elapsedMs / over;
  return 1 - t * t;
}

/** True once the cooldown has elapsed since the last effective swipe. */
export function swipeReady(sinceMs: number, cooldown = SWIPE_COOLDOWN_MS): boolean {
  return sinceMs >= cooldown;
}

/** The page-pixel figures these came from, kept so the card's scale is auditable in one place. */
export const HAND_SCALE_NOTE = {
  scale: CARD_SCALE,
  swipeMinSpeedPage: SWIPE_MIN_SPEED / CARD_SCALE,
  impulseSpeedPage: IMPULSE_SPEED / CARD_SCALE,
  travelCardPx: IMPULSE_TRAVEL_PX,
} as const;
