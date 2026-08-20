/**
 * Card game mechanics — treats and manual mode inside the card (§2.2).
 *
 * "Orders" was the third item in that list until 2.6 retired them. What replaced the order check is
 * documented at its call site below, because the interesting part is not that the check changed —
 * it is that the old one stayed green through the deletion of the mechanic it named.
 *
 * Uses the fleet's shared reporter so a missing fixture prints FIXTURE rather than FAIL:
 * a claimed tile or a board that failed to appear is a setup problem, not the game
 * misbehaving — and the hygiene test in tests/harness-hygiene.test.ts refuses to let a
 * harness hard-code a failing check to report one.
 */
// Chromium and the base URL come from the shared strategy (§12.1) — see card-check.mjs for
// why resolving Chrome privately made this harness exit 2 on every Linux run. This file
// already borrowed `report()`; it should have borrowed `launch()` in the same import.
import { launch, BASE, fresh, armAmmo, waitOpen, report, bounded, AMMO } from './lib/fixture.mjs';
const { ok, fixture, done } = report();
const browser = await launch();

// Treat economy: the throws below need ammo, and ammo is *earned* — by browsing the tabs,
// through the fleet's `armAmmo()`. This file used to stamp `.got` onto the paws from an init
// script on a 150ms interval, the same losing race `card-ambient` ran: `SiteCat`'s own render
// pass does `paw.classList.toggle('got', game.found.has(slug))` every frame and takes the class
// straight back off. Fixed in one copy and left in the other is the §12.1 fault exactly.
const ctx = await fresh(browser);
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle' });
const found = await armAmmo(page, { hops: 3, pool: 6, dwell: 650, settle: 750, home: '/' });
fixture('treats: ammo earned by browsing', found > 0, `${found} found`);

await page.locator('#cat-card-toggle').click();
await page.locator('#cat-card-panel').waitFor({ state: 'visible' });
// Two waits, because the 500ms sleep that used to sit here was doing two jobs: clearing the
// open animation before any `boundingBox()` read, and letting the fight settle. The first is a
// condition and belongs to `waitOpen()`; only the second is a duration.
await waitOpen(page);
await page.waitForTimeout(400); // the fight's first beat — stances rolled, squad placed

/*
 * **A click over a claimed tile is a throw, the same as a click anywhere else** (§16, 2.6).
 *
 * What stood here until 2.6 was `treats: commander click orders a kitten (no ammo spent)`, asserting
 * that after clicking a claimed tile *some* kitten had a `data-seek` — and that check was green on
 * the day ordering was deleted. It had to be: kittens pick their own work every frame through
 * `pickWork`, so a squad on a board with claims on it always has somebody seeking something. The
 * assertion never depended on the click at all. It would have passed with the click commented out,
 * and it passed for a mechanic that no longer existed — a check whose subject is gone but whose
 * evidence is supplied by unrelated machinery is worse than no check, because it reports a green.
 *
 * The replacement measures the rule that actually shipped: **the tile under the pointer no longer
 * changes what a click means.** A throw over a claim costs a treat exactly like a throw over bare
 * board, which is the whole content of "one job instead of two" — and unlike the old check, it
 * cannot pass without the click, because the ammo count only moves when a treat leaves the HUD.
 */
const claimedTile = page.locator('.cat-tile[data-state="claimed"]').first();
const box = await claimedTile.boundingBox();
fixture('treats: a claimed tile is on the board', box ? { value: true, deal: 1, deals: 1 } : null);
const ammoBefore = await page.evaluate(AMMO);
fixture('treats: ammo in hand to spend over the claim', ammoBefore > 0 ? { value: true, deal: 1, deals: 1 } : null, `${ammoBefore} in hand`);
if (box && ammoBefore > 0) {
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const flew = await bounded(page, () => !document.querySelector('[data-treat]')?.hasAttribute('hidden'), 1500);
  ok('treats: a click over a claim throws, like any other click', flew);
  const ammoAfter = await page.evaluate(AMMO);
  ok('treats: and it costs a treat — the claim is not a free zone', ammoAfter === ammoBefore - 1, `${ammoBefore} → ${ammoAfter} in hand`);
  // Wait for the treat to be *gone*, not for a duration long enough that it probably is. The next
  // block throws again and reads `[data-treat]`, and a leftover from this throw would answer for it.
  await bounded(page, () => !!document.querySelector('[data-treat]')?.hasAttribute('hidden'), 6000);
}

