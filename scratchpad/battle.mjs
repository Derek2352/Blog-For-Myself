/**
 * 1.4's combat additions, measured in a real browser — the ship gate for §9.3, §7.3 and §5.4.
 * 2.2: measured on the **card game** now — the page-board game is gone, so every check below
 * reads the card's tiles and boss instead of page furniture.
 *
 * Each of these mechanics is a claim about *the machine*, so every check here reads the machine:
 * the claim count, the phase the boss writes on itself, the mood attribute, the boss's own
 * coordinates. §12's standing lesson is that a proxy passes when the mechanic is broken — a
 * ribbon can say "the walls come in now" while nothing closes — and 1.4 spent an afternoon
 * proving it again, so nothing below asserts on prose.
 *
 * What it measures, and why each one needs a browser rather than a unit test:
 *
 *   1. **Siege is winnable when it is played as siege.** The stance cannot leave the floor, so the
 *      lure that beats a leaper is wasted motion against it. `arena8` only ever fights an ambush
 *      (section 4 forces one), so nothing measured siege until 1.4's sweep made it urgent.
 *   2. **The sweep takes two, and pays two intervals for them.** The bill is what keeps §9.3's
 *      moment out of §9.4's floor, and it is a *rate*, which means time has to pass to see it.
 *   3. **The last stand shortens the clock.** Only reachable by actually cornering a cat.
 *   4. **The counter is recover-only.** The rule is pure and unit-tested; that the *window is
 *      reachable by a player* — `RECOVER_MS` minus the treat's flight — is a browser fact.
 *   5. **The ambush pin holds the cat where it landed**, and then lets go.
 *
 * 2.2's drop list, applied: no page scrolling, no viewport band, no header twitch — the card's
 * board is the whole game surface, so "watch without playing" is a keypress (the card's own
 * presence signal) rather than a cursor parked in the page's furniture. Distances scale 1/5
 * (the pin's 90px leash is an 18px leash on the card); durations are unchanged.
 *
 * Run against a built preview on 4416, like every other harness here:
 *   npm run build && npx astro preview --port 4416 &
 *   node scratchpad/battle.mjs
 */
import {
  BASE,
  CARD_SCALE,
  IDLE_TRUCE_MS,
  RECOVER_MS,
  SCRUB_MS,
  SIEGE_REGROW_MS,
  armAmmo,
  bounded,
  deal,
  fresh as context,
  launch,
  overFor,
  press as sharedPress,
  reachClaim,
  release as sharedRelease,
  report,
  throwSpot,
  wants,
} from './lib/fixture.mjs';

/*
 * Shared with the rest of the fleet through `lib/fixture.mjs` (§12.1's charter): the reporter with its
 * fixture/assertion split, the context factory that declares the mode, the launcher, and the waits
 * that open and close a fight. This file used to carry its own copy of each.
 */
const browser = await launch();
const { ok, note, fixture, done } = report();


/* Mirrors src/lib/arena.ts — kept as literals so a drift shows up as a failure, not a pass.
 * Distances are scaled by CARD_SCALE (§2.2); durations are unchanged. */
const THROW_ARC_MS = 320;
const SWAT_STUN_MS = 900;
const AMBUSH_PIN_MS = 2600;
const AMBUSH_PIN_PX = 90 * CARD_SCALE; // 18px — the card's pin leash
const LAST_STAND_REGROW = 0.55;


/*
 * "Unreclaimed", not "labelled claimed". A tile leaves `claimed` for `scrubbing` the moment a
 * hold *starts* (the card's scrub is a `data-state`, unlike the page game's `--scrub` style which
 * left `.cat-claimed` on the element while it was worked), so the raw `claimed` count drops on
 * the beginning of a hold, not on the finish — and a loop that reads it as "reclaimed" thinks it
 * is winning while the tile is still being worked. That was the 2.2-conversion red: "10
 * reclaimed, 0 left, never won", and the same miscount is why the cornered tier was "never
 * reached" — the loop saw `scrubbing` tiles as gone and stopped short of actually reclaiming.
 * `claimed + scrubbing` is exactly `arena.claimed.length` (a scrubbing tile stays in the array
 * until the reclaim lands), which is the count that only moves on a real reclaim.
 */
