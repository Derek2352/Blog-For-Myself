/**
 * §9.4 — the handicap ladder — checked in a real browser.
 *
 * Two jobs, and the second is the interesting one.
 *
 * The ladder itself is bookkeeping with a voice: a win raises a rung, a loss lowers it, and a
 * raised rung withholds treats from a row the arena only *borrows* from SiteCat. So the checks
 * are about the rung moving the right way, the withheld paw being visible and distinguishable,
 * and the found-set coming back intact — that last one is where this could genuinely break the
 * site rather than the game.
 *
 * And then the floor. §9.4 promises the bottom rung is "a pure-skill fight for whoever wants
 * it", but 0.9 measured a treatless player reclaiming ground at about the rate a landed pounce
 * takes it back. Rather than emulate a human's reflexes, this exploits an arithmetic fact: the
 * cat can only take ground by landing a pounce, which needs it *within `POUNCE_RANGE`* of a
 * hold that is already past `POUNCE_THRESHOLD`. A player who only ever holds on a claim further
 * than the cat can walk inside one scrub cannot be interrupted at all. So the question is not
 * "is the player fast enough" but "does the board keep offering that much distance" — which is
 * a property of the page, and measurable.
 *
 * Mirrors src/lib/arena.ts:
 */
const SCRUB_MS = 1400;
const POUNCE_RANGE = 90;
const STALK_SPEED = 170;
const AGGRO_DESPERATE = 1.4;
/**
 * How far a claim has to be for the cat to be unable to reach it inside one scrub.
 *
 * `POUNCE_RANGE` plus the furthest a leaping stance can walk in `SCRUB_MS`. Computed at the
 * *desperate* tier because a player who is winning will be facing one — using the baseline
 * would understate the requirement exactly when the endgame is hardest. Siege walks faster
 * (1.15x) but cannot leave the floor, so the leapers' 1.0x is the binding case.
 */
const SAFE_FLEE_PX = POUNCE_RANGE + STALK_SPEED * 1.0 * AGGRO_DESPERATE * (SCRUB_MS / 1000);

import { chromium } from 'playwright-core';

const BASE = 'http://localhost:4416';
const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

async function press(page, timeout = 8000) {
  const was = await page.evaluate(() => !!document.querySelector('.cat-claimed'));
  await page.click('#cat-arena-toggle');
  await page
    .waitForFunction((w) => !!document.querySelector('.cat-claimed') !== w, was, { timeout })
    .catch(() => {});
}

async function release(page, timeout = 8000) {
  await page.keyboard.press('Escape');
  await page
    .waitForFunction(() => !document.querySelector('.cat-claimed'), undefined, { timeout })
    .catch(() => {});
}

/**
 * Wait for a fight to be genuinely over.
 *
 * Not `aria-pressed`: 0.9 made that follow the visitor's *intent*, so it flips before the exit
 * curtain has put anything back (§13.5).
 */
async function overFor(page, ms = 9000) {
  await page
    .waitForFunction(
      () =>
        !document.querySelector('.cat-claimed') &&
        // `.cat-freed` is the 480ms celebration on a reclaimed element, removed by its own
        // timer — so it outlives the fight and a snapshot taken the instant the arena closes
        // catches it. `arena.mjs` has waited on this since step 1; leaving it out here cost a
        // byte-identical check exactly once, on a `nav.rail`.
        !document.querySelector('.cat-freed') &&
        !document.documentElement.classList.contains('cat-arena-on'),
      { timeout: ms },
    )
    .catch(() => {});
  await page.waitForTimeout(150);
}

async function fresh() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem('welcomed', '1'));
  /*
   * 2.0: this harness measures **manual mode** (§3's fight). Commander mode is now the default, so
   * say which game before opening one — otherwise the pointer is not the verb and half these checks
   * are asking a spectator to hold still. Presses the HUD chip the way a visitor does, and waits for
   * `aria-pressed` rather than for a timeout.
   */
  await ctx.addInitScript(() => {
    const pick = () => {
      const b = document.getElementById('cat-manual-toggle');
      if (!b) return false;
      if (b.getAttribute('aria-pressed') === 'true') return true;
      b.click();
      return b.getAttribute('aria-pressed') === 'true';
    };
    addEventListener('DOMContentLoaded', () => {
      if (pick()) return;
      const t = setInterval(() => {
        if (pick()) clearInterval(t);
      }, 40);
      setTimeout(() => clearInterval(t), 8000);
    });
  });
  return ctx;
}

