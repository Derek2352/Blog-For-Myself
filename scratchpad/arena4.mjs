/**
 * Build step 4: territory, endings, dialogue — "first full loop", on the card game (2.2).
 *
 * A loop is only closed if both ends are reachable, so this harness *plays two whole
 * fights*: one lost on purpose (stand still with no treats and let the cat take the
 * card) and one won (browse for ammo, then work the far side of the card's board).
 * Anything less than playing them proves the code runs, not that the game ends.
 *
 * 2.2's drop list applies. The board is the card's own (~296×180), so there is no page
 * scrolling and no viewport band to hunt — a claim is reachable by construction. The
 * territory bar is a strip across the top of the card (`[data-territory]`, sized by a
 * 0..1 `--territory` custom property) rather than a page-edge bar; the ribbon is the
 * card's `[data-ribbon]`; the boss is `[data-boss]`. Pillar 2 becomes "the card never
 * touches the page": the snapshot check asserts the page is byte-identical *while* the
 * card plays and after it closes, instead of "the page is restored after the fight".
 *
 * Two mechanics the page game had and the card changed, noted where they matter:
 *
 * - The **parting line**. The page game's ribbon was the ambient cat's, and a truce line
 *   outlived the fight. The card's ribbon lives *inside* the card, and `truce()` says the
 *   line then `endFight()`→`hushRibbon()` clears it in the same synchronous task — so no
 *   read taken after `release` can see it. The line is still *produced* (`truce()` calls
 *   `say()`), so `WATCH_LINES` records the text node that passes through the DOM rather
 *   than a visible ribbon. That keeps the assertion (a truce gets an in-character parting
 *   line) without pretending the card leaves the ribbon up.
 *
 * - The **notch**. A win still lands on the *ambient* cat (`#site-cat.notched`), not the
 *   card's boss — §7.1's promise is session-scoped on the animal the visitor meets in the
 *   corner. The checks that read the notch are unchanged.
 */

import {
  BASE,
  SCRUB_MS,
  CARD_SAFE_FLEE_PX,
  armAmmo,
  deal,
  fresh as context,
  launch,
  press as sharedPress,
  reachClaim,
  release as sharedRelease,
  report,
  snapDiff,
  snapshotOf,
  wants,
} from './lib/fixture.mjs';

/*
 * The reporter, the context factory, the launcher and the open/close waits come from
 * `lib/fixture.mjs` (§12.1's charter). This file carried its own copy of each, which is
 * how one idea ended up with eleven implementations and a fix at one call site could
 * never be a fix.
 */
const browser = await launch();
const { ok, note, fixture, done } = report();

/** Shared with the fleet; this file has always allowed 8000ms for the open. */
const press = (page) => sharedPress(page, { timeout: 8000 });
const release = (page) => sharedRelease(page, { timeout: 8000 });

/**
 * A desktop context playing **manual mode** — this file plays two whole fights with a
 * pointer, so the mode is declared before either of them opens.
 */
const fresh = (opts = {}) => context(browser, { mode: 'manual', ...opts });

const CLAIMS = `document.querySelectorAll('.cat-tile[data-state="claimed"]').length`;
const AMMO = `document.querySelectorAll('#cat-score .cat-paw.got').length`;
/** The player's share of the card board, 0..1 — read off the territory fill's `--territory`. */
const MINE = `parseFloat(document.querySelector('[data-territory]')?.style.getPropertyValue('--territory')) || 0`;
const OPEN = `!document.querySelector('#cat-card-panel').hidden`;
const NOTCHED = `document.getElementById('site-cat').classList.contains('notched')`;

/**
 * Every line the ribbon shows, with a timestamp — plus the lines the card says and hushes
 * in the same breath, which no read taken after the fact can see.
 *
 * `__said` is the visible dialogue (the seven §8 rules read this). `__transient` is the
 * union of every text node that passed through the ribbon, visible or not — the truce line
 * is the one that matters, since `truce()` calls `say()` and `endFight()` back-to-back.
 * A MutationObserver records the *mutations* (the text node was added and removed), so it
 * still names the line even though the ribbon is already hidden and empty when any later
 * sample runs.
 */
