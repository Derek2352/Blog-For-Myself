/**
 * parity — the same page, built two ways, shot side by side.
 *
 * The migration's claim is that the Next build renders the site the Astro build renders. Type
 * checks and unit tests cannot see that claim: both builds can be internally correct and still
 * disagree about what a reader sees, because the disagreement would live in CSS, in markup order,
 * or in a component that was transcribed slightly wrong. The only instrument for it is a picture.
 *
 * Serve both, walk the same paths, shoot both themes, and write the pairs into `scratchpad/audit/`
 * for reading. It also reports the things a picture is bad at — the `<title>`, the canonical link,
 * the number of `<a>` elements — because a missing link is invisible in a screenshot and obvious
 * in a count.
 *
 * Deliberately **not** a pixel-diff. A pixel-diff on this site would be red on every run for
 * reasons that do not matter: the cat walks, the wash is seeded, the plates are generated. What is
 * wanted is a human looking at two pictures, plus a machine looking at the facts a human is bad at.
 *
 *   Astro:  npm run build && npx astro preview --port 4416
 *   Next:   npm run build:next && (cd out && python3 -m http.server 4417)
 */
import { launch, report } from './lib/fixture.mjs';

const ASTRO = process.env.ASTRO_URL ?? 'http://localhost:4416';
const NEXT = process.env.NEXT_URL ?? 'http://localhost:4417';
const OUT = '/home/user/Blog-For-Myself/scratchpad/audit';

/** Paths to compare. Add one here as each page is ported. */
const PATHS = (process.env.PARITY_PATHS ?? '/').split(',').filter(Boolean);

const { ok, note, fixture, done } = report();

/** The facts a screenshot cannot carry. */
const facts = (page) =>
  page.evaluate(() => ({
    title: document.title,
    canonical: document.querySelector('link[rel=canonical]')?.getAttribute('href') ?? null,
    /* Whitespace-collapsed, because the difference it would otherwise report is not one.
       Astro preserved the source newline between the hero h1's two spans; JSX strips whitespace
       between elements, so the Next copy needed an explicit `{' '}` — and once it had one, the
       two textContents differed by newline-versus-space. HTML collapses both to a single space
       when rendering, and accessible-name computation does the same, so a reader and a screen
       reader receive identical text. A check that stays red on that is a check that gets ignored.

       The `{' '}` still had to be added: without *any* separator the name reads
       "Hi — I’m Derek.Numbers by day", which is a real fault and one this comparison caught. The
       instrument was right about the fault and wrong about the fix, which is why it is loosened
       here and not before. */
    h1: document.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
    links: document.querySelectorAll('a[href]').length,
    imgs: document.querySelectorAll('img').length,
    /* An image without both dimensions reflows the page as it loads. Astro's `image()` guaranteed
       these; the Next loader has to reproduce it, and this is where that is checked on the real
       rendered page rather than on the loader's return value.
       **The lightbox stage is exempt, and legitimately.** `<img data-lb-img>` ships with no src at
       all — an empty `src=""` resolves to the page URL and triggers a spurious document fetch, so
       the script sets src, alt and size on open. It has no intrinsic dimensions to state until a
       frame is chosen. Astro's copy is identical, which is the point: this counter is compared
       *between the builds* below, so exempting it here keeps the comparison about the port rather
       than about an absolute nobody meets. */
    imgsMissingSize: [...document.querySelectorAll('img:not([data-lb-img])')].filter(
      (i) => !i.getAttribute('width') || !i.getAttribute('height'),
    ).length,
    /* The authoring notes must never reach the page. Checked on the built HTML of both, because
       this is the failure that ships silently.
       **React's own markers do not count**, and getting this wrong once was instructive: the
       first version counted every `<!--` and reported 23 on a page with no authoring notes at
       all — 19 `<!-- -->` text separators and two Suspense pairs. A check that is red on every
       React page is a check that gets ignored, and then the one comment that matters ships
       behind it. So: a comment counts only if it carries actual words. */
    htmlComments: (document.documentElement.innerHTML.match(/<!--([\s\S]*?)-->/g) ?? []).filter(
      (c) => /[a-z]{2}/i.test(c.slice(4, -3)),
    ).length,
  }));

const browser = await launch();
const reached = [];

for (const path of PATHS) {
  const got = {};
  for (const [tag, base] of [
    ['astro', ASTRO],
    ['next', NEXT],
  ]) {
    for (const theme of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await ctx.newPage();
      if (theme === 'dark') {
        await page.addInitScript(() => {
          try {
            localStorage.setItem('theme', 'dark');
          } catch {}
        });
      }
      const res = await page.goto(base + path, { waitUntil: 'load' }).catch(() => null);
      if (!res || !res.ok()) {
        await ctx.close();
        got[tag] = null;
        continue;
      }
      /* Let the reveal observers fire and the fonts settle before shooting. */
      await page.waitForTimeout(1400);
      const name = `parity${path.replace(/\//g, '-').replace(/-$/, '') || '-home'}-${tag}-${theme}`;
      await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
      if (theme === 'light') got[tag] = await facts(page);
      await ctx.close();
    }
  }
  reached.push([path, got]);
}

for (const [path, got] of reached) {
  fixture(`${path}: both builds served the page`, got.astro && got.next ? true : null,
    !got.astro ? 'astro did not serve it' : !got.next ? 'next did not serve it' : '');
  if (!got.astro || !got.next) continue;

  ok(`${path}: same <title>`, got.astro.title === got.next.title,
    got.astro.title === got.next.title ? got.next.title : `astro "${got.astro.title}" vs next "${got.next.title}"`);
  ok(`${path}: same <h1>`, got.astro.h1 === got.next.h1,
    got.astro.h1 === got.next.h1 ? String(got.next.h1) : `astro "${got.astro.h1}" vs next "${got.next.h1}"`);
  ok(`${path}: canonical points at the same URL`, got.astro.canonical === got.next.canonical,
    `astro ${got.astro.canonical} / next ${got.next.canonical}`);
  ok(
    `${path}: no image ships without dimensions`,
    got.next.imgsMissingSize === 0 && got.astro.imgsMissingSize === 0,
    `astro ${got.astro.imgsMissingSize}, next ${got.next.imgsMissingSize}, of ${got.next.imgs} images`,
  );
  ok(`${path}: no authoring comments reach the page (next)`, got.next.htmlComments === 0,
    `${got.next.htmlComments} comment(s) in the DOM`);
  note(`${path}: links astro ${got.astro.links} / next ${got.next.links}, images ${got.astro.imgs} / ${got.next.imgs}`);
}

await browser.close();
process.exit(done() ? 0 : 1);
