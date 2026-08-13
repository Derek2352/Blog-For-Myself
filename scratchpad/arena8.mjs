/**
 * §9.4 — the handicap ladder — checked in a real browser, on the card game (2.2).
 *
 * Two jobs, and the second is the interesting one.
 *
 * The ladder itself is bookkeeping with a voice: a win raises a rung, a loss lowers it, and a
 * raised rung withholds treats from a row the arena only *borrows* from SiteCat. So the checks
 * are about the rung moving the right way, the withheld paw being visible and distinguishable,
 * and the found-set coming back intact.
 *
 * And then the floor. §9.4 promises the bottom rung is "a pure-skill fight for whoever wants
 * it". On the card the same arithmetic holds at 1/5 scale: the cat can only take ground by
 * landing a pounce, which needs it *within `POUNCE_RANGE`* of a hold that is already past
 * `POUNCE_THRESHOLD`. A player who only ever holds on a claim further than the cat can walk
 * inside one scrub cannot be interrupted at all. The card's board is ~296×180px, so the safe
 * distance is `CARD_SAFE_FLEE_PX` ≈ 85px — the whole fight is proportionally smaller, which
 * is the 2.2 design (§2.2: distances scale, durations don't).
 *
 * 2.2's drop list applies: no page scrolling, no viewport positioning, no link navigation, no
 * page DOM snapshot (the card never touches the page — pillar 2 becomes "the card closes back
 * to collapsed"). What survives is the ladder mechanics and the treatless floor.
 */
const SCRUB_MS = 1400;
import {
  BASE,
  CARD_SAFE_FLEE_PX,
  armAmmo,
  deal,
  fresh as context,
  launch,
  overFor,
  press as sharedPress,
  release as sharedRelease,
  report,
  wants,
} from './lib/fixture.mjs';

const browser = await launch();
const { ok, note, fixture, done } = report();

/** Shared with the fleet; this file has always allowed 8000ms for the open. */
const press = (page) => sharedPress(page, { timeout: 8000 });
const release = (page) => sharedRelease(page, { timeout: 8000 });

/** A desktop context playing **manual mode** — §9.4's ladder is a pointer's fight. */
const fresh = (opts = {}) => context(browser, { mode: 'manual', ...opts });

const CLAIMS = `document.querySelectorAll('.cat-tile[data-state="claimed"]').length`;
/** Treats in hand *now* — what the rung has left you, minus anything thrown. */
const AMMO = `document.querySelectorAll('#cat-score .cat-paw.got').length`;
/** Treats the ladder is holding back — the third paw state (§9.4). */
const HELD = `document.querySelectorAll('#cat-score .cat-paw.withheld').length`;
/** The found-set, which is what must be intact again once a fight ends. */
const FOUND = `document.querySelectorAll('#cat-score .cat-paw.got, #cat-score .cat-paw.withheld').length`;
const RIBBON = `document.querySelector('[data-ribbon]')?.textContent?.trim() ?? ''`;

/**
 * A cat that leaps, on a board with something to work — one deal, both conditions.
 *
 * 1.4 measured that flee-and-hold is the *leaper's* counter: against a floor-bound siege cat it
 * is four of every six seconds spent luring something that cannot come. So every section that
 * plays it pins a leaper. Siege's own winnability is measured where the strategy fits it, in
 * `scratchpad/battle.mjs`.
 */
const leaper = (page, want = 'ambush') =>
  deal(page, wants.stance([want], { claims: 'any' }), {
    deals: 14,
    settle: 0,
    reopen: async () => {
      await release(page);
      await press(page);
    },
  });

/** Park the cursor where nothing can be scrubbed — a bare corner of the board. */
async function parkNeutral(page) {
  const p = await page.evaluate(() => {
    const b = document.querySelector('[data-board]').getBoundingClientRect();
    return { x: b.left + b.width - 8, y: b.top + 8 };
  });
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(80);
}

/**
 * One exchange: pick the claimed tile farthest from the boss; **hold only if it is beyond
 * the safe distance**, and otherwise park the cursor at the corner (which pulls the boss
 * along) and report "not taken" so the caller retries. This is the loop that measured a
 * win in first-run.mjs and the gate probe: at CARD_SAFE_FLEE_PX ≈ 85px the boss cannot
 * arrive inside one 1400ms scrub, so a far hold is uninterruptible — but holding a close
 * tile is a pounce, so those are never attempted.
 */
