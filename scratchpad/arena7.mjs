/**
 * Build step 7 — the rubber band (§7.3) — checked in a real browser, on the card game (2.2).
 *
 * §7.3's claim is that difficulty scales *as behaviour you can read*, so the checks have to
 * be about behaviour rather than about the scalar. The shape of every one of them is the
 * same: hold the **player's** conduct fixed, move the fight into a different tier, and show
 * that what the cat does changes. A test that drove the mood and then asserted the mood
 * would be asserting an assignment.
 *
 * The bait below is what makes that possible. Parking on a claimed tile and jiggling ±8px
 * on a fixed cadence keeps scrub progress oscillating just past `POUNCE_THRESHOLD` (0.35)
 * without ever completing a hold: the boss is offered exactly the same provocation every
 * ~520ms forever. So the commitment rate is a clean read of the boss's *willingness*, which
 * is the thing aggression moves.
 *
 * 2.2: the boss is the card's own `[data-boss]` (phase in `dataset.phase`, mood in
 * `dataset.mood`, grooming tell in `dataset.groom`), claims are `.cat-tile[data-state=
 * "claimed"]`, and the board is fully on screen — there is no scrolling, so the page's
 * scroll-reveal/prefetch confounds and the DOM snapshot (pillar 2) drop. The tier
 * measurements themselves are unchanged, because durations are unchanged by the card scale.
 */
const TELEGRAPH_MS = 420;
const SCRUB_MS = 1400;
const BAIT_MS = 520; // > POUNCE_THRESHOLD * SCRUB_MS (490), < the bored threshold's 910

import {
  BASE,
  armAmmo,
  deal,
  fresh as context,
  launch,
  press as sharedPress,
  release as sharedRelease,
  report,
  throwSpot,
  wants,
} from './lib/fixture.mjs';

const browser = await launch();
const { ok, note, fixture, done } = report();

/** Shared with the fleet; this file has always allowed 8000ms for the open. */
const press = (page) => sharedPress(page, { timeout: 8000 });
const release = (page) => sharedRelease(page, { timeout: 8000 });

/** The card closes back to collapsed (2.2's pillar 2). */
async function settled(page, ms = 8000) {
  await page
    .waitForFunction(
      () => document.querySelector('#cat-card-panel')?.hidden !== false,
      undefined,
      { timeout: ms },
    )
    .catch(() => {});
  await page.waitForTimeout(120);
}

/** A desktop context playing **manual mode**: §7.3's tiers are measured against a pointer that plays. */
const fresh = (opts = {}) => context(browser, { mode: 'manual', ...opts });

/**
 * Watch the boss: every phase change, every mood change, every grooming beat, timestamped.
 * One observer for all three because they have to be compared on the same clock.
 */
const RECORDER = () => {
  const root = document.querySelector('[data-boss]');
  const phase = () => root?.dataset.phase ?? 'off';
  window.__log = [];
  let seenPhase = phase();
  let seenMood = root?.dataset.mood ?? '';
  let seenGroom = root?.dataset.groom === '1';
  const at = () => performance.now();
  window.__log.push({ k: 'phase', v: seenPhase, t: at() });
  window.__log.push({ k: 'mood', v: seenMood, t: at() });
  new MutationObserver(() => {
    const p = phase();
    if (p !== seenPhase) {
      seenPhase = p;
      window.__log.push({ k: 'phase', v: p, t: at() });
    }
    const m = root?.dataset.mood ?? '';
    if (m !== seenMood) {
      seenMood = m;
      window.__log.push({ k: 'mood', v: m, t: at() });
    }
    const g = root?.dataset.groom === '1';
    if (g !== seenGroom) {
      seenGroom = g;
      window.__log.push({ k: 'groom', v: g ? 'on' : 'off', t: at() });
    }
    // Territory is what the mood is a function of, so it belongs on the same timeline.
    const claimed = document.querySelectorAll('.cat-tile[data-state="claimed"]').length;
    const last = window.__log.findLast((e) => e.k === 'claims');
    if (!last || last.v !== claimed) window.__log.push({ k: 'claims', v: claimed, t: at() });
    // The boss's attributes are *not* a complete clock for territory: a trade that keeps
    // the boss in stalk (siege never pounces, so phase never changes) still moves claims
    // on every hold and regrow, and those changes would never be recorded. Watch the
    // board's tile states directly, on the same timeline.
  }).observe(root, { attributes: true, attributeFilter: ['data-phase', 'data-mood', 'data-groom'] });
  const board = document.querySelector('[data-board]');
  if (board) {
    new MutationObserver(() => {
      const claimed = document.querySelectorAll('.cat-tile[data-state="claimed"]').length;
      const last = window.__log.findLast((e) => e.k === 'claims');
      if (!last || last.v !== claimed) window.__log.push({ k: 'claims', v: claimed, t: at() });
    }).observe(board, { attributes: true, attributeFilter: ['data-state'], subtree: true });
  }
};

