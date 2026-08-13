import { chromium } from 'playwright-core';
const URL = 'http://localhost:4416/?ink=20260802';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const mk = async (o = {}) => {
  const c = await b.newContext({ viewport: { width: 1280, height: 800 }, ...o });
  await c.addInitScript(() => localStorage.setItem('welcomed', '1'));
  return c;
};
const mass = `(() => {
  const c = document.querySelector('canvas.ink-wash');
  if (!c || c.hidden) return -1;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let s = 0; for (let i = 3; i < d.length; i += 4) s += d[i];
  return Math.round(s / 100000);
})()`;

// ---- does it actually come, go, and come back?
{
  const ctx = await mk();
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: 'load' });
  // park the cursor far from the hero so nothing counts as engagement
  await p.mouse.move(1270, 790);
  const series = [];
  for (let i = 0; i < 46; i++) {
    series.push(await p.evaluate(mass));
    await p.waitForTimeout(500);
  }
  const peak = Math.max(...series);
  const firstHigh = series.findIndex((v) => v > peak * 0.6);
  const dip = series.findIndex((v, i) => i > firstHigh && v < peak * 0.05);
  const back = series.findIndex((v, i) => i > dip && dip > 0 && v > peak * 0.6);
  console.log('ink mass over 23s:', series.join(' '));
  console.log(`\nhigh at ${firstHigh / 2}s, clear at ${dip / 2}s, back at ${back / 2}s`);
  console.log(dip > 0 && back > 0 ? 'PASS  comes, goes, and comes back' : 'FAIL  did not complete a cycle');
  await ctx.close();
}

// ---- the readability rule: parked on the headline, ink must not return
{
  const ctx = await mk();
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: 'load' });
  await p.mouse.move(1270, 790);
  // wait out hold + dry so the hero is clean
  await p.waitForTimeout(9000);
  const cleanNow = await p.evaluate(mass);
  // now sit on the headline for well past a full return + hold
  await p.mouse.move(300, 250);
  const held = [];
  for (let i = 0; i < 26; i++) {
    held.push(await p.evaluate(mass));
    await p.mouse.move(300 + (i % 2), 250);
    await p.waitForTimeout(500);
  }
  const worst = Math.max(...held);
  console.log(`\nclean before parking: ${cleanNow}`);
  console.log('while parked on the headline:', held.join(' '));
  console.log(worst <= Math.max(2, cleanNow + 2)
    ? 'PASS  ink never returned over a reader'
    : `FAIL  ink came back while reading (peak ${worst})`);
  await ctx.close();
}
await b.close();
