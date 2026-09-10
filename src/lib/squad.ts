/**
 * The squad — commander mode's rules (§15, 2.0).
 *
 * **Why this file exists.** 1.4's fight measures well and plays badly for the person it is
 * actually for. §5.2's core verb is holding a pointer perfectly still for 1400ms, §3's decision
 * is *scrub now or spend a treat*, and 1.0 measured that the winning line is to hold **423px
 * away from the cat** — so the fight asks a portfolio visitor to learn positioning, timing and a
 * resource trade before anything good happens. Two playtests returned the same sentence: *"she
 * doesn't know what she's doing."* On a CV site the correct amount of homework is none.
 *
 * So the verb changes hands rather than changing. **Kittens** do the holding; the visitor gives
 * orders or gives nothing. Everything §5–§9 measured about the fight stays true, because the
 * boss, the board, the stances, the moods and the dialogue are untouched — what moved is who
 * performs the hold.
 *
 * Everything here is pure and DOM-free for the same reason `arena.ts` is: the interesting claims
 * are arithmetic ("can a squad out-reclaim this clock?"), and arithmetic should not need a
 * browser to check. The one exception is the two `localStorage` functions at the bottom, marked
 * as the client half the way `a11y-prefs.ts` marks its own.
 */
import {
  SCRUB_MS,
  POUNCE_RANGE,
  STALK_SPEED,
  AGGRO_DESPERATE,
  regrowInterval,
  type Mood,
} from './arena';

/* ------------------------------------------------------------------ *
 * The safe distance — 1.0's arithmetic, reused as a *policy*
 * ------------------------------------------------------------------ */

/**
 * How far a claim has to be from the boss for a hold on it to be uninterruptible.
 *
 * `POUNCE_RANGE` plus the furthest a leaping stance can walk in one `SCRUB_MS`, computed at the
 * desperate tier because that is the cat a winning squad faces. This is not a new number: it is
 * the 423px 1.0 discovered by measuring a treatless win, and `arena8`/`battle.mjs` have both
 * used it since as the definition of a claim that can be worked in peace.
 *
 * In 1.4 it was a *finding* about how a human should play. Here it is kept as the **reference
 * figure** rather than the rule: `pickWork` compares two clocks instead, which reduces to exactly
 * this distance for a worker standing on its claim, and to a tighter one for a kitten because
 * `KITTEN_WORK_MS` is shorter than `SCRUB_MS`. Same arithmetic, one more variable — and the reason
 * a kitten can be trusted to play unattended is that its policy is the thing the harness proved
 * wins, applied every time without being told.
 */
export const SAFE_WORK_PX = POUNCE_RANGE + STALK_SPEED * AGGRO_DESPERATE * (SCRUB_MS / 1000);

/* ------------------------------------------------------------------ *
 * The kitten itself
 * ------------------------------------------------------------------ */

/**
 * `[PH 250]` px/s — how fast a kitten trots, and it has to be faster than the cat.
 *
 * **The first version was 190 and it made commander mode unwinnable.** The reasoning then was
 * symmetrical and wrong: above `STALK_SPEED` (170) so a kitten can cross the board, but below the
 * cat's desperate speed (170 × 1.4 = 238) "because a cornered cat has to be able to run one down".
 *
 * A frame-by-frame trace of a real fight is what settled it. The cat's pounce cycle *with no walk
 * to make* is `recover × spec + telegraph × spec × telegraphScale + LEAP`: 1422ms for siege, about
 * 1600ms for ambush. A hold is `SCRUB_MS` — 1400ms. So a kitten standing next to the cat has
 * roughly twenty milliseconds of margin, and any interruption at all takes it below zero: the
 * trace showed a hold reaching 0.75, being landed on, restarting, reaching 0.38, being landed on
 * again, for as long as anybody watched. A cat that can always stay in contact is a cat that
 * cancels the core verb, and the mode's promise dies with it.
 *
 * So a kitten can break contact and the cat cannot force it. That does not remove §7.3's pressure,
 * it *relocates* it into the thing the cat is actually built to do: take ground and stand over it
 * (§9.3's siege premise, and 1.4's ambush pin). The cat denies you the ground it is on rather than
 * deleting the animal working it — which is also what 0.7 measured for a *player* who flees, and
 * flee-and-hold has been the counter this fight is built on ever since.
 *
 * "Broken looks like": ≤238 and a squad in contact never completes a hold, so watching is a lie.
 * Much above 300 and the kittens teleport, the board falls in seconds, and the escalation has
 * nothing to escalate against.
 */