/** The boss's current mood, straight off the element. */
const MOOD = `document.querySelector('[data-boss]')?.dataset.mood ?? ''`;
const CLAIMS = `document.querySelectorAll('.cat-tile[data-state="claimed"]').length`;
const AMMO = `document.querySelectorAll('#cat-score .cat-paw.got').length`;

/** Throw a treat away from where the player is working, if one is in hand. */
async function bribe(page, awayFrom) {
  if ((await page.evaluate(AMMO)) === 0) return false;
  if (await page.evaluate(`!document.querySelector('[data-treat]').hidden`)) return false;
  // Aim across the board from the working tile: on the card the board is 318×217 and
  // page-ish corners (60,180)/(1220,780) fall off it — throwSpot falls back to the
  // nearest board spot, which can land *next to* the working tile and defeat the point.
  const b = await page.evaluate(() => {
    const r = document.querySelector('[data-board]')?.getBoundingClientRect();
    return r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null;
  });
  if (!b) return false;
  const spot = await throwSpot(page, {
    x: awayFrom.x > b.left + b.right / 2 ? b.left + 8 : b.right - 8,
    y: awayFrom.y > b.top + b.bottom / 2 ? b.top + 8 : b.bottom - 8,
  });
  if (!spot) return false;
  await page.mouse.move(spot.x, spot.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(140);
  return true;
}

/**
 * Offer the boss the same provocation, over and over, and never complete a scrub.
 * Returns when `until()` says so or the clock runs out.
 *
 * **2.2 — plain jiggle, no lead-in.** An earlier lead-in parked the cursor near the tile
 * and *waited* for the boss to arrive before starting the jiggle; the wait timed out on
 * the card (boss walks 34px/s, a fifth of the page game's 170) and the harness then
 * never jiggled at all — the "feed" was pure regrow (mood hit bored at exactly +30s, the
 * 15s regrow clock twice, with `phases=stalk` in the log). The jiggle itself pulls the
 * boss over: measured, it closes ~150px in ~12s and the first telegraph follows. So this
 * is the whole loop, and the section baselines are long enough to include the approach.
 */
async function bait(page, ms, until = null) {
  const t0 = Date.now();
  let n = 0;
  let spot = null;
  while (Date.now() - t0 < ms) {
    /*
     * A tile mid-hold reads `data-state="scrubbing"`, not `claimed` — the card flips the
     * state the moment the jiggle starts (the page game kept `.cat-claimed` on a scrubbed
     * tile; the card's `showScrub` owns the state). A check that only accepts `claimed`
     * fails on the very first jiggle and re-picks a *different* tile every cycle — the
     * cursor teleports around the board, the boss never closes, and the bait provokes
     * nothing (measured: `phases=stalk` with a mood that only ever moved by regrow).
     */
    const still = spot
      ? await page.evaluate(
          ([x, y]) =>
            !!document
              .elementFromPoint(x, y)
              ?.closest('.cat-tile[data-state="claimed"], .cat-tile[data-state="scrubbing"]'),
          [spot.x, spot.y],
        )
      : false;
    if (!still) spot = await parkableSpot(page);
    if (!spot) break;
    await page.mouse.move(spot.x + (n % 2 ? 8 : -8), spot.y);
    n++;
    await page.waitForTimeout(BAIT_MS);
    if (until && (await until())) break;
  }
  return Date.now() - t0;
}

/**
 * A claimed tile on the board, preferring the one furthest from the boss, hit-tested so the
 * harness and the game agree on what "on a claim" means.
 */
async function parkableSpot(page) {
  const spot = await page.evaluate(() => {
    const b = document.querySelector('[data-board]')?.getBoundingClientRect();
    if (!b) return null;
    const boss = document.querySelector('[data-boss]')?.getBoundingClientRect();
    const cx = boss ? boss.left + boss.width / 2 : b.left;
    const cy = boss ? boss.top + boss.height / 2 : b.top;
    const claims = [...document.querySelectorAll('.cat-tile[data-state="claimed"]')];
    claims.sort((a, z) => {
      const ra = a.getBoundingClientRect();
      const rb = z.getBoundingClientRect();
      return (
        Math.hypot(rb.left + rb.width / 2 - cx, rb.top + rb.height / 2 - cy) -
        Math.hypot(ra.left + ra.width / 2 - cx, ra.top + ra.height / 2 - cy)
      );
    });
    for (const el of claims) {
      const r = el.getBoundingClientRect();
      const x = Math.round(r.left + r.width / 2);
      const y = Math.round(r.top + r.height / 2);
      if (document.elementFromPoint(x, y)?.closest('.cat-tile[data-state="claimed"]') === el) return { x, y };
    }
    return null;
  });
  if (spot) await page.waitForTimeout(120);
  return spot;
}

/**
 * A claimed tile on the board, preferring the one **nearest** the boss, hit-tested the same
 * way `parkableSpot` is. Used by the mercy check, whose subject is whether a bored cat still
 * answers a real hold — not how far it will walk to one. Nearest keeps the walk a couple of
 * seconds instead of the whole board diagonal.
 */
async function nearSpot(page) {
  const spot = await page.evaluate(() => {
    const b = document.querySelector('[data-board]')?.getBoundingClientRect();
    if (!b) return null;
    const boss = document.querySelector('[data-boss]')?.getBoundingClientRect();
    const cx = boss ? boss.left + boss.width / 2 : b.left;
    const cy = boss ? boss.top + boss.height / 2 : b.top;
    const claims = [...document.querySelectorAll('.cat-tile[data-state="claimed"]')]
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          el,
          x: Math.round(r.left + r.width / 2),
          y: Math.round(r.top + r.height / 2),
          d: Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy),
        };
      })
      .sort((a, z) => a.d - z.d);
    for (const c of claims) {
      if (document.elementFromPoint(c.x, c.y)?.closest('.cat-tile[data-state="claimed"]') === c.el)
        return { x: c.x, y: c.y };
    }
    return null;
  });
  if (spot) await page.waitForTimeout(120);
  return spot;
}

