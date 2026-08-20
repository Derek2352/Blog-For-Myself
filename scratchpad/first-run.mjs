/**
 * First-run harness — the check 1.3 exists because nobody had written it, kept honest in 2.2
 * when the game moved into the card.
 *
 * The playtest that shipped 1.2 opened a fight as a cold visitor with no treats, did nothing,
 * and the cat said nothing: the opening state (territory 0.55, nothing freed, nothing spent)
 * sat in the dead band, so the first words a confused player heard were support-idle's "you
 * can stop any time." at 8 seconds, and the fight truced at 20.
 *
 * This harness is that visit, automated, on the **card game** (§2.2 — the page-board game is
 * gone; the board is a grid of tiles in the floating card), with three assertions:
 *
 *   0. **The opening is not silent in the default mode either** (2.6). The default mode
 *      acquired a verb when §16 was promoted, so it acquired a way to leave a visitor
 *      stranded — and until 2.6 nothing here looked at it, because commander mode had
 *      nothing to teach.
 *   1. **The opening is not silent.** A cold visitor opens the card and does nothing;
 *      the cat must tell them what to do inside OPENING_GRACE_MS (2.5s), where §5.3
 *      guarantees the cat cannot pounce — the teach line's safe context.
 *   2. **The fight is winnable doing only what it said.** Then the visitor plays
 *      exactly one verb — hold still on a claimed tile until it comes back — and
 *      the fight must actually be winnable that way (a treatless win, the arena8 §4
 *      gate, re-measured on card coordinates because the board is ~1/5 the size).
 *
 * Usage (after `npm run build` and a preview server on :4416):
 *   node scratchpad/first-run.mjs
 *
 * Depends on playwright-core + a real Chrome. Prints PASS/FAIL per check and exits
 * non-zero on failure.
 *
 * **Every `waitForFunction` here passes its options in the third position** (the fleet's
 * charter, fixed in 1.4): Playwright's signature is `(pageFunction, arg, options)`, so
 * `{ timeout: N }` in the second slot becomes the page function's *argument*.
 */
import { fresh, launch } from './lib/fixture.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:4416';
const OPENING_GRACE_MS = 2500;
const SCRUB_MS = 1400;
let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

const browser = await launch();

/** Open the card; returns the timestamp when the board actually appeared. */
async function openFight(page) {
  await page.click('#cat-card-toggle');
  await page.waitForFunction(
    () => !document.querySelector('#cat-card-panel').hidden,
    undefined,
    { timeout: 10_000 },
  );
  // Wait until at least one claimed tile is dealt.
  await page.waitForFunction(
    () => document.querySelectorAll('.cat-tile[data-state="claimed"]').length > 0,
    undefined,
    { timeout: 10_000 },
  );
  return Date.now();
}

/** What the ribbon currently says ('' when hidden/empty). */
const ribbonText = (page) =>
  page
    .evaluate(() => {
      const r = document.querySelector('[data-ribbon]');
      return r ? r.textContent?.trim() ?? '' : '';
    })
    .catch(() => '');

/**
 * The opening, measured: open the card, do nothing, and report the first thing the cat says.
 *
 * Both modes get the same treatment because the question is the same one in both — *does a person
 * who has never played this find out what to press before anything happens to them?* — and the
 * answer differs only in which verb the cat names.
 */
