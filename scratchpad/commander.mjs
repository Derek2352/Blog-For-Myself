/**
 * §15's ship gate — commander mode, measured in a real browser.
 *
 * **The promise this file exists to check is one sentence: a visitor can open the fight, touch
 * nothing, and watch the page come back.** Everything else 2.0 claims is decoration if that is
 * false, so check 1 is that and nothing else, and it is deliberately the longest-running check
 * here.
 *
 * Every assertion reads *machine state* — the claim count, the round the arena publishes, the
 * `data-seek`/`data-hold` a kitten publishes, the phase classes the boss writes on itself. §12 has
 * recorded the alternative often enough to know better: a check that reads a caption is a check that
 * passes while the mechanic is broken. The two `data-` attributes on a kitten exist for this file in
 * the same way `data-mood` and `data-stance` were added for `arena7`.
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
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

/* Mirrors src/lib/squad.ts and src/lib/arena.ts — literals, so a drift shows up as a failure. */
const KITTEN_WORK_MS = 1000;
const KITTEN_CAP = 4;
const ROUND_REGROW_STEP = 0.82;
const ROUND_BEAT_MS = 1500;
const SIEGE_REGROW_MS = 9000;
const BEST_ROUND_KEY = 'cat-best-round';

const BASE = process.env.BASE_URL ?? 'http://localhost:4416';
const CHROME = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  process.env.PLAYWRIGHT_BROWSERS_PATH ? `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium` : null,
  '/opt/pw-browsers/chromium',
].filter(Boolean);
const executablePath = CHROME.find((p) => existsSync(p));
if (!executablePath) {
  console.error('No Chrome found. Set CHROME_PATH or install Chrome.');
  process.exit(2);
}

const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};
const note = (s) => console.log(`      · ${s}`);

const browser = await chromium.launch({ executablePath, headless: true });

/** Bounded wait, options in the position Playwright actually reads them from. */
const bounded = (page, fn, ms, arg = undefined) =>
  page.waitForFunction(fn, arg, { timeout: ms }).then(
    () => true,
    () => false,
  );

async function fresh(storage = true) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem('welcomed', '1'));
  if (!storage) {
    // A browser that refuses storage — private mode, a hardened profile, a policy. The round still
    // has to play; only the record is lost (`readBestRound`/`writeBestRound` swallow it).
    await ctx.addInitScript(() => {
      const boom = () => {
        throw new Error('storage denied');
      };
      Object.defineProperty(window, 'localStorage', {
        get: () => ({ getItem: boom, setItem: boom, removeItem: boom }),
      });
    });
  }
  return ctx;
}

const SNAP = `(() => [...document.querySelectorAll('*')]
  .filter((el) => !el.closest('#site-cat, #cat-hud, #cat-squad, #cat-treat, #cat-scrub, #cat-throw, #cat-ribbon, #cat-territory, #cat-curtain, header'))
  .map((el, i) => i + ':' + el.tagName + ':' + el.className + ':' + (el.getAttribute('style') ?? '')))()`;

const STATE = () => ({
  on: document.documentElement.classList.contains('cat-arena-on'),
  round: Number(document.documentElement.dataset.catRound ?? 0),
  claims: document.querySelectorAll('.cat-claimed').length,
  kits: document.querySelectorAll('.cat-kit').length,
  notched: document.getElementById('site-cat')?.classList.contains('notched') ?? false,
  ribbon: document.getElementById('cat-ribbon')?.textContent?.trim() ?? '',
});

const state = (page) => page.evaluate(STATE);