/** Somewhere that is not a claim — leave the card entirely (a hold must not survive). */
async function parkNeutral(page) {
  await page.mouse.move(30, 30);
  await page.waitForTimeout(80);
}

/**
 * Hold perfectly still on a parkable claim until it is taken back.
 * `spend` throws a treat first (see arena3: without treats an even fight sits near the
 * opening ratio indefinitely — §5.4's "the safe window is a real decision").
 *
 * **Fixed-duration hold (2.2):** the treat's fetch gives ~3-4s of immunity; a hold that
 * *waits* for the count to drop can sit past the immunity and get pounced, which takes the
 * tile straight back — the poll then never sees a drop and the player's work reads as
 * nothing. Hold a fixed SCRUB_MS + 350 (the treat's safe window, matching the fleet's
 * hold cadence) and check once. Measured: waiting-for-drop reclaimed 26 tiles and ended
 * with 10 still claimed; fixed holds drove the board to 2 and the mood to desperate.
 */
async function scrubOne(page, ms = 7000, spend = false) {
  const spot = await parkableSpot(page);
  if (!spot) return false;
  if (spend) await bribe(page, spot);
  const before = await page.evaluate(CLAIMS);
  await page.mouse.move(spot.x, spot.y);
  await page.waitForTimeout(Math.min(ms, SCRUB_MS + 350));
  const after = await page.evaluate(CLAIMS);
  await parkNeutral(page);
  return after < before;
}

