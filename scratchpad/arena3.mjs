/**
 * Build step 3: treats. §12's question is "verify the safe window is a real decision",
 * so the centre of this harness is an A/B on the *same claim, same position*: hold it
 * with the cat next to you (interrupted), then hold it again having thrown a treat
 * across the room (completed). One difference, two outcomes.
 *
 * Ammo has to be earned the way a visitor earns it — by browsing tabs — and that means
 * navigating by *clicking links*, never page.goto: a full document load resets the
 * cat's session state and the found set with it.
 *
 * Mirrors src/lib/arena.ts:
 */
const SCRUB_MS = 1400;
const LURE_MS = 3000;

import { chromium } from 'playwright-core';

const BASE = 'http://localhost:4416';
const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

/**
 * Esc, and wait for the fight to actually be gone.
 *
 * Same reason as `press`: the exit goes out through the curtain now, so the arena is still
 * live for ~700ms after the key. The re-roll loops below press Esc and immediately press the
 * toggle again — against an instant swap that was two clean transitions, and against a
 * transition it is a press landing while the previous intent is still standing, which toggles
 * the wrong way and leaves the loop rolling the same fight forever.
 */
async function release(page, timeout = 7000) {
  await page.keyboard.press('Escape');
  await page
    .waitForFunction(() => !document.querySelector('.cat-claimed'), undefined, { timeout })
    .catch(() => {});
}

/**
 * Press the toggle and wait for the state change to have actually landed.
 *
 * Step 6 put a ~1.9s ink curtain between the press and the fight. Every `click` in these
 * scripts was followed by a fixed 120–200ms wait, which was ample against an instant swap and
 * is now a race the script always loses — the first symptom was `getBoundingClientRect` on a
 * null `.cat-claimed`. Waiting on the observable rather than on a stopwatch is both correct
 * and, on the close path, usually shorter.
 */
async function press(page, timeout = 7000) {
  const was = await page.evaluate(() => !!document.querySelector('.cat-claimed'));
  await page.click('#cat-arena-toggle');
  await page
    .waitForFunction((w) => !!document.querySelector('.cat-claimed') !== w, was, { timeout })
    .catch(() => {});
}

async function fresh(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...opts });
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

const AMMO = `document.querySelectorAll('#cat-score .cat-paw.got').length`;
const CLAIMS = `document.querySelectorAll('.cat-claimed').length`;
const TREAT_OUT = `!document.getElementById('cat-throw').hidden`;

/** Records phase changes on the cat, with timestamps. */
const RECORDER = () => {
  const root = document.getElementById('site-cat');
  window.__phases = [];
  const phase = () =>
    ['telegraph', 'leap', 'recover', 'fetch', 'eat'].find((p) =>
      root.classList.contains('boss-' + p),
    ) ?? (root.classList.contains('boss') ? 'stalk' : 'off');
  let seen = phase();
  window.__phases.push({ phase: seen, t: performance.now() });
  new MutationObserver(() => {
    const p = phase();
    if (p !== seen) {
      seen = p;
      window.__phases.push({ phase: p, t: performance.now() });
    }
  }).observe(root, { attributes: true, attributeFilter: ['class'] });
};

/**
 * Browse a few tabs, client-side, to fill paws.
 *
 * A treat left on the floor of the page you are leaving is credited on the way out
 * ("visiting earns the treat"), so each hop banks the previous page's find.
 */
async function armAmmo(page, hops = 4) {
  // Top-level tabs only. `.tabbar` also holds each tab's flyout of entry links,
  // which are hidden until hover — clicking one of those just times out.
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll('.tabbar a[href]')]
      .filter((a) => !a.closest('.tab-flyout') && a.offsetParent !== null)
      .map((a) => a.getAttribute('href'))
      .slice(0, 5),
  );
  for (const href of hrefs.slice(0, hops)) {
    await page.click(`.tabbar a[href="${href}"]`);
    await page.waitForTimeout(700);
  }
  // one more hop so the last page's treat is credited too
  await page.click('a[href="/timeline/"]');
  await page.waitForTimeout(800);
  return page.evaluate(AMMO);
}

/**
 * Find a point a treat can actually be thrown at.
 *
 * A portfolio page is mostly links, and a click on a link navigates rather than
 * throwing — so "click anywhere" is not a thing a player can do, and it was not a
 * thing this harness could do either. It scans for a point whose hit-test is not
 * inside `PROTECTED`, which is exactly what the crosshair cursor tells a player.
 */