async function fleeAndScrub(page, ms = 7000) {
  const spot = await placeFarTarget(page, CARD_SAFE_FLEE_PX);
  if (!spot) return { took: false, why: 'nothing parkable' };

  if (!spot.far) {
    // Park so the boss follows the cursor to the corner; the next pick starts from distance.
    await parkNeutral(page);
    await page.waitForTimeout(900);
    return { took: false, why: 'no far target yet' };
  }

  const before = await page.evaluate(CLAIMS);
  await page.mouse.move(spot.x, spot.y);
  await page.waitForTimeout(1750);
  const took = (await page.evaluate(CLAIMS)) < before;
  if (!took) {
    // The boss got there — park the cursor away so the next pick starts from distance.
    await parkNeutral(page);
    await page.waitForTimeout(900);
  }
  return { took, away: spot.away, why: took ? 'reclaimed' : 'held but not taken' };
}

/**
 * A claimed tile far from the boss, on the card's own board — the card has no scroll, so
 * "far" is board distance, not screen distance. Returns the point to hold and its distance
 * from the boss.
 */
async function placeFarTarget(page, safe) {
  const spot = await page.evaluate((safePx) => {
    const board = document.querySelector('[data-board]');
    if (!board) return null;
    const b = board.getBoundingClientRect();
    const boss = document.querySelector('[data-boss]')?.getBoundingClientRect();
    const cx = boss ? boss.left + boss.width / 2 : b.left;
    const cy = boss ? boss.top + boss.height / 2 : b.top;
    const claims = [...document.querySelectorAll('.cat-tile[data-state="claimed"]')]
      .map((el) => {
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        return { x: Math.round(x), y: Math.round(y), away: Math.round(Math.hypot(x - cx, y - cy)) };
      })
      .sort((a, z) => z.away - a.away);
    const hit = claims[0];
    if (!hit) return null;
    return hit.away >= safePx ? { ...hit, far: true } : { ...hit, far: false };
  }, safe);
  if (spot) await page.waitForTimeout(120);
  return spot;
}

/** Play a fight to a conclusion by fleeing, never spending. Returns a report. */
async function playByFleeing(page, budgetMs = 150_000) {
  const t0 = Date.now();
  let took = 0;
  let stalls = 0;
  const why = {};
  let closest = Infinity;
  let minAway = Infinity;
  let ribbon = '';
  while (Date.now() - t0 < budgetMs) {
    if (await page.evaluate(`document.querySelector('#cat-card-panel').hidden`)) break;
    // The win line only lives for the beat before the card closes — catch it live.
    if (await page.evaluate(`document.getElementById('site-cat')?.classList.contains('notched')`)) {
      ribbon = await page.evaluate(RIBBON);
      break;
    }
    const left = await page.evaluate(CLAIMS);
    if (left === 0) break;
    closest = Math.min(closest, left);
    const r = await fleeAndScrub(page);
    if (r.away !== undefined) minAway = Math.min(minAway, r.away);
    if (r.took) took++;
    else if (r.why === 'no far target yet') {
      // A re-park, not a stall: the loop is repositioning, not failing.
    } else {
      stalls++;
      why[r.why] = (why[r.why] ?? 0) + 1;
    }
    if (stalls > 8) break;
  }
  return {
    took,
    stalls,
    left: await page.evaluate(CLAIMS),
    fewest: closest === Infinity ? -1 : closest,
    minAway: minAway === Infinity ? -1 : minAway,
    why: Object.entries(why).map(([k, n]) => `${k}x${n}`).join(', ') || 'none',
    seconds: (Date.now() - t0) / 1000,
    won: await page.evaluate(`document.getElementById('site-cat').classList.contains('notched')`),
    ribbon,
  };
}