async function openArena(page) {
  await page.click('#cat-arena-toggle');
  await bounded(page, () => document.querySelectorAll('.cat-kit').length > 0, 9000);
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
  const clean = await page.evaluate(SNAP);
  await openArena(page);

  const first = await state(page);
  ok('a commander fight opens with a squad and a round', first.kits > 0 && first.round === 1, JSON.stringify(first));
  ok('and one kitten, because round one is one animal', first.kits === 1, `${first.kits} kittens`);

  /*
   * **Nothing is touched from here.** No mouse move, no click, no key, no scroll — the only thing
   * this loop does is read. If the round count rises, a visitor who did nothing watched the page come
   * back, which is the sentence the mode is built on.
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
    await page.waitForTimeout
      ? await page.waitForTimeout(500)
      : null;
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  const after = await state(page);
  note(`reached round ${rounds} in ${secs}s with no input at all; ${after.kits} kittens out`);
  ok('a round clears with no input whatsoever (§15’s promise)', rounds >= 2, `reached round ${rounds} in ${secs}s`);
  ok('and clearing one reinforces the squad', sawSquadGrow, `${after.kits} kittens at round ${rounds}`);
  ok('the fight is still going — a cleared round is not an ending (§7.4 does not apply)', after.on);
  ok('and it never wore the notch, because it never *won* — it is still playing', !after.notched);

  // Out, and the page must be exactly as found.
  await page.keyboard.press('Escape');
  await bounded(page, () => !document.documentElement.classList.contains('cat-arena-on'), 9000);
  await page.waitForTimeout(600);
  const now = await page.evaluate(SNAP);
  let diff = 0;
  let firstDiff = '';
  for (let i = 0; i < Math.max(clean.length, now.length); i++) {
    if (clean[i] !== now[i]) {
      diff++;
      if (!firstDiff) firstDiff = `${clean[i]} → ${now[i]}`;
    }
  }
  ok('the page comes back byte-identical after a multi-round run (pillar 2)', diff === 0, firstDiff);
  ok(
    'and the squad is gone with it',
    (await page.evaluate(`document.querySelectorAll('.cat-kit').length`)) === 0,
  );
  ok('no console errors across three rounds', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

/* ------------------------------------------------------------------ *
 * 2. The boss hunts kittens, and the cursor is not a target
 * ------------------------------------------------------------------ */
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1400);
  await openArena(page);

  // Park the cursor somewhere harmless and leave it. The header is PROTECTED_TREE.
  await page.mouse.move(640, 56);
  await page.waitForTimeout(300);

  /*
   * Watch where the cat *lands*. A pounce is aimed at its quarry, so the landing point is the
   * measurement: near a kitten means it is hunting the squad, near the cursor would mean §15's
   * central promise (read the page in peace) is false.
   */
  const landed = await page.evaluate(
    async () =>
      new Promise((done) => {
        const cat = document.getElementById('site-cat');
        const t0 = performance.now();
        let wasLeaping = false;
        const tick = () => {
          const leaping = cat.classList.contains('boss-leap');
          if (wasLeaping && !leaping) {
            const r = cat.getBoundingClientRect();
            const at = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            let nearest = Infinity;
            for (const k of document.querySelectorAll('.cat-kit')) {
              const kr = k.getBoundingClientRect();
              nearest = Math.min(
                nearest,
                Math.hypot(kr.left + kr.width / 2 - at.x, kr.top + kr.height / 2 - at.y),
              );
            }
            return done({ toKitten: Math.round(nearest), toCursor: Math.round(Math.hypot(at.x - 640, at.y - 56)) });
          }
          wasLeaping = leaping;
          if (performance.now() - t0 > 40_000) return done(null);
          requestAnimationFrame(tick);
        };
        tick();
      }),
  );
  ok('the cat commits to a pounce while nobody plays', !!landed, landed ? '' : 'no leap in 40s');
  if (landed) {
    note(`landed ${landed.toKitten}px from a kitten, ${landed.toCursor}px from the parked cursor`);
    ok(
      'and it lands on the squad, not on the reader’s cursor (§15)',
      landed.toKitten < landed.toCursor,
      `${landed.toKitten}px vs ${landed.toCursor}px`,
    );
  }

  /*
   * A landed pounce costs the kitten its hold and *not* a claim — the arithmetic in `squad.ts`
   * prices the board's growth as the regrow clock alone, and ground taken by pounces would be an
   * unpriced second source. Measured as: the claim count never rises at the moment of a landing.
   */
  const hitCost = await page.evaluate(
    async () =>
      new Promise((done) => {
        const cat = document.getElementById('site-cat');
        const count = () => document.querySelectorAll('.cat-claimed').length;
        const t0 = performance.now();
        let wasLeaping = false;
        let before = count();
        let landings = 0;
        let rises = 0;
        const tick = () => {
          const leaping = cat.classList.contains('boss-leap');
          if (leaping && !wasLeaping) before = count();
          if (wasLeaping && !leaping) {
            landings++;
            if (count() > before) rises++;
          }
          wasLeaping = leaping;
          if (performance.now() - t0 > 30_000 || landings >= 4) return done({ landings, rises });
          requestAnimationFrame(tick);
        };
        tick();
      }),
  );
  ok(
    'a hit takes tempo, never ground (§15 — the board’s rate is the regrow clock alone)',
    hitCost.landings > 0 && hitCost.rises === 0,
    `${hitCost.rises} of ${hitCost.landings} landings took a claim`,
  );
  ok('no console errors while the cat hunts the squad', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

/* ------------------------------------------------------------------ *
 * 3. The orders — both of them, and neither is required
 * ------------------------------------------------------------------ */
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1400);
  await openArena(page);

  // A claim well away from whatever the squad is already doing, and a point verified on it.
  const pick = await page.evaluate(() => {
    const kits = [...document.querySelectorAll('.cat-kit')];
    const centre = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    const claims = [...document.querySelectorAll('.cat-claimed')];
    let best = null;
    for (const el of claims) {
      const r = el.getBoundingClientRect();
      if (r.top < 200 || r.bottom > innerHeight - 150) continue;
      const x = Math.round(r.left + r.width / 2);
      const y = Math.round(r.top + r.height / 2);
      if (document.elementFromPoint(x, y)?.closest('.cat-claimed') !== el) continue;
      // Furthest from every kitten, so "a kitten came here" cannot be true by accident.
      const away = Math.min(...kits.map((k) => Math.hypot(centre(k).x - x, centre(k).y - y)));
      if (!best || away > best.away) best = { x, y, away: Math.round(away) };
    }
    return best;
  });
  ok('found a claim no kitten was standing near', !!pick, pick ? `at ${pick.x},${pick.y}, ${pick.away}px from the nearest kitten` : 'none free');

  if (pick) {
    await page.mouse.click(pick.x, pick.y);
    /*
     * **Assert that a kitten *came*, not that an index matched.**
     *
     * The first version of this compared the clicked claim's position in `.cat-claimed` against a
     * kitten's published `data-seek`, and failed on a build where ordering worked perfectly — because
     * those are two different index spaces. `data-seek` indexes `arena.order`, which is the whole
     * board including everything already freed; `.cat-claimed` is only what the cat currently holds.
     * A harness that invents its own numbering will eventually disagree with the game about what a
     * number means, and §12 has this filed under asserting on a proxy.
     *
     * Arrival is the thing with no second interpretation: a kitten is standing on the claim that was
     * pointed at, or it is not. It does fold the walk in with the order — so the wait is generous,
     * because the walk is a real distance at a real speed.
     */
    const came = await bounded(
      page,
      (at) =>
        [...document.querySelectorAll('.cat-kit')].some((k) => {
          const r = k.getBoundingClientRect();
          return Math.hypot(r.left + r.width / 2 - at.x, r.top + r.height / 2 - at.y) < 60;
        }),
      8000,
      pick,
    );
    ok('clicking a claim sends a kitten to *that* claim (§15’s first order)', came, came ? '' : 'nobody arrived in 8s');
  }

  /*
   * The second order is 1.4's throw, unchanged: a click on open page pulls the cat off whatever it is
   * hunting. `boss-fetch`/`boss-eat` is the cat abandoning its quarry, which is exactly what a lure is
   * for — and it must still work when the visitor has treats, which a cold homepage does not, so this
   * check reports rather than fails when the paws are empty.
   */
  const ammo = await page.evaluate(`document.querySelectorAll('#cat-score .cat-paw.got').length`);
  if (ammo > 0) {
    await page.mouse.click(200, Math.round(900 / 2));
    const lured = await bounded(
      page,
      () => {
        const c = document.getElementById('site-cat').classList;
        return c.contains('boss-fetch') || c.contains('boss-eat');
      },
      5000,
    );
    ok('and a click on open page still throws, pulling the cat off the squad (§5.4)', lured);
  } else {
    note(`no treats on a cold homepage (${ammo} in hand) — the throw is measured in battle.mjs`);
  }
  ok('no console errors around the orders', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

/* ------------------------------------------------------------------ *
 * 4. Escalation, and the one thing that is remembered
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
          const round = Number(document.documentElement.dataset.catRound ?? 0);
          if (round >= 4 || performance.now() - t0 > 120_000) return done(round);
          setTimeout(tick, 250);
        };
        tick();
      }),
  );
  ok('rounds keep coming without help', deep >= 3, `reached round ${deep}`);
  ok('and the squad is capped, however deep it goes', (await state(page)).kits <= KITTEN_CAP, `${(await state(page)).kits} kittens`);

  const best = await page.evaluate((k) => localStorage.getItem(k), BEST_ROUND_KEY);
  ok('the deepest round reached is remembered', Number(best) >= 2, `stored ${best}`);

  /*
   * §7.2 as amended: the round survives, and **nothing else does**. A refresh must come back with no
   * fight, no rung, no found treats and no squad — the stored integer is the single exception, and it
   * is the boundary the whole reversal was argued on.
   */
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const afterReload = await page.evaluate((k) => ({
    stored: localStorage.getItem(k),
    on: document.documentElement.classList.contains('cat-arena-on'),
    kits: document.querySelectorAll('.cat-kit').length,
    claims: document.querySelectorAll('.cat-claimed').length,
    round: document.documentElement.dataset.catRound ?? '-',
    found: document.querySelectorAll('#cat-score .cat-paw.got, #cat-score .cat-paw.withheld').length,
  }), BEST_ROUND_KEY);
  ok(
    'a refresh keeps the record and forgets everything else (§7.2/§13.4 as amended)',
    afterReload.stored === best &&
      !afterReload.on &&
      afterReload.kits === 0 &&
      afterReload.claims === 0 &&
      afterReload.round === '-' &&
      afterReload.found === 0,
    JSON.stringify(afterReload),
  );
  ok('no console errors through an escalating run', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

/* ------------------------------------------------------------------ *
 * 5. A browser that refuses storage still plays
 * ------------------------------------------------------------------ */
{
  const ctx = await fresh(false);
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
          const round = Number(document.documentElement.dataset.catRound ?? 0);
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
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('failed:');
  for (const f of failed) console.log(`  - ${f.name}${f.detail ? '  — ' + f.detail : ''}`);
  process.exit(1);
}
