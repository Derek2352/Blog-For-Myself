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

// hover a tile
const spot = await page.evaluate(() => {
  const r = document.querySelector('.cat-tile[data-state="claimed"]').getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
});
await page.mouse.move(spot.x, spot.y);
await page.waitForTimeout(300);

// leave the card entirely
await page.mouse.move(30, 30);
await page.waitForTimeout(300);

// check scrub state via a probe the game exposes? no — check the tile state
const tileState = await page.evaluate(([x, y]) => {
  const el = document.elementFromPoint(x, y);
  return { at: el ? el.tagName : 'none', tile: el?.closest?.('.cat-tile')?.dataset.state ?? null };
}, [spot.x, spot.y]);
console.log('tile at old spot after leaving card:', JSON.stringify(tileState));
// phases
await page.evaluate(() => {
  const root = document.querySelector('[data-boss]');
  window.__phases = [];
  const phase = () => root?.dataset.phase ?? 'off';
  let seen = phase();
  new MutationObserver(() => {
    const p = phase();
    if (p !== seen) { seen = p; window.__phases.push(p); }
  }).observe(root, { attributes: true, attributeFilter: ['data-phase'] });
});
await page.waitForTimeout(2500);
console.log('phases while parked off-card:', await page.evaluate(() => window.__phases.join('→')));
await browser.close();