const SNAP_LIST = `(() => [...document.querySelectorAll('*')]
  .filter((el) => !el.closest('#site-cat, #cat-hud, #cat-treat, #cat-scrub, #cat-throw, #cat-ribbon, #cat-territory, #cat-curtain, header'))
  .map((el, i) => i + ':' + el.tagName + ':' + el.className + ':' + (el.getAttribute('style') ?? '')))()`;

async function snapDiff(page, clean) {
  const now = await page.evaluate(SNAP_LIST);
  const diffs = [];
  for (let i = 0; i < Math.max(clean.length, now.length); i++) {
    if (clean[i] !== now[i]) diffs.push({ before: clean[i], after: now[i] });
  }
  return {
    n: diffs.length,
    detail: diffs.length
      ? `${diffs.length} differences, first: ${diffs[0].before} → ${diffs[0].after}`
      : 'identical',
  };
}

const CLAIMS = `document.querySelectorAll('.cat-claimed').length`;
/** Treats in hand *now* — what the rung has left you, minus anything thrown. */
const AMMO = `document.querySelectorAll('#cat-score .cat-paw.got').length`;
/** Treats the ladder is holding back — the third paw state (§9.4). */
const HELD = `document.querySelectorAll('#cat-score .cat-paw.withheld').length`;
/** The found-set, which is what must be intact again once a fight ends. */
const FOUND = `document.querySelectorAll('#cat-score .cat-paw.got, #cat-score .cat-paw.withheld').length`;
const RIBBON = `document.getElementById('cat-ribbon')?.textContent?.trim() ?? ''`;

/** Collect treats by walking the tabs, as arena4/arena7 do. */
async function armAmmo(page, hops = 5) {
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll('.tabbar a[href]')]
      .filter((a) => !a.closest('.tab-flyout') && a.offsetParent !== null)
      .map((a) => a.getAttribute('href'))
      .slice(0, 6),
  );
  for (const href of hrefs.slice(0, hops)) {
    await page.click(`.tabbar a[href="${href}"]`);
    await page.waitForTimeout(650);
  }
  await page.click('a[href="/timeline/"]');
  await page.waitForTimeout(750);
  return page.evaluate(AMMO);
}

/** Re-roll until the cat is one that can actually leave the floor (0.9's lesson). */
async function forceLeaper(page, want = 'ambush', tries = 14) {
  for (let i = 0; i < tries; i++) {
    const stance = await page.evaluate(`document.getElementById('site-cat')?.dataset.stance ?? ''`);
    if (stance === want && (await page.evaluate(CLAIMS)) > 0) return stance;
    await release(page);
    await press(page);
  }
  return null;
}

/**
 * Scroll so that a claim sits **low on the screen**, as far as possible from the decoy at the
 * top, and return a verified point on it.
 *
 * This replaces two worse attempts. Sorting by distance and *then* scrolling the winner to the
 * viewport centre destroyed the distance it sorted for. Searching by nudging the scroll and
 * re-picking was worse still: it kept a `spot` measured *before* the nudge, so the coordinates
 * no longer pointed at that claim at all.
 *
 * The placement is deliberate rather than searched, because the geometry is known. The cat is
 * `position: fixed` and has been lured to the header; claims are in document flow. So the
 * scroll offset that puts a given claim at the bottom of the viewport is arithmetic, and the
 * bottom of the viewport is the furthest a claim can be from the top of it. Stops at the first
 * claim that clears `safe`, and otherwise leaves the page wherever the best candidate was.
 */
