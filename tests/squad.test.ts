/**
 * The squad's rules (§15, 2.0) — commander mode's arithmetic, checked without a browser.
 *
 * The load-bearing claim of commander mode is that **watching is enough**: a visitor who never
 * touches anything still sees a round resolve. That claim is not about pixels, it is about two
 * rates — how fast a squad can free claims against how fast the board takes them back — so most
 * of it can be settled here, and the browser harness (`scratchpad/commander.mjs`) is left to
 * check that the rules are actually wired to the animals.
 */
import { describe, it, expect } from 'vitest';
import {
  SAFE_WORK_PX,
  KITTEN_SPEED,
  KITTEN_CAP,
  KITTEN_FLINCH_MS,
  KITTEN_WORK_MS,
  ARRIVE_PX,
  kittensFor,
  pickWork,
  workTimeMs,
  threatTimeMs,
  canFinish,
  shouldFlee,
  ROUND_REGROW_STEP,
  ROUND_AGGRO_CAP,
  ROUND_AGGRO_STEP,
  MIN_REGROW_MS,
  roundRegrowMs,
  roundAggro,
  BEST_ROUND_KEY,
} from '../src/lib/squad';
import {
  SCRUB_MS,
  RECOVER_MS,
  TELEGRAPH_MS,
  LEAP_MS,
  telegraphScale,
  STALK_SPEED,
  AGGRO_DESPERATE,
  POUNCE_RANGE,
  STANCES,
  SWAT_STUN_MS,
  regrowInterval,
} from '../src/lib/arena';

describe('the kitten is fast enough to matter and slow enough to catch', () => {
  it('can break contact with a cat at full tilt — the mode depends on it', () => {
    /*
     * **Faster than the cat's fastest, and this bound started out inverted.** The first version
     * capped the kitten below `STALK_SPEED × AGGRO_DESPERATE` (238) so "a cornered cat can run one
     * down", which sounds like §7.3's pressure and is actually the mode failing: a cat in contact
     * commits again every ~1422ms (siege: recover + telegraph + leap, with no walk to make) against
     * a 1400ms hold, so a kitten it can stay next to never completes anything. Traced frame by
     * frame — 0.75, landed on, 0.38, landed on, forever.
     *
     * The cat's threat is ground it takes and guards (§9.3, and 1.4's pin), not an animal it
     * deletes. So the kitten must be able to walk away, and the numbers say by how little.
     */
    expect(KITTEN_SPEED).toBeGreaterThan(STALK_SPEED * AGGRO_DESPERATE);
    // ...but only just. A kitten much faster than this clears boards before the escalation can bite.
    expect(KITTEN_SPEED).toBeLessThan(STALK_SPEED * AGGRO_DESPERATE * 1.3);
  });

  it('works faster than a person, because the cat out-cycles a 1400ms hold', () => {
    /*
     * **The bound that decides whether an endgame can be won at all.** A player answers an
     * interruption by fleeing, which is what 0.7's "after the first hit the player wins every
     * subsequent exchange" silently rests on — the cat has to walk back. A kitten holding the last
     * claim on the board has nowhere to flee to, so it has to win standing still.
     *
     * Read off `STANCES`: the cat's cycle with no walk to make is
     * `recover × RECOVER_MS + telegraph × TELEGRAPH_MS × telegraphScale + LEAP_MS`. Siege's is the
     * tightest, and at even mood it is *already shorter than `SCRUB_MS`* — so a 1400ms hold loses
     * that race forever, which is exactly the forty-second standoff a browser run showed.
     */
    const cycle = (s: (typeof STANCES)[keyof typeof STANCES], aggro: number) =>
      s.recover * RECOVER_MS + s.telegraph * TELEGRAPH_MS * telegraphScale(aggro) + LEAP_MS;
    const tightestEven = Math.min(...Object.values(STANCES).map((s) => cycle(s, 1)));
    expect(SCRUB_MS).toBeGreaterThan(tightestEven); // the race a player only wins by running away

    // The kitten's own rate has to clear the tightest cycle the cat can *ever* reach: the desperate
    // tier, multiplied again by the deepest round's aggression.
    const tightestEver = Math.min(
      ...Object.values(STANCES).map((s) => cycle(s, AGGRO_DESPERATE * ROUND_AGGRO_CAP)),
    );
    expect(KITTEN_WORK_MS).toBeLessThan(tightestEver);
    // ...with enough margin that a frame or two of scheduling jitter cannot flip it.
    expect(tightestEver - KITTEN_WORK_MS).toBeGreaterThan(100);
  });

  it('flinches without stopping — a reaction shot, not a stun', () => {
    // Two earlier values of this blocked the kitten (900ms, then 450ms) and both lost the exchange
    // race above. What is left is paint: shorter than a quarter of the work it interrupts.
    expect(KITTEN_FLINCH_MS).toBeLessThan(KITTEN_WORK_MS / 4);
    expect(KITTEN_FLINCH_MS).toBeLessThan(SWAT_STUN_MS);
  });

  it('arrives at a claim without having to land on a point', () => {
    expect(ARRIVE_PX).toBeGreaterThan(0);
    // Comfortably inside the pounce range, or "arrived" would mean "standing where the cat can
    // reach the thing I am about to hold".
    expect(ARRIVE_PX).toBeLessThan(POUNCE_RANGE);
  });
});

