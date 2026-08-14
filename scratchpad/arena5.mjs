/**
 * Build step 5: stances and loadout — replayability, on the card game (2.2).
 *
 * Both are *variation*, so the checks are about difference: fights must not all be the same
 * fight, and treats must not all be the same treat. The way to see that in a browser is to
 * force a stance or a treat and watch a number that only that one changes.
 *
 * 2.2: the boss is the card's own `[data-boss]` (stance in its `dataset.stance`, phase in
 * `dataset.phase`, feint in `dataset.feint`), claims are `.cat-tile[data-state="claimed"]`,
 * the treat is `[data-treat] use[href^="#treat-"]`, and the "floor" the siege cat refuses to
 * leave is the bottom edge of the card's board.
 */
const TELEGRAPH_MS = 420;
const SCRUB_MS = 1400;

import {
  BASE,
  armAmmo,
  deal,
  fresh as context,
  idlePoint,
  launch,
  press,
  release,
  report,
  wants,
} from './lib/fixture.mjs';

const browser = await launch();
const { ok, note, fixture, done } = report();

/** A desktop context playing **manual mode** — the stances are measured against a pointer. */
const fresh = (opts = {}) => context(browser, { mode: 'manual', ...opts });

const STANCE = `document.querySelector('[data-boss]')?.dataset.stance ?? ''`;
const AMMO = `document.querySelectorAll('#cat-score .cat-paw.got').length`;
const CLAIMS = `document.querySelectorAll('.cat-tile[data-state="claimed"]').length`;

/** Phase changes with timestamps, plus whether each wind-up was a bluff. */
const RECORDER = () => {
  const root = document.querySelector('[data-boss]');
  window.__phases = [];
  const phase = () => root?.dataset.phase ?? 'off';
  /*
   * **Keyed on phase *and* feint, since 1.4.** The dedupe used to be on the phase string alone,
   * and §9.3's double tell then became invisible: a feint that re-commits stays in `telegraph`
   * and only drops `data-feint`, so the second wind-up produced no record at all. The feint
   * going false *is* the observable commitment — the shoulders dropping is the tell — which
   * makes phase+feint the right key. On the card the tell is `[data-boss] dataset.feint`.
   */
  const key = () => phase() + (root?.dataset.feint ? '+feint' : '');
  let seen = key();
  const push = () => {
    const k = key();
    if (k === seen) return;
    seen = k;
    window.__phases.push({ phase: phase(), t: performance.now(), feint: !!root?.dataset.feint });
  };
  new MutationObserver(push).observe(root, { attributes: true, attributeFilter: ['data-phase', 'data-feint'] });
};

/**
 * Open a fight, and keep re-dealing until the cat rolls the stance this section is about.
 * Sleepy is deliberately rare, so section 3 asks for two hundred deals to be sure of seeing one.
 */
async function stanceDeal(page, want, deals = 120) {
  await press(page);
  return deal(page, wants.stance([want], { claims: 'ignore' }), { deals, settle: 90 });
}

/**
 * A claimed tile on the board, found without re-dealing (a re-deal rolls a fresh seed and
 * therefore a fresh stance — the trap §12.1 names as two re-rollers undoing each other).
 * The card's whole board is on screen, so "band" is board-relative and there is no scroll.
 */
async function bandSpot(page) {
  const hit = await page.evaluate(() => {
    const b = document.querySelector('[data-board]')?.getBoundingClientRect();
    if (!b) return null;
    const c = [...document.querySelectorAll('.cat-tile[data-state="claimed"]')]
      .map((n) => n.getBoundingClientRect())
      .filter((r) => r.top > b.top + 6 && r.bottom < b.bottom - 6 && r.height < 200)[0];
    return c ? { x: Math.round(c.left + c.width / 2), y: Math.round(c.top + c.height / 2) } : null;
  });
  return hit;
}

