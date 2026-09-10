/**
 * Build steps 0 + 1 of the cat card — checked in a real browser, on the card game (2.2).
 *
 * This is the oldest harness in the fleet, and its subject is unchanged: the way into a
 * fight (step 0, the toggle) and the core verb (step 1, claim + scrub), plus the
 * lifecycle questions every fight raises — the restore, storage, reduced motion, touch,
 * a narrow window, contrast, the idle truce, and the hidden-tab truce. What §2.2 changes
 * is the *surface* the checks run against. The page-board game is gone (CatArena.astro is
 * deleted); the game lives on a mini-board of tiles inside a floating card opened from
 * `#cat-card-toggle`.
 *
 * 2.2's drop list, applied:
 * - No page scrolling, no viewport band (`wants.spot` took `top/bottom/maxHeight` and no
 *   longer does — the card's board is all on screen by construction).
 * - No `.cat-claimed`/`.cat-arena-on` — claims are `.cat-tile[data-state="claimed"]`, the
 *   boss is `[data-boss]`, and "the arena is on" is "the card's panel is open".
 * - §3's page snapshot no longer *restores* the page (the card never touches it); the
 *   check becomes the stronger pillar-2 statement: the page is byte-identical *while* the
 *   card plays, and it still closes back to collapsed.
 * - §4's "navigating ends the fight" is inverted: the card is `transition:persist` chrome,
 *   so navigation keeps the fight where the page game used to end it.
 * - §8b (a planted inline style surviving the page game's `dropNested`) is dropped: the
 *   card claims nothing on the page, so there is no page-element round-trip left to check.
 *
 * What survives unchanged is the mechanics: a hold is a scrub (`--scrub` 0→1, 1400ms), a
 * reclaim drops the claim count by one, drifting more than STILL_PX resets it, a win is
 * still the ambient cat's `notched`, and the truces (idle, hidden-tab) keep their clocks.
 */
/*
 * ## Known: the three snapshot checks are unreliable, and it is not the game's fault
 *
 * `the card never touches the page while it plays`, `the page is byte-identical after the card
 * closes` and `off is a full restore too` fail on roughly four runs in five, giving 52/55. Measured
 * at this commit **and at the one before it** (five runs each side, 55 once and 52 the other four)
 * — so it is not a regression from the covers work, and the 55/55 recorded in that commit message
 * was the lucky run rather than the normal one. Recorded here so nobody re-diagnoses it from
 * scratch, and so the next person does not read a green 55 as proof of anything.
 *
 * **The failure text is misleading and the number is meaningless.** It reports "245 differences,
 * first: 47:BODY:… → 47:SCRIPT::". `snapshotOf` records elements by *index*, so one extra element
 * in `<head>` re-indexes everything after it and every subsequent entry compares against its
 * neighbour. There is one difference, not 245: the two snapshots disagree about how many children
 * `<head>` has.
 *
 * **What adds it is not established.** Two probes (`scratchpad/headdiff.mjs`, `headdiff2.mjs`)
 * driving pointer movement, scrolling and a full deal saw `<head>` stay at 46 children and the
 * document stay at 406 elements, so whatever inserts it happens on a path those did not take. The
 * honest fix is to key the snapshot on something stable rather than on position — but that is a
 * change to the instrument every arena harness shares, and it should be made deliberately rather
 * than in passing.
 */

import {
  BASE,
  deal,
  fresh as context,
  launch,
  press,
  reachClaim,
  release,
  report,
  snapDiff,
  snapshotOf,
  wants,
} from './lib/fixture.mjs';

const browser = await launch();
const { ok, note, fixture, done } = report();

/** A desktop context playing **manual mode** — every check here is about §3's pointer fight. */
const fresh = (opts = {}) => context(browser, { mode: 'manual', ...opts });

/**
 * A claim the pointer can actually hold — the one farthest from the boss, which is §5.2's
 * own advice and the one the boss cannot reach inside a single 1400ms scrub (so the hold is
 * not interrupted by a pounce). Dealt for, so a board that cannot offer one re-deals.
 */
const farSpot = (page) => deal(page, reachClaim, { deals: 6, settle: 240 });

/**
 * The game's own reclaimed count, read from the caption ("X / Y reclaimed"). This is the
 * authoritative signal — a tile's `data-state` leaves `claimed` for `scrubbing` the moment a
 * hold *starts*, so the DOM `claimed` count drops on beginning a hold, not on finishing one.
 * The caption is `arenaCaption(arena.claimed.length, …)`, which only moves on a real reclaim.
 */