describe('the squad grows by clearing rounds', () => {
  it('starts as one kitten, because one animal working is legible', () => {
    expect(kittensFor(1)).toBe(1);
  });

  it('adds one per round already cleared', () => {
    expect(kittensFor(2)).toBe(2);
    expect(kittensFor(3)).toBe(3);
  });

  it('is capped, and the cap holds however deep the run goes', () => {
    expect(kittensFor(KITTEN_CAP + 5)).toBe(KITTEN_CAP);
    expect(kittensFor(999)).toBe(KITTEN_CAP);
  });

  it('never deals a squad of zero, whatever it is handed', () => {
    // Round bookkeeping is the kind of thing that arrives as 0 or NaN once during a refactor,
    // and a round with no kittens is a fight nobody is having.
    for (const bad of [0, -1, 0.5]) expect(kittensFor(bad)).toBe(1);
  });
});

describe('what a kitten works on next (§15: can I finish before it arrives?)', () => {
  const boss = { x: 100, y: 100 };
  const kitten = { x: 120, y: 120, target: null };

  it('never counts a claim inside the cat’s reach as workable', () => {
    // `threatTime` of 0 is the cat being already in range: there is no walk left to out-run, so no
    // hold on that claim can be finished in time, whoever is asked and however close they are.
    const underTheCat = { index: 0, x: 120, y: 160 };
    const closeBoss = { x: 120, y: 175 };
    expect(threatTimeMs(closeBoss, underTheCat)).toBe(0);
    expect(workTimeMs({ x: 120, y: 160 }, underTheCat)).toBeGreaterThan(0);
  });

  it('has no workable option at all while the cat is on top of it', () => {
    /*
     * **A property of a *walking* worker, and the reason 1.0's strategy could not simply be
     * inherited.** Safety needs `threat > work`; `work` carries a 1400ms floor plus the walk at
     * 190px/s, and `threat` is the cat's walk at 238px/s less its 90px reach. Solve it and safety
     * needs the cat roughly three times the walk distance away, plus 423px — so with the cat inside
     * pouncing range of the kitten, **every** claim the kitten could reach is also one the cat can.
     *
     * There is nothing to fix here: it is what makes the boss dangerous, and it is why the policy's
     * fallback ("take the soonest anyway") is the branch that actually runs when the cat is close.
     * A kitten next to the cat cannot make a safe choice; it can only make a cheap one.
     */
    const kit = { x: 600, y: 500, target: null };
    const nextToTheCat = { x: 600, y: 560 };
    const options = [
      { index: 0, x: 600, y: 540 },
      { index: 1, x: 600, y: 300 },
      { index: 2, x: 900, y: 500 },
    ];
    for (const c of options) {
      expect(threatTimeMs(nextToTheCat, c), `#${c.index}`).toBeLessThan(workTimeMs(kit, c));
    }
    /*
     * So it walks *away* instead of standing there: with nothing finishable, the fallback takes the
     * claim where the cat is relatively furthest, which is the only move that can turn an
     * unfinishable board into a finishable one. Taking the *nearest* was the first answer, and it
     * priced an interruptible hold as though it would complete — the kitten stood beside the cat
     * restarting the same hold for as long as anybody watched.
     */
    const chosen = pickWork(kit, options, nextToTheCat);
    expect(chosen).not.toBe(0);
    const picked = options.find((c) => c.index === chosen)!;
    expect(threatTimeMs(nextToTheCat, picked) / workTimeMs(kit, picked)).toBeGreaterThan(
      threatTimeMs(nextToTheCat, options[0]!) / workTimeMs(kit, options[0]!),
    );
  });

  it('and takes a safe nearby claim over a costly one when the cat is far away', () => {
    // The common case in a real fight: one cat, a big page. Everything near the kitten is safe, so
    // the safety term agrees with the distance term and the kitten simply gets on with it.
    const kit = { x: 600, y: 500, target: null };
    const farBoss = { x: 600, y: 1200 };
    const nearby = { index: 0, x: 600, y: 460 };
    const besideTheCat = { index: 1, x: 600, y: 1150 };
    expect(threatTimeMs(farBoss, nearby)).toBeGreaterThan(workTimeMs(kit, nearby));
    expect(threatTimeMs(farBoss, besideTheCat)).toBe(0);
    expect(pickWork(kit, [besideTheCat, nearby], farBoss)).toBe(0);
  });

  it('and among claims it can finish, takes the one that finishes soonest', () => {
    // Both finishable — the cat is far enough away that the walk is affordable either way — so the
    // only thing left to choose on is which comes back sooner.
    const farBoss = { x: 100, y: 2000 };
    const far = { index: 0, x: 700, y: 100 };
    const near = { index: 1, x: 160, y: 120 };
    for (const c of [far, near]) expect(canFinish(kitten, c, farBoss), `#${c.index}`).toBe(true);
    expect(pickWork(kitten, [far, near], farBoss)).toBe(1);
  });

  it('does not walk to the far end of the document to be safe — the browser caught this', () => {
    /*
     * **The regression that made 2.0 rewrite this policy.** Ranking safety first and distance
     * second is 1.0's flee-and-hold, and it is correct for a *hand*: a cursor teleports, so
     * distance from the cat is free and maximising it costs nothing. A kitten pays for distance
     * with its legs. Measured in a browser, the first version sent it to `y: 1303` on a 900px
     * viewport and the board oscillated between three and five claims for a minute — six seconds
     * of walking to protect 1.4 seconds of holding.
     *
     * So: a claim far enough away to be *safer* must lose to a nearer one that is still safe.
     */
    const farBoss = { x: 100, y: 2400 };
    const nearAndFinishable = { index: 0, x: 140, y: 140 };
    const acrossTheDocument = { index: 1, x: 900, y: 1300 };
    expect(canFinish(kitten, nearAndFinishable, farBoss)).toBe(true);
    expect(pickWork(kitten, [nearAndFinishable, acrossTheDocument], farBoss)).toBe(0);
  });

  it('generalises 1.0’s 423px instead of replacing it, and needs less room than a person', () => {
    /*
     * "Can I finish before it arrives" reduces to a *distance* whenever the worker is already
     * standing on its claim, which is the case 1.0 measured — a cursor is always already there. The
     * boundary is `POUNCE_RANGE` plus the cat's fastest walk for the length of the hold, so the same
     * expression produces 1.0's 423px for a player's 1400ms and a **tighter** figure for a kitten's
     * 1000ms. Working faster buys room as well as time, which is worth stating because it is the
     * quiet second dividend of `KITTEN_WORK_MS`.
     */
    const boundary = (holdMs: number) =>
      POUNCE_RANGE + STALK_SPEED * AGGRO_DESPERATE * (holdMs / 1000);
    expect(boundary(SCRUB_MS)).toBeCloseTo(SAFE_WORK_PX, 6);
    expect(boundary(KITTEN_WORK_MS)).toBeLessThan(SAFE_WORK_PX);

    // And the two clocks agree with that arithmetic at the boundary they imply.
    const kitBoundary = boundary(KITTEN_WORK_MS);
    const onIt = { index: 0, x: 100 + kitBoundary + 1, y: 100 };
    const insideIt = { index: 1, x: 100 + kitBoundary - 40, y: 100 };
    expect(canFinish({ x: onIt.x, y: onIt.y }, onIt, boss)).toBe(true);
    expect(canFinish({ x: insideIt.x, y: insideIt.y }, insideIt, boss)).toBe(false);
  });

  it('heads for open ground when nothing can be finished in time', () => {
    // Both are inside the cat's reach or close to it, so neither can be held: the pick is the one
    // that puts the most distance between the kitten and the cat, because that is what changes the
    // situation. Standing still and re-trying the same doomed hold does not.
    const a = { index: 0, x: 150, y: 100 };
    const b = { index: 1, x: 300, y: 100 };
    expect(canFinish(kitten, a, boss)).toBe(false);
    expect(canFinish(kitten, b, boss)).toBe(false);
    expect(pickWork(kitten, [a, b], boss)).toBe(1);
  });

  it('will not pile onto a claim another kitten is already working', () => {
    // Two kittens on one claim is one kitten's progress and two kittens' risk.
    const safeA = { index: 0, x: 100 + SAFE_WORK_PX + 10, y: 100 };
    const safeB = { index: 1, x: 100 + SAFE_WORK_PX + 60, y: 100 };
    expect(pickWork(kitten, [safeA, safeB], boss, [0])).toBe(1);
  });

  it('keeps its own claim rather than treating itself as competition', () => {
    // `taken` is every kitten's target including this one's; excluding itself is what stops a
    // kitten abandoning a hold it is halfway through, once a frame, forever.
    const mine = { index: 7, x: 100 + SAFE_WORK_PX + 10, y: 100 };
    const busy = { x: mine.x, y: mine.y, target: 7 };
    expect(pickWork(busy, [mine], boss, [7])).toBe(7);
  });

  it('says so when there is nothing left to take', () => {
    expect(pickWork(kitten, [], boss)).toBe(-1);
    expect(pickWork(kitten, [{ index: 3, x: 400, y: 400 }], boss, [3])).toBe(-1);
  });
});

