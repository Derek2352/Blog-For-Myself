/**
 * Touch mode (§5.2 as answered in GDD 1.2) — played with real touches, on a real phone viewport.
 *
 * Every touch here goes through CDP `Input.dispatchTouchEvent`, not `page.mouse`, because the
 * whole point is that a finger behaves differently from a cursor: it *lands* rather than travels,
 * and it can arrive somewhere and then emit nothing at all. Playwright's `touchscreen` only taps,
 * so a **hold** — the core verb — needs the raw protocol.
 *
 * The design claim under test is not "touch input works". It is:
 *
 *   **scroll position is distance.** The cat is `position: fixed` at the bottom of the viewport
 *   and claims are in document flow, so where you scroll a claim to *is* how far it is from the
 *   cat. Step 0 measured 683–687px with a claim held high (safe past SAFE_FLEE_PX ≈ 423px, 15/15)
 *   against 413–420px centred (0/16) and 161–178px low. That gradient is the fight, and a flick
 *   is what it costs — which §5.2 already ruled interrupts a hold.
 */
import {
  BASE,
  SAFE_FLEE_PX,
  SCRUB_MS,
  deal,
  finger,
  fresh as context,
  launch,
  report,
  wants,
} from './lib/fixture.mjs';

/*
 * Everything shared lives in `lib/fixture.mjs` now (§12.1's charter): the constants, the reporter
 * with its fixture/assertion split, the context factory that declares the mode, `deal()` and the
 * `wants.*` predicates, and the CDP finger. What stays local is what is genuinely only true here —
 * `openGround`'s touch-adjustment clearance, `findLink`'s size and band, and the snapshot's
 * exclusion list.
 */
const browser = await launch();
const { ok, note, fixture, done } = report();

/**
 * A phone, playing **manual mode**.
 *
 * 2.0 made commander mode the default, and this file's whole subject is what a *finger* does — so
 * the mode is declared before any fight opens, or every check here is asking a spectator to hold
 * still. `fresh` does the pressing; the chip is pressed the way a visitor presses it.
 */
const phone = () => context(browser, { phone: true, mode: 'manual' });

const CLAIMS = `document.querySelectorAll('.cat-claimed').length`;
const ARMED = `document.documentElement.classList.contains('cat-arena-on')`;

/**
 * Byte-identical restore, borrowed verbatim from `arena.mjs` rather than rewritten.
 *
 * The exclusion list is the load-bearing part and I got it wrong by writing my own: the cat's
 * own overlays legitimately keep inline styles *after* the fight, because a deliberate truce
 * says a parting line and §8.4 wants that line to outlive the fight. Snapshotting `#cat-ribbon`
 * therefore fails pillar 2's check on the one behaviour pillar 2 does not govern.
 */
const SNAPSHOT = `(() => [...document.querySelectorAll('*')]
  .filter((el) => !el.closest('#site-cat, #cat-hud, #cat-treat, #cat-scrub, #cat-throw, #cat-ribbon, #cat-territory'))
  .map((el, i) => i + ':' + el.tagName + ':' + el.className + ':' + (el.getAttribute('style') ?? ''))
  .join('|'))()`;

/**
 * Earn treats the way a visitor does — by tapping through tabs. Never `page.goto`: a full
 * document load resets the cat's session state and the found set with it, which is the same rule
 * `arena3` states. Tapped rather than clicked, because on a phone that is the only gesture there
 * is, and the tab bar's own taps are part of what touch mode must not have broken.
 */
async function armAmmo(page, hops = 4) {
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll('.tabbar a[href]')]
      .filter((a) => !a.closest('.tab-flyout') && a.offsetParent !== null)
      .map((a) => a.getAttribute('href'))
      .slice(0, 6),
  );
  for (const href of hrefs.slice(0, hops)) {
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(120);
    await page.locator(`.tabbar a[href="${href}"]`).first().tap();
    await page.waitForTimeout(700);
  }
  /*
   * Home again, deliberately — the same correction `arena8` needed in 1.1. Arming ends on
   * whichever tab happened to be last, and a fight measured there is a fight on an unknown board:
   * the first run of this returned `found a claim to hold — none` and threw, because the tab it
   * landed on had nothing placeable in the safe band. Fighting on a known page is the difference
   * between testing touch mode and testing a page.
   */
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(120);
  await page.locator('.tabbar a[href="/"], a[href="/"]').first().tap();
  await page.waitForTimeout(900);
  return page.evaluate(`document.querySelectorAll('#cat-score .cat-paw.got').length`);
}

