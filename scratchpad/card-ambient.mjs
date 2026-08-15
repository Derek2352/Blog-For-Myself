// Chromium and the base URL come from the shared strategy (§12.1) — see card-check.mjs for
// why resolving Chrome privately made this harness exit 2 on every Linux run.
import { launch, BASE, fresh, armAmmo, report } from './lib/fixture.mjs';
const browser = await launch();
const { ok, fixture, done } = report();

// Visitor with NO treats: badge hidden, no cue.
{
  const ctx = await fresh(browser);
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const badgeHidden = await page.locator('[data-badge]').isHidden();
  const cue = await page.locator('#cat-card-toggle').getAttribute('data-cue');
  ok('ambient: no treats → no badge, no cue', badgeHidden && !cue, `hidden=${badgeHidden} cue=${cue}`);
  await ctx.close();
}

// Visitor WITH treats: badge shows the count, cue fires, and both are on the collapsed icon.
//
// Treats are *earned* here, by walking the tabs through the fleet's `armAmmo()`. The previous
// version stamped `.got` onto the paws from an init script on a 150ms interval, which lost a
// race it could not win: `SiteCat.astro`'s own render pass does
// `paw.classList.toggle('got', game.found.has(slug))` every frame and took the class straight
// back off. It measured badge=0 against a build whose badge works.
{
  const ctx = await fresh(browser);
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const found = await armAmmo(page, { hops: 3, pool: 6, dwell: 650, settle: 750, home: '/' });
  if (!fixture('ammo: treats earned by browsing', found > 0, `${found} found`)) {
    await ctx.close();
    await browser.close();
    process.exit(1);
  }
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

const pass = done();
await browser.close();
process.exit(pass ? 0 : 1);