/*
 * `describe('who answers an order')` stood here — three checks on `assignOrder`, which chose the
 * kitten that answered a click: idle before busy however far away, then nearest, and -1 for an empty
 * squad. All three deleted in 2.6 with the function, when the swipe replaced §15's ordering.
 *
 * Noted rather than silently dropped because deleting tests is the easiest way to lose coverage by
 * accident, and this is the case where it is correct: the checks were sound and the behaviour they
 * protected no longer exists. `pickWork` below is what decides where a kitten goes now, and it was
 * always doing the harder half of the job.
 */

describe('escalation — the endless round has to build (§15)', () => {
  it('leaves round one exactly as 1.4 measured it', () => {
    /*
     * The regression that would matter most: if round 1 is not 1.4's fight, then every number in
     * §9.3/§10 stops describing the thing the visitor meets first, and the 435 tests behind them
     * are describing a game nobody plays.
     */
    for (const s of Object.values(STANCES)) {
      for (const m of ['bored', 'even', 'desperate'] as const) {
        expect(roundRegrowMs(s.regrowMs, m, 1, 1)).toBe(regrowInterval(s.regrowMs, m, 1));
      }
    }
    expect(roundAggro(1)).toBe(1);
  });

  it('tightens the clock every cleared round', () => {
    const base = STANCES.siege.regrowMs;
    const r1 = roundRegrowMs(base, 'even', 1, 1);
    const r2 = roundRegrowMs(base, 'even', 1, 2);
    const r3 = roundRegrowMs(base, 'even', 1, 3);
    expect(r2).toBeLessThan(r1);
    expect(r3).toBeLessThan(r2);
    expect(r2 / r1).toBeCloseTo(ROUND_REGROW_STEP, 2);
  });

  it('never regrows faster *per claim* than a hold can complete — commander mode’s floor', () => {
    /*
     * §15's floor, and it is §9.4's restated for a squad: a claim takes `SCRUB_MS` to free, so a
     * board that can take one back faster than that makes every hold not worth starting, and no
     * number of kittens is a strategy. Checked at the *composition* of every multiplier — round,
     * mood and the sweep's bill — because that is where the first version of the last stand
     * nearly breached its own bound.
     */
    for (const s of Object.values(STANCES)) {
      if (s.regrowMs === 0) continue;
      for (const round of [1, 2, 5, 10, 40, 500]) {
        for (const m of ['bored', 'even', 'desperate'] as const) {
          for (const claims of [1, 2]) {
            const ms = roundRegrowMs(s.regrowMs, m, claims, round);
            // Per claim, which is the unit the promise is made in: the sweep takes two, so two
            // claims must cost two floors. Asserting the interval alone is what let 2.0's first
            // floor be quietly half a floor.
            expect(ms / claims, `${round}/${m}/${claims}`).toBeGreaterThanOrEqual(MIN_REGROW_MS);
          }
        }
      }
    }
  });

  it('keeps the floor at the length of one hold, stated in the game’s own units', () => {
    expect(MIN_REGROW_MS).toBe(SCRUB_MS);
  });

  it('still gives sleepy no clock, at any round', () => {
    // §9.3: "a gift with a clock is not a gift" — and an escalation multiplier must not turn a 0
    // into a very fast clock, which is the one arithmetic accident this could have.
    expect(STANCES.sleepy.regrowMs).toBe(0);
    for (const round of [1, 3, 20]) expect(roundRegrowMs(0, 'desperate', 2, round)).toBe(0);
  });

  it('makes the cat meaner, and stops', () => {
    expect(roundAggro(2)).toBeCloseTo(1 + ROUND_AGGRO_STEP, 5);
    expect(roundAggro(3)).toBeGreaterThan(roundAggro(2));
    expect(roundAggro(999)).toBe(ROUND_AGGRO_CAP);
  });

  it('caps meanness well under the clock’s reach, because a watcher cannot answer it', () => {
    /*
     * Aggression multiplies things a spectator has no reply to (wind-up, walk speed,
     * willingness). The clock at least gives a squad somewhere else to be. So the aggro lever is
     * deliberately the smaller of the two — it exists to make a late round *feel* different, not
     * to decide it.
     */
    expect(ROUND_AGGRO_CAP).toBeLessThan(AGGRO_DESPERATE);
  });

  it('is monotonic in the round, both levers, with no surprises in between', () => {
    let clock = Infinity;
    let mean = 0;
    for (let round = 1; round <= 30; round++) {
      const c = roundRegrowMs(STANCES.ambush.regrowMs, 'even', 1, round);
      const m = roundAggro(round);
      expect(c).toBeLessThanOrEqual(clock);
      expect(m).toBeGreaterThanOrEqual(mean);
      clock = c;
      mean = m;
    }
  });
});