/**
 * A point that belongs to nobody — no link, no HUD — so a tap there is unambiguously a throw.
 *
 * Its own function because it must be re-asked after **every** scroll: coordinates found before a
 * scroll point at whatever moved into them afterwards, and on this site that is usually a link.
 */
async function openGround(page) {
  return page.evaluate(() => {
    const PROT = 'a[href], button, input, select, textarea, summary, label, [contenteditable]';
    const free = (x, y) => {
      const el = document.elementFromPoint(x, y);
      return !!el && !el.closest(PROT) && !el.closest('#cat-hud');
    };
    for (let y = 200; y < innerHeight - 140; y += 14)
      for (let x = 40; x < innerWidth - 40; x += 14) {
        /*
         * **Clearance, not just the point itself.** Chromium applies *touch adjustment* on
         * mobile: a tap that lands near a clickable target snaps onto it, so
         * `elementFromPoint` can honestly report "not a link" and the tap still navigate. It
         * did — a point 30px from the edge reported as open ground took the harness to an
         * entry page, and the throw then failed for having no fight left rather than for any
         * reason to do with throwing. So require a whole neighbourhood to be free.
         */
        if (![0, -16, 16].every((dx) => [0, -16, 16].every((dy) => free(x + dx, y + dy)))) continue;
        return { x, y };
      }
    return null;
  });
}

/**
 * A tappable link, **scrolled into the band first**.
 *
 * The version that did not scroll reported "no link in the band" once the earlier checks had left
 * the page somewhere without one — a flake that looks like §11's promise failing when it is only
 * the harness standing in the wrong place. Whether a link still works is not a question about
 * where the page happens to be scrolled.
 */
async function findLink(page) {
  return page.evaluate(async () => {
    // Same reveal trap as `place()`: wait for the element to stop travelling, not for a clock.
    const stable = async (el) => {
      let last = null;
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 25)));
        const t = el.getBoundingClientRect().top;
        if (last !== null && Math.abs(t - last) < 0.5) return;
        last = t;
      }
    };
    const maxScroll = document.documentElement.scrollHeight - innerHeight;
    for (const a of document.querySelectorAll('a[href^="/"]')) {
      const r0 = a.getBoundingClientRect();
      if (r0.width * r0.height < 400) continue;
      const want = Math.max(0, Math.min(maxScroll, Math.round(r0.top + scrollY + r0.height / 2 - 300)));
      scrollTo({ top: want, behavior: 'instant' });
      await stable(a);
      const r = a.getBoundingClientRect();
      if (r.top < 150 || r.bottom > innerHeight - 90) continue;
      const x = Math.round(r.left + r.width / 2);
      const y = Math.round(r.top + r.height / 2);
      if (!document.elementFromPoint(x, y)?.closest('a[href]')) continue;
      return { x, y, href: a.getAttribute('href') };
    }
    return null;
  });
}

/**
 * Scroll a claim's centre to `at` px down the screen and return the point to hold.
 *
 * The logic moved to `wants.placed` in `lib/fixture.mjs`, where its two load-bearing details are
 * documented — the **tolerance** (a claim near the document top cannot be pushed down, and the first
 * version reported one as "high" while it sat 188px from the cat, so every conclusion was wrong in
 * the same direction) and the **settle** (this site reveals content with a `translateY`, so a claim
 * scrolled into view keeps travelling for a few hundred ms; a scroll-dependent hit-test needs the
 * scroll to be finished). It was one of three copies.
 */
const place = (page, at, opts = {}) => wants.placed(at, opts)(page);

