/**
 * Build step 5: stances and loadout — replayability.
 *
 * Both are *variation*, so the checks are about difference: fights must not all be the same
 * fight, and treats must not all be the same treat. The way to see that in a browser is to
 * force a stance or a treat and watch a number that only that one changes.
 *
 * Mirrors src/lib/arena.ts:
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

/*
 * The reporter, the context factory, the launcher and the open/close waits come from
 * `lib/fixture.mjs` (§12.1's charter). This file carried its own copy of each, which is how one
 * idea ended up with eleven implementations and a fix at one call site could never be a fix.
 */
const browser = await launch();
const { ok, note, fixture, done } = report();



/**
 * Press the toggle and wait for the state change to have actually landed.
 *
 * Step 6 put a ~1.9s ink curtain between the press and the fight. Every `click` in these
 * scripts was followed by a fixed 120–200ms wait, which was ample against an instant swap and
 * is now a race the script always loses — the first symptom was `getBoundingClientRect` on a
 * null `.cat-claimed`. Waiting on the observable rather than on a stopwatch is both correct
 * and, on the close path, usually shorter.
 */

/** A desktop context playing **manual mode** — the stances are measured against a pointer. */
const fresh = (opts = {}) => context(browser, { mode: 'manual', ...opts });

const STANCE = `document.getElementById('site-cat').dataset.stance ?? ''`;
const AMMO = `document.querySelectorAll('#cat-score .cat-paw.got').length`;

/** Phase changes with timestamps, plus whether each wind-up was a bluff. */
const RECORDER = () => {
  const root = document.getElementById('site-cat');
  window.__phases = [];
  const phase = () =>
    ['telegraph', 'leap', 'recover', 'fetch', 'eat'].find((p) => root.classList.contains('boss-' + p)) ??
    (root.classList.contains('boss') ? 'stalk' : 'off');
  /*
   * **Keyed on phase *and* feint, since 1.4.** The dedupe used to be on the phase string alone,
   * and §9.3's double tell then became invisible: a feint that re-commits stays in `telegraph`
   * and only drops `boss-feint`, so the second wind-up produced no record at all. This harness
   * reported "5 wind-ups" against its own `>= 6` floor and blamed the game.
   *
   * The feint class going false *is* the observable commitment — §9.3's "a bluff gathers without
   * dropping its shoulders", so the shoulders dropping is the tell — which makes phase+feint the
   * right key rather than a workaround.
   */
  const key = () => phase() + (root.classList.contains('boss-feint') ? '+feint' : '');
  let seen = key();
  const push = () => {
    const k = key();
    if (k === seen) return;
    seen = k;
    window.__phases.push({ phase: phase(), t: performance.now(), feint: root.classList.contains('boss-feint') });
  };
  new MutationObserver(push).observe(root, { attributes: true, attributeFilter: ['class'] });
};


/** Re-open the fight until the cat rolls the stance we want to look at. */
/**
 * Open a fight, and keep re-dealing until the cat rolls the stance this section is about.
 *
 * The budgets here are the largest in the fleet and they are not padding: §9.3 weights the roll, and
 * **sleepy is deliberately rare**, so section 4 asks for two hundred deals to be sure of seeing one.
 * A named stance is a fixture like any other — `deal()` reports which attempt produced it, so a
 * section that had to work for its opponent says so instead of looking flaky.
 */
async function stanceDeal(page, want, deals = 120) {
  await press(page);
  return deal(page, wants.stance([want], { claims: 'ignore' }), { deals, settle: 90 });
}

/**
 * A point that is neither a link nor a claim: the pointer can rest there without throwing
 * anything and without scrubbing anything. Used for measurements that must not be
 * confounded by the player accidentally playing.
 */

/**
 * A claim to work on — by **scrolling**, never by re-rolling the fight.
 *
 * The earlier version pressed Escape and re-opened when nothing was in view, which rolls a
 * fresh seed and therefore a fresh stance. Every section here forces a stance first, so that
 * quietly measured a different cat than the one it had just chosen: a "sleepy" wind-up came
 * out at 467ms, which is a trickster's, and the check failed for a reason that had nothing to
 * do with sleepy.
 */
/**
 * A claim in the band, found by **scrolling** rather than by re-dealing.
 *
 * Deliberately not `deal()`: this file has just spent up to two hundred fights pinning a stance, and
 * re-dealing the board would throw that away — the trap §12.1 names as two re-rollers undoing each
 * other. Scrolling changes which claims are reachable without touching the fight at all, so it is the
 * cheaper and safer of the two moves, and the name says which one this is.
 */
async function bandSpot(page) {
  const tops = await page.evaluate(() =>
    [...document.querySelectorAll('.cat-claimed')]
      .map((n) => n.getBoundingClientRect().top + scrollY)
      .sort((a, b) => a - b),
  );
  for (const top of [null, ...tops]) {
    if (top !== null) {
      await page.evaluate((y) => scrollTo({ top: Math.max(0, y), behavior: 'instant' }), top - 320);
      await page.waitForTimeout(130);
    }
    const hit = await page.evaluate(() => {
      const c = [...document.querySelectorAll('.cat-claimed')]
        .map((n) => n.getBoundingClientRect())
        .filter((r) => r.top > 170 && r.bottom < innerHeight - 50 && r.height < 420)[0];
      return c ? { x: Math.round(c.left + c.width / 2), y: Math.round(c.top + c.height / 2) } : null;
    });
    if (hit) return hit;
  }
  return null;
}

