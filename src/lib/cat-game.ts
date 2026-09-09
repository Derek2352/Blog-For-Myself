/**
 * The cat's quiet reward loop.
 *
 * Every navigable tab hides one treat. Find them and the cat warms to you —
 * watching, then following, then dozing off nearby. Progress is deliberately
 * **session-only**: it lives in the cat script's memory, so it survives moving
 * between pages and resets on a refresh or for a new visitor. Nothing is stored.
 *
 * This module holds only the parts that don't touch the DOM, so they can be
 * tested without an Astro runtime (same reason `sort.ts` sits apart from the
 * components that use it). The motion lives in `components/SiteCat.astro`.
 */
import { hash } from './wash';

/**
 * Treat shapes. Picked per tab by hashing the slug rather than mapped by hand, so
 * a category added tomorrow gets its own treat with no code change — the same
 * bargain `resolveWash` makes for hues.
 */
export const TREATS = ['fish', 'yarn', 'bell', 'feather', 'biscuit'] as const;
export type Treat = (typeof TREATS)[number];

/** Which treat hides in a given tab. Stable for a slug, for the whole session. */
export function resolveTreat(slug: string): Treat {
  // unsigned shift, then modulo: a signed `>>` can go negative on large hashes,
  // and a negative index reads off the end of the wheel as undefined
  return TREATS[(hash(slug) >>> 5) % TREATS.length]!;
}

/**
 * How the cat feels about you, worst to best. Plain words: a cat that has decided
 * you're acceptable is more charming than one with a numeric affection stat.
 */
export const LEVELS = [
  'keeping its distance',
  'watching you',
  'warming up',
  'friendly',
  'fond of you',
  'attached',
  'yours',
] as const;
export type Level = (typeof LEVELS)[number];

/** Top rung index. */
export const MAX_LEVEL = LEVELS.length - 1;

/**
 * Affection from progress, as a **ratio** rather than one rung per tab. With six
 * tabs that happens to be one each, but publishing a seventh category must not
 * strand the top rung out of reach — or hand out the same rung twice.
 */
export function levelFor(found: number, total: number): number {
  if (total <= 0 || found <= 0) return 0; // also guards 0/0 → NaN
  const clamped = Math.min(found, total);
  return Math.min(MAX_LEVEL, Math.round((clamped / total) * MAX_LEVEL));
}

/** The level's name, for the caption under the paw row. */
export function levelName(found: number, total: number): Level {
  return LEVELS[levelFor(found, total)]!;
}

/** `"3 / 6 · warming up"` — what the caption says on a level-up. */
export function captionFor(found: number, total: number): string {
  const clamped = Math.max(0, Math.min(found, Math.max(0, total)));
  return `${clamped} / ${Math.max(0, total)} · ${levelName(clamped, total)}`;
}

/**
 * `"3 / 6 treats"` — the line that sits under the paw row the rest of the time.
 *
 * The row used to be paws alone once the level-up caption had faded, which left a
 * visitor looking at six 9px dots with nothing anywhere saying what they were. The
 * word is the whole point of this function: it is what turns the dots into a tally
 * of something. `captionFor` still supplies the flavour for the few seconds after a
 * find.
 */
export function tallyFor(found: number, total: number): string {
  const cap = Math.max(0, total);
  const clamped = Math.max(0, Math.min(found, cap));
  return `${clamped} / ${cap} treats`;
}

/**
 * `[PH 3200]` ms the paw row stays up before retiring.
 *
 * The row is not a permanent readout. `#cat-hud` is fixed at the viewport's bottom-left and the
 * chip is 111–263px wide depending on the caption, while the page's content column starts at 88px
 * @1280 and 24px @1024 — so a chip that never leaves is a chip parked on the writing, which
 * `scratchpad/hud-overlap.mjs` measured landing on headings, body prose and the footer's tagline
 * at every scroll position it sampled. It rises when it has something to say, and then gets out
 * of the way — which is what this number is the length of.
 *
 * The number is the read, not the animation: long enough for a glance down, five words, and a
 * glance back — the caption is at most `"7 / 7 · all found — good hunting"` — and short enough
 * that a visitor who ignores it is not reading around a box for very long. It covers both the
 * arrival greeting and a find, deliberately: two dwells would be two numbers to keep in step for
 * a difference nobody can perceive.
 */
export const HUD_DWELL_MS = 3200;

/** True once every tab's treat has been found (and there was anything to find). */
export function isComplete(found: number, total: number): boolean {
  return total > 0 && found >= total;
}

/* ------------------------------------------------------------------ *
 * The top state (§7.1)
 * ------------------------------------------------------------------ */