// ---- 1. the toggle no longer refuses a phone, and a held finger reclaims
{
  const ctx = await phone();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const cdp = await ctx.newCDPSession(page);

  const btn = page.locator('#cat-arena-toggle');
  ok('the toggle is shown on a phone', await btn.isVisible());
  ok('and no longer marked unavailable', (await btn.getAttribute('aria-disabled')) === 'false');
  const note = page.locator('#cat-arena-note');
  ok('and the "needs a mouse" note is gone', !(await note.isVisible()));
  ok('the target is still tap-sized', (await btn.evaluate((b) => b.getBoundingClientRect().height)) >= 44, '');

  await btn.tap();
  const opened = await page
    .waitForFunction(() => !!document.querySelector('.cat-claimed'), undefined, { timeout: 9000 })
    .then(() => true)
    .catch(() => false);
  ok('tapping it opens the arena', opened && (await page.evaluate(ARMED)));
  ok('and it says it is on', (await btn.getAttribute('aria-pressed')) === 'true');

  // The core verb, on a finger. Held high, where step 0 says the cat cannot reach.
  const highDeal = await deal(page, wants.placed(150), { deals: 6, tap: true });
  const high = highDeal.value;
  fixture('found a claim to hold high on the screen', highDeal, high ? `${high.d}px from the cat` : '');
  if (high) {
    ok('and holding it high really is out of the cat’s reach', high.d >= SAFE_FLEE_PX, `${high.d}px vs ${SAFE_FLEE_PX.toFixed(0)}px`);
    // `.cat-freed` rather than a board count: siege regrows the element a completed hold just
    // freed, so `before - 1` is only true against three of the four stances (see section 4a).
    await page.evaluate(() => {
      window.__freed = 0;
      new MutationObserver((recs) => {
        for (const r of recs)
          if (r.target instanceof Element && r.target.classList.contains('cat-freed')) window.__freed++;
      }).observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
    });
    await finger(cdp, high.x, high.y, SCRUB_MS + 500);
    const freed = await page.evaluate(() => window.__freed);
    ok('a held finger reclaims the element (§5.2 on touch)', freed > 0, `${freed} reclaim(s) observed`);
  }
  ok('no console errors through a touch fight', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

// ---- 2. the progress is visible somewhere a fingertip is not covering
{
  const ctx = await phone();
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const cdp = await ctx.newCDPSession(page);
  await page.locator('#cat-arena-toggle').tap();
  await page.waitForFunction(() => !!document.querySelector('.cat-claimed'), undefined, { timeout: 9000 }).catch(() => {});

  const fillDeal = await deal(page, wants.placed(150), { deals: 6, tap: true });
  const spot = fillDeal.value;
  fixture('found a claim to watch fill', fillDeal, spot ? `${spot.d}px from the cat` : '');
  if (spot) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: spot.x, y: spot.y }] });
    await page.waitForTimeout(Math.round(SCRUB_MS * 0.55));
    const mid = await page.evaluate(([x, y]) => {
      const el = document.elementFromPoint(x, y)?.closest('.cat-claimed');
      const ring = document.getElementById('cat-scrub');
      return {
        scrub: el ? Number(el.style.getPropertyValue('--scrub') || 0) : -1,
        // the tinted wash the claim is wearing, which is what the player actually sees
        shadow: el ? getComputedStyle(el).boxShadow : '',
        ringUp: ring ? !ring.hidden : false,
      };
    }, [spot.x, spot.y]);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

    ok('mid-hold, the claim itself carries the progress', mid.scrub > 0.15 && mid.scrub < 0.95, `--scrub ${mid.scrub}`);
    /*
     * Asserted on the **rendered alpha**, not on the string's shape. A first version matched
     * `/rgba?\(/` and failed on `color(srgb 0.556863 0.184314 0.270588 / 0.17184)` — Chromium
     * serialises a resolved `color-mix()` in that form, so the check was testing the browser's
     * choice of notation while the wash was working perfectly. The number is the claim being made:
     * the CSS is `7% + 19% × --scrub`, so the alpha has to sit above the 7% a resting claim wears
     * and land where the progress says it should.
     */
    const alpha = Number((mid.shadow.match(/[\d.]+\s*\)/) ?? [])[0]?.replace(')', '')) || 0;
    const want = 0.07 + 0.19 * mid.scrub;
    ok(
      'and the wash really deepens with it, not just the variable',
      alpha > 0.07 && Math.abs(alpha - want) < 0.02,
      `alpha ${alpha.toFixed(4)} vs 7% + 19%×${mid.scrub} = ${want.toFixed(4)}`,
    );
    ok('the 40px ring under the fingertip is not used on touch', !mid.ringUp);

    // ...and it is cleaned up, because `free()` restores the style attribute verbatim (pillar 2)
    await page.waitForTimeout(400);
    const left = await page.evaluate(
      () => [...document.querySelectorAll('[style*="--scrub"]')].length,
    );
    ok('no --scrub is left on the page after the finger lifts', left === 0, `${left} elements`);
  }
  await ctx.close();
}