/** Every interval the boss spent in a given tier (a tier is a set of intervals). */
function tierSpans(log, tier, endT, notBefore = 0) {
  const moods = log.filter((e) => e.k === 'mood' && e.v);
  const spans = [];
  for (let i = 0; i < moods.length; i++) {
    if (moods[i].v !== tier) continue;
    const from = Math.max(moods[i].t, notBefore);
    // Trim the end as well as the start: the mood event marks the moment the tier
    // *changed*, and the observer can timestamp a same-frame grooming beat (the bored
    // tell that *is* the new tier) a hair before the mood mutation lands — measured
    // with groom:on at the same second as mood:bored landing inside the even span.
    const to = moods[i + 1] ? moods[i + 1].t - 100 : endT;
    if (to > from) spans.push([from, to]);
  }
  return spans;
}

/**
 * A point near `spot` that is **not** on any claim, so the boss can be lured into range
 * without the player accruing any scrub progress.
 *
 * 2.2: the radii climb from small — the card's tiles are ~95×44px with a ~7px gap, so the
 * nearest off-tile point is the **vertical gap between rows, ~24px from a claim centre**,
 * which is just outside the 18px pounce range. Parking the boss there means the probe's
 * latency is the *decision* (how far into the hold the cat commits) rather than the walk:
 * at the page game's 55–120px lure the boss was a whole pounce-range away and the latency
 * measured travel, which is why §2's "decides sooner" read empty or backwards on the card.
 */
async function lurePoint(page, spot) {
  return page.evaluate(
    ([x, y]) => {
      const b = document.querySelector('[data-board]')?.getBoundingClientRect();
      if (!b) return null;
      for (const r of [20, 24, 28, 32, 38, 46, 55, 70, 90, 110]) {
        for (const deg of [0, 45, 90, 135, 180, 225, 270, 315]) {
          const px = Math.round(x + r * Math.cos((deg * Math.PI) / 180));
          const py = Math.round(y + r * Math.sin((deg * Math.PI) / 180));
          if (px < b.left + 4 || py < b.top + 4 || px > b.right - 4 || py > b.bottom - 4) continue;
          const el = document.elementFromPoint(px, py);
          if (el && !el.closest('.cat-tile')) {
            return { x: px, y: py };
          }
        }
      }
      return null;
    },
    [spot.x, spot.y],
  );
}

async function commitLatencies(page, attempts = 6) {
  const out = [];
  for (let i = 0; i < attempts; i++) {
    const spot = await parkableSpot(page);
    if (!spot) break;
    /*
     * Wait next to the claim, not on it: hold the cursor on a **non-claim** point a few
     * tens of pixels away. Progress cannot accrue, so the boss can never commit; it walks
     * over and settles into a stable stalk beside the cursor. Then move onto the claim,
     * which starts a fresh hold with the animal already in range — and the clock measures
     * exactly one thing: how far into that hold it decides.
     */
    const lure = await lurePoint(page, spot);
    if (!lure) continue;
    await page.mouse.move(lure.x, lure.y);
    /*
     * 2.2: the boss settles on the **lure** (the cursor's resting point), so wait for it to
     * arrive *there* — not at the claim, which is where the cursor is not. `lurePoint` now
     * parks it in the vertical gap between tile rows, ~24px from the claim centre, i.e. just
     * outside the 18px pounce range, so the latency read below is the *decision* (how far
     * into the hold it commits) rather than the walk. On the page game the 55–75px lure sat
     * inside the 90px pounce range and this wait was keyed off the claim; on the card both
     * of those would leave the boss a pounce-range away and the measurement would be travel.
     */
    const ready = await page
      .waitForFunction(
        ([x, y]) => {
          const b = document.querySelector('[data-board]')?.getBoundingClientRect();
          const root = document.querySelector('[data-boss]');
          if (!root || !b) return false;
          const r = root.getBoundingClientRect();
          const near = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y) <= 10;
          const stalking = !['telegraph', 'leap', 'recover', 'eat', 'fetch'].includes(root.dataset.phase);
          return near && stalking;
        },
        [lure.x, lure.y],
        { timeout: 8000 },
      )
      .then(() => true)
      .catch(() => false);
    if (!ready) continue;

    const probe = await page.evaluate(
      async ([x, y, cap]) => {
        const root = document.querySelector('[data-boss]');
        // Tagged with the tier it was actually taken in, because the probe *changes* the
        // tier: every landed pounce takes ground back, so six probes at the desperate tier
        // walked the cat up past `DESPERATE_LEAVE`. The rubber band undoing the
        // measurement is the feature working.
        const mood = root?.dataset.mood ?? '';
        const t0 = performance.now();
        // 2.2: the card's pointermove listener lives on the board element, not on
        // `document`. A synthetic pointermove dispatched on `document` bubbles UP to
        // `window` and never reaches `boardEl`, so `scrub.x/y` never moved, the hold never
        // started, and the probe returned -1 every round — which left the re-entry loop
        // with no samples to stop it, and it ground through all 14 rounds of the
        // desperate oscillation. Dispatch on the board element so the hold actually begins.
        const board = document.querySelector('[data-board]');
        (board ?? document).dispatchEvent(
          new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true }),
        );
        while (performance.now() - t0 < cap) {
          if (root?.dataset.phase === 'telegraph') {
            return { latency: performance.now() - t0, mood };
          }
          await new Promise((r) => requestAnimationFrame(r));
        }
        return { latency: -1, mood };
      },
      [spot.x, spot.y, 3000],
    );
    if (probe.latency > 0) out.push(probe);
    await page.waitForTimeout(400);
  }
  return out;
}

