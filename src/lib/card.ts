/**
 * The card game's scale — GDD §2.2.
 *
 * **Why this file exists.** The page game's pure logic (`arena.ts`, `squad.ts`) is written in
 * page-pixel coordinates: a boss that stalks at 170px/s across a 1280×900 viewport, a pounce
 * range of 90px, a safe distance of 423px. The card game plays in a ~280×180 board area inside
 * a floating card, so every *distance* constant scales by `CARD_SCALE` while every *duration*
 * constant (scrub, telegraph, leap, recover, work) stays exactly as measured — time does not
 * shrink with the board (§2.2's coordinate table).
 *
 * **Nothing here computes with a DOM.** The card's game loop imports these scaled numbers the
 * way the page game imports the unscaled ones, and the pure predicates from `arena.ts` /
 * `squad.ts` take positions as arguments — so the card passes card-relative positions and these
 * card-scale constants, and the same arithmetic answers the same questions.
 *
 * A handful of predicates bake their constants in (`provoked`'s `POUNCE_RANGE`, `pounceHit`'s
 * `HIT_RADIUS`, `predict`'s `PREDICT_CAP`, squad's clock comparisons). Those functions accept
 * optional override parameters — added in 2.2, defaulting to the page-game constant, so every
 * existing caller and test measures exactly what it measured before. This file is where the
 * card versions of those calls are composed, in one place.
 */
import { POUNCE_RANGE, HIT_RADIUS, PREDICT_CAP, STALK_SPEED, AGGRO_DESPERATE, LEAP_HEIGHT } from './arena';
import { KITTEN_SPEED, SAFE_WORK_PX } from './squad';

/**
 * `[PH 1/5]` — every page-game distance constant, divided by this.
 *
 * The plan's table: STALK_SPEED 170 → ~35, KITTEN_SPEED 250 → ~50, POUNCE_RANGE and
 * SAFE_FLEE_PX scaled. The board is ~280×180 against a ~1280×900 viewport; the width ratio
 * (0.22) and height ratio (0.2) both sit near 1/5, and one factor is better than two that
 * disagree about the same fight.
 */
export const CARD_SCALE = 1 / 5;

/* Distances, scaled. Durations are deliberately not here — SCRUB_MS, TELEGRAPH_MS, LEAP_MS,
 * RECOVER_MS and KITTEN_WORK_MS are time and time does not shrink (§2.2's table says so in
 * so many words). */
export const CARD_STALK_SPEED = STALK_SPEED * CARD_SCALE; // 34 px/s — the boss's walk
export const CARD_KITTEN_SPEED = KITTEN_SPEED * CARD_SCALE; // 50 px/s — the kittens' trot
export const CARD_POUNCE_RANGE = POUNCE_RANGE * CARD_SCALE; // 18 px — the commit distance
export const CARD_HIT_RADIUS = HIT_RADIUS * CARD_SCALE; // ~9 px — the landing's catch radius
export const CARD_PREDICT_CAP = PREDICT_CAP * CARD_SCALE; // 24 px — how far ahead it may aim
/** 1.0's measured safe distance, scaled: ~85px on the card's board. */
export const CARD_SAFE_FLEE_PX = SAFE_WORK_PX * CARD_SCALE;
/** The desperate tier's top speed, scaled — what `threatTimeMs` walks the cat at. */
export const CARD_DESPERATE_SPEED = STALK_SPEED * AGGRO_DESPERATE * CARD_SCALE;
/** The hop's height on the card's board — a ~42px page leap is an ~8px card hop. */
export const CARD_LEAP_HEIGHT = LEAP_HEIGHT * CARD_SCALE;