// ---- 3. THE DESIGN: scroll position is distance, and a flick costs you the hold
{
  const ctx = await phone();
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const cdp = await ctx.newCDPSession(page);
  await page.locator('#cat-arena-toggle').tap();
  await page.waitForFunction(() => !!document.querySelector('.cat-claimed'), undefined, { timeout: 9000 }).catch(() => {});

  // The gradient, measured on the live board rather than trusted from step 0.
  const high = await place(page, 150);
  const low = await place(page, 844 - 160);
  ok('the same board offers a high placement and a low one', !!high && !!low);
  if (high && low) {
    ok(
      'scrolling a claim high really is fleeing (§5.2’s aim, on touch)',
      high.d >= SAFE_FLEE_PX && low.d < SAFE_FLEE_PX,
      `high ${high.d}px safe, low ${low.d}px not (threshold ${SAFE_FLEE_PX.toFixed(0)}px)`,
    );
    ok('and the difference is worth a gesture', high.d - low.d > 300, `${high.d - low.d}px of distance bought`);
  }

  /*
   * A scroll mid-hold interrupts it — §5.2 has said so since 0.1, and on touch it is the rule
   * that gives fleeing its price. Held, then dragged: the drag *is* the scroll on a phone.
   */
  const held = await place(page, 150);
  if (held) {
    const before = await page.evaluate(CLAIMS);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: held.x, y: held.y }] });
    await page.waitForTimeout(Math.round(SCRUB_MS * 0.7));
    // drag away — a flick, which is how a phone scrolls
    for (let i = 1; i <= 6; i++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: held.x, y: held.y - i * 30 }],
      });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(200);
    const after = await page.evaluate(CLAIMS);
    ok(
      'a flick 70% into a hold reclaims nothing (§5.2: a scroll is movement)',
      after >= before,
      `${before} → ${after} claims`,
    );
  }
  await ctx.close();
}

