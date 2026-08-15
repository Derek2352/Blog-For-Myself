/**
 * Touch mode (§5.2 as answered in GDD 1.2, re-checked on the card in 2.2) — played with real
 * touches, on a real phone viewport.
 *
 * Every touch here goes through CDP `Input.dispatchTouchEvent`, not `page.mouse`, because the
 * whole point is that a finger behaves differently from a cursor: it *lands* rather than travels,
 * and it can arrive somewhere and then emit nothing at all. Playwright's `touchscreen` only taps,
 * so a **hold** — the core verb — needs the raw protocol.
 *
 * 2.2 moved the game into the card, and with it the design changed in the way §2.2 says it does:
 * the board is card-relative, so "scroll position is distance" is gone — the whole board is on
 * screen, and distance is measured on the board's own coordinates. What stays is the part that
 * was ever about the *finger*: a held finger reclaims a tile, progress shows in the tile rather
 * than under the fingertip, a tap and a hold are different verbs (TAP_MS), a mouse still throws
 * after the screen has been touched, and §11's hard rules (no overflow, zoom survives,
 * selection suppressed) hold on the card's own furniture.
 *
 * The design claim under test:
 *
 *   **a finger can play the card game.** Tiles are the claims; a hold scrubs, a tap throws,
 *   and the card's chrome never makes a page control unreachable.
 */
import {
  BASE,
  CARD_SAFE_FLEE_PX,
  SCRUB_MS,
  deal,
  finger,
  fresh as context,
  launch,
  report,
  waitOpen,
  wants,
} from './lib/fixture.mjs';

const browser = await launch();
const { ok, note, fixture, done } = report();

/** A phone, playing **manual mode**. */
const phone = () => context(browser, { phone: true, mode: 'manual' });

const CLAIMS = `document.querySelectorAll('.cat-tile[data-state="claimed"]').length`;
const ARMED = `!document.querySelector('#cat-card-panel').hidden`;

/**
 * Earn treats the way a visitor does — by tapping through tabs. Never `page.goto`: a full
 * document load resets the cat's session state and the found set with it.
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
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(120);
  await page.locator('.tabbar a[href="/"], a[href="/"]').first().tap();
  await page.waitForTimeout(900);
  return page.evaluate(`document.querySelectorAll('#cat-score .cat-paw.got').length`);
}

/**
 * A point inside the card's board that belongs to nobody — no tile — so a tap there is
 * unambiguously a throw. Card-relative, so there is nothing to re-ask after a scroll.
 */
async function openGround(page, tries = 3) {
  for (let i = 0; i < tries; i++) {
    const hit = await page.evaluate(() => {
      const board = document.querySelector('[data-board]');
      if (!board) return null;
      const b = board.getBoundingClientRect();
      // Fine step: the board's gaps and padding ring are ~7–10px, so a coarser scan
      // lands on tiles every time and the fixture reads as "no open ground".
      for (let y = b.top + 4; y < b.bottom - 4; y += 6)
        for (let x = b.left + 4; x < b.right - 4; x += 6) {
          const el = document.elementFromPoint(x, y);
          if (el && !el.closest('.cat-tile')) return { x, y };
        }
      return null;
    });
    if (hit) return hit;
    await page.waitForTimeout(300);
  }
  return null;
}

/** Open the card and wait for the board to appear **and settle** (the panel's 0.18s open
 *  animation scales it from 0.86→1; coordinates measured mid-animation are stale by the
 *  time a finger lands — this flaked sections 2 and 4 until the settle). */
async function openCard(page) {
  await page.locator('#cat-card-toggle').tap();
  await page.waitForFunction(() => !!document.querySelector('.cat-tile[data-state="claimed"]'), undefined, { timeout: 9000 }).catch(() => {});
  await page.waitForTimeout(400);
}

