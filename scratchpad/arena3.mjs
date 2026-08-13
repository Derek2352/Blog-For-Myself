/**
 * Build step 3: treats — on the card game (2.2). §12's question is "verify the safe
 * window is a real decision", so the centre of this harness is an A/B on the *same
 * claim, same position*: hold it with the boss next to you (interrupted), then hold
 * it again having thrown a treat across the room (completed). One difference, two
 * outcomes.
 *
 * Ammo has to be earned the way a visitor earns it — by browsing tabs — and that means
 * navigating by *clicking links*, never page.goto: a full document load resets the
 * cat's session state and the found set with it.
 *
 * 2.2: the board is the card's own (~296×180), the boss is `[data-boss]`, claims are
 * `.cat-tile[data-state="claimed"]`, the treat is `[data-treat]`, and throws land by
 * clicking the board. Distances scale 1/5; durations do not.
 */
const SCRUB_MS = 1400;
const LURE_MS = 3000;

import {
  BASE,
  armAmmo,
  deal,
  fresh as context,
  launch,
  press,
  release,
  report,
  throwSpot,
  wants,
} from './lib/fixture.mjs';

const browser = await launch();
const { ok, note, fixture, done } = report();

/**
 * A desktop context playing **manual mode** — commander mode is 2.0's default, and every check
 * here is about a pointer and a treat, so the mode is declared before any fight opens.
 */
const fresh = (opts = {}) => context(browser, { mode: 'manual', ...opts });

/** This file's own arming numbers, passed explicitly rather than inherited. */
const ARM = { hops: 4, pool: 5, dwell: 700, settle: 800, home: '/timeline/' };

const AMMO = `document.querySelectorAll('#cat-score .cat-paw.got').length`;
const CLAIMS = `document.querySelectorAll('.cat-tile[data-state="claimed"]').length`;
const TREAT_OUT = `!document.querySelector('[data-treat]').hidden`;

/** Records phase changes on the boss, with timestamps. */
const RECORDER = () => {
  const root = document.querySelector('[data-boss]');
  window.__phases = [];
  const phase = () => root?.dataset.phase ?? 'off';
  let seen = phase();
  window.__phases.push({ phase: seen, t: performance.now() });
  new MutationObserver(() => {
    const p = phase();
    if (p !== seen) {
      seen = p;
      window.__phases.push({ phase: p, t: performance.now() });
    }
  }).observe(root, { attributes: true, attributeFilter: ['data-phase'] });
};

/**
 * Ambush only, and up to forty deals to get one. A trickster bluffs a third of its
 * wind-ups and a bluff interrupts nothing, which made the control arm of the A/B below
 * pass or fail on a coin toss. The comparison needs an opponent that always commits.
 */
const fighter = (page) => deal(page, wants.stance(['ambush'], { claims: 'ignore' }), { deals: 40, settle: 180 });

async function lureCat(page, target, within = 18, budgetMs = 14000) {
  const started = Date.now();
  let flip = 1;
  let heldStill = false;
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
    // The last stretch: hold the cursor ON the target — the boss walking to the pointer
    // is what actually closes it. The oscillation keeps the boss *near*; only stillness
    // lets it arrive (measured: oscillation alone could burn the whole budget at 20-30px).
    if (d < 40 && !heldStill) {
      await page.mouse.move(target.x, target.y);
      await page.waitForTimeout(120);
      heldStill = true;
    }
  }
  return -1;
}