const WATCH_LINES = () => {
  const node = document.querySelector('[data-ribbon]');
  window.__said = [];
  window.__transient = [];
  const push = () => {
    const t = node.hidden ? '' : node.textContent.trim();
    if (t && window.__said.at(-1)?.text !== t) window.__said.push({ text: t, t: performance.now() });
  };
  const seen = (n) => {
    if (n.nodeType === 3 && n.data.trim() && !window.__transient.includes(n.data.trim()))
      window.__transient.push(n.data.trim());
  };
  push();
  new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of m.addedNodes) seen(n);
      for (const n of m.removedNodes) seen(n);
    }
    push();
  }).observe(node, { childList: true, characterData: true, subtree: true });
};

/**
 * The page as pillar 2 defines it: every element's tag, classes and inline style, in order.
 * The card's chrome (`.cat-card-root`), the ambient cat and the HUD paw row are excluded —
 * they legitimately differ. Everything else must be byte-identical whether the card is
 * open, playing, or closed again, because the card never touches the page.
 */
const SNAPSHOT = snapshotOf('.cat-card-root, #site-cat, #cat-hud');

/**
 * Settle the site's scroll-reveal before snapshotting (1.2's lesson, in one function).
 *
 * Scrolling fires the site's own observer, which permanently adds `io-in` to whatever came
 * into view — so a snapshot taken at the top of an unscrolled page can never match one taken
 * after a fight that scrolled. The card's fight does not scroll, but `armAmmo` navigates,
 * and the reveal must be spent before the baseline so nothing fires mid-fight.
 */
async function settlePage(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 180) {
      scrollTo({ top: y, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 90));
    }
    scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.waitForTimeout(500);
}

/**
 * Roll the fight until it is both winnable-by-measurement and losable at all.
 *
 * Step 5's stances made both endings conditional on the opponent, which is what stances are
 * *for* and is also why three harnesses started timing out: a **sleepy** cat will not
 * interrupt a hold at all and takes no ground, so standing still empty-handed *wins*; a
 * **siege** cat cannot reach anything off the floor. Neither is a bug, but a check that says
 * "a fight can be lost" has to be given a cat that can win one.
 *
 * Stance and board in the same deal, for the reason §12.1 records: separate re-rollers spend
 * their time undoing each other. Forty deals is this file's own budget kept — a named stance
 * is one of four weighted rolls, so six is not enough to be sure of it.
 */
const fighter = (page, want = ['ambush', 'trickster']) =>
  deal(page, wants.stance(want, { claims: 'inView' }), { deals: 40, settle: 190 });

/*
 * The flee-and-hold counter (§5.2 / §9.4), card-scaled. The boss cannot arrive inside one
 * 1400ms scrub from beyond `CARD_SAFE_FLEE_PX` (≈85px), so a far hold is uninterruptible —
 * but holding a close tile is a pounce, so those are never attempted. These helpers are
 * arena8's, proven green on the card; one copy of a strategy now lives there, and this file
 * keeps its own because the fleet's charter is that a shared strategy is one edit, not four.
 */

/** Park the cursor where nothing can be scrubbed — a bare corner of the board. */
async function parkNeutral(page) {
  const p = await page.evaluate(() => {
    const b = document.querySelector('[data-board]').getBoundingClientRect();
    return { x: b.left + b.width - 8, y: b.top + 8 };
  });
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(80);
}