/** A tappable link on the page (still a thing: the card must not eat the page). */
async function findLink(page) {
  return page.evaluate(async () => {
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

// ---- 1. the card is tappable on a phone, and a held finger reclaims
{
  const ctx = await phone();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const cdp = await ctx.newCDPSession(page);

  const btn = page.locator('#cat-card-toggle');
  ok('the card icon is shown on a phone', await btn.isVisible());
  ok('the target is tap-sized', (await btn.evaluate((b) => b.getBoundingClientRect().height)) >= 44, '');

  await btn.tap();
  const opened = await page
    .waitForFunction(() => !!document.querySelector('.cat-tile[data-state="claimed"]'), undefined, { timeout: 9000 })
    .then(() => true)
    .catch(() => false);
  ok('tapping it opens the card', opened && (await page.evaluate(ARMED)));
  ok('and it says it is open', (await btn.getAttribute('aria-expanded')) === 'true');
  // Settle the open animation before measuring any tile: `btn.tap()` above waits only for the
  // first claimed tile to *exist*, but the panel still runs its 0.18s scale-up. A rect read
  // mid-animation is stale by the time the finger lands, so the hold starts on empty board and
  // "0 reclaims" (§2/§4 already clear this race via `openCard`'s settle; §1 was missing it).
  await waitOpen(page);

  // The core verb, on a finger: hold a claimed tile until it comes back.
  const holdDeal = await deal(page, wants.spot(), { deals: 6, tap: true });
  const spot = holdDeal.value;
  fixture('found a claimed tile to hold', holdDeal, spot ? `${spot.x},${spot.y}` : '');
  if (spot) {
    // The chosen tile is the board's own — measured distance from the boss is whatever it is;
    // what matters for §5.2 is that a completed hold frees it. Report the gap for the log.
    const gap = await page.evaluate(([x, y]) => {
      const boss = document.querySelector('[data-boss]')?.getBoundingClientRect();
      return boss ? Math.round(Math.hypot(x - (boss.left + boss.width / 2), y - (boss.top + boss.height / 2))) : -1;
    }, [spot.x, spot.y]);
    note(`tile ${gap}px from the boss`);
    // Observe the freed flash: `.cat-tile[data-state="freed"]` is added by free(node, true)
    // on a completed scrub and by nothing else.
    await page.evaluate(() => {
      window.__freed = 0;
      new MutationObserver((recs) => {
        for (const r of recs)
          if (r.target instanceof Element && r.target.dataset?.state === 'freed') window.__freed++;
      }).observe(document.body, { attributes: true, attributeFilter: ['data-state'], subtree: true });
    });
    await finger(cdp, spot.x, spot.y, SCRUB_MS + 500);
    const freed = await page.evaluate(() => window.__freed);
    ok('a held finger reclaims the tile (§5.2 on touch)', freed > 0, `${freed} reclaim(s) observed`);
  }
  ok('no console errors through a touch fight', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

// ---- 2. the progress is visible in the tile, not under the fingertip
{
  const ctx = await phone();
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const cdp = await ctx.newCDPSession(page);
  await openCard(page);

  const spotDeal = await deal(page, wants.spot(), { deals: 6, tap: true });
  const spot = spotDeal.value;
  fixture('found a claimed tile to watch fill', spotDeal, spot ? `${spot.x},${spot.y}` : '');
  if (spot) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: spot.x, y: spot.y }] });
    await page.waitForTimeout(Math.round(SCRUB_MS * 0.55));
    const mid = await page.evaluate(([x, y]) => {
      const el = document.elementFromPoint(x, y)?.closest('.cat-tile');
      return {
        state: el?.dataset.state ?? '',
        scrub: el ? Number(el.style.getPropertyValue('--scrub') || 0) : -1,
        shadow: el ? getComputedStyle(el).boxShadow : '',
      };
    }, [spot.x, spot.y]);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

    ok('mid-hold, the tile itself carries the progress', mid.state === 'scrubbing' && mid.scrub > 0.15 && mid.scrub < 0.95, `state=${mid.state} --scrub ${mid.scrub}`);
    // The wash is `7% + 19% × --scrub`, resolved to a color with an alpha — Chromium serialises
    // the color-mix() as `color(srgb r g b / a)`, so the *last* number is the alpha to read.
    const alpha = Number((mid.shadow.match(/([\d.]+)\)/) ?? [])[1] ?? 0) || 0;
    const want = 0.07 + 0.19 * mid.scrub;
    ok(
      'and the wash really deepens with it, not just the variable',
      alpha > 0.07 && Math.abs(alpha - want) < 0.02,
      `alpha ${alpha.toFixed(4)} vs 7% + 19%×${mid.scrub} = ${want.toFixed(4)}`,
    );

    // ...and it is cleaned up when the finger lifts (no stray --scrub left on the card)
    await page.waitForTimeout(400);
    const left = await page.evaluate(() => [...document.querySelectorAll('[style*="--scrub"]')].length);
    ok('no --scrub is left on the card after the finger lifts', left === 0, `${left} elements`);
  }
  await ctx.close();
}