/**
 * Has the visitor proved themselves **both** ways this session?
 *
 * §7.1 runs two parallel ladders — the collar for patience (find every treat) and the notch
 * for confrontation (win a fight) — and puts one state above both, "reachable only by playing
 * both ways". The `&&` is the entire design: either path alone already has its own reward, and
 * the point of this one is that it cannot be reached by doing more of what you were already
 * doing.
 *
 * Both inputs are session-only and live as classes on the cat (`lv6`, `notched`), so there is
 * nothing to store and nothing a returning visitor inherits.
 */
export function isTopState(level: number, notched: boolean): boolean {
  return notched && level >= MAX_LEVEL;
}

/**
 * `[PH 620]` ms the pointer must rest before the cat commits to sitting on it.
 *
 * §7.1 says the cat sits on the cursor "when idle", and it is the *pointer* being idle that
 * makes sense of it — a cat sitting on a moving cursor is chasing, not sitting. Long enough
 * that crossing the cat's strip on the way to something else never summons it; short enough
 * that stopping to read feels answered rather than waited out.
 */
export const PERCH_STILL_MS = 620;

/**
 * `[PH 4]` px — how close counts as *on* rather than beside.
 *
 * The chase that already ships stops at 26px and calls it "sitting proudly next to the prey".
 * This is the number that makes §7.1 a different reward rather than the same one held longer.
 */
export const PERCH_SNAP_PX = 4;

/**
 * `[PH 22]` px of pointer movement that ends the perch.
 *
 * Comfortably above `PERCH_SNAP_PX` so the cat's own arrival cannot break its own perch, and
 * above the jitter of a hand resting on a mouse — but well under a deliberate move, because
 * the one thing a cat sitting on your cursor must do is get off it the moment you want to work.
 */
export const PERCH_BREAK_PX = 22;

/* ------------------------------------------------------------------ *
 * The gaze (§17) — the cat looks where you point
 * ------------------------------------------------------------------ */

/**
 * `[PH 9]` degrees — how far the head turns toward the pointer.
 *
 * Read off the drawing rather than chosen: the skull is a circle of r=7.6 in a 64×40 viewBox,
 * and the two ears sit on top of it as separate paths reaching up to y=1.5. Past about 10° the
 * far ear's tip swings clear of the skull's silhouette and the head reads as *detached* rather
 * than turned — at the rendered 48×30 that is a two-pixel gap, which is plenty to look broken.
 *
 * The reference clip this came from was measured the same way (`scratchpad/measure_ref.py`): its
 * mascot's face travels ~17px horizontally against ~3px vertically, so the motion that reads as
 * "it noticed me" is a **yaw**, not a nod. This is the yaw.
 */
export const GAZE_YAW_DEG = 9;

/**
 * `[PH 0.55]` user units the **pupil** travels inside the eye, at full deflection.
 *
 * Bounded by the art, and the bound got tighter and more honest when the eye was redrawn. It used
 * to be the whole eye sliding across the skull, capped at 1.2 by the distance to the skull's
 * outline. The eye is now a socket with a pupil in it (`CAT_EYE`, `CAT_PUPIL` in `cat-art.ts`),
 * so the real limit is `rx 1.15 − rx 0.5 = 0.65` — the point at which the pupil's edge reaches the
 * socket's. 0.55 leaves a hair of white on the far side, which is what stops a full deflection
 * reading as a defect. (It was 0.9 against a larger eye, until the eye was halved to stop the cat
 * looking like a mascot; the constant followed the drawing, which is the point of deriving it
 * from the drawing.)
 *
 * The vertical falls out of the same geometry: `0.55 × GAZE_NOD_RATIO` is 0.17, comfortably inside
 * the socket's own 0.95 − 0.72 = 0.23 of vertical room. The two axes are bounded by two different
 * numbers and neither had to be guessed.
 */
export const GAZE_EYE_UNITS = 0.55;

/**
 * `[PH 0.3]` — vertical deflection as a fraction of horizontal.
 *
 * Not 1. The measured reference is a 5.7:1 horizontal-to-vertical ratio, and the reason
 * generalises past that one clip: a head on a neck turns much further than it tilts. Keeping
 * some vertical is still worth it, because a pointer up in the header and a pointer down by the
 * footer should not produce the same face. 0.3 is enough to tell those apart and not enough to
 * turn the yaw into a nod.
 */
export const GAZE_NOD_RATIO = 0.3;

/**
 * `[PH 200]` ms time constant for easing the gaze toward its target.
 *
 * `HEADING_TAU_MS = 220` is already justified in `hand.ts` as roughly the window an eye
 * integrates a direction over, and this is the same perceptual quantity one step more direct:
 * there the number smoothed an *inferred* heading, here it smooths where a literal eye is
 * pointing. Slightly quicker for that reason. Short enough that the cat feels like it noticed
 * you; long enough that a flick of the wrist does not snap its head round like a mechanism.
 */
export const GAZE_TAU_MS = 200;