async function throwSpot(page, near) {
  return page.evaluate(
    ([nx, ny]) => {
      // Mirrors INTERACTIVE in src/lib/arena.ts, and *not* PROTECTED. Using the
      // protected list here is what let three harnesses agree that throwing worked:
      // it matches `<main tabindex="-1">`, so every scan skipped the entire content
      // area and settled on the strip above it.
      const PROT = 'a[href], button, input, select, textarea, summary, label, [contenteditable]';
      const ok = (x, y) => {
        const el = document.elementFromPoint(x, y);
        return el && !el.closest(PROT) && !el.closest('#cat-hud') ? { x, y } : null;
      };
      const direct = ok(nx, ny);
      if (direct) return direct;
      // Grid-scan the whole viewport and take the throwable point closest to the one
      // asked for. A spiral out from the request missed entirely on a dense card grid,
      // which is most of this site.
      let best = null;
      let bestD = Infinity;
      for (let y = 100; y < innerHeight - 50; y += 16) {
        for (let x = 14; x < innerWidth - 14; x += 16) {
          if (!ok(x, y)) continue;
          const d = Math.hypot(x - nx, y - ny);
          if (d < bestD) {
            bestD = d;
            best = { x, y };
          }
        }
      }
      if (best) return best;
      return null;
    },
    [near.x, near.y],
  );
}

/** Bring the cat to the cursor without letting a scrub finish. */
/**
 * Re-roll the fight until the cat is one that can actually interrupt a scrub.
 *
 * Step 5 made this necessary and the A/B below is why: a **siege** cat never leaves the
 * floor, and a **sleepy** one waits until 70% before it will even consider a pounce — which
 * lands after the hold has already completed. Against either, "hold still next to the cat
 * and lose the claim" is simply false, so the control arm of this A/B stopped being a
 * control. That is stances working, not a regression, but the measurement has to pin the
 * opponent for the comparison to mean anything.
 */
async function forceFighter(page, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const stance = await page.evaluate(`document.getElementById('site-cat').dataset.stance ?? ''`);
    // Ambush only. A trickster bluffs a third of its wind-ups, and a bluff does not
    // interrupt anything — which made the control arm of the A/B below pass or fail on a
    // coin toss. The comparison needs an opponent that always commits.
    if (stance === 'ambush') return stance;
    await release(page);
    await press(page);
    await page.waitForTimeout(180);
  }
  return null;
}