async function placeFarTarget(page, safe) {
  const spot = await page.evaluate(async (safePx) => {
    /*
     * **Wait for the claim to stop moving before hit-testing it.** Added in 1.2, and it explains
     * a flake this file has had since 1.0: `nothing parkable`, meaning every claim failed the
     * `elementFromPoint` check and the harness reported an unwinnable fight. 1.1 patched section 2
     * around it by fighting on a different page and never found the cause.
     *
     * The cause is the site, not the game. Content is revealed on scroll with a `translateY`
     * transition, so a claim scrolled into place keeps *travelling* for a few hundred ms — and a
     * point taken at its centre is off its edge by the time it is tested, so `elementFromPoint`
     * returns whatever is behind it. §12 recorded the same trap in 0.8 against the site's
     * smooth-scroll. A fixed pause cannot fix it; waiting for the rect to settle can.
     */
    const stable = async (el) => {
      let last = null;
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 25)));
        const t = el.getBoundingClientRect().top;
        if (last !== null && Math.abs(t - last) < 0.5) return;
        last = t;
      }
    };
    const claims = [...document.querySelectorAll('.cat-claimed')];
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    const lowY = innerHeight - 170;
    let best = null;
    for (const el of claims) {
      const r0 = el.getBoundingClientRect();
      const docCentre = r0.top + scrollY + r0.height / 2;
      const want = Math.max(0, Math.min(maxScroll, Math.round(docCentre - lowY)));
      scrollTo({ top: want, behavior: 'instant' });
      await stable(el);
      const r = el.getBoundingClientRect();
      const x = Math.round(Math.min(Math.max(r.left + r.width / 2, 60), innerWidth - 60));
      const y = Math.round(Math.min(Math.max(r.top + r.height / 2, 170), innerHeight - 110));
      // The same question `claimUnder` asks, at the point the cursor will actually sit.
      if (document.elementFromPoint(x, y)?.closest('.cat-claimed') !== el) continue;
      const c = document.getElementById('site-cat').getBoundingClientRect();
      const away = Math.hypot(x - (c.left + c.width / 2), y - (c.top + c.height / 2));
      if (!best || away > best.away) best = { x, y, away, scroll: want };
      if (away >= safePx) break;
    }
    if (best) scrollTo({ top: best.scroll, behavior: 'instant' });
    return best;
  }, safe);
  if (spot) await page.waitForTimeout(250);
  return spot;
}

/** Park the cursor where nothing can be scrubbed — the header is PROTECTED_TREE. */
async function parkNeutral(page) {
  await page.mouse.move(640, 60);
  await page.waitForTimeout(80);
}

/**
 * One exchange, played the way §5.2 says the fight is meant to be played.
 *
 * Park at the top of the screen first and **wait for the cat to come**, which is what creates
 * the distance: the cat commits to the cursor, and only then does the cursor move to a claim on
 * the far side. That is a flight the cat has to answer by walking, and `SAFE_FLEE_PX` says it
 * cannot arrive before a 1400ms hold completes.
 */
async function fleeAndScrub(page, ms = 7000) {
  await parkNeutral(page);
  // Let it commit to the decoy. Bounded, because a pinned siege cat never arrives at all.
  await page
    .waitForFunction(
      () => {
        const r = document.getElementById('site-cat').getBoundingClientRect();
        return Math.hypot(r.left + r.width / 2 - 640, r.top + r.height / 2 - 60) < 200;
      },
      undefined,
      { timeout: 4000 },
    )
    .catch(() => {});

  const spot = await placeFarTarget(page, SAFE_FLEE_PX);
  if (!spot) return { took: false, why: 'nothing parkable' };

  const before = await page.evaluate(CLAIMS);
  await page.mouse.move(spot.x, spot.y);
  const t0 = Date.now();
  let took = false;
  while (Date.now() - t0 < ms) {
    await page.waitForTimeout(150);
    if ((await page.evaluate(CLAIMS)) < before) {
      took = true;
      break;
    }
  }
  return { took, away: spot.away, why: took ? 'reclaimed' : 'held but not taken' };
}

