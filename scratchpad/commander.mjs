/**
 * The default game's ship gate — the autonomous squad, measured in a real browser, on the card (2.2).
 *
 * **The filename is historical and stays.** This was §15's gate when the default mode was called
 * commander and a click sent a kitten somewhere. 2.6 retired that verb — the swipe (§16) is how a
 * visitor intervenes now — and it turned out **not one check here was about ordering**: the promise
 * this file measures is *"open the fight, touch nothing, and watch the page come back"*, which the
 * change to the player's verb does not affect at all. So the checks are untouched and only the words
 * moved. Renaming the file would churn every citation of it in the GDD to say nothing new.
 *
 * **The promise this file exists to check is one sentence: a visitor can open the fight, touch
 * nothing, and watch the page come back.** Everything else 2.2 claims is decoration if that is
 * false, so check 1 is that and nothing else, and it is deliberately the longest-running check
 * here.
 *
 * The autonomous squad is the **default**, so no mode is declared. The fight opens
 * from the collapsed icon (`#cat-card-toggle`), and `#cat-card-panel` deals a mini board of
 * `.cat-tile[data-state="claimed"]` tiles. The squad (`.cat-card-kit`) holds tiles on its own:
 * kittens appear from round 1, and `[data-round]` ("round N") climbs as rounds clear with zero
 * input. The boss is `[data-boss]` (stance in its `dataset`), dialogue is `[data-ribbon]`, treat
 * ammo is `#cat-score .cat-paw.got`, and the card closes on Escape or `#cat-card-close`.
 *
 * 2.2's drop list applies: no page scrolling, no viewport positioning, no link navigation, no page
 * DOM snapshot (pillar 2 becomes "the card closes back to collapsed"). What survives is the gate
 * itself — watching is enough — plus the escalation ceiling and the one thing remembered: the best
 * round (`localStorage['cat-best-round']`), which survives a refresh while every other bit of
 * progress dies.
 *
 * Every `waitForFunction` passes its options in the **third** argument position. 1.4 found all 22
 * sites in the fleet doing otherwise — Playwright's signature is `(pageFunction, arg, options)`, so
 * an options object in the second slot becomes the page function's argument and the bound silently
 * becomes 30s. Twenty of those seconds belong to §11's truce, so an over-running wait ends the fight
 * it is waiting on.
 *
 * Run against a built preview on 4416:
 *   npm run build && npx astro preview --port 4416 &
 *   node scratchpad/commander.mjs
 */
import {
  ARMED,
  BASE,
  BEST_ROUND_KEY,
  FOUND,
  KITTEN_CAP,
  bounded,
  deal,
  fresh as context,
  launch,
  overFor,
  press,
  release,
  report,
  wants,
} from './lib/fixture.mjs';

/*
 * The constants, the reporter, the context factory and the bounded wait all come from
 * `lib/fixture.mjs` now — §12.1's charter. This file used to carry its own copy of each, which is
 * how the fleet ended up with eleven context factories and four re-rollers with three different
 * budgets, and therefore how a fix at one call site could never be a fix.
 */
const browser = await launch();
const { ok, note, fixture, done } = report();

/** This harness measures the default game — the kittens play — so no mode is declared. */
const fresh = (opts = {}) => context(browser, opts);

/** One read of everything the gate cares about, on the card's own DOM. */
const STATE = () => ({
  on: !document.querySelector('#cat-card-panel').hidden,
  round: Number((document.querySelector('[data-round]')?.textContent ?? '0').replace(/\D/g, '')) || 0,
  claims: document.querySelectorAll('.cat-tile[data-state="claimed"]').length,
  kits: document.querySelectorAll('.cat-card-kit').length,
  stance: document.querySelector('[data-boss]')?.dataset.stance ?? '',
  ribbon: (() => {
    const r = document.querySelector('[data-ribbon]');
    return !r || r.hidden ? '' : r.textContent.trim();
  })(),
});

const state = (page) => page.evaluate(STATE);

/** Open the card and wait for the fight to have actually landed: panel up, tiles dealt. */
async function openArena(page) {
  await press(page);
  await bounded(
    page,
    () =>
      !document.querySelector('#cat-card-panel').hidden &&
      document.querySelectorAll('.cat-tile[data-state="claimed"]').length > 0,
    9000,
  );
  await page.waitForTimeout(400);
}

