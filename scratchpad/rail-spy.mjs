/**
 * rail-spy — does the monthly page's period rail point at the month you are actually looking at?
 *
 * The audit's full-page shot of `/monthly/` shows the rail marking **October 2025** while the
 * page displays Summer 2026 at the top. That is either a scrollspy bug or an artefact of how a
 * full-page screenshot is taken: Playwright scrolls the document to stitch the capture, so an
 * `IntersectionObserver` fires all the way down and the class is left wherever the stitch ended.
 * Exactly the class of false finding this pass keeps catching, so it gets asked properly:
 * park the page at a real scroll position and read the rail against what is on screen.
 */
import { launch, BASE, fresh } from './lib/fixture.mjs';

const browser = await launch();
const ctx = await fresh(browser, { viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const PAGE = process.argv[2] ?? '/monthly/';
await page.goto(BASE + PAGE, { waitUntil: 'load' });
console.log(` ${PAGE}`);

/**
 * Read the rail the way the eye does: find the item that differs from its neighbours.
 *
 * The first version of this looked for `aria-current`, an `active` class, or an accent colour,
 * and reported "no item marked" at every scroll position — which was the *detector* being wrong,
 * not the page. The rail marks with `color` and `border-left-color` and nothing else, and both
 * are token values rather than the accent. Asking "which one is not like the others" needs no
 * prior knowledge of the mechanism, which is the only kind of question worth asking of markup
 * you did not write.
 */
const read = async (label) => {
  const r = await page.evaluate(() => {
    // Whatever the rail links to, rather than a guess at its labels. `/monthly/` lists months
    // and named reels, `/timeline/` lists bare years — the first version of this matched only
    // the month names and reported `rail(0)` on the timeline, which reads as "the rail is
    // broken there" and meant "the probe cannot see it".
    const rail = [...document.querySelectorAll('.jump-rail a[data-jump]')];
    // `.here` is the class `JumpRail.astro` toggles, read directly now that the mechanism is
    // known. The first two versions of this inferred the mark by finding the item whose colour
    // differed from its neighbours — which cannot work on `/timeline/`, whose rail has exactly
    // **two** items: with one marked there is no majority, and with none marked there is no
    // minority. An "odd one out" needs three. Guessing at a mechanism is only reasonable while
    // you have not read the code that implements it.
    const odd = rail.filter((a) => a.classList.contains('here')).map((a) => a.textContent.trim());
    const heads = [...document.querySelectorAll('h2, h3')]
      .filter((h) => h.offsetParent !== null)
      .map((h) => ({
        t: h.textContent.trim().slice(0, 26),
        y: Math.round(h.getBoundingClientRect().top),
      }))
      .filter((h) => h.y > -60 && h.y < 420);
    return { odd, onScreen: heads.slice(0, 2), scrollY: Math.round(window.scrollY), n: rail.length };
  });
  console.log(
    `  ${label.padEnd(22)} y=${String(r.scrollY).padStart(5)}  rail(${r.n}) marks [${r.odd.join(', ') || '— nothing'}]  showing: ${r.onScreen.map((h) => `${h.t}@${h.y}`).join(' | ')}`,
  );
};

await page.waitForTimeout(700);
await read('at rest, top');
for (const y of [400, 1200, 2400, 3600]) {
  await page.evaluate((t) => window.scrollTo({ top: t, behavior: 'instant' }), y);
  await page.waitForTimeout(500);
  await read(`scrolled to ${y}`);
}
// And the artefact itself, reproduced on purpose so the note above is checkable.
await page.screenshot({ path: 'scratchpad/audit/rail-fullpage.png', fullPage: true });
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
await page.waitForTimeout(500);
await read('after a fullPage shot');
await browser.close();