/** Count commitments, grooming beats and wind-up lengths across a union of intervals. */
function spanStats(log, spans, guardMs = 400) {
  const trimmed = spans.map(([a, b]) => [a + guardMs, b]).filter(([a, b]) => b > a);
  const inAny = (t) => trimmed.some(([a, b]) => t >= a && t <= b);
  const phases = log.filter((e) => e.k === 'phase');
  const telegraphs = [];
  let commits = 0;
  for (let i = 0; i < phases.length; i++) {
    if (phases[i].v !== 'telegraph' || !inAny(phases[i].t)) continue;
    commits++;
    const next = phases[i + 1];
    if (next) telegraphs.push(next.t - phases[i].t);
  }
  const seconds = trimmed.reduce((n, [a, b]) => n + (b - a), 0) / 1000;
  return {
    commits,
    grooms: log.filter((e) => e.k === 'groom' && e.v === 'on' && inAny(e.t)).length,
    telegraphs,
    /*
     * The **shortest** wind-up, not the mean: a bell doubles the next telegraph, and the
     * climb to the desperate tier has to spend treats — so a mean with one bell in it says
     * nothing about the tier. Aggression sets a *floor* on the wind-up; the minimum is the
     * statistic that floor is about, and the confound only ever lengthens.
     */
    fastest: telegraphs.length ? Math.min(...telegraphs) : 0,
    seconds,
    rate: seconds > 0 ? commits / seconds : 0,
  };
}

/**
 * A cat that leaps, on a board with something in reach — one deal, both conditions.
 * Fourteen deals is this file's own budget: an ambush is one of four weighted stances.
 */
const leaper = (page, want = 'ambush') =>
  deal(page, wants.stance([want], { claims: 'inView' }), {
    deals: 14,
    settle: 0,
    reopen: async () => {
      await release(page);
      await press(page);
    },
  });

