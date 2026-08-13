/**
 * §7.1's top state on the card game (2.2) — the cat sits on the cursor once you have
 * earned both proofs.
 *
 * The interesting checks here are not "does it happen". They are the two claims §7.1 and 0.6
 * make *about* it:
 *
 * 1. **It needs both paths.** Either ladder alone already pays out, so a state above both is
 *    only above them if neither alone can reach it. That is the easiest thing to get wrong and
 *    the hardest to notice, because a collar-only session looks fine until you realise the
 *    reward was never exclusive.
 * 2. **The reader pays nothing.** 0.6 deferred this as "worth building deliberately" because it
 *    changes ambient browsing on a portfolio somebody may be reading. On a mouse the cat is a
 *    live hit target so it can be petted; parked under the cursor that is a dead zone exactly
 *    where a click is about to land. So the perched cat must be inert to the pointer — its own
 *    half of the click-through promise, which survives the card.
 *
 * **2.2 conversion.** The subject of this file is the **ambient cat** (`#site-cat`), which the
 * card build leaves alone — it still walks at the bottom-left, wears the collar (`lv6`) when
 * every treat is found and the notch (`.notched`) after a fight is won. Only the fight-earning
 * half changed: the page-board arena is gone, so a win is now a **card fight**, played here with
 * arena8's proven flee-and-scrub (imports `CARD_SAFE_FLEE_PX` + `wants.stance` from
 * `./lib/fixture.mjs`, board-relative coords, `[data-board]`/`[data-boss]`/`.cat-tile[data-state="claimed"]`,
 * `#cat-card-toggle`/`#cat-card-panel`, and the rematch budget — §9.4's answer to a stall-loss).
 * The card's `finish('win')` adds `.notched` to `#site-cat` (CatCard.astro), so the notch check
 * is unchanged: read the class off the ambient cat.
 *
 * **Dropped as page-only (2.2's drop list).** The link-click-through family — scrolling a link
 * into the cat's band, `elementFromPoint` on the page, clicking and expecting a navigation — is
 * page scrolling, page DOM probing and link navigation, which the card never touches. And the
 * arena-era "opening a fight drops the perch" (§9's page arena set `html.cat-arena-on` and the
 * cat answered it) is gone with the arena: CatCard explicitly never touches the ambient cat, so
 * there is no designed perch-drop on card open to measure.
 *
 * Mirrors src/lib/cat-game.ts and src/components/SiteCat.astro:
 */
const PERCH_STILL_MS = 620;
const PERCH_SNAP_PX = 4;
const PERCH_BREAK_PX = 22;

import {
  BASE,
  CARD_SAFE_FLEE_PX,
  deal,
  fresh as context,
  launch,
  overFor,
  press as sharedPress,
  release as sharedRelease,
  report,
  wants,
} from './lib/fixture.mjs';

/*
 * Shared with the rest of the fleet through `lib/fixture.mjs` (§12.1's charter): the reporter with its
 * fixture/assertion split, the context factory that declares the mode, the launcher, and the waits
 * that open and close a fight. This file used to carry its own copy of each.
 */
const browser = await launch();
const { ok, note, fixture, done } = report();

/** Shared with the fleet; this file has always allowed 8000ms for the open. */
const press = (page) => sharedPress(page, { timeout: 8000 });
const release = (page) => sharedRelease(page, { timeout: 8000 });

/** A desktop context playing **manual mode** — the top state is reached by winning the card's fight. */
const fresh = (opts = {}) => context(browser, { mode: 'manual', ...opts });

const PERCHED = `document.getElementById('site-cat').classList.contains('perched')`;
const LEVEL = `[...document.getElementById('site-cat').classList].filter((c) => /^lv\\d$/.test(c)).pop() ?? ''`;
const NOTCHED = `document.getElementById('site-cat').classList.contains('notched')`;