export const KITTEN_SPEED = 250;

/**
 * `[PH 26]` px — how close counts as arrived.
 *
 * The same 26px `hunt()` in `site-cat.ts` has always used for "beside you", reused rather than
 * re-picked. A kitten that has to land exactly on a centre point jitters on arrival, and one
 * with a loose tolerance starts holding from off the edge of the thing it is holding.
 */
export const ARRIVE_PX = 26;

/**
 * `[PH 220]` ms of flinch after a landed pounce — **a reaction, not a stun.**
 *
 * This number has been wrong twice, and the second time is the interesting one. It was 900ms
 * (matched to `SWAT_STUN_MS` for symmetry), which meant a kitten in contact never worked again. It
 * was then 450ms, derived from leaving the kitten room to run — and a browser run showed the round
 * sitting on its **last claim for forty seconds**, because with one claim left there is nowhere to
 * run to and the cat simply camped it.
 *
 * The arithmetic that settles it was already in the document. 0.7 measured that no stance's pounce
 * can take the page from a *stationary player*: "by the time it is ready your hold has already
 * completed, so after the first hit the player wins every subsequent exchange." That works because
 * a player's hold restarts the instant they are hit — 1400ms against the cat's tightest cycle of
 * about 1422ms. **Any** blocking stun puts a kitten the wrong side of that, and every version of
 * this constant was a way of discovering it.
 *
 * So a hit costs a kitten exactly what it costs a player: the hold, and nothing else. What remains
 * here is 220ms of squash — long enough to see, short enough to be over before the hold it is
 * reacting to has got anywhere — and it does not stop the kitten working. The cost of being caught
 * is the progress, which can be most of `SCRUB_MS`; the cat's *real* weapon is the regrow clock,
 * which is the one §9.3 gives it and the one this file's floor can actually price.
 *
 * "Broken looks like": anything that blocks work, at any length — the kitten loses the exchange
 * race and a camped claim never comes back. 0 and a landed pounce reads as nothing at all.
 */
export const KITTEN_FLINCH_MS = 220;

/**
 * `[PH 1000]` ms for a kitten to bring a claim back — **not** `SCRUB_MS`, and the difference is
 * forced by the cat's own numbers rather than chosen for feel.
 *
 * A player's hold is 1400ms and that is not up for negotiation: it is §5.2's core verb and every
 * number in §5/§10 is calibrated against it. But a *player's* answer to being interrupted is to
 * flee, which is what 0.7's "after the first hit the player wins every subsequent exchange" quietly
 * depends on — the cat has to walk back. A kitten holding the last claim on the board has nowhere
 * to flee to, so it has to win the exchange standing still.
 *
 * It cannot, at 1400ms. Read off `STANCES`: the cat's cycle with no walk to make is
 * `recover × 700 + telegraph × 420 × telegraphScale + LEAP`, which for siege at even mood is
 * **1380ms** and at the desperate tier about **1260ms** — both *shorter* than the hold they are
 * interrupting. Measured, that is a round parked on its final claim for forty seconds while the cat
 * camped it, and no amount of flinch-tuning fixes a race the kitten loses by construction.
 *
 * So a kitten works faster than a person does. 1000ms clears the tightest cycle the cat can reach —
 * including at deep rounds, where `roundAggro` shortens the telegraph further (about 1180ms at the
 * aggression cap) — with roughly 180ms in hand. It is also the right *character* note: kittens are
 * quick, and the mode's whole claim is that they are good at this.
 *
 * "Broken looks like": ≥1260 and a camped claim never comes back, which is the endgame of every
 * round. Much below 800 and a board falls faster than the escalation can respond to.
 */