// ---- 1. bored: the cat eases off a player who is behind and out of options
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1800);

  await press(page);
  const stance = await leaper(page);
  ok('dealt a cat that actually leaves the floor', !!stance, stance ?? 'no ambush in 14 rolls');
  note(`section 1 stance: ${await page.evaluate(`document.querySelector('[data-boss]')?.dataset.stance ?? ''`)}`);
  await page.evaluate(RECORDER);
  const opened = await page.evaluate(() => performance.now());

  ok('a fight opens even', (await page.evaluate(MOOD)) === 'even', await page.evaluate(MOOD));

  /*
   * Feed it. Baiting without ever finishing a hold means every landed pounce is a net gain
   * for the cat, so territory climbs — the only honest way to reach the tier that fires
   * when the player is losing.
   */
  const fed = await bait(page, 70_000, async () => (await page.evaluate(MOOD)) === 'bored');
  const reachedBored = (await page.evaluate(MOOD)) === 'bored';
  note(
    `feed: ${Math.round(fed / 1000)}s, ${await page.evaluate(CLAIMS)} claims, mood=${await page.evaluate(MOOD)}, ` +
      `phases=${(await page.evaluate(() => window.__log)).filter((e) => e.k === 'phase').map((e) => e.v).join('→')}`,
  );
  ok(
    'a player who keeps losing ground reaches the bored tier',
    reachedBored,
    `${Math.round(fed / 1000)}s, ${await page.evaluate(CLAIMS)} claims, mood=${await page.evaluate(MOOD)}`,
  );

  if (reachedBored) {
    // Keep doing exactly the same thing for another stretch, now that the cat has changed.
    await bait(page, 22_000);
    const log = await page.evaluate(() => window.__log);
    const endT = log.at(-1).t;
    const even = spanStats(log, tierSpans(log, 'even', endT, opened + 2500));
    const bored = spanStats(log, tierSpans(log, 'bored', endT));
    note(
      `phases=${log.filter((e) => e.k === 'phase').map((e) => e.v).join('→')} ` +
        `moods=${log.filter((e) => e.k === 'mood').map((e) => `${e.v}@${Math.round((e.t - opened) / 1000)}s`).join(',')} ` +
        `even=${even.commits}@${even.seconds.toFixed(0)}s bored=${bored.commits}@${bored.seconds.toFixed(0)}s`,
    );

    ok(
      'and then it stops trying — same bait, fewer commitments',
      even.rate > 0 && bored.rate < even.rate * 0.6,
      `${even.rate.toFixed(2)}/s even vs ${bored.rate.toFixed(2)}/s bored ` +
        `(${even.commits} in ${even.seconds.toFixed(0)}s, ${bored.commits} in ${bored.seconds.toFixed(0)}s)`,
    );
    ok(
      'a bored cat washes itself (§7.3’s tell)',
      bored.grooms > 0,
      `${bored.grooms} grooming beats in ${bored.seconds.toFixed(0)}s`,
    );
    ok(
      'and never does while the fight is even',
      even.grooms === 0,
      `${even.grooms} in ${even.seconds.toFixed(0)}s of even play`,
    );
    /*
     * Mercy, not surrender: a real hold still gets answered. §10's floor is that below
     * about 0.4 aggression the cat stops being a threat — this is that floor, measured.
     *
     * The answer is read from the boss's telegraph, the only signal that survives the card
     * port. The page game's second signal — "the claimed count changed" — is dead on the
     * card: a hold flips its tile `claimed → scrubbing`, and the wash (the tile just left
     * clears back to `claimed` as the new one starts scrubbing) nets the DOM count out, so
     * it never moves through a hold-and-reclaim. Hold the claim *nearest* the boss so the
     * walk is a couple of seconds, not the whole board diagonal; a real hold reclaims in
     * 1400ms, the boss's regrow (15s for a leaper) then re-claims the tile under the still
     * parked pointer, and the in-range boss telegraphs that re-hold. The regrow clock, not
     * the walk, is the ceiling.
     */
    const still = await nearSpot(page);
    let answered = false;
    if (still) {
      await page.mouse.move(still.x, still.y);
      answered = await page
        .waitForFunction(
          () => document.querySelector('[data-boss]')?.dataset.phase === 'telegraph',
          undefined,
          { timeout: 20000 },
        )
        .then(() => true)
        .catch(() => false);
    }
    ok(
      'mercy, not surrender — a real hold still gets answered',
      answered,
      answered ? 'the cat committed' : 'no telegraph in 20s of holding a claim',
    );
  }

  ok('no console errors through a rubber-banded fight', errors.length === 0, errors.slice(0, 2).join(' | '));

  await release(page);
  await settled(page);
  ok(
    'the card is back to collapsed after the rubber band (2.2 pillar 2)',
    await page.evaluate(`document.querySelector('#cat-card-panel').hidden`),
  );
  const leftovers = await page.evaluate(() => {
    const b = document.querySelector('[data-boss]');
    return { groom: b?.dataset.groom === '1', mood: b?.dataset.mood ?? '(none)' };
  });
  ok('no grooming marker left on the boss', leftovers.groom === false);
  // The card's boss element persists (transition:persist) with a resting mood of
  // 'even' — the fight-scoped tier must not leak, and this asserts exactly that.
  ok('and the fight tier did not leak onto the resting boss', leftovers.mood === 'even', leftovers.mood);
  await ctx.close();
}

