/**
 * 1.4's combat additions, measured in a real browser — the ship gate for §9.3, §7.3 and §5.4.
 *
 * Each of these mechanics is a claim about *the machine*, so every check here reads the machine:
 * the claim count, the phase classes the cat writes on itself, the mood attribute, the cat's own
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
 * Run against a built preview on 4416, like every other harness here:
 *   npm run build && npx astro preview --port 4416 &
 *   node scratchpad/battle.mjs
 */
import { chromium } from 'playwright-core';

/* Mirrors src/lib/arena.ts — kept as literals so a drift shows up as a failure, not a pass. */
const SCRUB_MS = 1400;
const RECOVER_MS = 700;
const THROW_ARC_MS = 320;
const SWAT_RADIUS = 64;
const SWAT_STUN_MS = 900;
const AMBUSH_PIN_MS = 2600;
const AMBUSH_PIN_PX = 90;
const SIEGE_REGROW_MS = 9000;
const LAST_STAND_REGROW = 0.55;
const IDLE_TRUCE_MS = 20_000;

const BASE = 'http://localhost:4416';
const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};
const note = (s) => console.log(`      · ${s}`);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const CLAIMS = `document.querySelectorAll('.cat-claimed').length`;
const AMMO = `document.querySelectorAll('#cat-score .cat-paw.got').length`;
const ON = `document.documentElement.classList.contains('cat-arena-on')`;
const WON = `document.getElementById('site-cat').classList.contains('notched')`;

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

/**
 * Every wait in this file passes its options in the **third** position.
 *
 * Playwright's signature is `waitForFunction(pageFunction, arg, options)`, and the whole harness
 * fleet had been passing `{ timeout: N }` in the second — where it becomes the page function's
 * *argument* and the bound silently defaults to 30s. That is not a style point here: §11 ends a
 * fight `IDLE_TRUCE_MS` after the last input, so a wait that overruns 20s **ends the fight it is
 * waiting on**, and the harness then reports the emptied board as a loss. It cost 1.4 a red
 * `arena8` section 1 that read exactly like a broken game: "0 reclaimed, 0 left".
 */
const bounded = (page, fn, ms, arg = undefined) =>
  page.waitForFunction(fn, arg, { timeout: ms }).then(
    () => true,
    () => false,
  );

async function press(page) {
  const was = await page.evaluate(() => !!document.querySelector('.cat-claimed'));
  await page.click('#cat-arena-toggle');
  await bounded(page, (w) => !!document.querySelector('.cat-claimed') !== w, 8000, was);
}

async function release(page) {
  await page.keyboard.press('Escape');
  await bounded(page, () => !document.querySelector('.cat-claimed'), 8000);
  await page.waitForTimeout(200);
}

/** Roll until the stance is the one under test. Nothing here is true of every cat. */
async function forceStance(page, want, tries = 24) {
  for (let i = 0; i < tries; i++) {
    const got = await page.evaluate(`document.getElementById('site-cat')?.dataset.stance ?? ''`);
    if (got === want && (await page.evaluate(CLAIMS)) > 0) return true;
    await release(page);
    await press(page);
  }
  return false;
}

/** Collect treats by walking the tabs, then come home: `/` is the board every harness fights on. */
async function armAmmo(page) {
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll('.tabbar a[href]')]
      .filter((a) => !a.closest('.tab-flyout') && a.offsetParent !== null)
      .map((a) => a.getAttribute('href'))
      .slice(0, 5),
  );
  for (const href of hrefs) {
    await page.click(`.tabbar a[href="${href}"]`);
    await page.waitForTimeout(650);
  }
  await page.click('a[href="/"]');
  await page.waitForTimeout(1200);
  return page.evaluate(AMMO);
}

/** Settle the site's scroll-reveal before any hit-testing (1.2's lesson, in one line). */
async function settlePage(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 180) {
      scrollTo({ top: y, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 70));
    }
    scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.waitForTimeout(500);
}