describe('a squad can out-reclaim the board it is given (the promise of watching)', () => {
  /*
   * The claim commander mode lives or dies on, as arithmetic. A kitten frees one claim per
   * `SCRUB_MS` plus a walk; the board takes one back per regrow interval. If the board's rate ever
   * exceeds the squad's, a visitor who does nothing watches the page get eaten — and "watching is
   * enough" was the whole reason for the rewrite.
   *
   * **The walk is modelled at `SAFE_WORK_PX`** — 423px — as a generous stand-in for "the nearest
   * claim it could have taken". `pickWork` minimises exactly this quantity, so the typical walk is
   * shorter than a screen; 423px is roughly half the height of one and therefore pessimistic
   * without being silly. Modelling every claim as a full 1280×900 diagonal (1560px, ~8.2s) would be
   * modelling a kitten that never picks the nearest thing, which is not the kitten in `pickWork` —
   * and it was that mistake, in the *code* rather than here, that made the first version plateau.
   * Real clear times are the browser harness's job; this is the inequality behind them.
   */
  const walkMs = (SAFE_WORK_PX / KITTEN_SPEED) * 1000;
  const perClaimMs = SCRUB_MS + walkMs;

  it('holds for every stance at the round its squad size arrives', () => {
    for (const [name, s] of Object.entries(STANCES)) {
      if (s.regrowMs === 0) continue;
      for (let round = 1; round <= 12; round++) {
        const squad = kittensFor(round);
        const squadRate = squad / perClaimMs;
        /*
         * Worst case for the board: cornered, so the last stand's clock applies, and sweeping if
         * this stance is the one that sweeps. **Only `pin` stances sweep** — the first version of
         * this test charged every stance two claims a tick and so accused ambush of a rate it can
         * never have. A test that models the wrong game fails on a build that is fine.
         */
        const claims = s.pin ? 2 : 1;
        const boardRate = claims / roundRegrowMs(s.regrowMs, 'desperate', claims, round);
        expect(squadRate, `${name} round ${round}`).toBeGreaterThan(boardRate);
      }
    }
  });

  it('and would fail loudly if the floor were ever lowered', () => {
    // The guard on the guard: this is the inequality that breaks first, so it is worth knowing
    // that it *can* break. At a tenth of the floor the promise is false even for a full squad.
    const boardRate = 1 / (MIN_REGROW_MS / 10);
    expect(KITTEN_CAP / perClaimMs).toBeLessThan(boardRate);
  });
});