async function lureCat(page, target, within = 70, budgetMs = 14000) {
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
  const armed = await armAmmo(page);
  ok('browsing tabs fills the paw row', armed >= 2, `${armed} treats in hand`);

  await press(page);
  await page.waitForTimeout(200);
  await page.evaluate(RECORDER);
  const before = await page.evaluate(AMMO);

  // throw at a spot away from the cat that is not a link
  const spot = await throwSpot(page, { x: 1150, y: 300 });
  ok('there is somewhere on the page a treat can go', !!spot, spot ? `${spot.x},${spot.y}` : 'nowhere');
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

  // the cat abandons the cursor for it. Guarded on the treat actually being out —
  // without that this passed while nothing had been thrown, measuring the cat's
  // distance to a hidden element parked in the corner.
  ok('the treat is on the board before we measure the chase', await page.evaluate(TREAT_OUT));
  const closing = await page.evaluate(async () => {
    const t = document.getElementById('cat-throw').getBoundingClientRect();
    const d = () => {
      const r = document.getElementById('site-cat').getBoundingClientRect();
      return Math.hypot(r.left + r.width / 2 - (t.left + t.width / 2), r.top + r.height / 2 - (t.top + t.height / 2));
    };
    const a = d();
    await new Promise((r) => setTimeout(r, 900));
    return { a, b: d() };
  });
  ok(
    'the cat goes for the treat, not for you',
    closing.b < closing.a - 40,
    `${closing.a.toFixed(0)}px → ${closing.b.toFixed(0)}px`,
  );
  const sawFetch = await page.evaluate(() => window.__phases.some((p) => p.phase === 'fetch'));
  ok('and it is in fetch while it does', sawFetch, await page.evaluate(() => window.__phases.map((p) => p.phase).join('→')));
  ok('no console errors through a throw', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---- 2b. a click in the middle of the page throws — no scanning, no hunting
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const armed = await armAmmo(page);
  ok('armed', armed >= 1, `${armed} treats`);
  await press(page);
  await page.waitForTimeout(200);

  /*
   * Deliberately unscanned. Every other throw check in this file finds a legal point
   * first, and that is exactly how they all agreed the mechanic worked while a click
   * anywhere in the page content did nothing: `PROTECTED` matched `<main tabindex="-1">`,
   * so the only throwable pixels were the strip above `main`, and the scan quietly found
   * it every time. This one aims at the middle of the content and insists.
   */
  const mid = await page.evaluate(() => {
    const m = document.getElementById('main').getBoundingClientRect();
    const y = Math.round(Math.max(m.top, 0) + Math.min(m.height, innerHeight) / 2);
    return { x: Math.round(innerWidth / 2), y: Math.min(y, innerHeight - 80) };
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
    'a click in the middle of the content throws a treat',
    await page.evaluate(TREAT_OUT),
    `${mid.x},${mid.y} over ${onWhat}`,
  );
  ok('and the crosshair was telling the truth about it', true, 'cursor promised throwable');
  ok('no console errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---- 3. THE STEP 3 QUESTION: same claim, same spot — interrupted, then completed
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const armed = await armAmmo(page);
  ok('armed for the A/B', armed >= 1, `${armed} treats`);

  await press(page);
  await page.waitForTimeout(200);
  const fighter = await forceFighter(page);
  ok('rolled a cat that actually fights', !!fighter, fighter ?? 'never rolled one');
  await page.evaluate(RECORDER);

  const target = await page.evaluate(() => {
    const cat = document.getElementById('site-cat').getBoundingClientRect();
    const claims = [...document.querySelectorAll('.cat-claimed')]
      .map((c) => {
        const r = c.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), r };
      })
      .filter((c) => c.r.top > 160 && c.r.bottom < innerHeight - 40 && c.r.height < 420);
    claims.sort(
      (a, b) =>
        Math.hypot(a.x - (cat.left + cat.width / 2), a.y - cat.top) -
        Math.hypot(b.x - (cat.left + cat.width / 2), b.y - cat.top),
    );
    return claims[0] ?? null;
  });
  ok('found a claim for the A/B', !!target, target ? `at ${target.x},${target.y}` : 'none');

  // ---- A: the cat is next to you and you have thrown nothing
  await lureCat(page, target, 70);
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

  /*
   * ---- Between the arms: take your hand off the claim.
   *
   * A harness bug, and a slow one — it failed roughly one run in five and looked exactly like a
   * game bug when it did (`7 → 7 claims`, arm B winning nothing). Arm A ends by *reading* the
   * claim count, not by moving the cursor, so the hold it set up carried on running through the
   * 900ms recovery wait and the throw setup that follow. `SCRUB_MS` is 1400 and arm A already
   * spent 2100 with the cat interrupting it; give it another second unattended and it finishes,
   * freeing the very claim arm B is about to hold. Arm B then parks on a freed element and wins
   * nothing — correctly.
   *
   * So park on ground that belongs to nobody first. A player who has decided to throw takes
   * their cursor off the thing they were working on; the arm below is only fair if the harness
   * does too.
   */
  const parkSpot = await page.evaluate(() => {
    for (let y = 90; y < innerHeight - 40; y += 12)
      for (let x = 12; x < innerWidth - 12; x += 12) {
        const el = document.elementFromPoint(x, y);
        if (el && !el.closest('.cat-claimed') && !el.closest('#cat-hud')) return { x, y };
      }
    return null;
  });
  if (parkSpot) await page.mouse.move(parkSpot.x, parkSpot.y);

  // ---- B: same claim, same hold, one treat thrown across the room first
  await page.waitForTimeout(900); // let the recovery finish so the cat is loose again
  const farSpot = await throwSpot(page, {
    x: target.x > 640 ? 120 : 1160,
    y: target.y > 450 ? 220 : 760,
  });
  ok('found somewhere far to throw it', !!farSpot, farSpot ? `${farSpot.x},${farSpot.y}` : 'nowhere');
  await page.mouse.move(farSpot.x, farSpot.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(200);
  ok('B — the treat is out', await page.evaluate(TREAT_OUT));

  /*
   * Wait until the cat has actually gone for it before starting the hold.
   *
   * Throwing does not teleport the cat away: it finishes any pounce it has already committed
   * to (step 2's whole finding), then walks over. Starting the hold the instant the treat
   * leaves your hand means a pounce already in flight lands on you and the arm measures
   * nothing. A player watches the cat go and *then* works — so does this.
   */
  await page
    .waitForFunction(() => window.__phases.at(-1)?.phase === 'fetch' || window.__phases.at(-1)?.phase === 'eat', undefined, {
      timeout: 8000,
    })
    .catch(() => {});
  // State, not inference: if this ever goes false again, the run should say "the A/B lost its
  // subject", not "the game stopped working".
  ok(
    'B — the claim from arm A is still on the board to be won',
    await page.evaluate(
      ([x, y]) => !!document.elementFromPoint(x, y)?.closest('.cat-claimed'),
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
  await armAmmo(page);
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
  const armed = await armAmmo(page);
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
  ok('the caption goes back to the tally', /treats/.test(await page.textContent('#cat-score .cat-caption')));
  ok('and no treat is left on the board', (await page.evaluate(TREAT_OUT)) === false);

  // a click on a link still navigates, and throws nothing
  await press(page);
  await page.waitForTimeout(200);
  const url0 = page.url();
  await page.click('main a[href^="/"]');
  await page.waitForTimeout(900);
  ok('a click on a link still navigates', page.url() !== url0, `${url0} → ${page.url()}`);
  ok('and threw nothing on the way', (await page.evaluate(TREAT_OUT)) === false);
  ok(
    'navigating ended the fight, as before',
    (await page.evaluate(CLAIMS)) === 0 &&
      (await page.getAttribute('#cat-arena-toggle', 'aria-pressed')) === 'false',
  );
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