/** The claimed tile farthest from the boss, and whether it is beyond the safe distance. */
async function placeFarTarget(page, safe) {
  const spot = await page.evaluate((safePx) => {
    const board = document.querySelector('[data-board]');
    if (!board) return null;
    const b = board.getBoundingClientRect();
    const boss = document.querySelector('[data-boss]')?.getBoundingClientRect();
    const cx = boss ? boss.left + boss.width / 2 : b.left;
    const cy = boss ? boss.top + boss.height / 2 : b.top;
    const claims = [...document.querySelectorAll('.cat-tile[data-state="claimed"]')]
      .map((el) => {
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        return { x: Math.round(x), y: Math.round(y), away: Math.round(Math.hypot(x - cx, y - cy)) };
      })
      .sort((a, z) => z.away - a.away);
    const hit = claims[0];
    if (!hit) return null;
    return hit.away >= safePx ? { ...hit, far: true } : { ...hit, far: false };
  }, safe);
  if (spot) await page.waitForTimeout(120);
  return spot;
}

/** One exchange: hold a far claim; park the cursor away if there is no far target yet. */
async function fleeAndScrub(page) {
  const spot = await placeFarTarget(page, CARD_SAFE_FLEE_PX);
  if (!spot) return { took: false, why: 'nothing parkable' };
  if (!spot.far) {
    await parkNeutral(page);
    await page.waitForTimeout(900);
    return { took: false, why: 'no far target yet' };
  }
  const before = await page.evaluate(CLAIMS);
  await page.mouse.move(spot.x, spot.y);
  await page.waitForTimeout(1750);
  const took = (await page.evaluate(CLAIMS)) < before;
  if (!took) {
    await parkNeutral(page);
    await page.waitForTimeout(900);
  }
  return { took, away: spot.away, why: took ? 'reclaimed' : 'held but not taken' };
}

/** Play a fight to a conclusion by fleeing, never spending. Returns a report. */
async function playByFleeing(page, budgetMs = 150_000) {
  const t0 = Date.now();
  let took = 0;
  let stalls = 0;
  const why = {};
  let closest = Infinity;
  let minAway = Infinity;
  while (Date.now() - t0 < budgetMs) {
    if (!(await page.evaluate(OPEN))) break;
    if (await page.evaluate(NOTCHED)) break;
    const left = await page.evaluate(CLAIMS);
    if (left === 0) break;
    closest = Math.min(closest, left);
    const r = await fleeAndScrub(page);
    if (r.away !== undefined) minAway = Math.min(minAway, r.away);
    if (r.took) took++;
    else if (r.why === 'no far target yet') {
      // A re-park, not a stall: the loop is repositioning, not failing.
    } else {
      stalls++;
      why[r.why] = (why[r.why] ?? 0) + 1;
    }
    if (stalls > 8) break;
  }
  return {
    took,
    stalls,
    left: await page.evaluate(CLAIMS),
    fewest: closest === Infinity ? -1 : closest,
    minAway: minAway === Infinity ? -1 : minAway,
    why: Object.entries(why).map(([k, n]) => `${k}x${n}`).join(', ') || 'none',
    seconds: (Date.now() - t0) / 1000,
    won: await page.evaluate(NOTCHED),
  };
}

// ---- 1. the bar
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  ok('no bar before a fight', await page.evaluate(() => document.getElementById('cat-card-panel').hidden));

  await press(page);
  await page.waitForTimeout(250);
  const bar = await page.evaluate(() => {
    const panel = document.getElementById('cat-card-panel');
    const b = document.querySelector('.cat-card-territory');
    const r = b.getBoundingClientRect();
    const pr = panel.getBoundingClientRect();
    return {
      h: r.height,
      top: r.top,
      // The panel carries a 1px border, so "full width" means the card's *content* box
      // (`clientWidth`/`clientTop` exclude the border), not the border-box.
      panelTop: pr.top,
      borderTop: panel.clientTop,
      wide: r.width,
      contentWide: panel.clientWidth,
      text: b.textContent.trim(),
      aria: b.getAttribute('aria-hidden'),
    };
  });
  ok(
    'the bar is 3px across the top of the card, full width',
    bar.h === 3 && Math.abs(bar.wide - bar.contentWide) < 1 && Math.abs(bar.top - (bar.panelTop + bar.borderTop)) < 1,
    JSON.stringify(bar),
  );
  ok('and carries no numbers (§6)', bar.text === '', JSON.stringify(bar.text));
  ok('and is aria-hidden like the rest of the cat', bar.aria === 'true');

  const opening = await page.evaluate(MINE);
  ok('it opens showing the visitor’s minority share', opening > 0.2 && opening < 0.6, `${opening.toFixed(2)} mine`);

  // free one claim and watch the bar move
  const dealt = await deal(page, reachClaim, { deals: 6, settle: 240 });
  const spot = dealt.value;
  fixture('the board dealt a claim to hold', dealt, spot ? `${spot.x},${spot.y}` : '');
  if (spot) {
    await page.mouse.move(spot.x, spot.y);
    await page.waitForTimeout(SCRUB_MS + 700);
    const after = await page.evaluate(MINE);
    ok('the bar tracks a reclaim', after > opening, `${opening.toFixed(2)} → ${after.toFixed(2)}`);
  }
  ok('no console errors', errors.length === 0, errors.join(' | '));

  await release(page);
  await page.waitForTimeout(150);
  ok('the bar goes away with the fight', await page.evaluate(() => document.getElementById('cat-card-panel').hidden));
  await ctx.close();
}