// ---- 4. the page keeps working: a tap on a link navigates, a tap on ground throws
{
  const ctx = await phone();
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const cdp = await ctx.newCDPSession(page);
  /*
   * Treats first — earned, by tapping through tabs. An earlier version tested the throw on a cold
   * load, found nothing in hand, and *skipped* both checks while reporting PASS. That is the
   * failure §12 named in 1.1: a guard that turns an absence into a green line. The tap-vs-hold
   * rule is the whole reason this section exists, so it has to be armed to be tested at all.
   */
  const ammoBefore = await armAmmo(page);
  ok('earned treats by tapping through tabs', ammoBefore >= 2, `${ammoBefore} in hand`);
  await page.locator('#cat-arena-toggle').tap();
  await page.waitForFunction(() => !!document.querySelector('.cat-claimed'), undefined, { timeout: 9000 }).catch(() => {});
  const ground = await page.evaluate(() => {
    const PROT = 'a[href], button, input, select, textarea, summary, label, [contenteditable]';
    for (let y = 200; y < innerHeight - 120; y += 14)
      for (let x = 20; x < innerWidth - 20; x += 14) {
        const el = document.elementFromPoint(x, y);
        if (el && !el.closest(PROT) && !el.closest('#cat-hud')) return { x, y };
      }
    return null;
  });
  /*
   * **Hold first, tap second, and assert on the board rather than on the paw row.**
   *
   * Two things went wrong writing this the other way round. Counting paws across the hold caught
   * a *win* — the board emptied, and §7.2 hands spent treats back on close, so "did not throw"
   * read as `3 → 4 in hand` and failed for being right. And the tap-then-hold order left a treat
   * already on the board, where §5.4's one-at-a-time rule blocks a second throw regardless — so
   * the hold could not have thrown even if the guard were missing, and the check was vacuous.
   *
   * `#cat-throw` hidden is the direct state: nothing was thrown, whatever the paw row says.
   */
  const holdDeal = await deal(page, wants.placed(150), { deals: 6, tap: true });
  const spot = holdDeal.value;
  fixture('found a claim to hold', holdDeal, spot ? `${spot.d}px from the cat` : '');
  if (spot) {
    // Observed, not counted — see the note in section 4a: siege's regrow puts back the element a
    // completed hold just freed, so a board count says `n → n` for a hold that worked perfectly.
    await page.evaluate(() => {
      window.__freed = 0;
      new MutationObserver((recs) => {
        for (const r of recs)
          if (r.target instanceof Element && r.target.classList.contains('cat-freed')) window.__freed++;
      }).observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
    });
    await finger(cdp, spot.x, spot.y, SCRUB_MS + 400);
    await page.waitForTimeout(300);
    ok('the hold reclaimed the claim', (await page.evaluate(() => window.__freed)) > 0, `${await page.evaluate(() => window.__freed)} reclaim(s)`);
    ok(
      'and threw nothing when the finger lifted (the reason TAP_MS exists)',
      await page.evaluate(`document.getElementById('cat-throw').hidden`),
    );
  }

  /*
   * Ground found **again, after the scrolling** — §12's 0.9 lesson, third outing. `ground` above
   * was measured before `place()` moved the page, so by the time it was tapped the coordinates
   * pointed at whatever had scrolled into them: on one run a link, which navigated and ended the
   * fight, and the throw then failed for a reason that had nothing to do with throwing.
   */
  const ground2 = await openGround(page);
  // A *scan*, not a roll: every viewport has open ground, so there is nothing to re-deal — but it is
  // still a fixture, and saying so keeps "I could not set up" from reading as "the game is broken".
  fixture('found open ground to tap, measured after the scrolling', ground2, ground2 ? `${ground2.x},${ground2.y}` : '');
  if (ground2) {
    await finger(cdp, ground2.x, ground2.y, 90);
    await page.waitForTimeout(250);
    ok(
      'while a brief tap on open ground does throw one (§3’s one button)',
      await page.evaluate(`!document.getElementById('cat-throw').hidden`),
    );
  }

  // A link still navigates, mid-fight, on a tap. §11 promises the page keeps working.
  const link = await findLink(page);
  fixture('found a link in the band to tap mid-fight', link, link?.href ?? '');
  if (link) {
    const from = page.url();
    await finger(cdp, link.x, link.y, 90);
    await page.waitForTimeout(1400);
    ok('a tap on a link still navigates during a fight', page.url() !== from, `${link.href} → ${new URL(page.url()).pathname}`);
    ok('and navigating ended the fight', !(await page.evaluate(ARMED)));
  }
  await ctx.close();
}