async function openingLine(mode) {
  const ctx = await fresh(browser, { mode, welcomed: false, viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#cat-card-toggle', { timeout: 10_000 });
  const t0 = await openFight(page);
  const deadline = t0 + OPENING_GRACE_MS;
  let saw = '';
  while (Date.now() < deadline && !saw) {
    saw = await ribbonText(page);
    if (!saw) await page.waitForTimeout(100);
  }
  return { ctx, page, t0, text: await ribbonText(page), at: Date.now() - t0 };
}

// ---------------------------------------------------------------- check 0
/*
 * **The default mode's cold opening**, which had no browser gate until 2.6 gave the default mode a
 * verb to teach.
 *
 * Before 2.6 the default was commander mode, whose whole promise was that watching *is* playing —
 * there was nothing for a first-time visitor to press, so this file only ever measured manual mode
 * and said so. §16's promotion changed that: the swipe is now the one thing a visitor can do, and
 * `teach-swipe` is the only place the game ever names it. `tests/arena.test.ts` proves `pickLine`
 * returns that id for the opening state. What a unit test cannot prove is that the *string reaches
 * the ribbon* on a real page, inside the grace, before the cat is allowed to pounce — which is the
 * gap 1.2 shipped in the first place and the reason this harness exists.
 */
const first = await openingLine('hand');
check(
  'default: the cat teaches the verb inside the opening grace',
  first.text.length > 0 && first.at <= OPENING_GRACE_MS,
  `saw "${first.text}" at ${first.at}ms`,
);
check(
  'default: the verb it teaches is the swipe',
  /swipe/i.test(first.text),
  `"${first.text}"`,
);
await first.ctx.close();

// ---------------------------------------------------------------- check 1
/*
 * **A cold visitor, in manual mode.** `welcomed: false` is the whole subject of this file —
 * nothing stored, no treats found, the welcome never dismissed. The mode declaration is `fresh`'s
 * job (it clicks the mode chip the way a visitor presses it), and check 2 below plays this context
 * to a win, so manual keeps the long-lived page.
 */
const ctx = await fresh(browser, { mode: 'manual', welcomed: false, viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();

await page.goto(BASE, { waitUntil: 'networkidle' });

// The card's collapsed icon is the way in.
await page.waitForSelector('#cat-card-toggle', { timeout: 10_000 });

// Open the card and do nothing. The teach line must appear inside the opening grace.
const t0 = await openFight(page);
const deadline = t0 + OPENING_GRACE_MS;
let saw = '';
while (Date.now() < deadline && !saw) {
  saw = await ribbonText(page);
  if (!saw) await page.waitForTimeout(100);
}
const graceText = await ribbonText(page);
check(
  'manual: the cat teaches the verb inside the opening grace',
  graceText.length > 0 && Date.now() - t0 <= OPENING_GRACE_MS,
  `saw "${graceText}" at ${Date.now() - t0}ms`,
);

// It must be the teach line, not mercy ("you can stop any time").
check(
  'manual: the first words are the teach line, not support-idle',
  /hold still/i.test(graceText),
  `"${graceText}"`,
);

// Close the check-1 card cleanly, then reload so check 2 runs in a fresh renderer context.
await page.waitForTimeout(400);
await page.keyboard.press('Escape');
await page.waitForFunction(() => document.querySelector('#cat-card-panel').hidden, undefined, { timeout: 10_000 }).catch(() => {});
await page.waitForTimeout(500);
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('#cat-card-toggle', { timeout: 10_000 });
await page.waitForTimeout(600);

// ---------------------------------------------------------------- check 2
// Play only what it told you: hold still on a claimed tile until it comes back. Keep doing
// that until the board is clear. A treatless fight must be winnable.
//
// The win must be asserted as a *win*, not as "the card closed": a truce also closes it,
// and the 1.1 finding was exactly that the two look identical from outside. The notch is
// only ever awarded by `finish('win')` (on the ambient #site-cat), so it is the signal.
//
// Strategy — the loop that measured fastest on the page game, rescaled: work the claimed
// tile farthest from the boss; when nothing is far enough (dist < CARD_SAFE_FLEE_PX ≈ 85),
// give the cat a short 900ms lure to a bottom corner instead of holding into the pounce.
// All coordinates are card-relative (board ~296×180), matching how the card game moves.
let won = false;
let reclaimed = 0;
const FIGHTS = 12; // the rematch budget: §9.4's floor has no margin; a rematch is the design's own answer
for (let fight = 0; fight < FIGHTS && !won; fight++) {
  if (fight === 0) {
    await page.click('#cat-card-toggle');
    await page.waitForFunction(
      () => !document.querySelector('#cat-card-panel').hidden,
      undefined,
      { timeout: 10_000 },
    ).catch(() => {});
    await page
      .waitForFunction(() => document.querySelectorAll('.cat-tile[data-state="claimed"]').length > 0, undefined, { timeout: 10_000 })
      .catch(() => {});
  }
  const winDeadline = Date.now() + 40_000;
  let fightReclaimed = 0;
  let ribbon = '';
  while (Date.now() < winDeadline) {
    const notched = await page.evaluate(() =>
      document.getElementById('site-cat')?.classList.contains('notched'),
    );
    if (notched) {
      won = true;
      break;
    }
    const on = await page.evaluate(() => !document.querySelector('#cat-card-panel').hidden);
    if (!on) {
      ribbon = await ribbonText(page);
      break;
    }
    const total = await page.evaluate(() => document.querySelectorAll('.cat-tile[data-state="claimed"]').length);
    if (total === 0) {
      await page.waitForTimeout(300); // ending beat (win re-claims one tile) or a moment of grace
      continue;
    }
    // The boss position, in board coords, and the claimed tiles' board positions.
    const state = await page.evaluate(() => {
      const board = document.querySelector('[data-board]');
      if (!board) return null;
      const b = board.getBoundingClientRect();
      const boss = document.querySelector('[data-boss]')?.getBoundingClientRect();
      const cx = boss ? boss.left + boss.width / 2 : b.left;
      const cy = boss ? boss.top + boss.height / 2 : b.top;
      const claims = [];
      for (const el of document.querySelectorAll('.cat-tile[data-state="claimed"]')) {
        const r = el.getBoundingClientRect();
        claims.push({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      }
      return { boss: { x: cx, y: cy }, claims, board: { x: b.left, y: b.top, w: b.width, h: b.height } };
    });
    if (!state || !state.claims.length) {
      await page.mouse.move(state ? state.board.x + 60 : 60, state ? state.board.y + 40 : 300);
      await page.waitForTimeout(200);
      continue;
    }
    state.claims.sort((a, b) => {
      const da = Math.hypot(a.x - state.boss.x, a.y - state.boss.y);
      const db = Math.hypot(b.x - state.boss.x, b.y - state.boss.y);
      return db - da;
    });
    const target = state.claims[0];
    const dist = Math.hypot(target.x - state.boss.x, target.y - state.boss.y);
    if (dist < 85) {
      // Inside the boss's reach — holding gets pounced. Short lure, then re-pick.
      await page.mouse.move(state.board.x + state.board.w - 12, state.board.y + state.board.h - 10);
      await page.waitForTimeout(900);
      continue;
    }
    await page.mouse.move(target.x, target.y);
    await page.waitForTimeout(1750);
    const freed = await page.evaluate(([x, y]) => {
      const hit = document.elementFromPoint(x, y);
      return !(hit && hit.closest && hit.closest('.cat-tile[data-state="claimed"]'));
    }, [target.x, target.y]);
    if (freed) {
      reclaimed++;
      fightReclaimed++;
    }
  }
  console.log(`  fight ${fight}: reclaimed=${fightReclaimed} won=${won}${ribbon ? ` ribbon="${ribbon}"` : ''}`);
  if (!won && fight < FIGHTS - 1) {
    // Rematch: close the card and re-open (§9.4's answer to a stall-loss).
    await page.waitForFunction(() => document.querySelector('#cat-card-panel').hidden, undefined, { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.click('#cat-card-toggle');
    await page.waitForFunction(() => !document.querySelector('#cat-card-panel').hidden, undefined, { timeout: 10_000 }).catch(() => {});
    await page
      .waitForFunction(() => document.querySelectorAll('.cat-tile[data-state="claimed"]').length > 0, undefined, { timeout: 10_000 })
      .catch(() => {});
  }
}

check('a treatless fight is winnable doing only the taught verb', won, `${reclaimed} claims reclaimed`);

await browser.close();
console.log(failures === 0 ? '\nAll first-run checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