export const KITTEN_WORK_MS = 1000;

/**
 * `[PH 4]` kittens on screen at once, ever.
 *
 * A cap rather than a target. Each kitten clears roughly one claim per `SCRUB_MS` plus its walk,
 * so on a `MAX_BOARD` of 14 a squad of four finishes a round in well under half a minute — past
 * that the escalation cannot keep up and rounds stop being able to build. There is a second,
 * plainer reason: four small cats moving on a page of text is already the most motion this site
 * has ever asked for (§11), and every extra one is drawn over somebody's writing.
 */
export const KITTEN_CAP = 4;

/**
 * How many kittens a given round is fought with.
 *
 * One, plus one for every round already cleared — the user's chosen shape, and it makes
 * reinforcement race the escalation instead of standing apart from it. Round 1 is deliberately a
 * single kitten: it is the clearest possible read on what a kitten *is*, and a visitor watching
 * one animal work is watching a story rather than a swarm.
 */
export function kittensFor(round: number): number {
  return Math.max(1, Math.min(KITTEN_CAP, Math.floor(round)));
}

/* ------------------------------------------------------------------ *
 * What a kitten works on next
 * ------------------------------------------------------------------ */

/** A claim as the policy sees it: an index into the board, and where it is on screen. */
export interface Candidate {
  index: number;
  x: number;
  y: number;
}

/** A kitten as the policy sees it. `target` is the board index it is already working, if any. */
export interface Worker {
  x: number;
  y: number;
  target: number | null;
}

/**
 * How long this kitten needs to turn that claim back: the walk, plus the hold.
 *
 * The kitten's whole cost, in one number, and the reason the policy below can be stated as a
 * comparison rather than a ranking.
 */
export function workTimeMs(
  kitten: { x: number; y: number },
  c: Candidate,
  speed = KITTEN_SPEED,
  workMs = KITTEN_WORK_MS,
): number {
  return (Math.hypot(c.x - kitten.x, c.y - kitten.y) / speed) * 1000 + workMs;
}

/**
 * How long the cat needs before it could interrupt a hold there.
 *
 * The walk to within `POUNCE_RANGE`, at the fastest a leaping stance travels (§7.3's desperate
 * tier, because a squad that is winning will be facing one). Anything already inside the pounce
 * range answers 0, which is correct and is what makes a claim under the cat's nose unattractive
 * without needing a special case.
 */
export function threatTimeMs(
  boss: { x: number; y: number },
  c: Candidate,
  pounceRange = POUNCE_RANGE,
  speed = STALK_SPEED * AGGRO_DESPERATE,
): number {
  const gap = Math.max(0, Math.hypot(c.x - boss.x, c.y - boss.y) - pounceRange);
  return (gap / speed) * 1000;
}

/**
 * Could this kitten actually finish that claim from where it stands?
 *
 * The predicate the policy is built on, exported because the *caller* needs it too: a kitten
 * already walking somewhere unfinishable should abandon the trip the moment something finishable
 * appears, and only the caller knows what a kitten is currently walking to.
 */
export function canFinish(
  kitten: { x: number; y: number },
  c: Candidate,
  boss: { x: number; y: number },
  scale: { pounceRange?: number; stalkSpeed?: number; kittenSpeed?: number } = {},
): boolean {
  return (
    threatTimeMs(boss, c, scale.pounceRange, scale.stalkSpeed) >
    workTimeMs(kitten, c, scale.kittenSpeed)
  );
}

/**
 * Should this kitten give up on the claim it is holding and get out of the way?
 *
 * **Why this exists.** `pickWork` decides where to *go*; nothing decided when to *leave*. A kitten
 * that started a winnable hold and then had the cat walk onto it kept holding until it was pounced,
 * because `KITTEN_FLINCH_MS` is explicitly cosmetic and does not interrupt work. On the page that
 * was survivable; in a game where the **player's only verb is shoving the cat around**, it is the
 * whole point — you push the cat toward a working kitten and the squad has to visibly react, or
 * your interference never reaches them.
 *
 * Two conditions, both required:
 *  - the cat is **inside the safe radius**, so it is a live threat rather than a distant one, and
 *  - `canFinish` has gone **false**, so the hold is now genuinely doomed.
 *
 * Requiring both is the guard against a squad that never commits: a kitten does not run from a cat
 * it can still out-work, which is exactly the trade `pickWork` already prices. Fleeing on proximity
 * alone would make the kittens cowards and the board unwinnable.
 */