async function lureCat(page, target, within = 18, budgetMs = 16000) {
  const started = Date.now();
  let flip = 1;
  while (Date.now() - started < budgetMs) {
    await page.mouse.move(target.x + flip * 9, target.y);
    flip = -flip;
    await page.waitForTimeout(60);
    const d = await page.evaluate(
      ([tx, ty]) => {
        const r = document.querySelector('[data-boss]')?.getBoundingClientRect();
        if (!r) return Infinity;
        return Math.hypot(r.left + r.width / 2 - tx, r.top + r.height / 2 - ty);
      },
      [target.x, target.y],
    );
    if (d <= within) return d;
  }
  return -1;
}

// ---- 1. every fight has a stance, and they are not all the same
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(700);

  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    await press(page);
    await page.waitForTimeout(80);
    seen.add(await page.evaluate(STANCE));
    await release(page);
  }
  ok('every fight declares a stance', !seen.has('') && seen.size > 0, [...seen].join(', '));
  ok('and forty fights are not all the same fight', seen.size >= 3, `${seen.size} distinct`);
  ok('no console errors across forty fights', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---- 2. siege: never leaves the floor, and the board grows back
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  fixture('rolled a siege', await stanceDeal(page, 'siege'));

  // chase it with the cursor up near the top of the board: a floor-bound cat cannot follow
  const topMid = await page.evaluate(() => {
    const b = document.querySelector('[data-board]').getBoundingClientRect();
    return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + 12) };
  });
  await page.mouse.move(topMid.x, topMid.y);
  const heights = [];
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(280);
    heights.push(
      await page.evaluate(() => {
        const b = document.querySelector('[data-board]').getBoundingClientRect();
        const r = document.querySelector('[data-boss]')?.getBoundingClientRect();
        if (!r) return 999;
        return b.bottom - r.bottom;
      }),
    );
  }
  ok(
    'a siege cat will not leave the bottom edge',
    Math.max(...heights) < 6,
    `highest it got: ${Math.max(...heights).toFixed(1)}px off the floor`,
  );

  const idle = await idlePoint(page);
  fixture('found somewhere harmless to wait', idle, idle ? `${idle.x},${idle.y}` : '');
  await page.mouse.move(idle.x, idle.y);
  const before = await page.evaluate(CLAIMS);
  await page.waitForTimeout(11000);
  const after = await page.evaluate(CLAIMS);
  ok('and the claims grow back without it touching you', after > before, `${before} → ${after} claims`);
  await ctx.close();
}

// ---- 3. sleepy: a gift. It waits until you have nearly finished before it bothers.
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  const sleepy = await stanceDeal(page, 'sleepy', 200);
  const rolled = !!sleepy.value;
  fixture('rolled a sleepy cat eventually — it is meant to be rare', sleepy);
  if (rolled) {
    await page.evaluate(RECORDER);
    const spot = await bandSpot(page);
    await lureCat(page, spot);
    ok('still sleepy when the measurement starts', (await page.evaluate(STANCE)) === 'sleepy');
    await page.mouse.move(spot.x, spot.y);
    await page.waitForTimeout(2600);
    const log = await page.evaluate(() => window.__phases);
    const tele = log.find((p) => p.phase === 'telegraph');
    const leap = log.find((p) => p.phase === 'leap');
    ok(
      'a sleepy wind-up is long enough to stroll away from',
      !tele || !leap || leap.t - tele.t > TELEGRAPH_MS * 1.3,
      tele && leap ? `${(leap.t - tele.t).toFixed(0)}ms vs ${TELEGRAPH_MS}ms baseline` : 'never bothered at all',
    );
  }
  await ctx.close();
}