/**
 * The page's own flight recorder: phase, mood, claim count and the cat's coordinates.
 *
 * Sampled in the page rather than polled over CDP because everything here is measured in
 * *milliseconds* and a round trip per sample would put the measurement error inside the effect.
 * Phase changes are captured by observer so no transition can fall between two samples.
 */
const RECORD = (everyMs) => {
  const cat = document.getElementById('site-cat');
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
  const phaseOf = () =>
    ['telegraph', 'leap', 'recover', 'eat', 'fetch', 'swatted']
      .filter((p) => cat.classList.contains('boss-' + p))
      .join('+') || 'stalk';
  let last = '';
  const mark = () => {
    const p = phaseOf();
    if (p !== last) {
      w.__rec.phases.push({ t: Math.round(performance.now() - w.__rec.t0), phase: p });
      last = p;
    }
  };
  new MutationObserver(mark).observe(cat, { attributes: true, attributeFilter: ['class'] });
  mark();
  w.__recTimer = setInterval(() => {
    const r = cat.getBoundingClientRect();
    w.__rec.samples.push({
      t: Math.round(performance.now() - w.__rec.t0),
      n: document.querySelectorAll('.cat-claimed').length,
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
 * seconds — and §11 is entitled to call that a truce. So the cursor twitches in the header, which
 * is `PROTECTED_TREE`: it refreshes `scrub.seen` (the truce clock) while never putting a claim
 * under the pointer, so nothing is scrubbed and no pounce is provoked. Watching the game without
 * playing it is exactly what a spectator does, and the game has no rule against it.
 */
async function watchFor(page, ms) {
  const t0 = Date.now();
  let x = 600;
  while (Date.now() - t0 < ms) {
    x = x === 600 ? 640 : 600;
    await page.mouse.move(x, 56);
    await page.waitForTimeout(Math.min(2000, IDLE_TRUCE_MS / 4));
  }
}

/**
 * Pick a point on the claim furthest from the cat, verified at the coordinate the cursor will
 * occupy. `placeFarTarget`'s lesson from 1.2, minus the scrolling: sections here need a target
 * *now*, and scrolling is what made that measurement lie.
 */
async function farTarget(page) {
  return page.evaluate(async () => {
    /* The site reveals content on scroll with a `translateY`, so a claim scrolled into place keeps
     * *travelling* for a few hundred ms and a point taken at its centre is off its edge by the
     * time `elementFromPoint` tests it. 1.2 found this; it is why the wait is on the rect settling
     * rather than on a fixed pause. */
    const stable = async (el) => {
      let last = null;
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 25)));
        const top = el.getBoundingClientRect().top;
        if (last !== null && Math.abs(top - last) < 0.5) return;
        last = top;
      }
    };
    const scan = () => {
      const c = document.getElementById('site-cat').getBoundingClientRect();
      const cx = c.left + c.width / 2;
      const cy = c.top + c.height / 2;
      let best = null;
      for (const el of document.querySelectorAll('.cat-claimed')) {
        const r = el.getBoundingClientRect();
        if (r.top < 170 || r.bottom > innerHeight - 110) continue; // off-screen or under the HUD
        const x = Math.round(r.left + r.width / 2);
        const y = Math.round(r.top + r.height / 2);
        if (document.elementFromPoint(x, y)?.closest('.cat-claimed') !== el) continue;
        const away = Math.hypot(x - cx, y - cy);
        if (!best || away > best.away) best = { x, y, away };
      }
      return best;
    };
    const here = scan();
    if (here) return here;
    /*
     * Nothing in the strip. **Scroll to a claim rather than nudging at the page**: the geometry is
     * known (the cat is `position: fixed`, claims are in flow), so the offset that centres one is
     * arithmetic. The first version nudged by 240px and re-looked, which spent 31 searches failing
     * to find the *last remaining claim* and reported a fight that had gone 13-for-14 as a loss —
     * the endgame is exactly when there is only one claim left to find, so a search that cannot
     * find one claim fails precisely at the moment the measurement matters.
     */
    const rest = [...document.querySelectorAll('.cat-claimed')];
    if (!rest.length) return null;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    for (const el of rest) {
      const r0 = el.getBoundingClientRect();
      const docCentre = r0.top + scrollY + r0.height / 2;
      scrollTo({ top: Math.max(0, Math.min(maxScroll, Math.round(docCentre - innerHeight / 2))), behavior: 'instant' });
      await stable(el);
      const found = scan();
      if (found) return found;
    }
    return null;
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
  await settlePage(page);
  await press(page);
  const isSiege = await forceStance(page, 'siege');
  ok('a siege cat to fight (§9.3)', isSiege, isSiege ? '' : 'no siege in 24 rolls');

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
    const left = await page.evaluate(CLAIMS);
    if (left === 0) break;
    const spot = await farTarget(page);
    if (!spot) {
      // `farTarget` has already scrolled to every remaining claim and failed to verify a point on
      // any of them, so this is a genuinely unreachable board rather than a bad viewport. Keep the
      // cursor alive (§11's truce clock) and try once more before giving up on the fight.
      misses++;
      await page.mouse.move(640, 56);
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
      (misses ? `, ${misses} searches found nothing on screen` : ''),
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
  const armedToWatch = await armAmmo(page);
  ok('treats in hand, so a watched fight cannot lose itself (§2)', armedToWatch >= 3, `${armedToWatch} found`);
  await settlePage(page);
  await press(page);
  const isSiege = await forceStance(page, 'siege');
  ok('a siege cat to watch', isSiege, isSiege ? '' : 'no siege in 24 rolls');

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
    const spot = await farTarget(page);
    if (!spot) {
      await page.evaluate(() => scrollBy({ top: 240, behavior: 'instant' }));
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
  const armed = await armAmmo(page);
  ok('treats in hand to spend on a counter', armed >= 3, `${armed} found`);
  await settlePage(page);
  await press(page);
  const isAmbush = await forceStance(page, 'ambush');
  ok('an ambush cat, which is the one that whiffs at you', isAmbush, isAmbush ? '' : 'no ambush in 24 rolls');
  await page.evaluate(RECORD, 60);

  /**
   * Bait a pounce and counter it, the way a player would.
   *
   * **Throw at the leap, not at the recovery.** The first version waited for `boss-recover` and
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
  let commitments = 0;
  const baitAndCounter = async (ms = 40_000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const spot = await page.evaluate(() => {
        const c = document.getElementById('site-cat').getBoundingClientRect();
        const cx = c.left + c.width / 2;
        const cy = c.top + c.height / 2;
        let best = null;
        for (const el of document.querySelectorAll('.cat-claimed')) {
          const r = el.getBoundingClientRect();
          if (r.top < 170 || r.bottom > innerHeight - 110) continue;
          const x = Math.round(r.left + r.width / 2);
          const y = Math.round(r.top + r.height / 2);
          if (document.elementFromPoint(x, y)?.closest('.cat-claimed') !== el) continue;
          const away = Math.hypot(x - cx, y - cy);
          if (!best || away < best.away) best = { x, y, away };
        }
        return best;
      });
      if (!spot) {
        await page.evaluate(() => scrollBy({ top: 200, behavior: 'instant' }));
        await page.waitForTimeout(300);
        continue;
      }
      await page.mouse.move(spot.x, spot.y);
      // Hold still until it commits. Bounded — a cat that never commits means re-baiting
      // somewhere else, not waiting out the truce.
      const committed = await bounded(
        page,
        () => document.getElementById('site-cat').classList.contains('boss-leap'),
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
        await bounded(page, () => document.getElementById('site-cat').classList.contains('boss-swatted'), 2500)
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
  ok(
    'a treat landing on a recovering cat swats it (§5.4’s counter)',
    swatted,
    swatted
      ? `landed inside the ${RECOVER_MS - THROW_ARC_MS}ms window (RECOVER_MS − THROW_ARC_MS) after ${commitments} pounce(s)`
      : `no boss-swatted class in ${commitments} attempts`,
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
  await page.mouse.move(640, 56);
  const stalking = await bounded(
    page,
    () => {
      const c = document.getElementById('site-cat').classList;
      return !c.contains('boss-recover') && !c.contains('boss-swatted') && !c.contains('boss-leap');
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
    const at = await page.evaluate(() => {
      const r = document.getElementById('site-cat').getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    });
    await page.mouse.click(at.x, at.y);
    threw = await bounded(page, () => !document.getElementById('cat-throw').hasAttribute('hidden'), 1500);
    await page.waitForTimeout(THROW_ARC_MS + 500);
  }
  const after = (await readRec(page)).phases.slice(beforeControl);
  ok(
    'a throw at a cat that is not recovering is a lure, not a counter (§3’s cost)',
    stalking && threw && !after.some((p) => p.phase.includes('swatted')),
    !stalking
      ? 'never caught it stalking'
      : !threw
        ? `the control throw never left the HUD (${ammoBefore} in hand) — nothing was measured`
        : `treat thrown, phases after it: ${after.map((p) => p.phase).join(' → ') || 'none'}`,
  );
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
  await settlePage(page);
  await press(page);
  const isAmbush = await forceStance(page, 'ambush');
  ok('an ambush cat, the only stance that pins', isAmbush, isAmbush ? '' : 'no ambush in 24 rolls');

  /*
   * Take a hit on purpose. Holding still on a claim inside the cat's reach is the one thing the
   * whole game is built to punish, so it is also the cheapest way to observe the punishment.
   */
  let hit = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 60_000 && !hit) {
    const spot = await page.evaluate(() => {
      const c = document.getElementById('site-cat').getBoundingClientRect();
      const cx = c.left + c.width / 2;
      const cy = c.top + c.height / 2;
      let best = null;
      for (const el of document.querySelectorAll('.cat-claimed')) {
        const r = el.getBoundingClientRect();
        if (r.top < 170 || r.bottom > innerHeight - 110) continue;
        const x = Math.round(r.left + r.width / 2);
        const y = Math.round(r.top + r.height / 2);
        if (document.elementFromPoint(x, y)?.closest('.cat-claimed') !== el) continue;
        const away = Math.hypot(x - cx, y - cy);
        if (!best || away < best.away) best = { x, y, away };
      }
      return best;
    });
    if (!spot) {
      await page.evaluate(() => scrollBy({ top: 200, behavior: 'instant' }));
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
     * So wait for the commitment first (`boss-leap` — the cat is in the air), and only then for
     * ground to change hands **while it is recovering from that leap**. That pair is the hit's
     * actual signature in `land()`, and a regrow cannot forge it.
     */
    if (!(await bounded(page, () => document.getElementById('site-cat').classList.contains('boss-leap'), 6000)))
      continue;
    const n = await page.evaluate(CLAIMS);
    const landed = await bounded(
      page,
      (was) =>
        document.querySelectorAll('.cat-claimed').length > was &&
        document.getElementById('site-cat').classList.contains('boss-recover'),
      1600,
      n,
    );
    if (landed) {
      hit = await page.evaluate(() => {
        const r = document.getElementById('site-cat').getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
      });
    }
  }
  ok('the cat lands one on us (the pin’s trigger)', !!hit, hit ? `landed at ${hit.x},${hit.y}` : 'never got hit in 60s');

  /*
   * Now run. The cursor goes to the far corner — the strongest lure the game has, since the cat
   * always walks toward it — and the question is whether the cat *can* follow. Sampled in the
   * page for the same reason as everything else here: this is a 2600ms window.
   */
  let pinned = null;
  if (hit) {
    const away = await page.evaluate(() => ({ x: 80, y: innerHeight - 140 }));
    await page.mouse.move(away.x, away.y);
    pinned = await page.evaluate(
      async ([hx, hy, windowMs]) => {
        const cat = document.getElementById('site-cat');
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
    pinned ? `furthest ${pinned.maxIn}px against a ${AMBUSH_PIN_PX}px leash over ${pinned.inside} samples` : 'not measured',
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
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('failed:');
  for (const f of failed) console.log(`  - ${f.name}${f.detail ? '  — ' + f.detail : ''}`);
  process.exit(1);
}