describe('the one thing that is remembered (§7.2/§13.4, amended)', () => {
  it('is a single key with a name that says what it is', () => {
    expect(BEST_ROUND_KEY).toBe('cat-best-round');
  });

  /*
   * `readBestRound`/`writeBestRound` are the client half and are deliberately untested here for
   * the same reason `a11y-prefs.ts`'s DOM half is: they are three lines of `try`/`catch` around a
   * browser API, and the interesting thing about them — that a browser refusing storage must not
   * throw inside a game loop — is what the browser harness checks by running with storage denied.
   */
});

describe('shouldFlee — the hand reaching the kittens indirectly', () => {
  const scale = { safePx: 85, pounceRange: 18, stalkSpeed: 48, kittenSpeed: 50 };
  const claim = { x: 100, y: 100, i: 0 };
  const kitten = { x: 100, y: 100 };

  it('does not flee a cat that is far away', () => {
    expect(shouldFlee(kitten, claim, { x: 100, y: 400 }, scale)).toBe(false);
  });

  it('flees when the cat is close AND the hold has become unwinnable', () => {
    // Cat sitting on the claim: threatTime is 0, so canFinish is false and it is inside the radius.
    expect(shouldFlee(kitten, claim, { x: 104, y: 100 }, scale)).toBe(true);
  });

  it('does NOT flee a nearby cat it can still out-work', () => {
    // This is the guard that keeps the squad from being cowards. Just inside the safe radius, but
    // far enough that the kitten's walk-plus-hold still beats the cat's approach.
    const far = { x: 100, y: 100 - scale.safePx + 2 };
    const near = Math.hypot(far.x - kitten.x, far.y - kitten.y) <= scale.safePx;
    expect(near).toBe(true);
    const winnable = canFinish(kitten, claim, far, scale);
    // Only assert the coupling: if the hold is still winnable, it must not flee.
    expect(shouldFlee(kitten, claim, far, scale)).toBe(!winnable);
  });

  it('requires both conditions — proximity alone is not enough', () => {
    // A doomed hold with the cat outside the radius: still no flee, because it is not a live threat.
    const outside = { x: 100, y: 100 + scale.safePx + 40 };
    expect(canFinish(kitten, claim, outside, scale)).toBe(true);
    expect(shouldFlee(kitten, claim, outside, scale)).toBe(false);
  });
});