const CLAIMS = `document.querySelectorAll('.cat-tile[data-state="claimed"], .cat-tile[data-state="scrubbing"]').length`;
const AMMO = `document.querySelectorAll('#cat-score .cat-paw.got').length`;
const ON = `!document.querySelector('#cat-card-panel').hidden`;
const WON = `document.getElementById('site-cat').classList.contains('notched')`;

/** A desktop context playing **manual mode** — 1.4's additions are all pointer-and-treat mechanics. */
const fresh = (opts = {}) => context(browser, { mode: 'manual', ...opts });



/** Shared with the fleet; this file has always allowed 8000ms either way. */
const press = (page) => sharedPress(page, { timeout: 8000 });
const release = async (page) => {
  await sharedRelease(page, { timeout: 8000 });
  await page.waitForTimeout(200);
};




/**
 * The stance a section is about, dealt for rather than hoped for.
 *
 * Twenty-four deals is this file's own budget kept — §9.3 weights the roll, so a named stance takes
 * several fights to see. Every section here pins one, because 1.4's additions are *per stance*: only
 * siege sweeps, only ambush pins, only a trickster feints.
 */
const stanceDeal = (page, want) =>
  deal(page, wants.stance([want], { claims: 'any' }), {
    deals: 24,
    settle: 0,
    // **This file's own open and close, not the defaults.** `release` here carries a 200ms tail, and
    // without it a re-deal presses the toggle again while the previous intent is still standing — which
    // toggles the wrong way and leaves the card *closed*. Measured: one commitment in forty seconds and a
    // treat that never left the HUD, because there was no fight to throw into.
    reopen: async () => {
      await release(page);
      await press(page);
    },
  });




/**
 * The card's own flight recorder: phase, mood, claim count and the boss's coordinates.
 *
 * Sampled in the page rather than polled over CDP because everything here is measured in
 * *milliseconds* and a round trip per sample would put the measurement error inside the effect.
 * Phase changes are captured by observer so no transition can fall between two samples.
 *
 * 2.2: the boss is `[data-boss]` and its phase is `dataset.phase`, not a class list — except the
 * swat, which is still a `boss-swatted` class layered over `recover` (the card's `stepTreat` adds
 * it while the phase stays `recover`). Mood is `dataset.mood`.
 */
const RECORD = (everyMs) => {
  const cat = document.querySelector('[data-boss]');
  const w = window;
  w.__rec = { samples: [], phases: [], marks: [], t0: performance.now() };
  /*
   * Phase marks, because a regrow interval measured across the harness's *own* playing is not a
   * regrow interval. The first version of section 2 averaged every gap it saw and reported 18333ms
   * for a 9000ms clock — the gaps that spanned the play-down included the time spent holding, and
   * a board with nothing left to take has no clock at all. Both are the harness's activity leaking
   * into the number, which is §12's oldest trap wearing a new hat.
   */
  w.__mark = (label) => w.__rec.marks.push({ t: Math.round(performance.now() - w.__rec.t0), label });
  const phaseOf = () => {
    if (cat.classList.contains('boss-swatted')) return 'swatted';
    return cat.dataset.phase ?? 'stalk';
  };
  let last = '';
  const mark = () => {
    const p = phaseOf();
    if (p !== last) {
      w.__rec.phases.push({ t: Math.round(performance.now() - w.__rec.t0), phase: p });
      last = p;
    }
  };
  new MutationObserver(mark).observe(cat, { attributes: true, attributeFilter: ['data-phase', 'class'] });
  mark();
  w.__recTimer = setInterval(() => {
    const r = cat.getBoundingClientRect();
    w.__rec.samples.push({
      t: Math.round(performance.now() - w.__rec.t0),
      n: document.querySelectorAll('.cat-tile[data-state="claimed"], .cat-tile[data-state="scrubbing"]').length,
      mood: cat.dataset.mood ?? '',
      x: Math.round(r.left + r.width / 2),
      y: Math.round(r.top + r.height / 2),
    });
  }, everyMs);
};
const readRec = (page) => page.evaluate(`JSON.stringify(window.__rec)`).then(JSON.parse);
const stopRec = (page) => page.evaluate(`clearInterval(window.__recTimer)`);

/**
 * Keep a *watched* fight alive without playing it.
 *
 * Sections 2 and 3 measure the board's own clock, which means not touching the board for tens of
 * seconds — and §11 is entitled to call that a truce. The page game let a spectator twitch the cursor
 * in the header (a protected tree that refreshed `scrub.seen` without scrubbing anything). The card
 * has no header to twitch in: its board is the only game surface, and a pointer on it is a lure. The
 * card's own presence signal is "any key" (`document keydown` sets `scrub.seen`), so a harmless key
 * keeps the truce clock alive while the pointer stays off the board and the boss sits still, regrowing.
 */