async function lureCat(page, target, within = 65, budgetMs = 14000) {
  const started = Date.now();
  let flip = 1;
  while (Date.now() - started < budgetMs) {
    await page.mouse.move(target.x + flip * 9, target.y);
    flip = -flip;
    await page.waitForTimeout(60);
    const d = await page.evaluate(
      ([tx, ty]) => {
        const r = document.getElementById('site-cat').getBoundingClientRect();
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

// ---- 2. siege: never leaves the floor, and the page grows back
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  fixture('rolled a siege', await stanceDeal(page, 'siege'));

  // chase it with the cursor up near the top: a floor-bound cat cannot follow
  await page.mouse.move(900, 220);
  const heights = [];
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(280);
    heights.push(
      await page.evaluate(() => {
        const r = document.getElementById('site-cat').getBoundingClientRect();
        return innerHeight - r.bottom;
      }),
    );
  }
  ok(
    'a siege cat will not leave the bottom edge',
    Math.max(...heights) < 6,
    `highest it got: ${Math.max(...heights).toFixed(1)}px off the floor`,
  );

  /*
   * Park somewhere that is neither a link nor a claim. The first version of this check
   * parked on a claim, so the player kept scrubbing it back while the board regrew and the
   * count sat still — a confounded measurement that read as a broken feature.
   */
  const idle = await idlePoint(page);
  fixture('found somewhere harmless to wait', idle, idle ? `${idle.x},${idle.y}` : '');
  await page.mouse.move(idle.x, idle.y);
  const before = await page.evaluate(`document.querySelectorAll('.cat-claimed').length`);
  await page.waitForTimeout(11000);
  const after = await page.evaluate(`document.querySelectorAll('.cat-claimed').length`);
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
   * **Treats in hand, never thrown — added 1.4, and for the reason `battle.mjs` found.** §2 makes a
   * loss "every claim taken **and** nothing left to throw", and this section deliberately provokes
   * without ever *finishing* a hold, so it frees nothing while the cat takes ground on every landed
   * pounce and every regrow. In 1.3 that stayed inside the window because a third of trickster's
   * wind-ups were bluffs that took nothing; §9.3's double tell converts some of those into real
   * attacks, so the board now fills fast enough to end the fight before the sample is big enough
   * to say anything about a 30% feint rate. Arming removes the loss without touching what is being
   * measured — the feint roll does not read the paw row.
   */
  const held = await armAmmo(page, { hops: 5, pool: 6, dwell: 650, settle: 800, home: '/' });
  ok('treats in hand, so provoking cannot lose the fight (§2)', held >= 3, `${held} found`);
  fixture('rolled a trickster', await stanceDeal(page, 'trickster'));
  await page.evaluate(RECORDER);

  const spot = await bandSpot(page);
  await lureCat(page, spot);
  /*
   * Provoke over and over without ever finishing.
   *
   * Holding still simply *completes* — the claim is freed and there is nothing left to
   * interrupt, which is why the first version of this got two wind-ups out of twenty-five
   * seconds. So: hold past the 0.35 that provokes, break the hold before it completes, and
   * do it again. That is also what a nervous player looks like.
   */
  /*
   * 34 rather than 22 since 1.4: a feint that re-commits (§9.3's double tell) spends a leap, a
   * recovery and a walk back, where a plain bluff returns to the stalk and can wind up again
   * almost at once. Same cat, fewer wind-ups per minute — so the window has to be longer to hold
   * a sample big enough to say anything about a 30% rate.
   */
  for (let i = 0; i < 34; i++) {
    await page.mouse.move(spot.x, spot.y);
    await page.waitForTimeout(1050);
    await page.mouse.move(spot.x + 70, spot.y + 40);
    await page.waitForTimeout(260);
  }
  /*
   * How much of the window was actually a *fight*. 1.4 made this worth asking: the double tell
   * converts some bluffs into landed attacks, each landed attack takes ground, and a board that
   * fills with no treats in hand is a §2 loss — so the observation window can close early and the
   * sample this section needs is bounded by the fight, not by the loop.
   */
  const stillOn = await page.evaluate(`document.documentElement.classList.contains('cat-arena-on')`);
  const leftNow = await page.evaluate(`document.querySelectorAll('.cat-claimed').length`);
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

  // which shapes did this visit actually earn? §9.5's whole point.
  const kit = await page.evaluate(() =>
    [...document.querySelectorAll('#cat-score .cat-paw.got')].map((p) => p.dataset.slug),
  );
  ok('the kit comes from the pages that were read', kit.length > 0, kit.join(', '));

  await press(page);
  await page.waitForTimeout(150);
  await page.evaluate(RECORDER);

  // throw one and watch which shape went out and how long it occupies the cat
  const spot = (await idlePoint(page, false)) ?? (await idlePoint(page, true));
  fixture('found somewhere to throw it', spot, spot ? `${spot.x},${spot.y}` : '');
  await page.mouse.move(spot.x, spot.y);
  await page.mouse.down();
  await page.mouse.up();
  const shape = await page.evaluate(
    () => document.querySelector('#cat-throw use')?.getAttribute('href') ?? '',
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