// ---- 4a. working on a claim is not pressing it, even when the claim is inside a link
{
  /*
   * The bug this section exists for, and the one that cost the most to find. §5.1 allows a claim
   * *inside* a link on purpose — "a `.frame` inside a card link is fair game" — which is true on a
   * mouse, where dwelling never clicks. On touch a hold **ends in a click**, so on a portfolio
   * (nearly all of it inside links) the core verb navigated off the page.
   *
   * It surfaced as `8 → 0 claims` from a single hold: a win the fight had not earned, which was
   * really the fight being destroyed. That is the 1.1 lesson again — a truce, a win and a
   * navigation all leave an empty board, so the only honest question is *who won*, or here,
   * *where are we*.
   */
  const ctx = await phone();
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const cdp = await ctx.newCDPSession(page);
  await page.locator('#cat-arena-toggle').tap();
  await page.waitForFunction(() => !!document.querySelector('.cat-claimed'), undefined, { timeout: 9000 }).catch(() => {});

  /*
   * Find a claim that really does sit inside a link — the case §5.1 permits.
   *
   * **Deal again rather than assert the deal.** `pickClaims` seeds from the clock, so "is one of this
   * fight's claims inside a link" is a property of the deal and not of the build. Asserted once, it
   * reported "none on this board" and took five checks down with it, on a build that had not touched
   * touch mode. This was the third of 2.0's three faults of that shape, and the last one written by
   * hand: the loop lives in `deal()` now, and the band and offset below are the ones this check has
   * always used.
   *
   * The tolerance is deliberately slack here (400px) rather than `wants.placed`'s default 60. The band
   * is the real constraint for this case, and tightening it would quietly shrink the candidate set —
   * changing what the check measures, which a consolidation is not allowed to do.
   */
  const inLinkDeal = await deal(
    page,
    wants.placed(150, { tol: 400, insideLink: true, band: { top: 110, bottom: 70 } }),
    { deals: 6, tap: true },
  );
  const inLink = inLinkDeal.value;
  fixture('found a claim that sits inside a link (§5.1 allows this)', inLinkDeal, inLink?.href ?? '');

  if (inLink) {
    const from = page.url();
    /*
     * **Watch for the reclaim event, not the board count.** The count is a proxy and siege breaks
     * it: `takeGround` regrows the *most recently freed* element, so a completed hold reads
     * `8 → 7 → 8` and the check failed intermittently, on whichever runs happened to roll siege.
     * A diagnostic showed the hold running uninterrupted — `pointerup` then a correctly prevented
     * `click`, no `pointercancel` — which is what ruled out the interruption theories and left
     * "it worked and something put it back". `.cat-freed` is added by `free(node, true)` on a
     * completed scrub and by nothing else, so it is the reclaim itself rather than its side effect.
     */
    await page.evaluate(() => {
      window.__freed = 0;
      new MutationObserver((recs) => {
        for (const r of recs)
          if (r.target instanceof Element && r.target.classList.contains('cat-freed')) window.__freed++;
      }).observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
    });
    await finger(cdp, inLink.x, inLink.y, SCRUB_MS + 400);
    await page.waitForTimeout(500);
    ok('holding it does not navigate away', page.url() === from, `${new URL(page.url()).pathname}`);
    ok('the fight is still on', await page.evaluate(ARMED));
    const freed = await page.evaluate(() => window.__freed);
    ok('and the hold reclaimed it like any other', freed > 0, `${freed} reclaim(s) observed`);

    // ...while a *tap* on the same thing still navigates, because §11 promises the page works.
    const link2 = await findLink(page);
    fixture('found a link to tap', link2, link2?.href ?? '');
    if (link2) {
      await finger(cdp, link2.x, link2.y, 90);
      await page.waitForTimeout(1400);
      ok('but a brief tap on a link still does', page.url() !== from, new URL(page.url()).pathname);
    }
  }
  await ctx.close();
}