// ---- 2. desperate: pushing the cat down makes the endgame cost something
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1800);
  const armed = await armAmmo(page, { hops: 5, pool: 6, dwell: 650, settle: 750, home: '/timeline/' });
  ok('armed like a player who has been round the site', armed >= 3, `${armed} treats`);

  await press(page);
  const leapDeal = await leaper(page);
  fixture('dealt a leaping cat for the desperate measurements too', leapDeal, leapDeal.value ?? '');
  await page.evaluate(RECORDER);
  const opened = await page.evaluate(() => performance.now());

  // A short baseline of the cat at the even tier, under the constant bait.
  // 16s, not 6: with the plain jiggle the boss takes ~12s just to close the first
  // ~150px on the card, and a baseline shorter than the approach collects zero
  // commits and reads as "the cat never tried" (§7.3 needs a real even sample).
  await bait(page, 16_000);
  const probes = await commitLatencies(page);
  const evenEnd = await page.evaluate(() => performance.now());

  // Then take the page off it: holding perfectly still completes holds.
  let taken = 0;
  for (let i = 0; i < 26; i++) {
    if ((await page.evaluate(MOOD)) === 'desperate') break;
    if (await scrubOne(page, 7000, true)) taken++;
    if ((await page.evaluate(CLAIMS)) === 0) break;
  }
  const mood = await page.evaluate(MOOD);
  const reachedDesperate = mood === 'desperate';
  ok(
    'a player who is winning drives the cat into the desperate tier',
    reachedDesperate,
    `${taken} reclaimed, ${await page.evaluate(CLAIMS)} claims left, mood=${mood}`,
  );

  if (reachedDesperate) {
    // Let the last thrown treat finish before measuring.
    await page
      .waitForFunction(() => document.querySelector('[data-treat]')?.hidden !== false, undefined, {
        timeout: 8000,
      })
      .catch(() => {});
    await page.waitForTimeout(600);
    const despFrom = await page.evaluate(() => performance.now());
    await bait(page, 8_000, async () => (await page.evaluate(CLAIMS)) === 0);
    /*
     * Probe, and **re-enter the tier when the probing knocks us out of it.** Every probe
     * ends in a landed pounce, which takes ground back, which walks the cat up past
     * `DESPERATE_LEAVE` — so the desperate window is only a couple of samples wide. 1.4
     * widened this loop because the tier digs itself out faster (`LAST_STAND_REGROW`).
     */
    for (let round = 0; round < 14; round++) {
      if (probes.filter((pr) => pr.mood === 'desperate').length >= 2) break;
      if ((await page.evaluate(MOOD)) !== 'desperate') {
        let pushed = 0;
        while (pushed < 4 && (await page.evaluate(MOOD)) !== 'desperate') {
          if ((await page.evaluate(CLAIMS)) === 0) break;
          if (!(await scrubOne(page, 7000, true))) break;
          pushed++;
        }
        if ((await page.evaluate(MOOD)) !== 'desperate') continue;
      }
      probes.push(...(await commitLatencies(page, 2)));
    }
    const log = await page.evaluate(() => window.__log);
    const endT = log.at(-1).t;
    const even = spanStats(
      log,
      tierSpans(log, 'even', endT, opened + 2500).map(([a, b]) => [a, Math.min(b, evenEnd)]),
    );
    const desp = spanStats(
      log,
      tierSpans(log, 'desperate', endT).map(([a, b]) => [Math.max(a, despFrom), b]),
    );

    ok(
      'a desperate cat winds up faster than an even one (§7.3)',
      desp.fastest > 0 && even.fastest > 0 && desp.fastest < even.fastest * 0.9,
      `fastest wind-up ${even.fastest.toFixed(0)}ms even vs ${desp.fastest.toFixed(0)}ms desperate ` +
        `(all: even ${even.telegraphs.map((t) => t.toFixed(0)).join('/')}, ` +
        `desperate ${desp.telegraphs.map((t) => t.toFixed(0)).join('/')})`,
    );
    ok(
      'but never faster than a human can react to (§5.3’s floor)',
      desp.telegraphs.every((t) => t > 200),
      `shortest ${Math.min(...desp.telegraphs).toFixed(0)}ms`,
    );
    const med = (xs) => (xs.length ? [...xs].sort((a, b) => a - b)[xs.length >> 1] : -1);
    const at = (m) => probes.filter((p) => p.mood === m).map((p) => p.latency);
    const evenLat = at('even');
    const despLat = at('desperate');
    ok(
      'and it decides sooner — the endgame is no longer free',
      evenLat.length > 0 && despLat.length > 0 && med(despLat) < med(evenLat) * 0.8,
      `commits ${med(evenLat).toFixed(0)}ms into a hold when even (${evenLat.map((v) => v.toFixed(0)).join('/')}), ` +
        `${med(despLat).toFixed(0)}ms when desperate (${despLat.map((v) => v.toFixed(0)).join('/')})`,
    );
    ok(
      'a desperate cat does not groom',
      desp.grooms === 0,
      `${desp.grooms} grooming beats`,
    );
  }

  ok('no console errors driving the cat to the wall', errors.length === 0, errors.slice(0, 2).join(' | '));
  await release(page);
  await settled(page);
  await ctx.close();
}