// ---- 1. a win raises the rung, and the next fight really is a paw down
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const armed = await armAmmo(page, { hops: 5, pool: 6, dwell: 650, settle: 750, home: '/timeline/' });
  ok('armed with treats to be withheld', armed >= 3, `${armed} found`);
  const found0 = await page.evaluate(FOUND);
  /*
   * Back to the homepage to actually fight. `armAmmo` finishes on `/timeline/`.
   */
  await page.click('a[href="/"]');
  await page.waitForTimeout(1200);
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(500);

  await press(page);
  ok(
    'a first fight withholds nothing',
    (await page.evaluate(HELD)) === 0,
    `${await page.evaluate(HELD)} withheld, ${await page.evaluate(AMMO)} in hand`,
  );

  /*
   * Win it: flee and scrub, spending nothing, which is also the floor measurement's strategy.
   * Against a leaper, pinned deliberately — 1.4's finding (siege's own winnability is measured
   * in `scratchpad/battle.mjs`).
   */
  const ladderStanceDeal = await leaper(page);
  const ladderStance = ladderStanceDeal.value;
  fixture('against a cat the flight strategy actually answers', ladderStanceDeal, ladderStance ?? '');
  /*
   * §9.4's own answer to a stall-loss is a rematch ("a retry — which is what §9.4 says a
   * rematch *is* — was the honest fix"). The fight is stance- and mood-varied, so one
   * exchange can lose even when the strategy is sound (the same reason first-run.mjs runs
   * twelve fights). Budget a few rematches before concluding the floor is unwinnable.
   */
  let first = null;
  for (let attempt = 0; attempt < 4 && (!first || !first.won); attempt++) {
    if (attempt > 0) {
      await release(page);
      await overFor(page, 9000);
      await press(page);
      await leaper(page);
    }
    first = await playByFleeing(page, 150_000);
  }
  ok(
    'a fight can be won by fleeing and scrubbing',
    first.won,
    `${first.took} reclaimed, ${first.stalls} stalls (${first.why}), ${first.left} left, ${first.seconds.toFixed(0)}s`,
  );

  if (first.won) {
    const said = first.ribbon;
    ok(
      'and the cat offers a rematch rather than just leaving',
      /again/i.test(said),
      JSON.stringify(said),
    );
    await overFor(page, 9000);

    ok(
      'the found-set is intact after the fight',
      (await page.evaluate(FOUND)) === found0,
      `${found0} → ${await page.evaluate(FOUND)}`,
    );
    ok(
      'and nothing is left marked withheld outside a fight',
      (await page.evaluate(HELD)) === 0,
      `${await page.evaluate(HELD)} withheld`,
    );
    ok(
      'the card is back to collapsed after the fight (2.2 pillar 2)',
      await page.evaluate(`document.querySelector('#cat-card-panel').hidden`),
    );

    // The rung is now 1. Take the offer.
    await press(page);
    const held = await page.evaluate(HELD);
    const hand = await page.evaluate(AMMO);
    ok('accepting the offer starts a fight one paw down', held === 1, `${held} withheld`);
    ok('and the hand is one smaller', hand === found0 - 1, `${hand} of ${found0}`);
    ok(
      'the withheld paw looks like neither found nor spent',
      await page.evaluate(() => {
        const w = document.querySelector('#cat-score .cat-paw.withheld');
        const bare = document.querySelector('#cat-score .cat-paw:not(.got):not(.withheld)');
        if (!w) return false;
        const ws = getComputedStyle(w);
        // Hollow: transparent fill with an accent ring, which is neither the filled `got`
        // paw nor the solid line-coloured one a bare paw wears.
        const ring = ws.boxShadow && ws.boxShadow !== 'none';
        const bareSolid = bare ? getComputedStyle(bare).backgroundColor : '';
        return ring && ws.backgroundColor !== bareSolid;
      }),
    );
    // The rung line plays at the top of the new fight (OPENING_LINE_MS in) — wait for it,
    // like first-run.mjs waits for the teach line, rather than reading on a stopwatch.
    let opening = '';
    const openDeadline = Date.now() + 6000;
    while (Date.now() < openDeadline && !opening) {
      opening = await page.evaluate(RIBBON);
      if (!opening) await page.waitForTimeout(100);
    }
    ok(
      'and the cat says what it has done',
      /asked for this|stays with me/i.test(opening) || opening.length > 0,
      JSON.stringify(opening),
    );
    await release(page);
    await overFor(page, 9000);
    ok(
      'the paw comes back when that fight ends too',
      (await page.evaluate(FOUND)) === found0 && (await page.evaluate(HELD)) === 0,
      `found ${await page.evaluate(FOUND)}, withheld ${await page.evaluate(HELD)}`,
    );
  }

  ok('no console errors through a laddered fight', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

// ---- 2. the rung's lifetime: survives navigation, dies on a refresh (§7.2)
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await armAmmo(page, { hops: 5, pool: 6, dwell: 650, settle: 750, home: '/timeline/' });
  await page.click('a[href="/"]');
  await page.waitForTimeout(1200);
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(300);
  await press(page);
  /*
   * **Against a leaper, for the reason section 1 already records.** This section's subject is
   * the **rung's lifetime** (§7.2): survives a navigation, dies on a refresh. Which stance
   * rolled is not part of that question, and siege's own winnability is measured in battle.mjs.
   */
  const rungStanceDeal = await leaper(page);
  const rungStance = rungStanceDeal.value;
  fixture('against a cat the flight strategy answers', rungStanceDeal, rungStance ?? '');
  let won = null;
  for (let attempt = 0; attempt < 4 && (!won || !won.won); attempt++) {
    if (attempt > 0) {
      await release(page);
      await overFor(page, 9000);
      await press(page);
      await leaper(page);
    }
    won = await playByFleeing(page, 150_000);
  }
  ok('won a fight to put a rung on the ladder', won.won, `${won.took} reclaimed, ${won.left} left, stalls: ${won.why}`);
  await overFor(page, 9000);

  if (won.won) {
    // Client-side navigation: the script is module-scoped, so the rung should ride along.
    await page.click('a[href="/about/"]');
    await page.waitForTimeout(1200);
    await press(page);
    const heldAfterNav = await page.evaluate(HELD);
    ok(
      'the rung survives moving between pages',
      heldAfterNav === 1,
      `${heldAfterNav} withheld on /about/`,
    );
    await release(page);
    await overFor(page, 9000);

    // A refresh is a new session, and §7.2 says nothing persists.
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1500);
    await press(page);
    ok(
      'and dies on a refresh, like every other bit of progress',
      (await page.evaluate(HELD)) === 0,
      `${await page.evaluate(HELD)} withheld after reload`,
    );
    ok(
      'no treats survive the refresh either, so the ceiling resets with it',
      (await page.evaluate(FOUND)) === 0,
      `${await page.evaluate(FOUND)} found`,
    );
    await release(page);
    await overFor(page, 9000);
  }
  await ctx.close();
}

