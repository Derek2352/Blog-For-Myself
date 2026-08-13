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

// phases recorder
await page.evaluate(() => {
  const root = document.querySelector('[data-boss]');
  window.__phases = [];
  const phase = () => root?.dataset.phase ?? 'off';
  let seen = phase();
  window.__phases.push({ phase: seen, t: performance.now() });
  new MutationObserver(() => {
    const p = phase();
    if (p !== seen) { seen = p; window.__phases.push({ phase: p, t: performance.now() }); }
  }).observe(root, { attributes: true, attributeFilter: ['data-phase'] });
});

const target = await page.evaluate(() => {
  const boss = document.querySelector('[data-boss]')?.getBoundingClientRect();
  const b = document.querySelector('[data-board]').getBoundingClientRect();
  const claims = [...document.querySelectorAll('.cat-tile[data-state="claimed"]')]
    .map((c) => { const r = c.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), r }; })
    .filter((c) => c.r.bottom < b.bottom - 6 && c.r.top > b.top + 6);
  claims.sort((a, z) => Math.hypot(a.x - (boss ? boss.left + boss.width/2 : 0), a.y - (boss ? boss.top : 0)) - Math.hypot(z.x - (boss ? boss.left + boss.width/2 : 0), z.y - (boss ? boss.top : 0)));
  return claims[0];
});
console.log('target:', target.x, target.y);

// A arm
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
console.log('A done, claims:', await page.evaluate(`document.querySelectorAll('.cat-tile[data-state="claimed"]').length`));

// park off the card
await page.mouse.move(30, 30);
await page.waitForTimeout(1200);

// throw a treat at a far board spot (like harness farSpot)
const farSpot = await page.evaluate(() => {
  const b = document.querySelector('[data-board]').getBoundingClientRect();
  const board = b;
  for (let y = board.top + 6; y < board.bottom - 6; y += 12)
    for (let x = board.left + 6; x < board.right - 6; x += 12) {
      const el = document.elementFromPoint(x, y);
      if (el && !el.closest('.cat-tile')) return { x, y };
    }
  return null;
});
console.log('farSpot:', JSON.stringify(farSpot));
if (farSpot) {
  await page.mouse.move(farSpot.x, farSpot.y);
  await page.mouse.down();
  await page.mouse.up();
}
await page.waitForFunction(() => window.__phases.at(-1)?.phase === 'eat', undefined, { timeout: 8000 }).catch(() => {});
console.log('phases:', await page.evaluate(() => window.__phases.map((p) => `${p.phase}@${Math.round(p.t)}`).join('→')));
const check = await page.evaluate(([x, y]) => {
  const el = document.elementFromPoint(x, y);
  return {
    at: el ? `${el.tagName}.${String(el.className).slice(0, 30)}` : 'none',
    claimedHere: !!el?.closest('.cat-tile[data-state="claimed"]'),
  };
}, [target.x, target.y]);
console.log('B check at target:', JSON.stringify(check));
await browser.close();