// ---- 3. the tier does not strobe while territory trades back and forth
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1800);
  await press(page);
  await page.evaluate(RECORDER);

  // Trade: bait for a while (cat gains), then scrub (player gains), repeatedly.
  // Bait windows must outlast the ~12s approach or the cat never gains (see §2 note).
  for (let i = 0; i < 4; i++) {
    await bait(page, 16000);
    await scrubOne(page, 4000);
    if ((await page.evaluate(CLAIMS)) === 0) break;
  }

  const log = await page.evaluate(() => window.__log);
  const moods = log.filter((e) => e.k === 'mood' && e.v);
  const claimSeries = log.filter((e) => e.k === 'claims').map((e) => e.v);
  const swings = claimSeries.filter((v, i) => i > 0 && v !== claimSeries[i - 1]).length;
  ok(
    'territory really did move back and forth',
    swings >= 4,
    `${swings} changes across ${claimSeries.length} samples`,
  );
  /*
   * The band's own guarantee: no two tier changes can be one claim apart.
   */
  const claimsLog = log.filter((e) => e.k === 'claims');
  const gaps = [];
  for (let i = 1; i < moods.length; i++) {
    const between = claimsLog.filter((c) => c.t > moods[i - 1].t && c.t <= moods[i].t);
    const moved = between.filter((c, j) => j === 0 || c.v !== between[j - 1].v).length;
    gaps.push(moved);
  }
  ok(
    'no two tier changes happen within one claim of each other',
    gaps.every((g) => g >= 2),
    moods.length < 2
      ? `only ${moods.length} tier change, nothing to space out`
      : `gaps of ${gaps.join('/')} claims between ${moods.map((m) => m.v).join('→')}`,
  );
  await release(page);
  await settled(page);
  await ctx.close();
}

// ---- 4. the ambient cat is never touched by any of this
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1800);
  await press(page);
  await bait(page, 9000);
  await release(page);
  await settled(page);
  await page.waitForTimeout(1500);

  /*
   * Total distance travelled, sampled, over a window long enough to contain a walk.
   * The ambient cat is never taken over by the card's boss — the card owns its own sprite —
   * so it should walk the whole time, exactly as it did before the card existed.
   */
  const travelled = await page.evaluate(async () => {
    const c = document.getElementById('site-cat');
    if (!c) return 0;
    let last = c.getBoundingClientRect().left;
    let total = 0;
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 120));
      const x = c.getBoundingClientRect().left;
      total += Math.abs(x - last);
      last = x;
    }
    return total;
  });
  const after = await page.evaluate(() => {
    const c = document.getElementById('site-cat');
    return {
      boss: !!c && c.classList.contains('boss'),
      groom: !!c && c.classList.contains('grooming'),
      mood: c?.dataset.mood ?? '(none)',
    };
  });
  ok('the ambient cat walks throughout a card fight', travelled > 20, `${travelled.toFixed(0)}px over 7s`);
  ok('and was never made a boss', after.boss === false);
  ok('and was never made to groom on the card’s behalf', after.groom === false);
  ok('and carries no mood into ambient browsing', after.mood === '(none)', after.mood);
  await ctx.close();
}

await browser.close();
if (!done()) process.exit(1);
void TELEGRAPH_MS;
void SCRUB_MS;