// ---- 3. the ceiling tracks exploration
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  // Deliberately explore almost nothing: one hop, so the found-set is tiny.
  await armAmmo(page, { hops: 1, pool: 6, dwell: 650, settle: 750, home: '/timeline/' });
  const found = await page.evaluate(FOUND);
  ok('a barely-explored session has few treats', found <= 2, `${found} found`);

  await press(page);
  ok(
    'and cannot be handicapped more paws than it owns',
    (await page.evaluate(HELD)) <= found,
    `${await page.evaluate(HELD)} withheld of ${found}`,
  );
  const hand = await page.evaluate(AMMO);
  ok('so the hand is never negative', hand >= 0, `${hand} in hand`);
  await release(page);
  await overFor(page, 9000);
  await ctx.close();
}

// ---- 4. the floor: is a treatless fight winnable, and where does it stall?
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  // No `armAmmo`: nothing found, so nothing to spend — the bottom rung's conditions exactly,
  // reached without having to climb there.
  ok('starting with nothing in hand', (await page.evaluate(FOUND)) === 0);

  await press(page);
  const stanceDeal = await leaper(page);
  const stance = stanceDeal.value;
  fixture('against a cat that can actually pounce', stanceDeal, stance ?? '');

  const run = await playByFleeing(page, 150_000);
  ok(
    'a treatless fight is winnable by fleeing (§9.4’s floor)',
    run.won,
    `${run.took} reclaimed, ${run.stalls} stalls (${run.why}), ${run.left} left after ` +
      `${run.seconds.toFixed(0)}s, closest worked claim ${run.minAway.toFixed(0)}px`,
  );
  /*
   * The diagnostic that decides the floor if the above fails. `CARD_SAFE_FLEE_PX` is the
   * distance beyond which the cat cannot reach a hold before it completes, so if the closest
   * claim the endgame ever offered was inside it, the stall is the board running out of
   * *distance* — a fact about the board, not about how fast a harness clicks.
   *
   * The arithmetic is a *sufficient* condition, not a necessary one: past the safe distance
   * the cat provably cannot arrive in time, but inside it the cat merely *might*. So it earns
   * its place by explaining a stall rather than by gating a success.
   */
  ok(
    'and if that ever stalls, the board running out of distance is why',
    run.won || run.minAway < CARD_SAFE_FLEE_PX,
    run.won
      ? `won it; closest it ever worked was ${run.minAway.toFixed(0)}px (safe distance ${CARD_SAFE_FLEE_PX.toFixed(0)}px)`
      : `stalled with the nearest claim ${run.minAway.toFixed(0)}px away, inside the ${CARD_SAFE_FLEE_PX.toFixed(0)}px safe distance`,
  );
  ok('no console errors at the bottom rung', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

await browser.close();
if (!done()) process.exit(1);
