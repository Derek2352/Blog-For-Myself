/**
 * tab-edge — the tab strip's two scroll edges, shot at the positions where each one shows.
 *
 * Finding #7 of the page audit was "the phone tab-bar clips mid-glyph where a fade would read as
 * designed". Half of that was already handled: a 2.4rem `::after` washed `--color-ground` over
 * the last inch. Two things it did not do, and one thing I assumed it did not do and was wrong
 * about, all of which this file exists to keep honest.
 *
 *  · The fade was too short. It reached full strength 21px in, so a glyph at 350px was about a
 *    third covered — a smudged letter, not a dissolve.
 *  · There was no fade on the **left**. Scroll the strip and the first visible tab is cut hard.
 *    That edge is the one this file's `scrollStrip` shots are for.
 *  · **I also wrote down that the opaque wash mismatched the header's translucent pane**
 *    (`color(srgb … / 0.82)`) once the page scrolled under it. Measured, that never happens:
 *    the header is sticky with a negative offset and the strip's top is at **-41px** by
 *    scroll 400, so the tab bar is only ever on screen near scroll-top, where an opaque
 *    `--color-ground` wash matches exactly. The mask is still the better mechanism — it fades
 *    content rather than painting over it, so there is no colour to keep in step — but that is
 *    a robustness argument, not a bug that was fixed, and it does not get written up as one.
 */
import { launch, BASE, fresh } from './lib/fixture.mjs';

const browser = await launch();
for (const theme of ['light', 'dark']) {
  const ctx = await fresh(browser, { viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/competitions/', { waitUntil: 'load' });
  if (theme === 'dark') await page.evaluate(() => document.documentElement.classList.add('dark'));
  // The strip's own scroll, not the page's — the page's does not keep the bar on screen.
  for (const [label, sl] of [
    ['start', 0],
    ['mid', 400],
    ['end', 9999],
  ]) {
    await page.evaluate((x) => {
      const bar = document.querySelector('.tabbar');
      bar.scrollLeft = x;
      bar.dispatchEvent(new Event('scroll'));
    }, sl);
    await page.waitForTimeout(400);
    const band = await page.evaluate(() => {
      const bar = document.querySelector('.tabbar');
      const r = bar.getBoundingClientRect();
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
        left: bar.hasAttribute('data-more-left'),
        right: bar.hasAttribute('data-more-right'),
        sl: Math.round(bar.scrollLeft),
      };
    });
    const name = `scratchpad/audit/tabedge-${theme}-${label}.png`;
    await page.screenshot({
      path: name,
      clip: { x: 0, y: Math.max(0, band.y - 4), width: 390, height: band.h + 8 },
    });
    console.log(
      `  ${name.padEnd(44)} scrollLeft=${String(band.sl).padStart(4)}  fade left=${band.left} right=${band.right}`,
    );
  }
  await ctx.close();
}
await browser.close();
