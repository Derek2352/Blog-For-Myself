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

// what does the harness's farSpot scan find, and is it on a tile?
const scan = await page.evaluate(() => {
  const b = document.querySelector('[data-board]').getBoundingClientRect();
  const hits = [];
  for (let y = b.top + 6; y < b.bottom - 6; y += 12)
    for (let x = b.left + 6; x < b.right - 6; x += 12) {
      const el = document.elementFromPoint(x, y);
      if (el && !el.closest('.cat-tile')) { hits.push({ x, y }); break; }
    }
  return hits[0] ?? null;
});
console.log('farSpot candidate:', JSON.stringify(scan));
if (scan) {
  // hover it — does the card register a hold target?
  await page.mouse.move(scan.x, scan.y);
  await page.waitForTimeout(400);
  const st = await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y);
    const tile = el?.closest?.('.cat-tile');
    return { at: el ? `${el.tagName}.${String(el.className).slice(0, 20)}` : 'none', tile: tile ? tile.dataset.state : null, scrubbing: document.querySelectorAll('.cat-tile[data-state="scrubbing"]').length };
  }, [scan.x, scan.y]);
  console.log('after hover:', JSON.stringify(st));
}
await browser.close();