// ---- 2. the cat talks, and obeys its own rules
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await press(page);
  await page.waitForTimeout(150);
  await page.evaluate(WATCH_LINES);

  /*
   * Stand on a claim with no treats: it will interrupt, and it will comment. One loop does
   * both jobs the page version split in two — collect lines *and* catch the ribbon while it
   * is up — because the ribbon is only visible for `LINE_MS` at a time and a separate poll
   * that starts after the fight has gone quiet can run its whole budget and see nothing.
   */
  const dealt = await deal(page, wants.spot(), { deals: 6, settle: 240 });
  const spot = dealt.value;
  fixture('the board dealt a claim to hold', dealt, spot ? `${spot.x},${spot.y}` : '');
  let placed = null;
  for (let i = 0; i < 56; i++) {
    if (spot) {
      await page.mouse.move(spot.x + (i % 2 ? 1 : 0), spot.y);
      await page.waitForTimeout(400);
    }
    if (!placed) {
      placed = await page.evaluate(() => {
        const node = document.querySelector('[data-ribbon]');
        if (node.hidden) return null;
        const r = node.getBoundingClientRect();
        const boss = document.querySelector('[data-boss]')?.getBoundingClientRect();
        if (!boss) return null;
        return {
          cx: r.left + r.width / 2,
          cy: r.top + r.height / 2,
          nearBoss: Math.hypot(r.left + r.width / 2 - (boss.left + boss.width / 2), r.top - boss.top),
        };
      });
    }
  }
  const said = await page.evaluate(() => window.__said);
  ok('the cat says something', said.length > 0, said.map((s) => `“${s.text}”`).join(' '));
  ok(
    'never more than seven words, ever',
    said.every((s) => s.text.split(/\s+/).length <= 7),
    `longest ${Math.max(0, ...said.map((s) => s.text.split(/\s+/).length))} words`,
  );
  ok('never shouts', said.every((s) => !s.text.includes('!')));
  ok('stays lower-case', said.every((s) => s.text === s.text.toLowerCase()));
  ok('never says the same thing twice running', said.every((s, i) => i === 0 || s.text !== said[i - 1].text));
  ok(
    'leaves silence between lines',
    said.every((s, i) => i === 0 || s.t - said[i - 1].t > 1200),
    said.length > 1 ? `tightest gap ${Math.min(...said.slice(1).map((s, i) => s.t - said[i].t)).toFixed(0)}ms` : 'one line',
  );
  ok('the ribbon was on screen to be measured', !!placed);
  ok(
    'it sits above the boss, not in the middle of the page',
    placed && placed.nearBoss < 140 && Math.hypot(placed.cx - 640, placed.cy - 450) > 120,
    placed
      ? `${placed.cx.toFixed(0)},${placed.cy.toFixed(0)} — ${placed.nearBoss.toFixed(0)}px from the boss`
      : 'never shown',
  );

  // Esc gets its own line, and the card closes back over it (see the header note: the card
  // hushes the parting line in the same breath it closes, so read the transient text node).
  await release(page);
  await page.waitForTimeout(150);
  const transient = await page.evaluate(() => window.__transient.join(' '));
  ok('a truce gets a parting line', /sensible|cowardly/.test(transient), JSON.stringify(transient));
  ok(
    'and the card is already closed while it was being said',
    await page.evaluate(() => document.getElementById('cat-card-panel').hidden),
  );
  await ctx.close();
}