export function shouldFlee(
  kitten: { x: number; y: number },
  c: Candidate,
  boss: { x: number; y: number },
  scale: {
    pounceRange?: number;
    stalkSpeed?: number;
    kittenSpeed?: number;
    safePx?: number;
  } = {},
): boolean {
  const safePx = scale.safePx ?? SAFE_WORK_PX;
  const near = Math.hypot(boss.x - kitten.x, boss.y - kitten.y) <= safePx;
  return near && !canFinish(kitten, c, boss, scale);
}

/**
 * Which claim this kitten should go and work on.
 *
 * **Two times, compared: can I finish before it can arrive?** Prefer every candidate where the
 * kitten's walk-plus-hold is shorter than the cat's walk to within pouncing distance, and among
 * those take the one that finishes *soonest*.
 *
 * When nothing qualifies — the cat is in contact, or the board is full — take the best **ratio** of
 * the two times: the claim it comes closest to being able to finish. Taking the *soonest* instead
 * was the first answer and it is subtly wrong, because "soonest" prices an interruptible hold as
 * though it would complete — so a claim under the cat's nose, 1.5 seconds away and interrupted
 * every single time, beat a claim across the room that would actually have come back. Traced frame
 * by frame, the kitten stood beside the cat restarting the same hold for as long as anybody
 * watched. A ratio cannot make that mistake: a claim the cat is already on scores zero however
 * short the walk, so the fallback walks *away*, which is the only move that ends the stalemate.
 *
 * **This corrects a policy that was wrong for a reason worth writing down.** The first version
 * ranked safety first and distance second, straight out of 1.0's finding that a winning player
 * holds beyond `SAFE_WORK_PX` (423px) from the cat. Measured in a browser, it plateaued: the
 * kitten oscillated between three and five claims for a solid minute, walking to `y: 1303` on a
 * 900px viewport. On a page taller than the screen, "as far from the cat as possible" *means* "the
 * far end of the document" — so the policy was spending six seconds of walking to protect 1.4
 * seconds of holding, and the board grew back faster than it could travel.
 *
 * The flaw is that 1.0's strategy belongs to a **hand**. A cursor teleports: distance from the cat
 * costs a human nothing, so maximising it is free. A kitten pays for that distance with its legs,
 * and the whole race is against a clock. Same goal, different animal, opposite tactic.
 *
 * `SAFE_WORK_PX` is not discarded by this — it is the special case of it. Set the walk to zero and
 * "can I finish before it arrives" reduces to `threatTime > SCRUB_MS`, which is a gap of
 * `STALK_SPEED × AGGRO_DESPERATE × 1.4s` = 333px, plus `POUNCE_RANGE` = **423px exactly**. The
 * arithmetic 1.0 measured is what this generalises, and a stationary worker still gets 1.0's answer.
 *
 * `taken` excludes what other kittens are already on, because two kittens on one claim is one
 * kitten's worth of progress and two kittens' worth of risk.
 *
 * Returns -1 when there is nothing to take.
 */
export function pickWork(
  kitten: Worker,
  candidates: readonly Candidate[],
  boss: { x: number; y: number },
  taken: readonly number[] = [],
  scale: { pounceRange?: number; stalkSpeed?: number; kittenSpeed?: number } = {},
): number {
  const busy = new Set(taken.filter((t) => t !== kitten.target));
  let safe = -1;
  let safeSoonest = Infinity;
  let best = -1;
  let bestRatio = -1;
  for (const c of candidates) {
    if (busy.has(c.index)) continue;
    const mine = workTimeMs(kitten, c, scale.kittenSpeed);
    const theirs = threatTimeMs(boss, c, scale.pounceRange, scale.stalkSpeed);
    if (theirs > mine) {
      if (mine < safeSoonest) {
        safeSoonest = mine;
        safe = c.index;
      }
      continue;
    }
    // Not workable from here. How close does it come? `mine` is always ≥ `SCRUB_MS`, so this is
    // never a divide by zero, and a claim inside the cat's reach scores exactly 0.
    const ratio = theirs / mine;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = c.index;
    }
  }
  return safe >= 0 ? safe : best;
}