async function watchFor(page, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    await page.keyboard.press('Shift');
    await page.waitForTimeout(Math.min(2000, IDLE_TRUCE_MS / 4));
  }
}

/**
 * A claimed tile nearest the boss — the one a bait sits on to provoke a pounce (sections 4 and 5).
 * The card's board is all on screen, so "nearest" is board distance and nothing needs scrolling.
 */
async function nearClaim(page) {
  return page.evaluate(() => {
    const boss = document.querySelector('[data-boss]')?.getBoundingClientRect();
    const board = document.querySelector('[data-board]')?.getBoundingClientRect();
    if (!boss || !board) return null;
    const cx = boss.left + boss.width / 2;
    const cy = boss.top + boss.height / 2;
    let best = null;
    for (const el of document.querySelectorAll('.cat-tile[data-state="claimed"]')) {
      const r = el.getBoundingClientRect();
      if (r.top <= board.top + 4 || r.bottom >= board.bottom - 4) continue;
      const x = Math.round(r.left + r.width / 2);
      const y = Math.round(r.top + r.height / 2);
      if (document.elementFromPoint(x, y)?.closest('.cat-tile') !== el) continue;
      const away = Math.hypot(x - cx, y - cy);
      if (!best || away < best.away) best = { x, y, away };
    }
    return best;
  });
}

