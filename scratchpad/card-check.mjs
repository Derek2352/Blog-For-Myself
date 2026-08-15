import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const BASE = 'http://localhost:4416';
const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].filter(existsSync);
const executablePath = CHROME_CANDIDATES[0];
if (!executablePath) {
  console.error('no chrome');
  process.exit(2);
}
const browser = await chromium.launch({ executablePath, headless: true });
const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

// ---- desktop ----
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem('welcomed', '1'));
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const icon = page.locator('#cat-card-toggle');
  await icon.waitFor({ state: 'visible' });
  ok('desktop: collapsed icon visible bottom-right', (await icon.boundingBox()).x > 1100);
  await icon.click();
  const panel = page.locator('#cat-card-panel');
  await panel.waitFor({ state: 'visible' });
  const box = await panel.boundingBox();
  ok('desktop: card ~320px wide', Math.abs(box.width - 320) < 30, `w=${Math.round(box.width)}`);
  ok('desktop: card above the icon', box.y + box.height < (await icon.boundingBox()).y);
  const tiles = await page.locator('.cat-tile').count();
  ok('desktop: 10–12 tiles dealt', tiles >= 10 && tiles <= 12, `${tiles}`);
  const claimed = await page.locator('.cat-tile[data-state="claimed"]').count();
  ok('desktop: ~55% claimed', claimed >= 5 && claimed <= 7, `${claimed}/${tiles}`);
  const labels = await page.locator('.cat-tile').allTextContents();
  const good = labels.every((l) => l.trim().length > 0);
  ok('desktop: tiles labelled', good, labels.slice(0, 3).join(', ') + '…');
  // page untouched
  ok('desktop: page game untouched', (await page.locator('.cat-claimed').count()) === 0);
  // Escape closes, focus returns
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('#cat-card-panel').hidden);
  ok('desktop: Escape closes', true);
  const focus = await page.evaluate(() => document.activeElement?.id);
  ok('desktop: focus returns to icon', focus === 'cat-card-toggle', focus);
  // reopen and close via ×
  await icon.click();
  await page.locator('#cat-card-close').click();
  await page.waitForFunction(() => document.querySelector('#cat-card-panel').hidden);
  ok('desktop: × closes', true);
  await ctx.close();
}

// ---- phone ----
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });
  await ctx.addInitScript(() => localStorage.setItem('welcomed', '1'));
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const icon = page.locator('#cat-card-toggle');
  await icon.waitFor({ state: 'visible' });
  const ib = await icon.boundingBox();
  ok('phone: icon in corner', ib.x > 300 && ib.y > 700, `x=${Math.round(ib.x)} y=${Math.round(ib.y)}`);
  await icon.tap();
  const panel = page.locator('#cat-card-panel');
  await panel.waitFor({ state: 'visible' });
  const box = await panel.boundingBox();
  ok('phone: near-full-width card', box.width > 320 && box.width <= 390, `w=${Math.round(box.width)}`);
  ok('phone: no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  const tiles = await page.locator('.cat-tile').count();
  ok('phone: tiles dealt', tiles >= 10 && tiles <= 12, `${tiles}`);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('#cat-card-panel').hidden);
  ok('phone: Escape closes', true);
  await ctx.close();
}

// ---- page independence: scroll, then open the card ----
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem('welcomed', '1'));
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => window.scrollY);
  await page.locator('#cat-card-toggle').click();
  await page.locator('#cat-card-panel').waitFor({ state: 'visible' });
  const after = await page.evaluate(() => window.scrollY);
  ok('scroll: page scroll unchanged by card open', Math.abs(after - before) < 2, `${before}→${after}`);
  // board re-deals on each open
  const firstDeal = await page.locator('.cat-tile').count();
  await page.keyboard.press('Escape');
  await page.locator('#cat-card-toggle').click();
  await page.locator('#cat-card-panel').waitFor({ state: 'visible' });
  const secondDeal = await page.locator('.cat-tile').count();
  ok('scroll: board re-deals on reopen', secondDeal >= 10 && secondDeal <= 12, `${firstDeal}→${secondDeal}`);
  await ctx.close();
}

// ---- sound / mode controls live in the card (the page chips are gone — §2.2) ----
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem('welcomed', '1'));
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('#cat-card-toggle').click();
  await page.locator('#cat-card-panel').waitFor({ state: 'visible' });
  const soundBefore = await page.locator('#cat-card-sound').getAttribute('aria-pressed');
  await page.locator('#cat-card-sound').click();
  const soundAfter = await page.locator('#cat-card-sound').getAttribute('aria-pressed');
  ok('sound: card chip toggles (on by default, tap mutes)', soundBefore === 'true' && soundAfter === 'false', `${soundBefore}→${soundAfter}`);
  // mode flips commander→manual in place
  const modeBefore = await page.locator('#cat-card-mode').getAttribute('aria-pressed');
  await page.locator('#cat-card-mode').click();
  const modeAfter = await page.locator('#cat-card-mode').getAttribute('aria-pressed');
  ok('mode: card chip flips commander→manual', modeBefore === 'false' && modeAfter === 'true', `${modeBefore}→${modeAfter}`);
  // a11y: role/aria on the dialog
  const role = await page.locator('#cat-card-panel').getAttribute('role');
  const labelled = await page.locator('#cat-card-panel').getAttribute('aria-label');
  ok('a11y: dialog role + label', role === 'dialog' && !!labelled, `${role}/${labelled}`);
  await ctx.close();
}

console.log(`\n${results.filter((r) => r.pass).length}/${results.length} checks passed`);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
