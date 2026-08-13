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

// Visitor with NO treats: badge hidden, no cue.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem('welcomed', '1'));
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const badgeHidden = await page.locator('[data-badge]').isHidden();
  const cue = await page.locator('#cat-card-toggle').getAttribute('data-cue');
  ok('ambient: no treats → no badge, no cue', badgeHidden && !cue, `hidden=${badgeHidden} cue=${cue}`);
  await ctx.close();
}

// Visitor WITH treats: badge shows the count, cue fires, and both are on the collapsed icon.
{
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
  const badgeVisible = await page.locator('[data-badge]').isVisible();
  const badgeText = await page.locator('[data-badge]').textContent();
  const cue = await page.locator('#cat-card-toggle').getAttribute('data-cue');
  ok('ambient: treats found → badge visible with count', badgeVisible && Number(badgeText) > 0, `badge=${badgeText}`);
  ok('ambient: treats found → cue fires', cue === '1', `cue=${cue}`);
  // Opening the card clears the cue (the game is where the treats are now spent).
  await page.locator('#cat-card-toggle').click();
  await page.locator('#cat-card-panel').waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
  const cueAfter = await page.locator('#cat-card-toggle').getAttribute('data-cue');
  ok('ambient: opening clears the cue', !cueAfter, `cue=${cueAfter}`);
  await ctx.close();
}

console.log(`\n${results.filter((r) => r.pass).length}/${results.length} checks passed`);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
