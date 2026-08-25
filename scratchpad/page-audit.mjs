/**
 * The design review the game got three times and the rest of the site has never had.
 *
 * Not a check — it has no assertions and it cannot fail. It renders every page a visitor can
 * reach, at both widths and in both themes, and writes full-height PNGs to look at. Every design
 * fault this project has actually fixed was found by looking (2.2.1's black kittens, 2.3's flat
 * board, 2.4's form-shaped game); every one it invented was found by reasoning about the CSS. So
 * the method is: shoot it at true size, read the shots, rank what is wrong, then change something.
 *
 * `fresh()` for the same reason `plate-look.mjs` uses it: the first-visit welcome dialog's
 * `::backdrop` dims a screenshot without appearing to, and an audit that grades a dimmed page will
 * report a contrast problem the site does not have.
 *
 * Usage: node scratchpad/page-audit.mjs [slug…]   (writes scratchpad/audit/<page>-<w>-<theme>.png)
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { launch, BASE, fresh } from './lib/fixture.mjs';

/** Every page shape the site has. One instance each — the audit is of layouts, not of content. */
const PAGES = [
  { name: 'home', path: '/' },
  { name: 'timeline', path: '/timeline/' },
  { name: 'monthly', path: '/monthly/' },
  { name: 'tags', path: '/tags/' },
  { name: 'tag', path: '/tags/ai-film/' },
  { name: 'search', path: '/search/' },
  { name: 'about', path: '/about/' },
  { name: 'colophon', path: '/colophon/' },
  { name: 'category', path: '/competitions/' },
  // The one category with nothing filed under it — the site's shortest page, and the only place
  // the "nothing here yet" state can actually be looked at.
  { name: 'cat-empty', path: '/leisure-time/' },
  { name: 'entry', path: '/entry/nextgen-video-challenge-2025/' },
  // No `/log/…` here on purpose: `getStaticPaths` only builds a log detail page for a log with a
  // body, and the one published log has none. The log *card* is the shape that ships, and monthly
  // and timeline both render it — shooting a route that does not exist would grade a 404.
  { name: '404', path: '/nowhere-at-all/' },
];

/** Desktop and the narrowest phone the site claims to support (§ the 390px rule in global.css). */
const WIDTHS = [
  { w: 1280, h: 900, tag: 'desk' },
  { w: 390, h: 844, tag: 'phone' },
];

/**
 * Walk the page to the bottom and back, so everything below the first screen has been seen.
 *
 * **The first version of this harness did not do this, and the first page it shot proved why.**
 * `/timeline/` came back as four entries and roughly three thousand pixels of empty ruled track,
 * under a header that says "21 entries" — a striking finding, and a false one. `Base.astro` marks
 * every section below the fold `data-io-text` and reveals it on intersection; a `fullPage`
 * screenshot expands the capture without ever scrolling, so the observers never fire and the other
 * seventeen entries sit at `opacity: 0` in a shot that looks like a rendering bug.
 *
 * That is the same fault as the welcome modal in `plate-look.mjs`, one file later: **a harness
 * reporting the state its own capture created.** Playwright will not tell you; the number and the
 * picture both look like answers.
 *
 * **The other thing a `fullPage` shot does to this site, which no walk can fix.** Fixed elements
 * are painted once, where they sat during capture — so the cat (`#site-cat`, `position: fixed;
 * bottom: 0`) and the treats chip land at the bottom of *one* viewport inside an image several
 * viewports tall, and read as hovering in the middle of the page. Measured on `/monthly/` with
 * `scratchpad/fixed-in-shot.mjs`: the cat is at y 871 in a 900px viewport shot (97% down it) and
 * at y 856 in the 4461px fullPage shot (19% down it) — **the same y, a taller image.** When
 * reading these shots, everything fixed is at a scroll position you are not looking at.
 *
 * **`behavior: 'instant'` is the whole of the second version.** The first walk scrolled and still
 * came back fifteen entries short, which read as confirmation that the reveals were broken. They
 * are not: the site sets `scroll-behavior: smooth`, so each `scrollTo` *starts an animation* and
 * the next call 90ms later retargets it before it has travelled — the page crawled while the loop
 * believed it had reached the bottom. `card-check` learned this in 2.2.1 and `armAmmo()` has
 * scrolled `'instant'` ever since; this file did not consult the fleet's own lesson, and paid the
 * same price. Stepped at half a screen, instantly, every row is `io-in` by the time it returns.
 */
async function revealAll(tab) {
  await tab.evaluate(async () => {
    const step = Math.round(window.innerHeight / 2);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 60)));
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
    await new Promise((r) => setTimeout(r, 250));
  });
  // The reveal transition itself still has to finish, or the shot catches blocks part-way up.
  await tab.waitForTimeout(900);
}

const want = process.argv.slice(2);
const pages = want.length ? PAGES.filter((p) => want.includes(p.name)) : PAGES;
const dir = new URL('./audit/', import.meta.url);
await mkdir(dir, { recursive: true });

const browser = await launch();

for (const page of pages) {
  for (const size of WIDTHS) {
    for (const theme of ['light', 'dark']) {
      const ctx = await fresh(browser, {
        viewport: { width: size.w, height: size.h },
        deviceScaleFactor: 2,
        phone: size.tag === 'phone',
      });
      await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
      const tab = await ctx.newPage();
      const res = await tab.goto(`${BASE}${page.path}`, { waitUntil: 'networkidle' });
      // The cat walks, the ribbon cycles and the reveal animations run on a timer. Give the page
      // long enough to settle, or half the shots catch furniture mid-transition and every read of
      // them is a read of the animation rather than the design.
      await tab.waitForTimeout(1200);
      await revealAll(tab);

      const file = `${page.name}-${size.tag}-${theme}.png`;
      await tab.screenshot({ path: new URL(file, dir).pathname, fullPage: true });

      const box = await tab.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
        h: document.documentElement.scrollHeight,
      }));
      // Horizontal overflow is the one fault a full-page screenshot hides — the shot widens to fit
      // it, so a card pushing past the viewport looks like a wider page instead of a broken one.
      const bleed = box.scrollW > box.clientW ? `  BLEEDS ${box.scrollW}>${box.clientW}` : '';
      console.log(`${file.padEnd(28)} ${res.status()}  ${box.h}px tall${bleed}`);
      await ctx.close();
    }
  }
}

await browser.close();