// Throw a treat at empty board space (bottom corner of the board).
const boardBox = await page.locator('[data-board]').boundingBox();
fixture('treats: the board is present', boardBox ? { value: true, deal: 1, deals: 1 } : null);
if (boardBox) {
  await page.mouse.click(boardBox.x + boardBox.width - 10, boardBox.y + boardBox.height - 10);
  await page.waitForTimeout(200);
  const visible = await page.locator('[data-treat]').isVisible().catch(() => false);
  ok('treats: a throw appears in the card', visible);
  let fetched = false;
  for (let i = 0; i < 16 && !fetched; i++) {
    await page.waitForTimeout(500);
    const phase = await page.locator('[data-boss]').getAttribute('data-phase');
    if (phase === 'fetch' || phase === 'eat') fetched = true;
  }
  ok('treats: the boss goes to get it', fetched);
}

// Manual mode: switch while the card is still open (the chip lives inside the card),
// then close and reopen so the mode takes effect on the next fight (§15).
await page.locator('#cat-card-mode').click();
const cardMode = await page.locator('#cat-card-mode').getAttribute('aria-pressed');
await page.keyboard.press('Escape');
await page.waitForFunction(() => document.querySelector('#cat-card-panel').hidden);
await page.locator('#cat-card-toggle').click();
await page.locator('#cat-card-panel').waitFor({ state: 'visible' });
await waitOpen(page);
await page.waitForTimeout(400); // the reopened fight's first beat
// Named for what it measures. It read "mode chip mirrors page chip" until now — 2.2 deleted the
// page chip, and `55e9b6a` corrected that wording in `card-check` and `card-fight` but not here.
// The assertion was already card-only and correct; a green check that misdescribes itself is
// worse than a red one, because nobody goes back and re-reads it.
ok('manual: mode chip flips hand→manual', cardMode === 'true', cardMode ?? '');

const manClaimed = page.locator('.cat-tile[data-state="claimed"]').first();
const mbox = await manClaimed.boundingBox();
fixture('manual: a claimed tile is on the board', mbox ? { value: true, deal: 1, deals: 1 } : null);
if (mbox) {
  const cx = mbox.x + mbox.width / 2;
  const cy = mbox.y + mbox.height / 2;
  const beforeCaption = (await page.locator('[data-caption]').textContent()) ?? '';
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.waitForTimeout(1800); // SCRUB_MS = 1400
  await page.mouse.up();
  await page.waitForTimeout(500);
  const afterCaption = (await page.locator('[data-caption]').textContent()) ?? '';
  const beforeN = parseInt((beforeCaption.match(/(\d+) \/ \d+/) ?? [])[1] ?? '0', 10);
  const afterN = parseInt((afterCaption.match(/(\d+) \/ \d+/) ?? [])[1] ?? '0', 10);
  ok('manual: a hold scrubs the tile back', afterN > beforeN, `${beforeCaption} → ${afterCaption}`);
}

// Manual mode: a quick tap on empty board throws (tap, not hold).
const mb = await page.locator('[data-board]').boundingBox();
fixture('manual: the board is present', mb ? { value: true, deal: 1, deals: 1 } : null);
if (mb) {
  await page.mouse.click(mb.x + mb.width - 12, mb.y + mb.height - 12);
  await page.waitForTimeout(250);
  const visible = await page.locator('[data-treat]').isVisible().catch(() => false);
  ok('manual: a tap on empty board throws', visible);
}

await page.keyboard.press('Escape');
const pass = done();
await browser.close();
process.exit(pass ? 0 : 1);
