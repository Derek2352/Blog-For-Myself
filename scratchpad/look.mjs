/**
 * look — full-page screenshots of the landing pages, for a human to look at.
 *
 * Not a harness: nothing here passes or fails. It exists so a design change is judged on the page
 * as rendered at the two widths that matter, in both themes, rather than on the source.
 *
 *   node scratchpad/look.mjs [outDir] [tag]
 */
import { launch, BASE, fresh } from './lib/fixture.mjs';

const OUT = process.argv[2] ?? 'scratchpad/out/look';
const TAG = process.argv[3] ?? 'now';
const PAGES = (process.env.PAGES ?? '/,/competitions/,/timeline/,/about/').split(',');
const THEMES = (process.env.THEMES ?? 'light,dark').split(',');
const SIZES = (process.env.SIZES ?? 'desk,phone').split(',');
const FULL = process.env.FULL !== '0';

const { mkdirSync } = await import('node:fs');
mkdirSync(OUT, { recursive: true });

const browser = await launch();
for (const size of SIZES) {
  for (const theme of THEMES) {
    const ctx = await fresh(browser, size === 'phone' ? { phone: true } : { viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
    const page = await ctx.newPage();
    for (const path of PAGES) {
      await page.goto(BASE + path, { waitUntil: 'load' });
      /* Let the reveals and the ink settle, then walk the page so every scroll-revealed block has
         entered once — a full-page shot of a page nobody scrolled is a shot of opacity: 0. */
      await page.waitForTimeout(900);
      await page.evaluate(async () => {
        /* `behavior: 'instant'` is not optional: the site sets `scroll-behavior: smooth` on <html>,
           so a bare scrollTo animates, the next one interrupts it, and the walk never reaches the
           foot of the page — the first run of this file shot a home page with its whole browse
           section still at opacity 0 and looked, for a moment, like a bug in the site. */
        const step = innerHeight * 0.7;
        for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
          scrollTo({ top: y, behavior: 'instant' });
          await new Promise((r) => setTimeout(r, 120));
        }
        scrollTo({ top: 0, behavior: 'instant' });
      });
      await page.waitForTimeout(700);
      const base = `${TAG}-${size}-${theme}-${path.replace(/\//g, '_') || 'home'}`;
      if (FULL) {
        await page.screenshot({ path: `${OUT}/${base}.png`, fullPage: true });
        console.log(`${base}.png`);
      } else {
        /* Viewport slices, for reading a phone page at the size a phone shows it rather than as a
           ribbon 200px wide. `AT` is a list of scroll offsets in CSS px. */
        for (const y of (process.env.AT ?? '0').split(',').map(Number)) {
          await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), y);
          await page.waitForTimeout(500);
          await page.screenshot({ path: `${OUT}/${base}@${y}.png` });
          console.log(`${base}@${y}.png`);
        }
      }
    }
    await ctx.close();
  }
}
await browser.close();