/*
 * `assignOrder` lived here — §15's rule for which kitten answers a click: an idle one first, because
 * pulling a kitten off a half-finished hold spends progress the visitor cannot see, then the nearest.
 *
 * Retired in 2.6 with the order itself, when the swipe became how a visitor intervenes. The reasoning
 * is kept because it is the argument *against* re-adding it: ordering only felt free because this
 * function worked to hide its cost, and `pickWork` — which compares two clocks per claim and walks
 * away from work it cannot finish — was always the more interesting half. What the squad does now is
 * entirely its own.
 */

/* ------------------------------------------------------------------ *
 * Escalation (§15) — the endless round's shape
 * ------------------------------------------------------------------ */

/**
 * `[PH 0.82]` — how much of its regrow clock the board keeps per round already cleared.
 *
 * The T-Rex property: an endless mode with a flat difficulty is a screensaver, and the thing
 * that has to tighten is the clock rather than the pounce. 1.4 established which of the two
 * matters — the pounce is answered by distance and the clock is not, which is why the last stand
 * scales the clock — so the escalation escalates the same lever for the same reason.
 *
 * 0.82 rather than a rounder number because of what it buys per round: at siege's 9000ms base a
 * cleared round takes ~1.6s off the clock, which is about the time one kitten needs to walk to
 * its next claim. So each round costs the squad roughly one walk per regrow, and the
 * reinforcement it just earned pays for roughly that — the two curves are deliberately close,
 * and which one wins is what makes a run interesting.
 *
 * "Broken looks like": ≤0.6 and round 4 is unclearable however many kittens turned up; ≥0.95 and
 * round 12 feels like round 1, which is the failure the whole escalation exists to prevent.
 */
export const ROUND_REGROW_STEP = 0.82;

/**
 * `[PH 1400]` ms — the fastest the board may ever regrow, whatever the round.
 *
 * **This is commander mode's floor, and it is §9.4's floor restated for a squad.** A claim takes
 * `SCRUB_MS` to free; if the board can take one back faster than that, no amount of kittens is
 * a strategy, because each kitten's own hold is outpaced while it happens. `SCRUB_MS` exactly,
 * not a fraction of it: the bound is not "the squad should be comfortable", it is "a hold must be
 * worth starting".
 *
 * Deliberately independent of squad size. A floor that relaxed as kittens arrived would be
 * tighter arithmetic and a worse guarantee — the promise of commander mode is that *watching is
 * enough*, and a promise that depends on how well the previous round went is not one.
 *
 * **Charged per claim, and the first version of this was not.** Applying it to the interval
 * instead lets §9.3's sweep through the gap: two claims taken on one floored 1400ms interval is
 * one claim per 700ms, which is exactly half the thing this constant promises. The unit test that
 * compares the squad's rate against the board's is what caught it — at deep rounds a cornered
 * sweeping siege out-reclaimed a capped squad of four, which is the promise of watching failing
 * quietly at the far end of a run where nobody would have looked.
 */
export const MIN_REGROW_MS = SCRUB_MS;

/**
 * `[PH 1.35]` — the most a round may add to the cat's aggression.
 *
 * The second half of "faster board and a meaner cat". §7.3 already owns what aggression *does*
 * (wind-up, walking speed, willingness, talk cadence) and clamps the parts that must not scale,
 * so this needs no new machinery and cannot break §10's whiff invariant: `telegraphScale` only
 * ever shortens the telegraph and floors it above human reaction time.
 *
 * Capped low on purpose. Aggression multiplies things a *watcher* cannot influence, so it is the
 * least fair of the two levers — the clock at least gives the squad somewhere to be. It exists
 * to make a late round feel different, not to decide it.
 */