// ---- 3. a fight lost, played out
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  const clean = await page.evaluate(SNAPSHOT);
  ok('starting a losing fight with nothing to throw', (await page.evaluate(AMMO)) === 0);

  await press(page);
  await page.waitForTimeout(150);
  /*
   * A siege, and then simply refuse to play.
   *
   * The obvious losing script — stand still on a claim empty-handed and let the cat grind you
   * down — turns out not to lose. A pounce resets your hold, but the cat then has to *recover*
   * before it can commit again, and by the time it is ready your hold has already completed:
   * after the first hit the player wins every subsequent exchange. **No stance's pounce can
   * take the card from a stationary player.**
   *
   * What can take the card is siege's regrowing board (§9.3), which does not care what you are
   * doing: every regrow interval it takes back the nearest free tile until the board is full,
   * and a full board with empty paws is §2's loss. So the losing player here is the one who
   * stops playing — park somewhere harmless, empty-handed, and watch the card close over.
   */
  const foeDeal = await fighter(page, ['siege']);
  fixture('rolled the one stance that can take a card on its own', foeDeal, foeDeal.value ?? '');
  await page.evaluate(WATCH_LINES);
  const board = await page.evaluate(CLAIMS);

  /*
   * Somewhere the pointer can rest without playing.
   *
   * Two card-specific traps here, and both are about *where the pointer lands*, not the game:
   *
   * - The card opens with a 0.18s scale-up animation, so any `getBoundingClientRect` taken
   *   right after `press` reads the board mid-flight. `idlePoint` measured during the
   *   animation returns a point that is on a tile once the card settles — and a pointer that
   *   jiggles on a claimed tile *scrubs* it free, which fights the very siege that is meant
   *   to lose this fight (measured: the claim count oscillates regrow-claims vs accidental
   *   scrubs, and the loss stalls past the 120s budget). So wait for the card to settle
   *   first, and park in the board's top-left *padding*, which is tile-free by construction —
   *   the tiles start after the 0.6rem padding.
   */
  await page.waitForTimeout(400);
  const idle = await page.evaluate(() => {
    const b = document.querySelector('[data-board]').getBoundingClientRect();
    return { x: Math.round(b.left + 5), y: Math.round(b.top + 5) };
  });
  fixture('found somewhere harmless to stand', idle, idle ? `${idle.x},${idle.y}` : '');

  const t0 = Date.now();
  let ended = false;
  while (idle && Date.now() - t0 < 120000) {
    // keep the pointer alive without touching anything: the idle truce is 20s
    await page.mouse.move(idle.x, idle.y);
    await page.waitForTimeout(300);
    await page.mouse.move(idle.x + 1, idle.y);
    await page.waitForTimeout(300);
    if (await page.evaluate(() => document.getElementById('cat-card-panel').hidden)) {
      ended = true;
      // The card has closed; the fight is over.
      await page.waitForTimeout(150);
      break;
    }
  }

  const said = await page.evaluate(() => window.__said.map((s) => s.text));
  ok('a fight can be lost', ended, `${((Date.now() - t0) / 1000).toFixed(0)}s from ${board} claims`);
  ok(
    'and the cat says so, in character',
    said.some((t) => /you may read on/.test(t)),
    said.map((t) => `“${t}”`).join(' '),
  );
  const lossDiff = await snapDiff(page, SNAPSHOT, clean);
  ok('losing leaves the page untouched (the card owns its board)', lossDiff.n === 0, lossDiff.detail);
  ok('losing earns no notch', !(await page.evaluate(NOTCHED)));
  ok('no console errors through a loss', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---- 4. a fight won, played out
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  const armed = await armAmmo(page, { hops: 5, pool: 6, dwell: 650, settle: 750, home: '/' });
  ok('armed for a real fight', armed >= 3, `${armed} treats`);

  await settlePage(page);
  const clean = await page.evaluate(SNAPSHOT);

  await press(page);
  await page.waitForTimeout(200);
  // Pinned to a leaper, so the flee-and-hold below is a fight against a cat that fights back
  // rather than whichever one turned up.
  const oppDeal = await fighter(page);
  fixture('rolled an opponent for the timed win', oppDeal, oppDeal.value ?? '');
  await page.evaluate(WATCH_LINES);

  /*
   * Play it the way §5.2 says: work the far side of the board, hold what the cat cannot reach
   * inside one scrub. Treats are armed — the loop is only closed if the player *could* have
   * spent them — but the flee counter needs none, which is the point §9.4's floor makes.
   */
  const run = await playByFleeing(page, 150_000);
  const said = await page.evaluate(() => window.__said.map((s) => s.text));
  ok(
    'a fight can be won',
    run.won,
    `${run.seconds.toFixed(0)}s over ${run.took} holds, ${run.left} left, stalls: ${run.why}`,
  );
  /*
   * "Did it win" is a question about **state**, not prose: the notch is the thing a win *does*.
   * The floor and ceiling are arithmetic rather than samples — a script that always picks the
   * farthest claim and never mis-aims is strictly faster than the §10 human target, so only
   * that the fight is neither trivial nor endless is asserted.
   */
  ok(
    'a win takes work but ends',
    run.won && run.seconds >= 8 && run.seconds <= 200,
    `${run.seconds.toFixed(0)}s scripted over ${run.took} holds (§10 targets 90–180s for a human, who is slower)`,
  );
  ok(
    'and says one of §8.4’s ending lines while doing it',
    said.some((t) => /keep it|bribe me|show-off|keep one back|kept everything/.test(t)),
    said.map((t) => `“${t}”`).join(' ') || '(silent)',
  );

  // Let the win beat finish and the card close on its own.
  await page
    .waitForFunction(() => document.getElementById('cat-card-panel').hidden, undefined, { timeout: 8000 })
    .catch(() => {});
  await page.waitForTimeout(200);

  ok(
    'and the notch is actually drawn',
    await page.evaluate(() => {
      const n = document.querySelector('#site-cat .cat-notch');
      return !!n && getComputedStyle(n).display !== 'none';
    }),
  );
  const winDiff = await snapDiff(page, SNAPSHOT, clean);
  ok('the page comes back whole after a win', winDiff.n === 0, winDiff.detail);
  ok(
    'and the ear stays marked once the fight is over (§7.1)',
    await page.evaluate(NOTCHED),
  );
  ok(
    'the toggle un-presses itself',
    (await page.getAttribute('#cat-card-toggle', 'aria-expanded')) === 'false',
  );
  /*
   * The ambient cat's loop *alternates* walk and idle, so no instantaneous measurement of "is
   * it walking" is reliable. Poll across several cycles instead — and park the pointer in a
   * corner first, because a pointer resting low on the page is something the cat legitimately
   * comes and sits beside.
   */
  await page.mouse.move(20, 20);
  await page.waitForTimeout(300);
  const walking = await page.evaluate(async () => {
    const c = document.getElementById('site-cat');
    const a = c.getBoundingClientRect().left;
    let most = 0;
    for (let i = 0; i < 60 && most <= 1; i++) {
      await new Promise((r) => setTimeout(r, 150));
      most = Math.max(most, Math.abs(c.getBoundingClientRect().left - a));
    }
    return most;
  });
  ok('and the cat goes back to walking, notch and all', walking > 1, `${walking.toFixed(1)}px`);
  ok('no console errors through a win', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
if (!done()) process.exit(1);