/** Claims left on the card's board. */
const CLAIMS = `document.querySelectorAll('.cat-tile[data-state="claimed"]').length`;
/** What the card's ribbon currently says ('' when hidden/empty). */
const RIBBON = `document.querySelector('[data-ribbon]')?.textContent?.trim() ?? ''`;

/**
 * Somewhere inside the cat's notice band that is not a link.
 *
 * The band is the bottom `150 + level*14` px, and the cat only moves in x — so it can only sit
 * *on* a cursor that is already low. Reuses the site's own rule rather than a second one.
 */
async function lowSpot(page, x = 640) {
  return page.evaluate(
    (px) => {
      const y = Math.round(innerHeight - 70);
      return { x: px, y };
    },
    x,
  );
}

/** Collect every treat by walking the tab bar — the patient path to the collar. */
async function collectAll(page) {
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll('.tabbar a[href]')]
      .filter((a) => !a.closest('.tab-flyout') && a.offsetParent !== null)
      .map((a) => a.getAttribute('href')),
  );
  for (const href of hrefs) {
    await page.click(`.tabbar a[href="${href}"]`).catch(() => {});
    await page.waitForTimeout(700);
  }
  await page.click('a[href="/"]').catch(() => {});
  await page.waitForTimeout(900);
  return page.evaluate(LEVEL);
}

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

/** Play a card fight to a conclusion by fleeing, never spending. Returns a report. */
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

/**
 * Win a card fight — the confrontation path to the notch. **Retried, because a loss is a result.**
 *
 * Every fight this harness plays is treatless: the collar is earned before or after, never
 * during, so `ammo` is 0 for the whole thing. With no treats a single stalled exchange lets the
 * cat regrow to the whole board and the fight ends in a loss — the game behaving exactly as
 * §9.4's floor describes, so the retry is the honest response rather than a papered-over flake:
 * §9.4 makes the toggle itself the rematch, and pressing it again is what a player who just lost
 * actually does. Whether a treatless fight is *winnable* is arena8 section 4's question and it
 * answers yes; this file only needs a notch. After a win the card closes back to collapsed
 * (2.2 pillar 2), which is what the perch needs to measure the ambient page.
 */
async function winAFight(page, budgetMs = 150_000, tries = 4) {
  let last = null;
  let attemptsUsed = 0;
  for (let attempt = 0; attempt < tries && (!last || !last.won); attempt++) {
    attemptsUsed = attempt + 1;
    if (attempt > 0) {
      await release(page);
      await overFor(page, 9000);
    }
    await press(page);
    const stanceDeal = await leaper(page);
    const stance = stanceDeal.value;
    fixture('against a cat the flight strategy answers', stanceDeal, stance ?? '');
    last = await playByFleeing(page, budgetMs);
  }
  if (last?.won) await overFor(page, 9000);
  return { ...last, tries: attemptsUsed };
}

/** Rest the pointer at a low spot and report whether the cat comes and sits on it. */
async function tryPerch(page, x = 640, waitMs = 5000) {
  const spot = await lowSpot(page, x);
  await page.mouse.move(spot.x, spot.y);
  const perched = await page
    .waitForFunction(
      () => document.getElementById('site-cat').classList.contains('perched'),
      undefined,
      { timeout: waitMs },
    )
    .then(() => true)
    .catch(() => false);
  return { perched, spot };
}

// ---- 1. neither path alone earns it
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  const bare = await tryPerch(page, 640, 3000);
  ok('a fresh visitor gets no perch', !bare.perched);

  // Collar only: every treat, never a fight.
  const lv = await collectAll(page);
  ok('the patient path reaches the collar', lv === 'lv6', lv || '(none)');
  ok(
    'and the collar alone still gets no perch (§7.1)',
    !(await tryPerch(page, 700, 4000)).perched,
    `level ${lv}, notched ${await page.evaluate(NOTCHED)}`,
  );
  await ctx.close();
}

