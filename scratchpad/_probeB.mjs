import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const BASE = 'http://localhost:4416';
const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].filter(existsSync);
const browser = await chromium.launch({ executablePath: CHROME_CANDIDATES[0], headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(() => localStorage.setItem('welcomed', '1'));
await ctx.addInitScript(() => {
  const pick = () => {
    const b = document.getElementById('cat-card-mode');
    if (!b) return false;
    if (b.getAttribute('aria-pressed') === 'true') return true;
    b.click();
    return b.getAttribute('aria-pressed') === 'true';
  };
  addEventListener('DOMContentLoaded', () => {
    if (pick()) return;
    const t = setInterval(() => { if (pick()) clearInterval(t); }, 40);
    setTimeout(() => clearInterval(t), 8000);
  });
});
const page = await ctx.newPage();
await page.goto(BASE + '/', { waitUntil: 'load' });
await page.waitForTimeout(800);
await page.click('#cat-card-toggle');
await page.waitForFunction(() => !!document.querySelector('.cat-tile[data-state="claimed"]'), undefined, { timeout: 9000 }).catch(() => {});
await page.waitForTimeout(400);

const target = await page.evaluate(() => {
  const boss = document.querySelector('[data-boss]')?.getBoundingClientRect();
  const b = document.querySelector('[data-board]').getBoundingClientRect();
  const claims = [...document.querySelectorAll('.cat-tile[data-state="claimed"]')]
    .map((c) => { const r = c.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), r }; })
    .filter((c) => c.r.bottom < b.bottom - 6 && c.r.top > b.top + 6);
  claims.sort((a, z) => Math.hypot(a.x - (boss ? boss.left + boss.width/2 : 0), a.y - (boss ? boss.top : 0)) - Math.hypot(z.x - (boss ? boss.left + boss.width/2 : 0), z.y - (boss ? boss.top : 0)));
  return claims[0];
});
console.log('target:', JSON.stringify(target));

// A arm: lure, hold, get pounced
const t0 = Date.now();
while (Date.now() - t0 < 14000) {
  const d = await page.evaluate(([tx, ty]) => {
    const r = document.querySelector('[data-boss]')?.getBoundingClientRect();
    if (!r) return Infinity;
    return Math.hypot(r.left + r.width / 2 - tx, r.top + r.height / 2 - ty);
  }, [target.x, target.y]);
  if (d <= 18) break;
  await page.mouse.move(target.x + 9, target.y);
  await page.waitForTimeout(60);
  await page.mouse.move(target.x - 9, target.y);
  await page.waitForTimeout(60);
}
await page.mouse.move(target.x, target.y);
await page.waitForTimeout(1400 + 700);
const afterA = await page.evaluate(`document.querySelectorAll('.cat-tile[data-state="claimed"]').length`);
console.log('after A claims:', afterA);

// park on board ground
const parkSpot = await page.evaluate(() => {
  const b = document.querySelector('[data-board]').getBoundingClientRect();
  for (let y = b.top + 4; y < b.bottom - 4; y += 6)
    for (let x = b.left + 4; x < b.right - 4; x += 6) {
      const el = document.elementFromPoint(x, y);
      if (el && !el.closest('.cat-tile')) return { x, y };
    }
  return null;
});
console.log('parkSpot:', JSON.stringify(parkSpot));
if (parkSpot) await page.mouse.move(parkSpot.x, parkSpot.y);
await page.waitForTimeout(900);

// what is at the target now?
const atTarget = await page.evaluate(([x, y]) => {
  const el = document.elementFromPoint(x, y);
  return {
    tag: el?.tagName,
    cls: String(el?.className || '').slice(0, 40),
    tile: !!el?.closest('.cat-tile'),
    tileState: el?.closest('.cat-tile')?.dataset.state ?? null,
  };
}, [target.x, target.y]);
console.log('at target after park:', JSON.stringify(atTarget));
await browser.close();
