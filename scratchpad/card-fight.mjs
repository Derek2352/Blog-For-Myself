import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const BASE = 'http://localhost:4416';
const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].filter(existsSync);
if (!CHROME_CANDIDATES[0]) {
  console.error('no chrome');
  process.exit(2);
}
const browser = await chromium.launch({ executablePath: CHROME_CANDIDATES[0], headless: true });
const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(() => localStorage.setItem('welcomed', '1'));
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle' });

// Open the card; a fight should start.
await page.locator('#cat-card-toggle').click();
await page.locator('#cat-card-panel').waitFor({ state: 'visible' });
await page.waitForTimeout(600);

const tiles = await page.locator('.cat-tile').count();
ok('fight: 10–12 tiles dealt', tiles >= 10 && tiles <= 12, `${tiles}`);
const claimed = await page.locator('.cat-tile[data-state="claimed"]').count();
ok('fight: ~55% claimed at open', claimed >= 5 && claimed <= 7, `${claimed}/${tiles}`);

// Boss visible and has a phase + stance published.
const bossPhase = await page.locator('[data-boss]').getAttribute('data-phase');
const bossStance = await page.locator('[data-boss]').getAttribute('data-stance');
ok('fight: boss phase published', !!bossPhase, bossPhase);
ok('fight: boss stance published', ['ambush', 'siege', 'trickster', 'sleepy'].includes(bossStance ?? ''), bossStance);

// Commander mode is default: kittens present.
const kits = await page.locator('.cat-card-kit').count();
ok('fight: commander mode deals kittens', kits >= 1, `${kits}`);

// The loop is alive: the boss moves (position changes over time).
const pos1 = await page.locator('[data-boss]').evaluate((el) => el.style.transform);
await page.waitForTimeout(1200);
const pos2 = await page.locator('[data-boss]').evaluate((el) => el.style.transform);
ok('fight: boss moves', pos1 !== pos2, `${pos1} → ${pos2}`);

// Territory bar painted.
const terr = await page.locator('[data-territory]').evaluate((el) => el.style.getPropertyValue('--territory'));
ok('fight: territory painted', terr !== '', terr);

// The round label shows.
const roundTxt = await page.locator('[data-round]').textContent();
ok('fight: round label', /round \d+/.test(roundTxt ?? ''), roundTxt);

// A kitten should arrive at a claimed tile and start holding within a few seconds.
let arrived = false;
for (let i = 0; i < 20 && !arrived; i++) {
  await page.waitForTimeout(500);
  const holding = await page.locator('.cat-card-kit[data-hold]:not([data-hold="-1"])').count();
  if (holding > 0) arrived = true;
}
ok('fight: a kitten arrives and holds a claim', arrived);

// Scrubbing paint appears on the held tile.
let scrub = false;
for (let i = 0; i < 12 && !scrub; i++) {
  await page.waitForTimeout(500);
  scrub = await page.locator('.cat-tile[data-state="scrubbing"]').count() > 0;
}
ok('fight: scrub progress paints on the tile', scrub);

// Claim should eventually free (round clears or claim count drops).
let freed = false;
for (let i = 0; i < 40 && !freed; i++) {
  await page.waitForTimeout(500);
  const nowClaimed = await page.locator('.cat-tile[data-state="claimed"]').count();
  if (nowClaimed < claimed) freed = true;
}
ok('fight: a claim comes back', freed);

// Wait for a full clear or several rounds; commander mode should escalate the round number.
// Round 1 clears at ~12s once the kitten is holding, but the first hold needs travel time —
// measured: round 1 cleared at t=36s in a fresh visit, so give the window room.
let roundUp = false;
const roundStart = parseInt((roundTxt ?? '1').replace(/\D/g, ''), 10);
for (let i = 0; i < 90 && !roundUp; i++) {
  await page.waitForTimeout(500);
  const txt = await page.locator('[data-round]').textContent();
  const n = parseInt((txt ?? '1').replace(/\D/g, ''), 10);
  if (n > roundStart) roundUp = true;
}
ok('fight: rounds escalate (commander)', roundUp, `round ${roundStart} → later`);

// Manual mode switch flips the card's mode chip (the page chip is gone — §2.2).
await page.locator('#cat-card-mode').click();
const cardMode = await page.locator('#cat-card-mode').getAttribute('aria-pressed');
ok('mode: card chip flips commander→manual', cardMode === 'true', cardMode);

// Escape closes the card; the page game is untouched throughout.
await page.keyboard.press('Escape');
await page.waitForFunction(() => document.querySelector('#cat-card-panel').hidden);
ok('close: Escape closes', true);
const pageClaimed = await page.locator('.cat-claimed').count();
const arenaOn = await page.evaluate(() => document.documentElement.classList.contains('cat-arena-on'));
ok('close: page game untouched', pageClaimed === 0 && !arenaOn, `claims=${pageClaimed} on=${arenaOn}`);
const focus = await page.evaluate(() => document.activeElement?.id);
ok('close: focus returns to icon', focus === 'cat-card-toggle', focus);

console.log(`\n${results.filter((r) => r.pass).length}/${results.length} checks passed`);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