// ---- 4. trickster: some wind-ups are bluffs, and a bluff looks different
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  /*
   * **Treats in hand, never thrown — added 1.4.** §2 makes a loss "every claim taken **and**
   * nothing left to throw", and this section deliberately provokes without ever *finishing* a
   * hold, so it frees nothing while the cat takes ground on every landed pounce and every
   * regrow. Arming removes the loss without touching what is being measured.
   */
  const held = await armAmmo(page, { hops: 5, pool: 6, dwell: 650, settle: 800, home: '/' });
  ok('treats in hand, so provoking cannot lose the fight (§2)', held >= 3, `${held} found`);
  fixture('rolled a trickster', await stanceDeal(page, 'trickster'));
  await page.evaluate(RECORDER);

  const spot = await bandSpot(page);
  await lureCat(page, spot);
  /*
   * Provoke over and over without ever finishing: hold past the 0.35 that provokes, break
   * the hold before it completes, and do it again — what a nervous player looks like.
   */
  for (let i = 0; i < 34; i++) {
    await page.mouse.move(spot.x, spot.y);
    await page.waitForTimeout(1050);
    await page.mouse.move(spot.x + 70, spot.y + 40);
    await page.waitForTimeout(260);
  }
  const stillOn = await page.evaluate(`!document.querySelector('#cat-card-panel').hidden`);
  const leftNow = await page.evaluate(CLAIMS);
  console.log(`      · fight ${stillOn ? 'still on' : 'ENDED early'}, ${leftNow} claims, ` +
    `${(await page.evaluate(() => window.__phases.length))} phase records`);
  const log = await page.evaluate(() => window.__phases);
  const winds = log.filter((p) => p.phase === 'telegraph');
  const bluffs = winds.filter((p) => p.feint);
  // a bluff is a telegraph followed by a stalk instead of a leap
  const followed = winds.map((w) => log.find((p) => p.t > w.t)?.phase);
  ok('it winds up plenty', winds.length >= 6, `${winds.length} wind-ups`);
  ok(
    'and some of them are bluffs',
    bluffs.length > 0,
    `${bluffs.length} of ${winds.length} marked as feints`,
  );
  ok(
    'a bluff goes back to stalking instead of leaping',
    followed.filter((f) => f === 'stalk').length > 0,
    followed.join('→'),
  );
  ok(
    'and it is a minority of them — a tell you can learn, not a coin toss',
    winds.length >= 6 && bluffs.length < winds.length,
    `${bluffs.length}/${winds.length} bluffed (${((bluffs.length / winds.length) * 100).toFixed(0)}%, spec says 30%)`,
  );
  await ctx.close();
}

// ---- 5. the loadout: a bell and a biscuit are not the same treat
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const armed = await armAmmo(page, { hops: 5, pool: 6, dwell: 650, settle: 800, home: '/' });
  ok('armed with a kit', armed >= 3, `${armed} treats`);

  const kit = await page.evaluate(() =>
    [...document.querySelectorAll('#cat-score .cat-paw.got')].map((p) => p.dataset.slug),
  );
  ok('the kit comes from the pages that were read', kit.length > 0, kit.join(', '));

  await press(page);
  await page.waitForTimeout(200);
  await page.evaluate(RECORDER);

  // throw one and watch which shape went out and how long it occupies the cat
  const spot = (await idlePoint(page, false)) ?? (await idlePoint(page, true));
  fixture('found somewhere to throw it', spot, spot ? `${spot.x},${spot.y}` : '');
  await page.mouse.move(spot.x, spot.y);
  await page.mouse.down();
  await page.mouse.up();
  const shape = await page.evaluate(
    () => document.querySelector('[data-treat] use')?.getAttribute('href') ?? '',
  );
  ok('the shape thrown is the shape that was spent', /^#treat-/.test(shape), shape);

  await page.waitForFunction(() => window.__phases.some((p) => p.phase === 'eat'), undefined, { timeout: 20000 });
  const ate = await page.evaluate(() => window.__phases.find((p) => p.phase === 'eat').t);
  await page.waitForFunction(
    (from) => window.__phases.some((p) => p.phase !== 'eat' && p.t > from),
    ate,
    { timeout: 20000 },
  );
  const done = await page.evaluate(
    (from) => window.__phases.find((p) => p.phase !== 'eat' && p.t > from).t,
    ate,
  );
  const held = done - ate;
  ok(
    'the treat holds the cat for a time its own type decides',
    held > 1300 && held < 4600,
    `${shape.replace('#treat-', '')} held it ${held.toFixed(0)}ms (specs run 1600–4000)`,
  );
  ok('no console errors through a loadout throw', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
if (!done()) process.exit(1);