// ---- 2. notch only is not enough either
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  const fight = await winAFight(page);
  const notched = fight.won;
  ok(
    'the confrontation path reaches the notch — a card win',
    notched,
    `${fight.took} reclaimed, ${fight.stalls} stalls (${fight.why}), ${fight.left} left, ` +
      `${fight.seconds.toFixed(0)}s, on try ${fight.tries}`,
  );
  const lv = await page.evaluate(LEVEL);
  ok(
    'and the notch alone gets no perch (§7.1)',
    !(await tryPerch(page, 600, 4000)).perched,
    `notched ${notched}, level ${lv || '(none)'}`,
  );
  await ctx.close();
}

// ---- 3. both paths, and the perch is real
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  const f1 = await winAFight(page);
  const notched = f1.won;
  const lv = await collectAll(page);
  ok(
    'earned both, fight first',
    notched && lv === 'lv6',
    `notched ${notched} (${f1.took} reclaimed, ${f1.stalls} stalls, ${f1.seconds.toFixed(0)}s), ${lv}`,
  );

  const got = await tryPerch(page, 640, 6000);
  ok('the cat comes and sits on the cursor', got.perched);

  if (got.perched) {
    const gap = await page.evaluate(
      ([cx]) => {
        const r = document.getElementById('site-cat').getBoundingClientRect();
        return Math.abs(r.left + r.width / 2 - cx);
      },
      [got.spot.x],
    );
    ok(
      'on the cursor, not beside it',
      gap <= PERCH_BREAK_PX,
      `${gap.toFixed(1)}px off centre (snap ${PERCH_SNAP_PX}, hold ${PERCH_BREAK_PX}; the old chase stopped at 26)`,
    );

    /*
     * The reader-pays-nothing half that lives on the cat itself: while perched, `.cat-svg` is
     * `pointer-events: none`, so the perched cat is scenery rather than a dead zone under the
     * cursor. (The other half — clicking a link under it — is page behaviour and belongs to the
     * 2.2 drop list; the mechanism is this CSS.)
     */
    ok(
      'and the cat is inert to the pointer while perched',
      (await page.evaluate(
        `getComputedStyle(document.querySelector('#site-cat .cat-svg')).pointerEvents`,
      )) === 'none',
    );
  }

  ok('no console errors from the top state', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

// ---- 4. both paths the other way round, and it lets go
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  const lv = await collectAll(page);
  const f2 = await winAFight(page);
  const notched = f2.won;
  ok(
    'earned both, collecting first',
    notched && lv === 'lv6',
    `${lv}, notched ${notched} (${f2.took} reclaimed, ${f2.stalls} stalls, ${f2.seconds.toFixed(0)}s)`,
  );

  const got = await tryPerch(page, 560, 6000);
  ok('the order does not matter', got.perched);

  if (got.perched) {
    // The one thing a cat sitting on your cursor absolutely must do.
    await page.mouse.move(560 + PERCH_BREAK_PX * 4, got.spot.y);
    const released = await page
      .waitForFunction(
        () => !document.getElementById('site-cat').classList.contains('perched'),
        undefined,
        { timeout: 3000 },
      )
      .then(() => true)
      .catch(() => false);
    ok('moving the pointer gets the cat off it', released);

    const walked = await page.evaluate(async () => {
      const c = document.getElementById('site-cat');
      let last = c.getBoundingClientRect().left;
      let total = 0;
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 120));
        const x = c.getBoundingClientRect().left;
        total += Math.abs(x - last);
        last = x;
      }
      return total;
    });
    ok('and it goes back to wandering', walked > 20, `${walked.toFixed(0)}px over ~5s`);
  }
  await ctx.close();
}

// ---- 5. reduced motion never perches
{
  const ctx = await fresh({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await collectAll(page);
  // No fight is possible under reduced motion (§11), so force the notch the only honest way
  // available: assert the perch stays off even with the collar and a planted notch.
  await page.evaluate(() => document.getElementById('site-cat').classList.add('notched'));
  const got = await tryPerch(page, 640, 3500);
  ok('reduced motion never perches, even at the top state (§11)', !got.perched);
  await ctx.close();
}

await browser.close();
if (!done()) process.exit(1);
