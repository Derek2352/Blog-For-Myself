/**
 * Card game mechanics — treats, orders, and manual mode inside the card (§2.2).
 *
 * Uses the fleet's shared reporter so a missing fixture prints FIXTURE rather than FAIL:
 * a claimed tile or a board that failed to appear is a setup problem, not the game
 * misbehaving — and the hygiene test in tests/harness-hygiene.test.ts refuses to let a
 * harness hard-code a failing check to report one.
 */
// Chromium and the base URL come from the shared strategy (§12.1) — see card-check.mjs for
// why resolving Chrome privately made this harness exit 2 on every Linux run. This file
// already borrowed `report()`; it should have borrowed `launch()` in the same import.
import { launch, BASE, report } from './lib/fixture.mjs';
const { ok, fixture, done } = report();
const browser = await launch();

// Treat economy: give the visitor paws, so throws have ammo (the page HUD owns it).
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(() => {
  localStorage.setItem('welcomed', '1');
  const mark = () =>
    document.querySelectorAll('#cat-score .cat-paw[data-slug]').forEach((p) => p.classList.add('got'));
  mark();
  window.setInterval(mark, 150);
});
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

await page.locator('#cat-card-toggle').click();
await page.locator('#cat-card-panel').waitFor({ state: 'visible' });
await page.waitForTimeout(500);

// Commander mode: click on a claimed tile = order a kitten (free — treats are the throw's).
const claimedTile = page.locator('.cat-tile[data-state="claimed"]').first();
const box = await claimedTile.boundingBox();
fixture('treats: a claimed tile is on the board', box ? { value: true, deal: 1, deals: 1 } : null);
if (box) {
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(300);
  const ordered = await page.evaluate(() => {
    const kits = [...document.querySelectorAll('.cat-card-kit')];
    return kits.some((k) => k.dataset.seek !== '-1' && k.dataset.seek !== '');
  });
  ok('treats: commander click orders a kitten (no ammo spent)', ordered);
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
await page.waitForTimeout(500);
ok('manual: mode chip mirrors page chip', cardMode === 'true', cardMode ?? '');

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