const reclaimed = (page) =>
  page.evaluate(() => {
    const c = document.querySelector('[data-caption]')?.textContent ?? '';
    const m = c.match(/(\d+) \/ \d+ reclaimed/);
    return m ? Number(m[1]) : -1;
  });

const CLAIMS = `document.querySelectorAll('.cat-tile[data-state="claimed"]').length`;
const OPEN = `!document.querySelector('#cat-card-panel').hidden`;

/**
 * The page as pillar 2 defines it: every element's tag, classes and inline style, in order.
 * The card's chrome (`.cat-card-root`) and the cat's ambient furniture (`#site-cat`, the
 * `#cat-hud` paw row) are excluded — they legitimately differ. What must not differ, open
 * or closed, is everything else, because the card never touches the page.
 */
const SNAPSHOT = snapshotOf('.cat-card-root, #site-cat, #cat-hud');

// ---- 1. the toggle: visible, real, and announced
{
  const ctx = await fresh({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(600);

  const btn = page.locator('#cat-card-toggle');
  ok('the toggle is visible without being hunted for', await btn.isVisible());

  const shape = await btn.evaluate((b) => ({
    tag: b.tagName,
    type: b.getAttribute('type'),
    expanded: b.getAttribute('aria-expanded'),
    controls: b.getAttribute('aria-controls'),
    label: b.getAttribute('aria-label') ?? b.textContent.trim(),
    hiddenAncestor: !!b.closest('[aria-hidden="true"]'),
    box: b.getBoundingClientRect().height,
  }));
  ok('it is a real button, not a div with a handler', shape.tag === 'BUTTON' && shape.type === 'button');
  ok('it announces its state', shape.expanded === 'false', `aria-expanded=${shape.expanded}`);
  ok('it points at the panel it opens', shape.controls === 'cat-card-panel', `aria-controls=${shape.controls}`);
  ok('it is NOT inside anything aria-hidden', !shape.hiddenAncestor, 'a control cannot be hidden and usable');
  ok('the label says what it does', /cat/i.test(shape.label), JSON.stringify(shape.label));

  // Reachable and operable from the keyboard alone — Enter is what a real button does.
  await page.locator('#cat-card-toggle').focus();
  const focused = await page.evaluate(() => document.activeElement?.id === 'cat-card-toggle');
  await page.keyboard.press('Enter');
  await page
    .waitForFunction(() => !document.querySelector('#cat-card-panel').hidden, undefined, { timeout: 7000 })
    .catch(() => {});
  ok('reachable and operable by keyboard', focused && (await page.evaluate(CLAIMS)) > 0);

  ok('pressing it deals tiles on the card', (await page.evaluate(CLAIMS)) > 0, `${await page.evaluate(CLAIMS)} claims`);
  ok('aria-expanded follows the card', (await btn.getAttribute('aria-expanded')) === 'true');

  // ---- what it must never claim: the page itself
  const never = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('.cat-tile')];
    return {
      pageClaims: document.querySelectorAll('.cat-claimed').length,
      arenaOn: document.documentElement.classList.contains('cat-arena-on'),
      allInBoard: tiles.every((t) => !!t.closest('[data-board]')),
      allButtons: tiles.every((t) => t.tagName === 'BUTTON' && t.getAttribute('type') === 'button'),
      nested: tiles.filter((t) => tiles.some((o) => o !== t && o.contains(t))).length,
    };
  });
  ok(
    'the card claims nothing on the page — the page-board game is gone',
    never.pageClaims === 0 && !never.arenaOn,
    `page claims ${never.pageClaims}, arena-on ${never.arenaOn}`,
  );
  ok('every tile lives on the card board, nowhere else', never.allInBoard);
  ok('tiles are real buttons too', never.allButtons);
  ok('no tile sits inside another', never.nested === 0);

  // ---- the page must stay usable
  const usable = await page.evaluate(() => {
    const de = document.documentElement;
    return {
      hscroll: de.scrollWidth - de.clientWidth,
      linksClickable: [...document.querySelectorAll('main a[href]')].every(
        (a) => getComputedStyle(a).pointerEvents !== 'none',
      ),
      selectable: getComputedStyle(document.body).userSelect !== 'none',
    };
  });
  ok('no horizontal scrollbar at 1280 while the card is open', usable.hscroll === 0, `${usable.hscroll}px`);
  ok('every link stays clickable', usable.linksClickable);
  ok('text stays selectable', usable.selectable);
  ok(
    'focus moves into the card, not trapped in it',
    await page.evaluate(() => document.activeElement?.id === 'cat-card-close'),
  );
  ok('no console errors opening the card', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---- 2. scrubbing: hold still, take it back
{
  const ctx = await fresh({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await press(page);
  await page.waitForTimeout(200);

  const before = await reclaimed(page);
  const spotDeal = await farSpot(page);
  const spot = spotDeal.value;
  fixture('the board dealt a claim the pointer can hold', spotDeal, spot ? `${spot.x},${spot.y}` : '');
  await page.mouse.move(spot.x, spot.y);
  await page.waitForTimeout(250);
  const ring = await page.evaluate(() => {
    const t = document.querySelector('.cat-tile[data-state="scrubbing"]');
    return {
      shown: !!t,
      progress: t ? parseFloat(getComputedStyle(t).getPropertyValue('--scrub')) || 0 : -1,
    };
  });
  ok('a scrub ring appears where you are holding', ring.shown);
  ok(
    'the scrub reports progress rather than sitting full',
    ring.progress > 0 && ring.progress < 1,
    `progress ${ring.progress.toFixed(2)} of 1`,
  );

  await page.waitForTimeout(1500); // past SCRUB_MS 1400
  const after = await reclaimed(page);
  ok('holding still takes one back', after === before + 1, `${before} → ${after} reclaimed`);

  const caption = await page.textContent('[data-caption]');
  ok('the HUD says what you have reclaimed', /reclaimed/i.test(caption), JSON.stringify(caption));

  // Drifting resets the hold rather than banking it. Dealt for, like the hold above — an
  // unworkable claim would pass this vacuously, and this check asserts something does NOT
  // happen, so it must be given a claim the drift could otherwise have taken.
  const driftDeal = await farSpot(page);
  fixture('a claim to drift over', driftDeal, driftDeal.value ? `${driftDeal.value.x},${driftDeal.value.y}` : '');
  const spot2 = driftDeal.value ?? { x: 640, y: 450 };
  const mid = await reclaimed(page);
  for (let i = 0; i < 14; i++) {
    await page.mouse.move(spot2.x + (i % 2 ? 14 : -14), spot2.y + (i % 3 ? 11 : -11));
    await page.waitForTimeout(120);
  }
  const drifted = await reclaimed(page);
  ok('drifting for longer than a scrub takes nothing', drifted === mid, `${mid} → ${drifted} reclaimed`);
  await ctx.close();
}

// ---- 3. the card never touches the page, and Esc returns it to collapsed
{
  const ctx = await fresh({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(600);

  const clean = await page.evaluate(SNAPSHOT);
  await press(page);
  await page.waitForTimeout(150);
  const openDiff = await snapDiff(page, SNAPSHOT, clean);
  ok('the card never touches the page while it plays (pillar 2)', openDiff.n === 0, openDiff.detail);

  // Scrub one back first, so the close has a reclaim to unwind.
  const restoreDeal = await farSpot(page);
  fixture(
    'a claim to reclaim before restoring',
    restoreDeal,
    restoreDeal.value ? `${restoreDeal.value.x},${restoreDeal.value.y}` : '',
  );
  const spot = restoreDeal.value ?? { x: 640, y: 450 };
  await page.mouse.move(spot.x, spot.y);
  await page.waitForTimeout(1600);

  await release(page);
  const restored = await snapDiff(page, SNAPSHOT, clean);
  ok('the page is byte-identical after the card closes', restored.n === 0, restored.detail);
  ok('the card is back to collapsed after the fight', await page.evaluate(OPEN) === false);
  ok(
    'the toggle un-expands itself',
    (await page.locator('#cat-card-toggle').getAttribute('aria-expanded')) === 'false',
  );
  ok(
    'focus returns to the icon on close',
    await page.evaluate(() => document.activeElement?.id === 'cat-card-toggle'),
  );

  // And the toggle still works afterwards.
  await press(page);
  await page.waitForTimeout(120);
  ok('it can be switched on again', (await page.evaluate(CLAIMS)) > 0);
  await release(page);
  const offAgain = await snapDiff(page, SNAPSHOT, clean);
  ok('off is a full restore too', offAgain.n === 0, offAgain.detail);
  await ctx.close();
}

// ---- 4. a refresh ends it, navigation keeps it, and nothing fight-scoped is stored
{
  const ctx = await fresh({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await press(page);
  await page.waitForTimeout(200);

  const stored = await page.evaluate(() => ({
    local: Object.keys(localStorage).filter((k) => /arena/i.test(k)),
    session: Object.keys(sessionStorage).filter((k) => /arena|cat/i.test(k)),
  }));
  ok(
    'the page game left no storage behind',
    stored.local.length === 0 && stored.session.length === 0,
    JSON.stringify(stored),
  );

  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(500);
  ok(
    'a refresh cannot land you mid-fight',
    (await page.evaluate(CLAIMS)) === 0 && (await page.evaluate(OPEN)) === false,
  );

  // Client-side navigation: the card is transition:persist chrome, so the fight survives
  // where the page game used to end it — the 2.2 inversion of this section's old subject.
  await press(page);
  await page.waitForTimeout(200);
  await page.click('main a[href^="/"]');
  await page.waitForTimeout(900);
  ok(
    'navigating does not end the fight — the card persists (§2.2)',
    (await page.evaluate(CLAIMS)) > 0 && (await page.evaluate(OPEN)) === true,
  );

  await release(page);
  await press(page);
  await page.waitForTimeout(200);
  ok('the toggle still works after a navigation', (await page.evaluate(CLAIMS)) > 0);
  await ctx.close();
}

// ---- 5. reduced motion: the card plays, animation stands down
{
  const ctx = await fresh({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(600);

  const btn = page.locator('#cat-card-toggle');
  ok('the card is still offered under reduced motion', await btn.isVisible());
  ok(
    'and not marked disabled — hiding the game was the paternalism 0.2 retracted',
    (await btn.getAttribute('aria-disabled')) === null,
  );

  await press(page);
  await page.waitForTimeout(200);
  ok('opening still deals a board', (await page.evaluate(CLAIMS)) > 0, `${await page.evaluate(CLAIMS)} claims`);

  // The core verb is logic, not animation: a hold still reclaims under reduced motion.
  const before = await reclaimed(page);
  const spotDeal = await farSpot(page);
  const spot = spotDeal.value;
  fixture('a claim to hold under reduced motion', spotDeal, spot ? `${spot.x},${spot.y}` : '');
  await page.mouse.move(spot.x, spot.y);
  await page.waitForTimeout(1600);
  const after = await reclaimed(page);
  ok('a hold still reclaims — the mechanic is not the animation', after === before + 1, `${before} → ${after} reclaimed`);
  await ctx.close();
}

// ---- 6. a touch screen: offered, tap-sized, pinch-zoom-safe
{
  const ctx = await fresh({ phone: true });
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const btn = page.locator('#cat-card-toggle');
  ok('the toggle is shown on a phone', await btn.isVisible());
  ok('and is offered, not refused', (await btn.getAttribute('aria-disabled')) === null);
  const tap = await btn.evaluate((b) => b.getBoundingClientRect().height);
  ok('the target is tap-sized', tap >= 44, `${tap.toFixed(0)}px tall`);

  await press(page, { tap: true });
  await page.waitForTimeout(300);
  ok('tapping it opens a fight', (await page.evaluate(CLAIMS)) > 0);
  const hscroll = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  ok('no horizontal overflow at 390px, card and all', hscroll === 0, `${hscroll}px`);
  // §11's zoom row is no-exceptions, and `touch-action: none` would have broken it.
  const ta = await page.evaluate(() => {
    const c = document.querySelector('.cat-tile');
    return c ? getComputedStyle(c).touchAction : '(no tile)';
  });
  ok('a tile refuses panning but never pinch-zoom (§11)', ta === 'pinch-zoom', JSON.stringify(ta));
  // No Escape key on a phone — the close button is the way out.
  await release(page, { tap: true });
  ok('and the close button ends it', (await page.evaluate(OPEN)) === false);
  await ctx.close();
}

// ---- 7. a narrow desktop window: the card must not widen the page
{
  const ctx = await fresh({ viewport: { width: 400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const before = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  await press(page);
  await page.waitForTimeout(200);
  const during = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  const claims = await page.evaluate(CLAIMS);
  ok('opening the card never adds a horizontal scrollbar', during <= before, `${before} → ${during} with ${claims} claims`);
  await ctx.close();
}

// ---- 8. contrast: a claim washes the tile, and must not push its text under AA
for (const theme of ['light', 'dark']) {
  const ctx = await fresh({ viewport: { width: 1280, height: 900 } });
  if (theme === 'dark') await ctx.addInitScript(() => localStorage.setItem('theme', 'dark'));
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await press(page);
  await page.waitForTimeout(200);

  const ratios = await page.evaluate(() => {
    /** Resolve any CSS colour — `rgb()`, `color(srgb …)`, `color-mix` — to [r,g,b] in 0–255. */
    const toRgb = (s) => {
      const n = (s.match(/[\d.]+/g) || []).map(Number);
      if (s.startsWith('color(')) return n.slice(0, 3).map((v) => (v <= 1 ? Math.round(v * 255) : v));
      return n.slice(0, 3);
    };
    const lum = ([r, g, b]) =>
      [r, g, b]
        .map((v) => v / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (a, b) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    /** The wash: accent blended over the tile's background at TINT (an inset box-shadow). */
    const over = (fg, bg, a) => bg.map((c, i) => c * (1 - a) + fg[i] * a);
    const probe = (prop) => {
      const s = document.createElement('span');
      s.style.color = `var(${prop})`;
      document.body.append(s);
      const v = toRgb(getComputedStyle(s).color);
      s.remove();
      return v;
    };
    const accent = probe('--color-accent');
    const TINT = 0.07; // must match the claimed-tile wash in CatCard.astro
    const out = [];
    for (const el of document.querySelectorAll('.cat-tile[data-state="claimed"]')) {
      if (!el.textContent.trim()) continue;
      const cs = getComputedStyle(el);
      const bg = toRgb(cs.backgroundColor);
      if (bg.length !== 3) continue;
      out.push({
        tag: el.tagName,
        before: ratio(toRgb(cs.color), bg),
        after: ratio(toRgb(cs.color), over(accent, bg, TINT)),
      });
    }
    return out;
  });
  const worst = ratios.reduce((a, r) => (r.after < a.after ? r : a), ratios[0]);
  ok(
    `${theme}: no claimed tile pushes its text under AA`,
    ratios.length > 0 && ratios.every((r) => r.after >= 4.5),
    `worst ${worst?.tag} ${worst?.before.toFixed(2)} → ${worst?.after.toFixed(2)} over ${ratios.length} tiles`,
  );
  await ctx.close();
}

// ---- 8c. playing well is not the same as not playing (§11 vs §5.2)
{
  /*
   * The complement of the idle truce below, and a real bug when this was written. `scrub.seen`
   * — the idle clock — was refreshed only by `pointermove`, but the core verb is holding the
   * pointer **still**. A player pinned on one claim by a cat that keeps interrupting makes
   * continuous progress, never moves the mouse, and at IDLE_TRUCE_MS the game quietly ended
   * itself under them. The card's `stepScrub` refreshes `scrub.seen` every frame it is on a
   * claimed tile, which is the fix this section now verifies is present.
   *
   * Siege, deliberately: it is pinned to the floor so it cannot pounce the hold, and its
   * regrow claims the most recently freed tile — the one under the parked cursor — so the hold
   * completes, the board grows it back underneath, and the hold starts again, forever.
   */
  const ctx = await fresh({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(600);

  const siege = await deal(page, wants.stance(['siege'], { claims: 'inView' }), { deals: 16, settle: 0 });
  const stance = siege.value ?? '';
  const spot = siege.value ? await reachClaim(page) : null;
  fixture('rolled a siege fight with somewhere to hold', siege, stance);

  if (stance === 'siege' && spot) {
    // Exactly one pointer move, then nothing at all for longer than the idle truce.
    await page.mouse.move(spot.x, spot.y);
    await page.waitForTimeout(24_000);
    const after = await page.evaluate(() => ({
      open: !document.querySelector('#cat-card-panel').hidden,
      claims: document.querySelectorAll('.cat-tile[data-state="claimed"]').length,
    }));
    ok(
      'a fight being played without mouse movement is not treated as abandoned',
      after.open && after.claims > 0,
      `open=${after.open}, ${after.claims} claims after 24s on a single hold`,
    );
    await release(page);
  }
  await ctx.close();
}

// ---- 9. auto-truce on a hidden tab
{
  const ctx = await fresh({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await press(page);
  await page.waitForTimeout(150);
  // Fake a long absence: the handler compares wall-clock stamps, so overriding Date.now once
  // is enough to test the rule without waiting ten seconds.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    const real = Date.now;
    Date.now = () => real() + 20000;
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Date.now = real;
  });
  await page.waitForTimeout(300);
  const ended = await page.evaluate(() => ({
    claims: document.querySelectorAll('.cat-tile[data-state="claimed"]').length,
  }));
  ok('a long absence ends the fight by itself', ended.claims === 0, `${ended.claims} claims left`);
  await ctx.close();
}

await browser.close();
if (!done()) process.exit(1);