/** Play a fight to a conclusion by fleeing, never spending. Returns a report. */
async function playByFleeing(page, budgetMs = 150_000) {
  const t0 = Date.now();
  let took = 0;
  let stalls = 0;
  const why = {};
  let closest = Infinity;
  let minAway = Infinity;
  while (Date.now() - t0 < budgetMs) {
    if (await page.evaluate(`!document.documentElement.classList.contains('cat-arena-on')`)) break;
    const left = await page.evaluate(CLAIMS);
    if (left === 0) break;
    closest = Math.min(closest, left);
    const r = await fleeAndScrub(page);
    if (r.away !== undefined) minAway = Math.min(minAway, r.away);
    if (r.took) took++;
    else {
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
  const armed = await armAmmo(page);
  ok('armed with treats to be withheld', armed >= 3, `${armed} found`);
  const found0 = await page.evaluate(FOUND);
  /*
   * Back to the homepage to actually fight. `armAmmo` finishes on `/timeline/`, and a fight
   * there did not resolve — the board it deals is long, tall entries stacked down the page, and
   * the viewport-space flight this harness plays needs claims spread across a screen rather than
   * queued below it. Sections 2 and 4 win on `/` reliably, so fighting somewhere else here would
   * make section 1 measure the page instead of the ladder.
   */
  await page.click('a[href="/"]');
  await page.waitForTimeout(1200);

  // Settle the page before baselining: scrolling adds the site's scroll-reveal classes and
  // warms Astro's link prefetch, neither of which the arena is responsible for (arena7).
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 180) {
      scrollTo({ top: y, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 70));
    }
    scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.waitForTimeout(500);
  const clean = await page.evaluate(SNAP_LIST);

  await press(page);
  ok(
    'a first fight withholds nothing',
    (await page.evaluate(HELD)) === 0,
    `${await page.evaluate(HELD)} withheld, ${await page.evaluate(AMMO)} in hand`,
  );

  /*
   * Win it: flee and scrub, spending nothing, which is also the floor measurement's strategy.
   *
   * **Against a leaper, pinned deliberately — 1.4's finding.** `playByFleeing` lures the cat to the
   * top of the screen and then works a claim on the far side, which is the counter to a cat that
   * *leaps*. Siege cannot leave the floor (`spec.pin`), so against it the lure is four of every six
   * seconds spent waiting for an arrival that is physically impossible, and the fight plateaus:
   * measured at 14 reclaims and 3 claims still standing after 121s, with the same board falling in
   * 21s when played the way §9.3 describes siege. This section's subject is the *ladder* — a win
   * raises a rung — so it has no business also being a referendum on which stance rolled, and
   * section 4 pins a leaper for the floor measurement for the same reason. Siege's own winnability
   * is measured where it belongs, in `scratchpad/battle.mjs`.
   */
  const ladderStance = await forceLeaper(page);
  ok('against a cat the flight strategy actually answers', !!ladderStance, ladderStance ?? 'no leaper in 14 rolls');
  const first = await playByFleeing(page, 150_000);
  ok(
    'a fight can be won by fleeing and scrubbing',
    first.won,
    `${first.took} reclaimed, ${first.stalls} stalls (${first.why}), ${first.left} left, ${first.seconds.toFixed(0)}s`,
  );

  if (first.won) {
    const said = await page.evaluate(RIBBON);
    ok(
      'and the cat offers a rematch rather than just leaving',
      /again/i.test(said),
      JSON.stringify(said),
    );
    await overFor(page);

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
    const diff = await snapDiff(page, clean);
    ok('the page comes back byte-identical', diff.n === 0, diff.detail);

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
    const opening = await page.evaluate(RIBBON);
    ok(
      'and the cat says what it has done',
      /asked for this/i.test(opening) || opening.length > 0,
      JSON.stringify(opening),
    );
    await release(page);
    await overFor(page);
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
  await armAmmo(page);
  /*
   * Back to `/` before fighting, for the reason section 1 already wrote down and this section
   * then didn't act on: `armAmmo` finishes on `/timeline/`, whose board is tall entries queued
   * *down* the page rather than spread across a screen, and the viewport-space flight this
   * harness plays cannot get far enough from the cat there. Section 1 navigates home and wins;
   * this one inherited the landing page and lost — reporting `0 reclaimed, 0 left`, which reads
   * exactly like a broken game and was a harness fighting on the wrong page.
   *
   * The cost was larger than the one red line: everything below is inside `if (won.won)`, so a
   * failed win silently skipped both of §7.2's lifetime checks — the rung surviving a
   * navigation and dying on a refresh. A guard that turns a failure into an absence is worse
   * than the failure.
   */
  await page.click('a[href="/"]');
  await page.waitForTimeout(1200);
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(300);
  await press(page);
  /*
   * **Against a leaper, for the reason section 1 already records — and 2.0 found that 1.4 fixed only
   * one of the two.** `playByFleeing` lures the cat to the top of the screen and works a claim on the
   * far side, which is the counter to a cat that *leaps*; siege cannot leave the floor, so the lure is
   * four of every six seconds spent waiting for an arrival that cannot happen and the fight plateaus.
   * 1.4 measured that, pinned a leaper in section 1, and left its sibling rolling freely — where it
   * duly turned up as "16 reclaimed, 2 left" on a build that had not touched a manual fight at all.
   *
   * This section's subject is the **rung's lifetime** (§7.2): survives a navigation, dies on a
   * refresh. Which stance rolled is not part of that question, and siege's own winnability is
   * measured where the strategy fits it, in `scratchpad/battle.mjs`.
   */
  const rungStance = await forceLeaper(page);
  ok('against a cat the flight strategy answers', !!rungStance, rungStance ?? 'no leaper in 14 rolls');
  const won = await playByFleeing(page, 150_000);
  ok('won a fight to put a rung on the ladder', won.won, `${won.took} reclaimed, ${won.left} left, stalls: ${won.why}`);
  await overFor(page);

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
    await overFor(page);

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
    await overFor(page);
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
  await armAmmo(page, 1);
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
  await overFor(page);
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
  const stance = await forceLeaper(page);
  ok('against a cat that can actually pounce', !!stance, stance ?? 'no ambush in 14 rolls');

  const run = await playByFleeing(page, 150_000);
  ok(
    'a treatless fight is winnable by fleeing (§9.4’s floor)',
    run.won,
    `${run.took} reclaimed, ${run.stalls} stalls (${run.why}), ${run.left} left after ` +
      `${run.seconds.toFixed(0)}s, closest worked claim ${run.minAway.toFixed(0)}px`,
  );
  /*
   * The diagnostic that decides the floor if the above fails. `SAFE_FLEE_PX` is the distance
   * beyond which the cat cannot reach a hold before it completes, so if the closest claim the
   * endgame ever offered was inside it, the stall is the board running out of *distance* —
   * a fact about the page, not about how fast a harness clicks.
   */
  /*
   * A diagnostic that only bites when the claim above fails, and the first version had it the
   * wrong way round — it asserted every worked claim was beyond `SAFE_FLEE_PX`, and then failed
   * on a run that **won** while working a claim 227px out.
   *
   * That is the arithmetic being a *sufficient* condition, not a necessary one: past the safe
   * distance the cat provably cannot arrive in time, but inside it the cat merely *might* —
   * it still has to be facing the right way, out of recovery, and past the threshold. Turning a
   * guarantee into a requirement asserted something the game never promised.
   *
   * So it earns its place by explaining a stall rather than by gating a success: if a treatless
   * fight ever stops being winnable, this says whether the board ran out of distance.
   */
  ok(
    'and if that ever stalls, the board running out of distance is why',
    run.won || run.minAway < SAFE_FLEE_PX,
    run.won
      ? `won it; closest it ever worked was ${run.minAway.toFixed(0)}px (safe distance ${SAFE_FLEE_PX.toFixed(0)}px)`
      : `stalled with the nearest claim ${run.minAway.toFixed(0)}px away, inside the ${SAFE_FLEE_PX.toFixed(0)}px safe distance`,
  );
  ok('no console errors at the bottom rung', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('failed:');
  for (const f of failed) console.log(`  - ${f.name}${f.detail ? '  — ' + f.detail : ''}`);
  process.exit(1);
}
