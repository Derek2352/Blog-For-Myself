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
console.log('mode:', await page.getAttribute('#cat-card-mode', 'aria-pressed'));

// install phase recorder
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

// pick a claimed tile
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

// lure the boss close (oscillate)
const t0 = Date.now();
while (Date.now() - t0 < 8000) {
  const d = await page.evaluate(([tx, ty]) => {
    const r = document.querySelector('[data-boss]')?.getBoundingClientRect();
    if (!r) return Infinity;
    return Math.hypot(r.left + r.width / 2 - tx, r.top + r.height / 2 - ty);
  }, [target.x, target.y]);
  if (d <= 18) break;
  await page.mouse.move(target.x + (Math.random() > 0.5 ? 6 : -6), target.y);
  await page.waitForTimeout(50);
  console.log('  dist:', Math.round(d));
}
const dist = await page.evaluate(([tx, ty]) => {
  const r = document.querySelector('[data-boss]')?.getBoundingClientRect();
  if (!r) return Infinity;
  return Math.round(Math.hypot(r.left + r.width / 2 - tx, r.top + r.height / 2 - ty));
}, [target.x, target.y]);
console.log('after lure, boss dist:', dist);

// hold
const before = await page.evaluate(`document.querySelectorAll('.cat-tile[data-state="claimed"]').length`);
await page.mouse.move(target.x, target.y);
await page.waitForTimeout(1400 + 700);
const after = await page.evaluate(`document.querySelectorAll('.cat-tile[data-state="claimed"]').length`);
const phases = await page.evaluate(() => window.__phases.map((p) => `${p.phase}@${Math.round(p.t)}`).join('→'));
console.log(`hold: ${before} → ${after} claims; phases: ${phases}`);
await browser.close();