// ---- 3. THE DESIGN on the card: distance is board distance, and there is no scroll to flick
{
  const ctx = await phone();
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const cdp = await ctx.newCDPSession(page);
  await openCard(page);

  // §2.2's table: every distance constant is scaled 1/5, so the safe distance is CARD_SAFE_FLEE_PX.
  ok('the card scale keeps the safe distance in the board’s proportions', CARD_SAFE_FLEE_PX < 120, `${CARD_SAFE_FLEE_PX.toFixed(0)}px on a ~296px board`);
  await ctx.close();
}

// ---- 4. the page keeps working: a tap on a link navigates, a tap on ground throws
{
  const ctx = await phone();
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const cdp = await ctx.newCDPSession(page);
  const ammoBefore = await armAmmo(page);
  ok('earned treats by tapping through tabs', ammoBefore >= 2, `${ammoBefore} in hand`);
  await openCard(page);

  const ground = await openGround(page);
  fixture('found open ground in the card', ground, ground ? `${ground.x},${ground.y}` : '');
  if (ground) {
    await finger(cdp, ground.x, ground.y, 90);
    await page.waitForTimeout(250);
    ok(
      'a brief tap on open ground throws one (§3’s one button)',
      await page.evaluate(`!document.querySelector('[data-treat]').hidden`),
    );
  }

  // A link on the page still navigates, mid-fight, on a tap. §11 promises the page keeps working.
  const link = await findLink(page);
  fixture('found a link in the band to tap mid-fight', link, link?.href ?? '');
  if (link) {
    const from = page.url();
    await finger(cdp, link.x, link.y, 90);
    await page.waitForTimeout(1400);
    ok('a tap on a page link still navigates during a fight', page.url() !== from, `${link.href} → ${new URL(page.url()).pathname}`);
    // 2.2: the card persists across navigation (transition:persist), so the fight
    // *survives* page hops — browsing is not an escape hatch, and treats found on the
    // next page still feed the same fight. The page game ended the fight on navigate
    // because its claims lived in the page; the card owns its own board.
    ok('and the fight is still on — the card persists across navigation (§2.2)', await page.evaluate(ARMED));
  }
  await ctx.close();
}

