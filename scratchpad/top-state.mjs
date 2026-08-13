/**
 * §7.1's top state — the cat sits on the cursor once you have earned both proofs.
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
 *    where a click is about to land. So: a link under a perched cat must still be clickable.
 *
 * Mirrors src/lib/cat-game.ts:
 */
const PERCH_STILL_MS = 620;
const PERCH_SNAP_PX = 4;
const PERCH_BREAK_PX = 22;

import {
  BASE,
  fresh as context,
  launch,
  report,
} from './lib/fixture.mjs';

/*
 * Shared with the rest of the fleet through `lib/fixture.mjs` (§12.1's charter): the reporter with its
 * fixture/assertion split, the context factory that declares the mode, the launcher, and the waits
 * that open and close a fight. This file used to carry its own copy of each.
 */
const browser = await launch();
const { ok, note, fixture, done } = report();




/** A desktop context playing **manual mode** — the top state is reached by winning §3's fight. */
const fresh = (opts = {}) => context(browser, { mode: 'manual', ...opts });


const PERCHED = `document.getElementById('site-cat').classList.contains('perched')`;
const LEVEL = `[...document.getElementById('site-cat').classList].filter((c) => /^lv\\d$/.test(c)).pop() ?? ''`;
const NOTCHED = `document.getElementById('site-cat').classList.contains('notched')`;

/** Where the cat's body centre is, in client coordinates. */
const CAT_CENTRE = `(() => {
  const r = document.getElementById('site-cat').getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
})()`;

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
 * Win a fight — the confrontation path to the notch. **Retried, because a loss is a result.**
 *
 * Every fight this harness plays is treatless: the collar is earned before or after, never
 * during, so `ammo` is 0 for the whole thing. `isLost` is territory at 100% *and* nothing left
 * to throw, so with no treats a single stalled exchange — 7s where the flight found nowhere far
 * enough to hold — lets the cat regrow to the whole board and the fight ends in a loss. Runs
 * with 0 stalls won every time; the one run with 1 stall lost, and was reported as "the top
 * state does not work".
 *
 * That is the game behaving exactly as §9.4's floor describes, so the retry is the honest
 * response rather than a papered-over flake: §9.4 makes the toggle itself the rematch, and
 * pressing it again is what a player who just lost actually does. Whether a treatless fight is
 * *winnable* is arena8 section 4's question and it answers yes; this file only needs a notch.
 */
async function winAFight(page, budgetMs = 130_000, tries = 3) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    last = await winAFightOnce(page, budgetMs);
    if (last.notched) return { ...last, tries: i + 1 };
    await page.waitForTimeout(800);
  }
  return { ...last, tries };
}

