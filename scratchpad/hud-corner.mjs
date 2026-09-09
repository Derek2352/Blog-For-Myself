/**
 * hud-corner — a picture of the bottom-left corner in both of the row's states.
 *
 * The overlap probe answers "is a word behind the chip". It cannot answer the question that
 * follows from making the chip transient: `#cat-score` retires by going to `opacity: 0`, not by
 * going to `display: none`, so it still occupies its 47px of the HUD's flex column. That is
 * deliberate — collapsing it would make the arena toggle jump 47px up the screen every time the
 * cat had something to say, and a control that moves when a notification arrives is a control you
 * can miss-click. But "deliberate" is a claim about how it looks, and §13.2 places the toggle
 * "directly under the ammo row", so it gets looked at rather than reasoned about.
 */
import { launch, BASE, fresh } from './lib/fixture.mjs';

const shot = async (page, name) => {
  const box = { x: 0, y: 900 - 200, width: 380, height: 200 };
  await page.screenshot({ path: `scratchpad/audit/hud-${name}.png`, clip: box });
  console.log(`  wrote scratchpad/audit/hud-${name}.png`);
};

const browser = await launch();
for (const theme of ['light', 'dark']) {
  const ctx = await fresh(browser, { viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/about/', { waitUntil: 'load' });
  if (theme === 'dark') {
    await page.evaluate(() => document.documentElement.classList.add('dark'));
  }
  await page.waitForFunction(
    () => {
      const el = document.getElementById('cat-score');
      return !el || getComputedStyle(el).opacity === '0';
    },
    null,
    { timeout: 15000, polling: 100 },
  );
  const geom = await page.evaluate(() => {
    const hud = document.getElementById('cat-hud');
    const score = document.getElementById('cat-score');
    const btn = hud?.querySelector('button');
    const r = (n) => (n ? [...['x', 'y', 'width', 'height'].map((k) => Math.round(n.getBoundingClientRect()[k]))] : null);
    return { hud: r(hud), score: r(score), btn: r(btn), btnLabel: btn?.textContent?.trim() };
  });
  console.log(` ${theme}: hud=${geom.hud} score=${geom.score} btn=${geom.btn} "${geom.btnLabel}"`);
  await shot(page, `${theme}-rest`);
  await page.evaluate(() => document.getElementById('cat-score')?.classList.add('speaking'));
  await page.waitForFunction(
    () => getComputedStyle(document.getElementById('cat-score')).opacity === '1',
    null,
    { timeout: 4000, polling: 50 },
  );
  await shot(page, `${theme}-speaking`);
  await ctx.close();
}
await browser.close();