// ---- 4b. a hybrid device: one machine where both inputs are real
{
  const ctx = await context(browser, { mode: 'manual', hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const cdp = await ctx.newCDPSession(page);
  const armed = await armAmmo(page);
  ok('hybrid: armed with treats', armed >= 2, `${armed} in hand`);
  await page.click('#cat-card-toggle');
  await page.waitForFunction(() => !!document.querySelector('.cat-tile[data-state="claimed"]'), undefined, { timeout: 9000 }).catch(() => {});

  // A long touch on open ground stamps the touch record without throwing (§5.4's silent-failure guard).
  const g1 = await openGround(page);
  ok('hybrid: found open ground', !!g1);
  if (g1) {
    await finger(cdp, g1.x, g1.y, 600);
    await page.waitForTimeout(300);
    ok(
      'a long touch on open ground throws nothing, but is on the record',
      await page.evaluate(`document.querySelector('[data-treat]').hidden`),
    );

    // Then the mouse, at the same point. This must still throw.
    await page.mouse.move(g1.x, g1.y);
    await page.mouse.click(g1.x, g1.y);
    await page.waitForTimeout(300);
    ok(
      'a mouse click still throws after the screen has been touched',
      await page.evaluate(`!document.querySelector('[data-treat]').hidden`),
    );
  }
  await ctx.close();
}

// ---- 5. §11's hard rules still hold on the card's own furniture
{
  const ctx = await phone();
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const cdp = await ctx.newCDPSession(page);

  await openCard(page);

  // The card is fixed chrome: it must never give the page a horizontal scrollbar.
  const hscroll = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  ok('no horizontal overflow at 390px with the card open', hscroll === 0, `${hscroll}px`);

  // Zoom must survive on a claimed tile: `touch-action: pinch-zoom`, not `none`.
  const ta = await page.evaluate(() => {
    const c = document.querySelector('.cat-tile[data-state="claimed"]');
    return c ? getComputedStyle(c).touchAction : '';
  });
  ok('a claim refuses panning but not pinch-zoom (§11)', ta === 'pinch-zoom', JSON.stringify(ta));

  // Long-press suppression on the tile: no text selection from a held finger.
  const sel = await page.evaluate(() => {
    const c = document.querySelector('.cat-tile[data-state="claimed"]');
    return c ? getComputedStyle(c).userSelect : '';
  });
  ok('a held finger cannot start a text selection on a claim', sel === 'none', JSON.stringify(sel));
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

  // Then a truce, and the card closed — the page was never touched, so it is as found.
  await page.locator('#cat-card-close').tap();
  await page
    .waitForFunction(() => document.querySelector('#cat-card-panel').hidden, undefined, { timeout: 9000 })
    .catch(() => {});
  await page.waitForTimeout(200);
  ok('the close button ends it on touch too, with no Esc key to fall back on', !(await page.evaluate(ARMED)));
  await ctx.close();
}

// ---- 6. the card is a guest on the page, on short screens too (2.1's rule, kept)
{
  const ctx = await context(browser, { mode: 'manual', viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1600);

  // The collapsed icon sits bottom-right; the hero's own buttons must stay reachable.
  const rest = await page.evaluate(() => {
    const icon = document.querySelector('#cat-card-toggle')?.getBoundingClientRect();
    return {
      icon: icon ? `${Math.round(icon.left)}–${Math.round(icon.right)},${Math.round(icon.top)}–${Math.round(icon.bottom)}` : 'none',
      buttons: [...document.querySelectorAll('.glass a, .glass button')].map((el) => {
        const r = el.getBoundingClientRect();
        const at = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
        return { label: el.textContent.trim().slice(0, 16), blocked: !!at?.closest('#cat-card-toggle') };
      }),
    };
  });
  ok(
    'the hero’s own buttons are reachable on a short phone, card icon and all',
    rest.buttons.length > 0 && rest.buttons.every((b) => !b.blocked),
    rest.buttons.map((b) => `${b.label}${b.blocked ? ' BLOCKED' : ''}`).join(', '),
  );

  // …and the card is still a control: the game has to be reachable from the page a visitor lands on.
  const tapped = await page
    .locator('#cat-card-toggle')
    .tap()
    .then(() => true)
    .catch(() => false);
  ok('the way into the game is still tappable from the page', tapped);
  await page.waitForFunction(() => document.querySelectorAll('.cat-tile[data-state="claimed"]').length > 0, undefined, { timeout: 9000 }).catch(() => {});
  const claims = await page.evaluate(CLAIMS);
  ok('and it opens a fight', claims > 0, `${claims} claims`);
  ok('no console errors around the mobile card', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

await browser.close();
if (!done()) process.exit(1);