// ---- 4b. a hybrid device: one machine where both inputs are real
{
  /*
   * A touchscreen laptop is the only device where a visitor genuinely uses both, and it is where
   * the tap-versus-hold guard can misfire in the quietest possible way. `touch.at` is stamped by a
   * touch and read by the `click` handler; the first version never cleared it for a mouse, so
   * after a single tap every subsequent mouse click was measured against a stale timestamp,
   * failed the tap test, and stopped throwing treats — silently, which §5.4 explicitly forbids.
   *
   * `hasTouch` with a fine pointer is that machine. Touch first, then click with the mouse.
   */
  // Not `phone: true`: that profile sets `isMobile`, and the point of this one is a *desktop* that
  // also has a touchscreen. `fresh` passes any extra context option through for exactly this.
  const ctx = await context(browser, { mode: 'manual', hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const cdp = await ctx.newCDPSession(page);
  const armed = await armAmmo(page);
  ok('hybrid: armed with treats', armed >= 2, `${armed} in hand`);
  await page.click('#cat-arena-toggle');
  await page.waitForFunction(() => !!document.querySelector('.cat-claimed'), undefined, { timeout: 9000 }).catch(() => {});

  /*
   * The touch that stamps the record is a **long hold on open ground**, deliberately.
   *
   * A first version held a *claim* for 120ms to stamp it — which is a tap, on an element that may
   * sit inside a link, so it navigated and ended the fight, and the mouse check then failed for
   * want of a fight rather than for the bug it was aiming at. Open ground cannot navigate, and
   * over `TAP_MS` it cannot throw either, so it stamps `touch.at` and changes nothing else. The
   * point is only to leave a touch record behind for the mouse to trip over.
   */
  const g1 = await openGround(page);
  ok('hybrid: found open ground', !!g1);
  if (g1) {
    await finger(cdp, g1.x, g1.y, 600);
    await page.waitForTimeout(300);
    ok(
      'a long touch on open ground throws nothing, but is on the record',
      await page.evaluate(`document.getElementById('cat-throw').hidden`),
    );

    // Then the mouse, at the same point. This must still throw.
    await page.mouse.move(g1.x, g1.y);
    await page.mouse.click(g1.x, g1.y);
    await page.waitForTimeout(300);
    ok(
      'a mouse click still throws after the screen has been touched',
      await page.evaluate(`!document.getElementById('cat-throw').hidden`),
    );
  }
  await ctx.close();
}

// ---- 5. §11's hard rules still hold on a phone
{
  const ctx = await phone();
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const cdp = await ctx.newCDPSession(page);

  const clean = await page.evaluate(SNAPSHOT);

  await page.locator('#cat-arena-toggle').tap();
  await page.waitForFunction(() => !!document.querySelector('.cat-claimed'), undefined, { timeout: 9000 }).catch(() => {});

  const hscroll = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  ok('no horizontal overflow at 390px with claims up', hscroll === 0, `${hscroll}px`);

  // Zoom must survive. `touch-action: none` would refuse a pinch beginning on a claim; the build
  // uses `pinch-zoom`, so panning is refused and zooming is not.
  const ta = await page.evaluate(() => {
    const c = document.querySelector('.cat-claimed');
    return c ? getComputedStyle(c).touchAction : '';
  });
  ok('a claim refuses panning but not pinch-zoom (§11)', ta === 'pinch-zoom', JSON.stringify(ta));
  const meta = await page.getAttribute('meta[name="viewport"]', 'content');
  ok('and nothing blocks zoom at the document level', !/user-scalable\s*=\s*no|maximum-scale/.test(meta ?? ''), meta ?? '');
  /*
   * Long-press suppression, checked in the two halves this browser can actually answer.
   *
   * `user-select: none` is what stops Chromium and Android turning a held finger into a text
   * selection, and it is computable. `-webkit-touch-callout: none` is what stops iOS raising its
   * link preview — and **Chromium does not implement it**, so `getComputedStyle` returns `""` no
   * matter what the stylesheet says. A first version asserted on that empty string and failed a
   * rule that is correctly shipped; the honest check is that the declaration reached the built
   * CSS, with the note that only a WebKit browser can confirm the behaviour.
   */
  const sel = await page.evaluate(() => {
    const c = document.querySelector('.cat-claimed');
    return c ? getComputedStyle(c).userSelect : '';
  });
  ok('a held finger cannot start a text selection on a claim', sel === 'none', JSON.stringify(sel));
  // Fetched as **text**, not read through the CSSOM: Chromium drops properties it does not
  // implement from `cssText`, so `cssRules` reports the declaration missing from a stylesheet
  // that plainly contains it. Asking the network what shipped is the only honest question here.
  const shipped = await page.evaluate(async () => {
    const hrefs = [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href);
    for (const h of hrefs) {
      const css = await fetch(h).then((r) => r.text()).catch(() => '');
      if (css.includes('-webkit-touch-callout')) return true;
    }
    return [...document.querySelectorAll('style')].some((s) =>
      s.textContent.includes('-webkit-touch-callout'),
    );
  });
  ok(
    'and iOS’s link callout is suppressed in the shipped CSS (unverifiable in Chromium)',
    shipped,
  );

  // Then a truce, and the page as found — pillar 2, on touch.
  await page.locator('#cat-arena-toggle').tap();
  await page
    .waitForFunction(
      () =>
        !document.querySelector('.cat-claimed') &&
        !document.querySelector('.cat-freed') &&
        !document.documentElement.classList.contains('cat-arena-on'),
      undefined,
      { timeout: 9000 },
    )
    .catch(() => {});
  await page.waitForTimeout(200);
  const after = await page.evaluate(SNAPSHOT);
  ok('the toggle ends it on touch too, with no Esc key to fall back on', !(await page.evaluate(ARMED)));
  ok('and the page is byte-identical after a touch fight (pillar 2)', after === clean);
  await ctx.close();
}

await browser.close();
if (!done()) process.exit(1);