// ---- 1. cold start: no browsing, no ammo, and silence rather than an error
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  ok('a cold visitor has no treats', (await page.evaluate(AMMO)) === 0);

  await press(page);
  await page.waitForTimeout(200);
  const claims = await page.evaluate(CLAIMS);
  await page.mouse.move(640, 720);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(300);
  ok('throwing nothing throws nothing', (await page.evaluate(TREAT_OUT)) === false);
  ok('and costs nothing — no error, no claim change', (await page.evaluate(CLAIMS)) === claims);
  ok('no console errors on an empty-handed click', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---- 2. browsing arms you
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const armed = await armAmmo(page, ARM);
  ok('browsing tabs fills the paw row', armed >= 2, `${armed} treats in hand`);

  await press(page);
  await page.waitForTimeout(200);
  await page.evaluate(RECORDER);
  const before = await page.evaluate(AMMO);

  // throw at a board spot away from the boss
  const spot = await throwSpot(page, { x: 1150, y: 300 });
  fixture('there is somewhere on the board a treat can go', spot, spot ? `${spot.x},${spot.y}` : '');
  await page.mouse.move(spot.x, spot.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(120);
  ok('a click puts a treat on the board', await page.evaluate(TREAT_OUT));
  ok('and spends exactly one paw', (await page.evaluate(AMMO)) === before - 1, `${before} → ${await page.evaluate(AMMO)}`);

  // a second click while one is out costs nothing
  const mid = await page.evaluate(AMMO);
  const spot2 = await throwSpot(page, { x: 400, y: 400 });
  await page.mouse.move(spot2.x, spot2.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(150);
  ok('one treat on the board at a time', (await page.evaluate(AMMO)) === mid, `still ${mid}`);

  ok('the treat is on the board before we measure the chase', await page.evaluate(TREAT_OUT));
  const closing = await page.evaluate(async () => {
    const t = document.querySelector('[data-treat]').getBoundingClientRect();
    const d = () => {
      const r = document.querySelector('[data-boss]')?.getBoundingClientRect();
      if (!r) return Infinity;
      return Math.hypot(r.left + r.width / 2 - (t.left + t.width / 2), r.top + r.height / 2 - (t.top + t.height / 2));
    };
    const a = d();
    await new Promise((r) => setTimeout(r, 900));
    return { a, b: d() };
  });
  ok(
    'the cat goes for the treat, not for you',
    closing.b < closing.a - 15,
    `${closing.a.toFixed(0)}px → ${closing.b.toFixed(0)}px`,
  );
  const sawFetch = await page.evaluate(() => window.__phases.some((p) => p.phase === 'fetch' || p.phase === 'eat'));
  ok('and it is fetching while it does', sawFetch, await page.evaluate(() => window.__phases.map((p) => p.phase).join('→')));
  ok('no console errors through a throw', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---- 2b. a click in the middle of the board throws — no scanning, no hunting
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const armed = await armAmmo(page, ARM);
  ok('armed', armed >= 1, `${armed} treats`);
  await press(page);
  await page.waitForTimeout(200);

  /* Deliberately unscanned: click the middle of the board and insist it throws. */
  const mid = await page.evaluate(() => {
    const b = document.querySelector('[data-board]').getBoundingClientRect();
    return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) };
  });
  const onWhat = await page.evaluate(
    ([x, y]) => {
      const el = document.elementFromPoint(x, y);
      return el ? el.tagName + '.' + (el.className || '').toString().split(' ')[0] : 'nothing';
    },
    [mid.x, mid.y],
  );
  await page.mouse.move(mid.x, mid.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(200);
  ok(
    'a click in the middle of the board throws a treat',
    await page.evaluate(TREAT_OUT),
    `${mid.x},${mid.y} over ${onWhat}`,
  );
  ok('no console errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---- 3. THE STEP 3 QUESTION: same claim, same spot — interrupted, then completed
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const armed = await armAmmo(page, ARM);
  ok('armed for the A/B', armed >= 1, `${armed} treats`);

  await press(page);
  await page.waitForTimeout(200);
  /* One deal for both halves: ambush cat AND a claimed tile to hold. */
  const abDeal = await deal(
    page,
    wants.all(wants.stance(['ambush'], { claims: 'ignore' }), (pg) =>
      pg.evaluate(() => {
        const boss = document.querySelector('[data-boss]')?.getBoundingClientRect();
        const b = document.querySelector('[data-board]').getBoundingClientRect();
        const claims = [...document.querySelectorAll('.cat-tile[data-state="claimed"]')]
          .map((c) => {
            const r = c.getBoundingClientRect();
            return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), r };
          })
          .filter((c) => c.r.bottom < b.bottom - 6 && c.r.top > b.top + 6);
        claims.sort(
          (a, z) =>
            Math.hypot(a.x - (boss ? boss.left + boss.width / 2 : 0), a.y - (boss ? boss.top : 0)) -
            Math.hypot(z.x - (boss ? boss.left + boss.width / 2 : 0), z.y - (boss ? boss.top : 0)),
        );
        return claims[0] ?? null;
      }),
    ),
    { deals: 40, settle: 180 },
  );
  const target = abDeal.value ? abDeal.value[1] : null;
  fixture(
    'rolled a cat that fights, on a board with a claim for the A/B',
    abDeal,
    target ? `ambush, claim at ${target.x},${target.y}` : '',
  );
  if (!target) {
    console.log('      · no deal offered both — the A/B below is skipped');
  }
  await page.evaluate(RECORDER);

  // ---- A: the boss is next to you and you have thrown nothing
  const lureResult = await lureCat(page, target, 18);
  note(`lure result: ${lureResult}`);
  const beforeA = await page.evaluate(CLAIMS);
  await page.mouse.move(target.x, target.y);
  await page.waitForTimeout(SCRUB_MS + 700);
  const afterA = await page.evaluate(CLAIMS);
  const gotPounced = await page.evaluate(() => window.__phases.some((p) => p.phase === 'recover'));
  ok(
    'A — holding still with the cat on you does not win the claim',
    afterA >= beforeA && gotPounced,
    `${beforeA} → ${afterA} claims, pounced: ${gotPounced}`,
  );

  /* ---- Between the arms: take your hand off the claim — leave the card entirely.
   * Parking on the board itself does not end the hold: pointerout inside the card still
   * has a relatedTarget, so `scrub.inside` stays true and the tile reads `scrubbing`
   * when arm B checks it (measured: `data-state="scrubbing"` after a board-park). A
   * player who has decided to throw takes their hand off the thing they were working on;
   * moving to the page margin is what actually drops the hold. */
  await page.mouse.move(30, 30);
  await page.waitForTimeout(300);

  // ---- B: same claim, same hold, one treat thrown across the board first
  await page.waitForTimeout(900); // let the recovery finish so the boss is loose again
  const farSpot = await throwSpot(page, {
    x: target.x > 640 ? 120 : 1160,
    y: target.y > 450 ? 220 : 760,
  });
  fixture('found somewhere far to throw it', farSpot, farSpot ? `${farSpot.x},${farSpot.y}` : '');
  await page.mouse.move(farSpot.x, farSpot.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(200);
  ok('B — the treat is out', await page.evaluate(TREAT_OUT));

  /* Wait until the boss has actually gone for it before starting the hold. */
  await page
    .waitForFunction(() => window.__phases.at(-1)?.phase === 'eat', undefined, {
      timeout: 8000,
    })
    .catch(() => {});
  ok(
    'B — the claim from arm A is still on the board to be won',
    await page.evaluate(
      ([x, y]) => !!document.elementFromPoint(x, y)?.closest('.cat-tile[data-state="claimed"]'),
      [target.x, target.y],
    ),
  );
  // Diagnostic for the B-arm setup — what state is the target tile in right now?
  note(
    await page.evaluate(
      ([x, y]) => {
        const el = document.elementFromPoint(x, y);
        const t = el?.closest?.('.cat-tile');
        return `target tile: ${t ? t.dataset.state : 'none'} claims=${document.querySelectorAll('.cat-tile[data-state="claimed"]').length} phases=${window.__phases?.map((p) => p.phase).join('→')}`;
      },
      [target.x, target.y],
    ),
  );
  const beforeB = await page.evaluate(CLAIMS);
  const markB = await page.evaluate(() => window.__phases.length);
  await page.mouse.move(target.x, target.y);
  await page.waitForTimeout(SCRUB_MS + 500);
  const afterB = await page.evaluate(CLAIMS);
  const pouncedDuringB = await page.evaluate(
    (from) => window.__phases.slice(from).some((p) => p.phase === 'telegraph'),
    markB,
  );
  ok(
    'B — the same hold wins the claim once a treat is out',
    afterB === beforeB - 1,
    `${beforeB} → ${afterB} claims`,
  );
  ok('B — and the cat never even wound up', !pouncedDuringB);
  ok(
    'so the safe window is a real decision',
    afterA >= beforeA && afterB === beforeB - 1,
    'same claim, same hold, one treat apart',
  );
  await ctx.close();
}

// ---- 4. the lure lasts long enough to be worth a treat
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(600);
  await armAmmo(page, ARM);
  await press(page);
  await page.waitForTimeout(200);
  await page.evaluate(RECORDER);

  const eatSpot = await throwSpot(page, { x: 1150, y: 760 });
  await page.mouse.move(eatSpot.x, eatSpot.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForFunction(() => window.__phases.some((p) => p.phase === 'eat'), undefined, { timeout: 20000 });
  const eatStart = await page.evaluate(
    () => window.__phases.find((p) => p.phase === 'eat').t,
  );
  await page.waitForTimeout(LURE_MS + 400);
  const back = await page.evaluate(() => {
    const log = window.__phases;
    const i = log.findIndex((p) => p.phase === 'eat');
    return log.slice(i + 1)[0] ?? null;
  });
  ok(
    'eating keeps the cat busy for the full lure',
    back && back.t - eatStart >= LURE_MS - 60,
    back ? `${(back.t - eatStart).toFixed(0)}ms head-down, then ${back.phase}` : 'still eating',
  );
  ok(
    'the lure outlasts a scrub, which is the whole point',
    back && back.t - eatStart > SCRUB_MS,
  );
  ok('and the treat is gone afterwards', (await page.evaluate(TREAT_OUT)) === false);
  await ctx.close();
}

// ---- 5. the page still works: links navigate, and a truce gives the paws back
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const armed = await armAmmo(page, ARM);
  await press(page);
  await page.waitForTimeout(200);

  // spend one, then call a truce: the row must come back as it was
  const spendSpot = await throwSpot(page, { x: 1150, y: 300 });
  await page.mouse.move(spendSpot.x, spendSpot.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(200);
  const spent = await page.evaluate(AMMO);
  await release(page);
  await page.waitForTimeout(150);
  const restored = await page.evaluate(AMMO);
  ok(
    'treats spent in a fight are given back on truce',
    restored === armed && spent === armed - 1,
    `${armed} → ${spent} in the fight → ${restored} after`,
  );
  ok('and no treat is left on the board', (await page.evaluate(TREAT_OUT)) === false);

  // a click on a link still navigates, and throws nothing
  await press(page);
  await page.waitForTimeout(200);
  const url0 = page.url();
  await page.click('main a[href^="/"]');
  await page.waitForTimeout(900);
  ok('a click on a link still navigates', page.url() !== url0, `${url0} → ${page.url()}`);
  ok('and threw nothing on the way', (await page.evaluate(TREAT_OUT)) === false);
  // 2.2: the card persists across navigation (transition:persist) — the fight is still on,
  // exactly as touch-fight.mjs and arena8 assert. The page game ended fights on navigate;
  // the card owns its board, so browsing does not reset it.
  ok(
    'and the fight is still on — the card persists across navigation (§2.2)',
    (await page.evaluate(CLAIMS)) > 0 && !(await page.evaluate(`document.querySelector('#cat-card-panel').hidden`)),
  );
  await ctx.close();
}

await browser.close();
if (!done()) process.exit(1);