/* ------------------------------------------------------------------ *
 * 1. Siege, played the way a floor-bound cat has to be played
 * ------------------------------------------------------------------ */
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await press(page);
  const isSiegeDeal = await stanceDeal(page, 'siege');
  const isSiege = !!isSiegeDeal.value;
  fixture('a siege cat to fight (§9.3)', isSiegeDeal);

  /*
   * No decoy, on purpose, and this is the finding that made this file exist.
   *
   * `arena8` plays every fight by luring the cat to the top of the screen and then working a
   * claim on the far side, which is the counter to a *leaper*. Against siege it is 4 of every 6
   * seconds spent waiting for a cat that physically cannot come: `spec.pin` holds its y fixed.
   * Played that way, siege and the board fought flee-and-scrub to a dead plateau — six claims,
   * ten exchanges, neither winning. Played the way its own premise implies (take whatever is
   * furthest from the floor it is stuck on, hold, repeat) it is a fight with an end.
   */
  const t0 = Date.now();
  let took = 0;
  let misses = 0;
  const budget = 150_000;
  while (Date.now() - t0 < budget) {
    if (!(await page.evaluate(ON))) break;
    // The win leaves a single "parting" claim behind (the card's `finish('win')` re-claims one),
    // so `notched` — not an empty board — is the signal the fight is over.
    if (await page.evaluate(WON)) break;
    const left = await page.evaluate(CLAIMS);
    if (left === 0) break;
    const spot = await reachClaim(page);
    if (!spot) {
      // `reachClaim` found no claim to hold; the board has already run out. Keep the fight alive
      // (a key is presence, §11) and try once more before giving up on the fight.
      misses++;
      await page.waitForTimeout(400);
      if (misses > 8) break;
      continue;
    }
    const before = await page.evaluate(CLAIMS);
    await page.mouse.move(spot.x, spot.y);
    const held = Date.now();
    while (Date.now() - held < SCRUB_MS * 2.5) {
      await page.waitForTimeout(120);
      if ((await page.evaluate(CLAIMS)) < before) {
        took++;
        break;
      }
    }
  }
  const won = await page.evaluate(WON);
  ok(
    'siege is winnable by holding what it cannot reach (§9.4’s floor, for the stance nothing tested)',
    won,
    `${took} reclaimed, ${await page.evaluate(CLAIMS)} left after ${((Date.now() - t0) / 1000).toFixed(0)}s` +
      (misses ? `, ${misses} searches found nothing to hold` : ''),
  );
  ok('no console errors through a siege fight', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

/* ------------------------------------------------------------------ *
 * 2 + 3. The sweep's bill, and the cornered clock — one recording, two rules
 * ------------------------------------------------------------------ */
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  /*
   * **Treats in hand, and not for throwing.** The first version of this section watched a
   * treatless fight and the fight *lost itself*: §2 makes a loss "every claimable thing taken
   * **and** nothing left to throw", so a spectator with empty paws is a player being beaten by
   * the clock, and 62s of siege regrow is enough board to do it. The recording then ended early
   * and the cornered tier below was never reachable — the harness reported "never reached the
   * desperate tier" while the game had done nothing wrong.
   *
   * Arming and never spending removes the loss without touching the thing being measured: the
   * regrow clock does not read the paw row. Which is also a neat confirmation of §2's rule —
   * ammo really is the thing standing between a full board and defeat.
   */
  const armedToWatch = await armAmmo(page, { hops: 5, pool: 5, dwell: 650, settle: 1200, home: '/' });
  ok('treats in hand, so a watched fight cannot lose itself (§2)', armedToWatch >= 3, `${armedToWatch} found`);
  await press(page);
  const isSiegeDeal = await stanceDeal(page, 'siege');
  const isSiege = !!isSiegeDeal.value;
  fixture('a siege cat to watch', isSiegeDeal);

  await page.evaluate(RECORD, 100);
  // Watch the board grow while playing nothing: every increase is a regrow, and its size is the
  // sweep. Long enough for four intervals, because the bill is only visible across a cycle.
  await page.evaluate(`window.__mark('watch-even')`);
  await watchFor(page, 62_000);
  await page.evaluate(`window.__mark('play')`);
  const before = await readRec(page);

  /*
   * Now corner it. §7.3's desperate tier needs territory ≤ 20%, which is a state only reachable
   * by *winning*, so the last stand cannot be measured without playing the fight down — and the
   * gap has to be read afterwards, from the same recording, or two runs' worth of noise gets
   * compared instead of two moods.
   */
  let guard = 0;
  while ((await page.evaluate(CLAIMS)) > 2 && (await page.evaluate(ON)) && guard++ < 40) {
    const spot = await reachClaim(page);
    if (!spot) {
      await page.waitForTimeout(300);
      continue;
    }
    const n = await page.evaluate(CLAIMS);
    await page.mouse.move(spot.x, spot.y);
    const held = Date.now();
    while (Date.now() - held < SCRUB_MS * 2.5) {
      await page.waitForTimeout(120);
      if ((await page.evaluate(CLAIMS)) < n) break;
    }
  }
  const cornered = await page.evaluate(CLAIMS);
  /*
   * Then stop playing and let the cornered clock run, watched the same way. Long enough for three
   * desperate intervals at `LAST_STAND_REGROW`, because the tier only lasts until the board it is
   * regrowing pushes territory back over the line — the last stand measures itself out of
   * existence, which is the point of it.
   */
  if (await page.evaluate(ON)) {
    await page.evaluate(`window.__mark('watch-cornered')`);
    await watchFor(page, 22_000);
  }
  await page.evaluate(`window.__mark('end')`);
  await stopRec(page);
  const rec = await readRec(page);
  const stillOn = await page.evaluate(ON);

  /*
   * Turn samples into regrow *events*: an increase in the claim count, its size, and the mood the
   * cat was in when it happened. The interval that was *bought* by an event is the gap to the
   * next one, and `regrowInterval` charges one interval per claim — so the quantity that has to
   * be invariant is the gap divided by the size of the event that preceded it.
   */
  const events = [];
  for (let i = 1; i < rec.samples.length; i++) {
    const d = rec.samples[i].n - rec.samples[i - 1].n;
    if (d > 0) events.push({ t: rec.samples[i].t, size: d, mood: rec.samples[i - 1].mood });
  }
  /*
   * A span is only a measurement of the *clock* if nothing else touched the board while it ran, so
   * each one is stamped with the window it fell inside and only watch spans are averaged. The
   * play-down's spans are kept and printed, because "what the clock looks like while somebody is
   * fighting it" is worth seeing — it is just not what `regrowInterval` claims.
   */
  const windowAt = (t) => {
    let label = 'before';
    for (const m of rec.marks) if (m.t <= t) label = m.label;
    return label;
  };
  const spans = [];
  for (let i = 1; i < events.length; i++) {
    const a = events[i - 1];
    const b = events[i];
    spans.push({
      per: (b.t - a.t) / a.size,
      size: a.size,
      mood: a.mood,
      window: windowAt(a.t) === windowAt(b.t) ? windowAt(a.t) : 'straddles',
    });
  }
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  const sizes = events.map((e) => e.size);
  const clean = spans.filter((s) => s.window === 'watch-even' && s.mood !== 'desperate');
  const desperate = spans.filter((s) => s.window === 'watch-cornered' && s.mood === 'desperate');
  const singles = clean.filter((s) => s.size === 1).map((s) => s.per);
  const doubles = clean.filter((s) => s.size === 2).map((s) => s.per);
  note(`spans by window: ${spans.map((s) => `${s.size}×${(s.per / 1000).toFixed(1)}s/${s.window}`).join(', ')}`);

  note(
    `${events.length} regrow events, sizes [${sizes.join(',')}], cornered at ${cornered} claims` +
      `, fight ${stillOn ? 'still on' : 'ended'}`,
  );
  note(
    `per-claim interval: singles ${mean(singles).toFixed(0)}ms (n=${singles.length}), ` +
      `doubles ${mean(doubles).toFixed(0)}ms (n=${doubles.length}), ` +
      `desperate ${mean(desperate.map((s) => s.per)).toFixed(0)}ms (n=${desperate.length})`,
  );

  ok(
    'the sweep takes two (§9.3 — siege’s signature happens at all)',
    sizes.includes(2),
    `sizes seen: [${sizes.join(',')}] over ${(before.samples.at(-1)?.t ?? 0) / 1000 | 0}s of watching`,
  );
  ok(
    'and pays an interval for each claim, so the board’s rate is 1.3’s (§9.4 by construction)',
    doubles.length > 0 && singles.length > 0
      ? Math.abs(mean(doubles) - mean(singles)) < mean(singles) * 0.35
      : false,
    doubles.length && singles.length
      ? `${mean(doubles).toFixed(0)}ms vs ${mean(singles).toFixed(0)}ms per claim`
      : `not enough events (singles ${singles.length}, doubles ${doubles.length})`,
  );
  ok(
    'a regrow interval is the stance’s own clock, not something faster',
    singles.length > 0 && Math.abs(mean(singles) - SIEGE_REGROW_MS) < SIEGE_REGROW_MS * 0.3,
    `${mean(singles).toFixed(0)}ms against ${SIEGE_REGROW_MS}ms`,
  );
  ok(
    'and the walls come in faster once the cat is cornered (§7.3’s last stand)',
    desperate.length > 0 && mean(desperate.map((s) => s.per)) < mean(singles) * 0.8,
    desperate.length
      ? `${mean(desperate.map((s) => s.per)).toFixed(0)}ms cornered against ${mean(singles).toFixed(0)}ms even ` +
        `(design says ×${LAST_STAND_REGROW})`
      : 'never reached the desperate tier — nothing measured',
  );
  ok('no console errors while the board fights alone', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

/* ------------------------------------------------------------------ *
 * 4. The counter — a treat that lands on a recovering cat
 * ------------------------------------------------------------------ */
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const armed = await armAmmo(page, { hops: 5, pool: 5, dwell: 650, settle: 1200, home: '/' });
  ok('treats in hand to spend on a counter', armed >= 3, `${armed} found`);
  await press(page);
  const isAmbushDeal = await stanceDeal(page, 'ambush');
  const isAmbush = !!isAmbushDeal.value;
  fixture('an ambush cat, which is the one that whiffs at you', isAmbushDeal);
  await page.evaluate(RECORD, 60);

  /**
   * Bait a pounce and counter it, the way a player would.
   *
   * **Throw at the leap, not at the recovery.** The first version waited for `recover` and
   * then threw, which spends most of the 380ms window on the wait resolving and the click
   * arriving — measured, it lands after the recovery has closed about half the time, and reports
   * a working counter as broken. A player does not react to the recovery either: they read the
   * *commitment*, and throw at the ground the cat is already falling towards. From the leap the
   * treat's 320ms flight arrives just after the cat does, which is the whole window rather than
   * whatever is left of it.
   *
   * Retried, for the reason 1.3's gate note gives about the rematch budget: the cat feints, aims
   * ahead of a moving cursor and sometimes lands out of radius, so "the counter is reachable" is
   * measured over several attempts. One attempt would be measuring luck.
   */
  /*
   * **The loop used to race its own reclaiming.** Baiting means holding still on the claim nearest the
   * cat — and a hold that survives 1400ms *reclaims* that claim, so a few baits in, the board is empty,
   * the fight is won and there is no cat left to commit. Measured across the gate: three commitments in
   * one run, one in another, which is not a property of the build but of how fast the holds happened to
   * land. A fight that ends mid-measurement is a fixture problem, so the loop starts another one and
   * keeps its own count across them.
   */
  let commitments = 0;
  let refights = 0;
  const baitAndCounter = async (ms = 60_000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const alive = await page.evaluate(
        `!document.querySelector('#cat-card-panel').hidden && document.querySelectorAll('.cat-tile[data-state="claimed"], .cat-tile[data-state="scrubbing"]').length > 0`,
      );
      if (!alive) {
        // Won, or truced. Open another and pin the same stance — the section is about the counter, and
        // which fight it is measured in was never part of the claim.
        if (refights >= 4) return false;
        refights++;
        await overFor(page, 9000);
        await press(page);
        await stanceDeal(page, 'ambush');
        await page.waitForTimeout(200);
        continue;
      }
      const spot = await nearClaim(page);
      if (!spot) {
        await page.waitForTimeout(300);
        continue;
      }
      await page.mouse.move(spot.x, spot.y);
      // Hold still until it commits. Bounded — a cat that never commits means re-baiting
      // somewhere else, not waiting out the truce.
      const committed = await bounded(
        page,
        () => document.querySelector('[data-boss]')?.dataset.phase === 'leap',
        6000,
      );
      if (!committed) continue;
      commitments++;
      /*
       * Throw at the cursor's own position, because that is where the cat aimed: `predict` leads a
       * *moving* pointer and this one has been still, so the aim is the hold. The treat therefore
       * lands on the cat rather than near it, which is what `SWAT_RADIUS` asks.
       */
      await page.mouse.click(spot.x, spot.y);
      if (
        await bounded(page, () => document.querySelector('[data-boss]')?.classList.contains('boss-swatted'), 2500)
      )
        return true;
      // Missed the window or the radius. Let the treat clear (one on the board at a time) and
      // bait again — the retry is the measurement, not a workaround for one.
      await page.waitForTimeout(1200);
    }
    return false;
  };

  const swatted = await baitAndCounter();
  ok('the cat commits, which is the window (§5.3’s tell)', commitments > 0, `${commitments} pounces baited`);
  /*
   * **How many chances it got is a fixture.** 1.4's own note says the counter is measured over several
   * attempts, because the cat feints, aims ahead of a moving cursor and sometimes lands out of radius.
   * Sweep 1 of 2.0's gate got two commitments in forty seconds and reported "the counter is broken";
   * sweep 2 got enough and reported it working. Whether the *build* counters is the assertion below;
   * whether this run got enough bites to ask is this line.
   */
  /*
   * **One commitment is the bar, because one is what the counter needs.** This line first asked for
   * three, and promptly failed at two on a run where the counter *landed* — a fixture failing while the
   * thing it gates succeeds, which is the fixture rule used as a comfort blanket rather than a
   * precondition. The threshold belongs to what the assertion needs: no commitment, no window, nothing
   * measured. The count still goes in the detail, because "it worked on the second of two bites" and
   * "it worked on the second of twenty" are different things to know.
   */
  fixture(
    'the cat committed at least once, so there was a window to counter',
    commitments >= 1 || null,
    `${commitments} commitments${refights ? ` across ${refights + 1} fights` : ''}`,
  );
  ok(
    'a treat landing on a recovering cat swats it (§5.4’s counter)',
    swatted,
    swatted
      ? `landed inside the ${RECOVER_MS - THROW_ARC_MS}ms window (RECOVER_MS − THROW_ARC_MS) after ${commitments} pounce(s)`
      : `no swat in ${commitments} attempts`,
  );

  /*
   * The stun, read off the phase log rather than off a timer here: the rule is that the cat
   * cannot telegraph out of a recovery it has not finished, so what has to be true is the *gap*
   * between the swat and the next telegraph.
   */
  const log = (await readRec(page)).phases;
  const swatAt = log.find((p) => p.phase.includes('swatted'))?.t ?? -1;
  const nextTelegraph = log.find((p) => p.t > swatAt && p.phase.includes('telegraph'))?.t ?? -1;
  ok(
    'and the stun really does hold the telegraph off',
    swatAt >= 0 && (nextTelegraph < 0 || nextTelegraph - swatAt > SWAT_STUN_MS * 0.6),
    swatAt < 0
      ? 'no swat in the log'
      : nextTelegraph < 0
        ? 'no telegraph at all after the swat'
        : `${nextTelegraph - swatAt}ms until the next telegraph (stun ${SWAT_STUN_MS}ms)`,
  );

  /*
   * The guard, which is the half that keeps §3 honest: the same throw at the same distance while
   * the cat is *stalking* must do nothing but lure. Without this the counter is "click the cat",
   * and a fight with a free interrupt is not a fight.
   */
  const stalking = await bounded(
    page,
    () => {
      const b = document.querySelector('[data-boss]');
      return !!b && !b.classList.contains('boss-swatted') && !['recover', 'leap'].includes(b.dataset.phase);
    },
    8000,
  );
  const beforeControl = (await readRec(page)).phases.length;
  /*
   * **The control has to be shown to have happened.** The first version reported "phases after the
   * control throw: none" and passed — but "none" is also what a throw that was never made looks
   * like, and `throwTreat` silently refuses one when a treat is already on the board or the paws
   * are empty. A guard that turns a failure into an absence is worse than the failure (§12, twice
   * already), so the treat leaving the HUD is now part of the check rather than assumed.
   */
  let threw = false;
  const ammoBefore = await page.evaluate(AMMO);
  if (stalking && ammoBefore > 0) {
    /*
     * **Two things this needs that it used to assume.**
     *
     * It clicked the cat's own centre — and the boss is pointer-transparent, so the click lands on
     * whatever is behind it, which on this board is usually a *claim*. A click on a claim throws
     * nothing in the wrong place. `throwSpot` returns the nearest point that belongs to nobody,
     * which keeps the intent ("the same throw at the same distance") and makes the throw legal.
     *
     * And §5.4 allows one treat on the board at a time, so a throw arriving while the counter section's
     * last treat is still out is silently refused. Waiting for the board to clear costs nothing and
     * removes the whole failure mode. Sweep 1 of 2.0's gate reported `5 in hand` and no throw; sweep 2
     * threw fine, which is the signature of a fixture rather than a bug.
     */
    await bounded(page, () => document.querySelector('[data-treat]')?.hasAttribute('hidden') !== false, 4000);
    const cat = await page.evaluate(() => {
      const r = document.querySelector('[data-boss]').getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    });
    const at = (await throwSpot(page, cat, { avoidClaims: true })) ?? cat;
    await page.mouse.click(at.x, at.y);
    threw = await bounded(page, () => !document.querySelector('[data-treat]').hasAttribute('hidden'), 1500);
    await page.waitForTimeout(THROW_ARC_MS + 500);
  }
  const after = (await readRec(page)).phases.slice(beforeControl);
  /*
   * **Three statements, not one.** Catching the cat stalking and getting a treat out are what this
   * check needs *before* it can measure anything, and folding them into the assertion meant a run that
   * never caught the cat stalking reported "a throw at a stalking cat swats it" — a sentence about the
   * build, on evidence about the harness.
   */
  fixture('caught the cat stalking, so the control throw has a target', stalking || null);
  fixture('and the control treat left the HUD', threw || null, `${ammoBefore} in hand`);
  if (stalking && threw) {
    ok(
      'a throw at a cat that is not recovering is a lure, not a counter (§3’s cost)',
      !after.some((p) => p.phase.includes('swatted')),
      `treat thrown, phases after it: ${after.map((p) => p.phase).join(' → ') || 'none'}`,
    );
  }
  await stopRec(page);
  ok('no console errors around the counter', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

/* ------------------------------------------------------------------ *
 * 5. The ambush pin — a hit is a place, not just a subtraction
 * ------------------------------------------------------------------ */
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await press(page);
  const isAmbushDeal = await stanceDeal(page, 'ambush');
  const isAmbush = !!isAmbushDeal.value;
  fixture('an ambush cat, the only stance that pins', isAmbushDeal);

  /*
   * Take a hit on purpose. Holding still on a claim inside the cat's reach is the one thing the
   * whole game is built to punish, so it is also the cheapest way to observe the punishment.
   */
  let hit = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 60_000 && !hit) {
    const spot = await nearClaim(page);
    if (!spot) {
      await page.waitForTimeout(300);
      continue;
    }
    await page.mouse.move(spot.x, spot.y);
    /*
     * **"Claims went up" is not "it hit me", and 1.3 is what made that proxy wrong.** The first
     * version of this waited for the count to rise and called it a landed pounce — but since 1.3
     * every stance has a regrow clock, so ambush grows the board on its own every 15000ms, and a
     * bait loop that runs for tens of seconds catches one of those about as often as a real hit.
     * A run that measured a *regrow* then found the cat 388px from the "landing" spot and reported
     * the pin broken, on a build where it holds at exactly 90px.
     *
     * So wait for the commitment first (`leap` — the cat is in the air), and only then for
     * ground to change hands **while it is recovering from that leap**. That pair is the hit's
     * actual signature in `land()`, and a regrow cannot forge it.
     */
    if (!(await bounded(page, () => document.querySelector('[data-boss]')?.dataset.phase === 'leap', 6000)))
      continue;
    const n = await page.evaluate(CLAIMS);
    const landed = await bounded(
      page,
      (was) =>
        document.querySelectorAll('.cat-tile[data-state="claimed"], .cat-tile[data-state="scrubbing"]').length > was &&
        document.querySelector('[data-boss]')?.dataset.phase === 'recover',
      1600,
      n,
    );
    if (landed) {
      hit = await page.evaluate(() => {
        const r = document.querySelector('[data-boss]').getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
      });
    }
  }
  ok('the cat lands one on us (the pin’s trigger)', !!hit, hit ? `landed at ${hit.x},${hit.y}` : 'never got hit in 60s');

  /*
   * Now run. The cursor goes to the far corner of the *board* — the strongest lure the card's
   * game has, since the boss stalks any pointer inside the board and never one outside it — and
   * the question is whether the cat *can* follow. Sampled in the page for the same reason as
   * everything else here: this is a 2600ms window.
   */
  let pinned = null;
  if (hit) {
    const away = await page.evaluate(
      ([hx, hy]) => {
        const b = document.querySelector('[data-board]').getBoundingClientRect();
        const corners = [
          { x: Math.round(b.left + 8), y: Math.round(b.top + 8) },
          { x: Math.round(b.right - 8), y: Math.round(b.top + 8) },
          { x: Math.round(b.left + 8), y: Math.round(b.bottom - 8) },
          { x: Math.round(b.right - 8), y: Math.round(b.bottom - 8) },
        ];
        corners.sort((a, z) => Math.hypot(z.x - hx, z.y - hy) - Math.hypot(a.x - hx, a.y - hy));
        return corners[0];
      },
      [hit.x, hit.y],
    );
    await page.mouse.move(away.x, away.y);
    pinned = await page.evaluate(
      async ([hx, hy, windowMs]) => {
        const cat = document.querySelector('[data-boss]');
        const t0 = performance.now();
        let inside = 0;
        let outside = 0;
        let maxIn = 0;
        let afterMax = 0;
        while (performance.now() - t0 < windowMs + 2500) {
          await new Promise((r) => setTimeout(r, 80));
          const r = cat.getBoundingClientRect();
          const d = Math.hypot(r.left + r.width / 2 - hx, r.top + r.height / 2 - hy);
          if (performance.now() - t0 < windowMs - 300) {
            inside++;
            maxIn = Math.max(maxIn, d);
          } else if (performance.now() - t0 > windowMs + 300) {
            outside++;
            afterMax = Math.max(afterMax, d);
          }
        }
        return { inside, outside, maxIn: Math.round(maxIn), afterMax: Math.round(afterMax) };
      },
      [hit.x, hit.y, AMBUSH_PIN_MS],
    );
    note(`during the pin the cat got ${pinned.maxIn}px from the spot; after it, ${pinned.afterMax}px`);
  }
  ok(
    'it stands over what it took, and the leash holds (§9.3’s pin)',
    !!pinned && pinned.inside > 5 && pinned.maxIn <= AMBUSH_PIN_PX + 20,
    pinned ? `furthest ${pinned.maxIn}px against a ${AMBUSH_PIN_PX.toFixed(0)}px leash over ${pinned.inside} samples` : 'not measured',
  );
  ok(
    'and then it lets go, so the pin is a delay rather than a wall',
    !!pinned && pinned.afterMax > pinned.maxIn,
    pinned ? `${pinned.afterMax}px once the window closed, against ${pinned.maxIn}px inside it` : 'not measured',
  );
  ok('no console errors around the pin', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

await browser.close();
if (!done()) process.exit(1);