export const ROUND_AGGRO_CAP = 1.35;

/** `[PH 0.06]` — aggression added per cleared round, before the cap. */
export const ROUND_AGGRO_STEP = 0.06;

/**
 * The regrow interval for this round: the stance's clock, the mood, the sweep's bill, and the
 * round — composed in that order and then floored.
 *
 * Wraps `regrowInterval` rather than replacing it so manual mode's path is byte-identical and
 * 1.4's measurements still describe it. The clamp lives here, *after* every multiplier, because
 * clamping a base and then multiplying it by 0.55 for the last stand would breach the floor by
 * exactly the amount that matters most — the endgame.
 */
export function roundRegrowMs(baseMs: number, m: Mood, claims: number, round: number): number {
  if (baseMs <= 0) return baseMs; // sleepy still has no clock, at any round
  const scaled = baseMs * Math.pow(ROUND_REGROW_STEP, Math.max(0, Math.floor(round) - 1));
  // The floor is per *claim*, so a sweep of two cannot arrive twice as fast as the floor allows —
  // see `MIN_REGROW_MS`. `regrowInterval` already bills an interval per claim, so this clamps the
  // composed figure in the same currency it is charged in.
  return Math.max(MIN_REGROW_MS * Math.max(1, claims), regrowInterval(scaled, m, claims));
}

/** How much meaner the cat is by this round. 1 in round 1, rising to `ROUND_AGGRO_CAP`. */
export function roundAggro(round: number): number {
  const grown = 1 + ROUND_AGGRO_STEP * Math.max(0, Math.floor(round) - 1);
  return Math.min(ROUND_AGGRO_CAP, grown);
}

/* ------------------------------------------------------------------ *
 * A board a squad can walk (§15 vs §4.1)
 * ------------------------------------------------------------------ */

/**
 * ~~`[PH 4]` — the smallest board commander mode will deal.~~ **Retracted before it shipped, and
 * kept here because the mistake is the useful part.**
 *
 * §4.1's `boardSlice` borrows claims from below the fold when the screen cannot hold `MIN_BOARD`
 * (10). Measured against the *first* version of the kitten — 190px/s, and a policy that ranked
 * safety above distance — that dealt claims at `y: 1300` on a 900px viewport, five-second marches,
 * and a round that restarted twice a minute. Shrinking the board to four fixed it.
 *
 * It fixed the symptom. The cause was the kitten: it was slower than the cat and its policy sent it
 * to the far end of the document on purpose. Both are corrected now (`KITTEN_SPEED`, `pickWork`), and
 * with them a full-sized board is walkable again — while a four-claim board turned out to have its
 * own failure, and a worse one. Tiny boards are *trivially fillable*: `roundOutcome` calls a full
 * board a restart, and four claims is two siege sweeps. They are also over instantly — a squad of
 * four cleared three claims in three seconds, so a browser run reached **round 14 in 72 seconds** and
 * the escalation ran out of road before anybody could read a line of dialogue.
 *
 * So commander mode deals §4.1's board, exactly as manual mode does. The lesson is the one §12 keeps
 * relearning in different clothes: a symptom fixed at the wrong layer buys a worse bug.
 */

/* ------------------------------------------------------------------ *
 * No losing (§15) — what the end of a round means
 * ------------------------------------------------------------------ */

/** What this board says about the round: cleared it, lost the board, or still going. */
export type RoundOutcome = 'clear' | 'restart' | 'fighting';

/**
 * How a round ends, and **what is missing from the arguments is the feature.**
 *
 * `isLost` in `arena.ts` takes `ammo` as well, because §2 makes a loss "every claim taken *and*
 * nothing left to throw" — a real failure with a real cost (§9.4 drops a rung). This does not
 * take ammo, and cannot: a full board in commander mode is not a loss, it is a round that gets
 * *started again*, on the same page, at the same difficulty, with the same kittens. Nothing is
 * taken away and there is no screen to dismiss.
 *
 * That is the T-Rex bargain the user asked for, and it is the reason this is a separate function
 * rather than a flag passed to `isLost`: the two modes disagree about what losing *is*, and a
 * boolean threaded through the old rule would have left both of them half-true.
 */