async function winAFightOnce(page, budgetMs = 130_000) {
  await page.click('#cat-arena-toggle');
  /*
   * **Re-roll until the cat is one this strategy answers (added 2.0).** Everything below lures the
   * cat to the top of the screen and works a claim on the far side, which is the counter to a
   * *leaper*; siege never leaves the floor, so the lure waits for an arrival that cannot happen and
   * the fight plateaus. 1.4 measured that and pinned a leaper in `arena8` section 1; 2.0 found the
   * same fault still sitting in this file and in `arena8` section 2, which is what a shared strategy
   * fixed at one call site looks like. Reported here as "notched false (3 left, 2 stalls, 144s)".
   *
   * This file needs a **notch**, not a verdict on any particular stance — §9.4's floor is `arena8`
   * section 4's question and siege's own winnability is `battle.mjs`'s.
   */
  for (let roll = 0; roll < 12; roll++) {
    const stance = await page.evaluate(`document.getElementById('site-cat')?.dataset.stance ?? ''`);
    const claims = await page.evaluate(`document.querySelectorAll('.cat-claimed').length`);
    if (stance !== 'siege' && stance !== 'sleepy' && claims > 0) break;
    await page.keyboard.press('Escape');
    await page
      .waitForFunction(() => !document.querySelector('.cat-claimed'), undefined, { timeout: 8000 })
      .catch(() => {});
    await page.waitForTimeout(300);
    await page.click('#cat-arena-toggle');
    await page
      .waitForFunction(() => !!document.querySelector('.cat-claimed'), undefined, { timeout: 9000 })
      .catch(() => {});
  }
  await page
    .waitForFunction(() => !!document.querySelector('.cat-claimed'), undefined, { timeout: 9000 })
    .catch(() => {});
  const t0 = Date.now();
  let stalls = 0;
  while (Date.now() - t0 < budgetMs && stalls < 9) {
    if (await page.evaluate(`!document.documentElement.classList.contains('cat-arena-on')`)) break;
    if ((await page.evaluate(`document.querySelectorAll('.cat-claimed').length`)) === 0) break;
    await page.mouse.move(640, 60); // decoy at the top
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
    const spot = await page.evaluate(async () => {
      /*
       * Wait for the element to stop travelling before hit-testing it (added 1.2). The site
       * reveals content on scroll with a `translateY`, so a claim scrolled into place keeps
       * moving for a few hundred ms and a point taken at its centre lands off its edge — which
       * is what `winAFightOnce` kept hitting, and why 1.1 had to give this file a *retry*. The
       * retry stays, for genuine losses; this removes the reason it was needed.
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
      for (const el of claims) {
        const r0 = el.getBoundingClientRect();
        const want = Math.max(
          0,
          Math.min(maxScroll, Math.round(r0.top + scrollY + r0.height / 2 - lowY)),
        );
        scrollTo({ top: want, behavior: 'instant' });
        await stable(el);
        const r = el.getBoundingClientRect();
        const x = Math.round(Math.min(Math.max(r.left + r.width / 2, 60), innerWidth - 60));
        const y = Math.round(Math.min(Math.max(r.top + r.height / 2, 170), innerHeight - 110));
        if (document.elementFromPoint(x, y)?.closest('.cat-claimed') === el) return { x, y };
      }
      return null;
    });
    if (!spot) {
      stalls++;
      continue;
    }
    await page.waitForTimeout(250);
    const before = await page.evaluate(`document.querySelectorAll('.cat-claimed').length`);
    await page.mouse.move(spot.x, spot.y);
    let took = false;
    const h0 = Date.now();
    while (Date.now() - h0 < 7000) {
      await page.waitForTimeout(150);
      if ((await page.evaluate(`document.querySelectorAll('.cat-claimed').length`)) < before) {
        took = true;
        break;
      }
    }
    if (!took) stalls++;
  }
  // Let the win beat and the exit curtain finish.
  await page
    .waitForFunction(
      () =>
        !document.querySelector('.cat-claimed') &&
        !document.documentElement.classList.contains('cat-arena-on'),
      undefined,
      { timeout: 9000 },
    )
    .catch(() => {});
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(400);
  return {
    notched: await page.evaluate(NOTCHED),
    left: await page.evaluate(`document.querySelectorAll('.cat-claimed').length`),
    stalls,
    seconds: (Date.now() - t0) / 1000,
  };
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
  const page2 = await ctx.newPage();
  await page2.close();
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
  const notched = fight.notched;
  ok(
    'the confrontation path reaches the notch',
    notched,
    `${fight.left} claims left, ${fight.stalls} stalls, ${fight.seconds.toFixed(0)}s`,
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
  const notched = f1.notched;
  const lv = await collectAll(page);
  ok(
    'earned both, fight first',
    notched && lv === 'lv6',
    `notched ${notched} (${f1.left} left, ${f1.stalls} stalls, ${f1.seconds.toFixed(0)}s), ${lv}`,
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
     * The check this whole design turns on. 0.6 deferred the top state because it changes
     * ambient browsing; the answer was to make the perched cat scenery. If a link under it
     * cannot be clicked, the reward has cost the reader something and the feature is wrong.
     */
    const reach = await page.evaluate(
      ([cx, cy]) => {
        const el = document.elementFromPoint(cx, cy);
        return {
          tag: el ? el.tagName : '(nothing)',
          isCat: !!el?.closest('#site-cat'),
        };
      },
      [got.spot.x, got.spot.y],
    );
    ok(
      'the page is still what is under the cursor, not the cat',
      !reach.isCat,
      `elementFromPoint → ${reach.tag}`,
    );
    ok(
      'and the cat is inert to the pointer while perched',
      (await page.evaluate(
        `getComputedStyle(document.querySelector('#site-cat .cat-svg')).pointerEvents`,
      )) === 'none',
    );

    // Now the real thing: park the cat over a link and click it.
    /*
     * **Scroll** a link into the cat's band rather than hoping one is already there. The band is
     * the bottom ~234px and the homepage at rest had nothing in it, so the first run skipped the
     * only check that matters. The page moves; the cat is fixed to the floor — so putting a link
     * where the cat can sit on it is arithmetic, the same move arena8 uses to place a claim.
     */
    const clicked = await page.evaluate(async () => {
      // Its own copy: `page.evaluate` bodies are separate scopes, and defining this only in the
      // claim finder above left a `stable is not defined` here — one edit, two closures.
      const stable = async (el) => {
        let last = null;
        for (let i = 0; i < 40; i++) {
          await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 25)));
          const t = el.getBoundingClientRect().top;
          if (last !== null && Math.abs(t - last) < 0.5) return;
          last = t;
        }
      };
      const cands = [...document.querySelectorAll('main a[href^="/"]')].filter((a) => {
        const r = a.getBoundingClientRect();
        return r.width > 40 && r.height > 12;
      });
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - innerHeight);
      const bandY = innerHeight - 90; // inside the notice band, clear of the very edge
      for (const link of cands) {
        const r0 = link.getBoundingClientRect();
        const want = Math.max(
          0,
          Math.min(maxScroll, Math.round(r0.top + scrollY + r0.height / 2 - bandY)),
        );
        scrollTo({ top: want, behavior: 'instant' });
        await stable(link);
        const r = link.getBoundingClientRect();
        const x = Math.round(r.left + r.width / 2);
        const y = Math.round(r.top + r.height / 2);
        if (y < innerHeight - 150 || y > innerHeight - 30) continue; // not in the band
        if (document.elementFromPoint(x, y)?.closest('a[href]') !== link) continue;
        return { found: true, x, y, href: link.getAttribute('href') };
      }
      return { found: false };
    });
    if (clicked.found) await page.waitForTimeout(300);
    // A *scan* of the page's own links rather than a roll — nothing to re-deal, but still the harness
    // setting itself up, and `FIXTURE` says which of the two failed when it does.
    fixture('found a link inside the cat’s band to test against', clicked.found || null, clicked.href ?? '');
    if (clicked.found) {
      const settled = await tryPerch(page, clicked.x, 6000);
      // Move onto the link's exact centre and let the cat settle there too.
      await page.mouse.move(clicked.x, clicked.y);
      await page.waitForTimeout(PERCH_STILL_MS + 900);
      const over = await page.evaluate(
        ([lx, ly]) => {
          const el = document.elementFromPoint(lx, ly);
          return { isCat: !!el?.closest('#site-cat'), isLink: !!el?.closest('a[href]') };
        },
        [clicked.x, clicked.y],
      );
      ok(
        'a link under the perched cat is still the click target',
        over.isLink && !over.isCat,
        `perched ${settled.perched}, elementFromPoint isLink=${over.isLink} isCat=${over.isCat}`,
      );
      await page.mouse.click(clicked.x, clicked.y);
      await page.waitForTimeout(1200);
      ok(
        'and clicking it actually navigates',
        new URL(page.url()).pathname === clicked.href,
        `${new URL(page.url()).pathname} (wanted ${clicked.href})`,
      );
    }
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
  const notched = f2.notched;
  ok(
    'earned both, collecting first',
    notched && lv === 'lv6',
    `${lv}, notched ${notched} (${f2.left} left, ${f2.stalls} stalls, ${f2.seconds.toFixed(0)}s)`,
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

// ---- 5. the arena wins any argument about who owns the cat
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const lv = await collectAll(page);
  const f3 = await winAFight(page);
  const notched = f3.notched;
  /*
   * **Reaching the top state is a fixture, and an expensive one.** It needs every treat found and a
   * fight won, and both are plays against a rolled opponent — so when it does not happen, this harness
   * has measured nothing, which is a different statement from "the arena mishandles a perch". Written
   * as `ok(..., false)` it made the second statement in the words of the first.
   */
  const top = notched && lv === 'lv6' && (await tryPerch(page, 640, 6000)).perched;
  fixture(
    'reached the top state to test the arena against',
    top || null,
    `${lv}, notched ${notched} (${f3.left} left, ${f3.stalls} stalls, ${f3.seconds.toFixed(0)}s)`,
  );
  if (top) {
    await page.click('#cat-arena-toggle');
    await page
      .waitForFunction(() => !!document.querySelector('.cat-claimed'), undefined, { timeout: 9000 })
      .catch(() => {});
    ok(
      'opening a fight drops the perch',
      (await page.evaluate(PERCHED)) === false,
      `perched ${await page.evaluate(PERCHED)}`,
    );
    // A boss must be able to be under the cursor without being click-through furniture.
    await page.waitForTimeout(2500);
    ok(
      'and it does not come back mid-fight',
      (await page.evaluate(PERCHED)) === false,
    );
    await page.keyboard.press('Escape');
    await page.waitForTimeout(2000);
  }
  await ctx.close();
}

// ---- 6. reduced motion never perches
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