/* ------------------------------------------------------------------ *
 * 1. Watching is enough — the whole premise, and nothing else
 * ------------------------------------------------------------------ */
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1400);
  await openArena(page);

  const first = await state(page);
  ok('a fight opens with a squad and a round', first.kits > 0 && first.round === 1, JSON.stringify(first));
  ok('and one kitten, because round one is one animal', first.kits === 1, `${first.kits} kittens`);

  /*
   * **Nothing is touched from here.** No mouse move, no click, no key, no scroll — the only thing
   * this loop does is read. If the round count rises, a visitor who did nothing watched the page
   * come back, which is the sentence the mode is built on.
   */
  const t0 = Date.now();
  let rounds = 1;
  let sawSquadGrow = false;
  while (Date.now() - t0 < 90_000) {
    const s = await state(page);
    if (!s.on) break;
    rounds = Math.max(rounds, s.round);
    if (s.kits > 1) sawSquadGrow = true;
    if (rounds >= 3) break;
    await page.waitForTimeout(500);
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  const after = await state(page);
  note(`reached round ${rounds} in ${secs}s with no input at all; ${after.kits} kittens out`);
  ok('a round clears with no input whatsoever (§15’s promise)', rounds >= 2, `reached round ${rounds} in ${secs}s`);
  ok('and clearing one reinforces the squad', sawSquadGrow, `${after.kits} kittens at round ${rounds}`);
  ok('the fight is still going — a cleared round is not an ending (§7.4 does not apply)', after.on);

  // Out, and the card must come back to collapsed (2.2 pillar 2).
  await release(page);
  await overFor(page, 8000);
  ok(
    'the card is back to collapsed after a multi-round run (2.2 pillar 2)',
    (await page.evaluate(ARMED)) === false,
  );
  ok(
    'and the squad is gone with it',
    (await page.evaluate(`document.querySelectorAll('.cat-card-kit').length`)) === 0,
  );
  ok('no console errors across three rounds', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

/* ------------------------------------------------------------------ *
 * 2. Escalation, and the one thing that is remembered
 * ------------------------------------------------------------------ */
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1400);
  await page.evaluate((k) => localStorage.removeItem(k), BEST_ROUND_KEY);
  await openArena(page);

  // Let it run up some rounds, touching nothing.
  const deep = await page.evaluate(
    async () =>
      new Promise((done) => {
        const t0 = performance.now();
        const tick = () => {
          const round = Number((document.querySelector('[data-round]')?.textContent ?? '0').replace(/\D/g, '')) || 0;
          if (round >= 4 || performance.now() - t0 > 120_000) return done(round);
          setTimeout(tick, 250);
        };
        tick();
      }),
  );
  ok('rounds keep coming without help', deep >= 3, `reached round ${deep}`);
  ok(
    'and the squad is capped, however deep it goes',
    (await state(page)).kits <= KITTEN_CAP,
    `${(await state(page)).kits} kittens`,
  );

  const best = await page.evaluate((k) => localStorage.getItem(k), BEST_ROUND_KEY);
  ok('the deepest round reached is remembered', Number(best) >= 2, `stored ${best}`);

  /*
   * §7.2 as amended: the round survives, and **nothing else does**. A refresh must come back with no
   * fight, no rung, no found treats and no squad — the stored integer is the single exception, and it
   * is the boundary the whole reversal was argued on.
   */
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const afterReload = await page.evaluate(
    (k) => ({
      stored: localStorage.getItem(k),
      collapsed: document.querySelector('#cat-card-panel').hidden,
      kits: document.querySelectorAll('.cat-card-kit').length,
      claims: document.querySelectorAll('.cat-tile[data-state="claimed"]').length,
      found: document.querySelectorAll('#cat-score .cat-paw.got').length,
    }),
    BEST_ROUND_KEY,
  );
  ok(
    'a refresh keeps the record and forgets everything else (§7.2/§13.4 as amended)',
    afterReload.stored === best &&
      afterReload.collapsed &&
      afterReload.kits === 0 &&
      afterReload.claims === 0 &&
      afterReload.found === 0,
    JSON.stringify(afterReload),
  );
  ok('no console errors through an escalating run', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

/* ------------------------------------------------------------------ *
 * 3. A browser that refuses storage still plays
 * ------------------------------------------------------------------ */
{
  const ctx = await fresh({ storage: false });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1400);
  await openArena(page);
  const rounds = await page.evaluate(
    async () =>
      new Promise((done) => {
        const t0 = performance.now();
        const tick = () => {
          const round = Number((document.querySelector('[data-round]')?.textContent ?? '0').replace(/\D/g, '')) || 0;
          if (round >= 2 || performance.now() - t0 > 60_000) return done(round);
          setTimeout(tick, 250);
        };
        tick();
      }),
  );
  /*
   * The point of this section: a game that throws inside its own loop because a profile has storage
   * turned off is a broken page, not a missing feature. `readBestRound`/`writeBestRound` swallow it,
   * so the round still plays and only the record is lost.
   */
  ok('a round still clears with storage denied', rounds >= 2, `reached round ${rounds}`);
  ok('and nothing threw', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

await browser.close();
if (!done()) process.exit(1);