export function roundOutcome(claimed: number, board: number): RoundOutcome {
  if (board <= 0) return 'fighting';
  if (claimed <= 0) return 'clear';
  return claimed >= board ? 'restart' : 'fighting';
}

/* ------------------------------------------------------------------ *
 * Watching is playing (§11, amended in 2.0)
 * ------------------------------------------------------------------ */

/**
 * `[PH 180000]` ms — how long a fight runs with **no sign of the visitor at all**.
 *
 * §11's auto-truce ends a fight `IDLE_TRUCE_MS` (20s) after the last input, and it is right to:
 * an abandoned fight leaves somebody's page tinted. But commander mode's whole promise is that
 * *watching is enough*, and a visitor watching a round they did not order is, by that clock,
 * doing nothing — so the 20s truce would end the mode's central experience twice a minute.
 *
 * So in commander mode the clock is longer and it measures a different thing: not "has this
 * visitor played" but "is anybody there". Any pointer movement, scroll or keypress counts as
 * presence, because all three mean somebody is reading. Three minutes of literally none of them
 * means the tab was left open, and the hidden-tab truce (`HIDDEN_TRUCE_MS`, 10s) already covers
 * the commoner case of walking away to another tab.
 *
 * "Broken looks like": as short as `IDLE_TRUCE_MS` and the page snatches itself back mid-round
 * from somebody who was watching it; unbounded and a laptop left on this page runs an animation
 * loop until the battery is flat, which is a rude thing for a CV to do.
 */
export const WATCH_TRUCE_MS = 180_000;

/* ------------------------------------------------------------------ *
 * The one thing that is remembered (§7.2/§13.4, amended in 2.0)
 * ------------------------------------------------------------------ */

/**
 * `localStorage` key holding the deepest round ever reached.
 *
 * **This reverses a decision the GDD made twice**, so it is worth being exact about what is and
 * is not being reversed. §7.2 says a fight costs you nothing outside itself and §13.4 says
 * nothing is stored — both were about *the fight's state*: territory, the rung, the found-set,
 * whether the cat is wearing a collar. All of that is still session-only and still dies on a
 * refresh, which is what makes losing free.
 *
 * What is stored is one integer that is not fight state at all. It is a record of a visit, it
 * cannot be spent, it changes nothing about how any future round plays, and it can only go up.
 * An endless mode needs one number that survives the tab closing or "endless" is a word about a
 * single afternoon — and the visitor already trusts this site with a theme and five reading
 * preferences under the same rules.
 *
 * The boundary is the whole justification, so: **this key, and nothing else, ever.**
 */
export const BEST_ROUND_KEY = 'cat-best-round';

/**
 * The deepest round reached, or 0.
 *
 * Client-only, and total about it: a browser refusing storage (private mode, a hardened
 * profile, a policy) must degrade to "no record yet" rather than throwing inside a game loop.
 * `a11y-prefs.ts` sets the precedent — every read there is wrapped for the same reason.
 */
export function readBestRound(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(BEST_ROUND_KEY);
    const n = raw === null ? 0 : Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

/**
 * Remember a round if it beats the record, and answer whether it did.
 *
 * Monotonic by construction: a worse run cannot lower it, so there is no way for a bad
 * afternoon to take something away from the visitor. Returns true only on a new record, which is
 * what the HUD needs in order to say so once rather than every frame.
 */
export function writeBestRound(round: number): boolean {
  const best = readBestRound();
  const n = Math.floor(round);
  if (!(n > best)) return false;
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(BEST_ROUND_KEY, String(n));
    return true;
  } catch {
    // Storage refused. The round still happened and the HUD still shows it — the visitor simply
    // has no record afterwards, which is a smaller loss than a fight that crashes mid-pounce.
    return false;
  }
}
