/**
 * hud-overlap — what is underneath `#cat-hud`, at every scroll position, not just the last one.
 *
 * 2.6.1 reserved room for the HUD at the foot of the page and the comment in `SiteCat.astro` then
 * said the chip "was covering the footer" — past tense, fault closed. The audit shots for 2.6.2 show
 * it covering a card's body text on `/competitions/` and the word "Education" on `/about/`, at
 * scroll-top, where no amount of footer padding reaches. So the footer was not the fault; it was the
 * one instance of the fault that happened to get shot.
 *
 * This measures the real thing: the HUD's rect, and every text node the browser finds underneath it,
 * at three scroll positions × two widths × the short and long caption states. `elementsFromPoint`
 * is the check that matters — it answers "is a reader's word behind this panel" without me deciding
 * in advance which elements to look for.
 */
import { launch, BASE, fresh } from './lib/fixture.mjs';

const PAGES = ['/', '/about/', '/competitions/', '/timeline/'];
const WIDTHS = [1280, 1024];

/**
 * `behavior: 'instant'`, and then wait for the number to stop moving.
 *
 * The first version of this scrolled with the default behavior and slept 250ms. `global.css:790`
 * sets `html { scroll-behavior: smooth }`, so on a long page that sleep landed the probe somewhere
 * in the middle of the animation and the "bottom" rows reported whatever happened to be passing.
 * That produced a reading — "at 1024 even the footer is covered" — that was an artefact of the
 * harness, not the site, and it is exactly the kind of measurement that would have sent this pass
 * off to fix a bug that isn't there.
 */
const scrollTo = async (page, frac) => {
  await page.evaluate((f) => {
    const doc = document.documentElement;
    window.scrollTo({ top: (doc.scrollHeight - doc.clientHeight) * f, behavior: 'instant' });
  }, frac);
  await page.waitForFunction(
    () => {
      const y = Math.round(window.scrollY);
      const seen = window.__lastY;
      window.__lastY = y;
      return seen === y;
    },
    null,
    { polling: 60 },
  );
};

/**
 * "At rest" is a *state*, and the state is the rendered opacity — not an elapsed time, and not
 * the class either.
 *
 * Two wrong versions preceded this one, both the same mistake in different clothes: standing in
 * something convenient for the condition actually wanted.
 *
 *  1. Wait `HUD_DWELL_MS` (3200) plus a margin from load. Only "at rest" if nothing speaks in
 *     between — and on `/competitions/` @1024 the cat reaches that page's treat about a second
 *     and a half in, `announce()` restarts the dwell, and the row measured as "at rest" was a
 *     find still being announced.
 *  2. Wait for `.speaking` to come off. `#cat-score` carries `transition: opacity 0.45s` under
 *     `prefers-reduced-motion: no-preference`, so the class is gone ~450ms before the chip is,
 *     and the probe caught it mid-fade at opacity ~1 on every page — reporting a permanent
 *     readout that a reader never sees.
 *
 * So: wait for the number the eye actually reads.
 */
const settle = async (page) => {
  await page
    .waitForFunction(
      () => {
        const el = document.getElementById('cat-score');
        return !el || getComputedStyle(el).opacity === '0';
      },
      null,
      { timeout: 15000, polling: 100 },
    )
    .catch(() => console.log('      !! still visible after 15s — the row never retired'));
};

const probe = async (page, label) => {
  const r = await page.evaluate(() => {
    const hud = document.getElementById('cat-hud');
    const score = document.getElementById('cat-score');
    if (!hud || !score || getComputedStyle(score).opacity === '0') return null;
    const b = score.getBoundingClientRect();
    if (b.width === 0) return null;

    // Sample a grid inside the panel and ask the browser what is behind it. Anything that is not
    // the HUD's own subtree, the body, or the html element is content the panel is sitting on.
    const own = new Set();
    for (const n of hud.querySelectorAll('*')) own.add(n);
    own.add(hud);
    const hits = new Map();
    for (let x = b.left + 2; x < b.right - 2; x += 8) {
      for (let y = b.top + 2; y < b.bottom - 2; y += 6) {
        for (const el of document.elementsFromPoint(x, y)) {
          if (own.has(el) || el === document.body || el === document.documentElement) continue;
          const text = (el.textContent ?? '').trim();
          if (!text) continue;
          // Only leaf-ish text: a wrapper div "contains text" without any glyph at this point.
          if (el.children.length && !['A', 'P', 'H1', 'H2', 'H3', 'LI', 'SPAN'].includes(el.tagName))
            continue;
          const key = `${el.tagName.toLowerCase()} "${text.slice(0, 42).replace(/\s+/g, ' ')}"`;
          hits.set(key, (hits.get(key) ?? 0) + 1);
          break;
        }
      }
    }
    return {
      rect: [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)],
      caption: (document.querySelector('#cat-score .cat-caption')?.textContent ?? '').trim(),
      under: [...hits.entries()].sort((a, b2) => b2[1] - a[1]),
    };
  });
  if (!r) return console.log(`  ${label.padEnd(30)} (hud not shown)`);
  const [x, y, w, h] = r.rect;
  console.log(
    `  ${label.padEnd(30)} x${x}–${x + w} y${y}–${y + h}  ${String(w).padStart(3)}×${h}  "${r.caption}"`,
  );
  if (!r.under.length) console.log('      clear');
  for (const [k, n] of r.under.slice(0, 3)) console.log(`      ${String(n).padStart(3)} pts  ${k}`);
};

const browser = await launch();
for (const width of WIDTHS) {
  console.log(`\n=== ${width}px ===`);
  const ctx = await fresh(browser, { viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  for (const path of PAGES) {
    await page.goto(BASE + path, { waitUntil: 'load' });
    console.log(` ${path}`);

    /* The row has two states now and only one of them is on screen for long, so measuring
       "the HUD" without saying which state is measuring nothing.

       `at rest` is where a reader spends all but a few seconds of a visit. It is reached by
       waiting for the class, not by waiting out a duration — see `settle`. */
    await settle(page);
    await probe(page, 'top, at rest');
    await scrollTo(page, 0.5);
    await settle(page);
    await probe(page, 'middle, at rest');
    await scrollTo(page, 1);
    await settle(page);
    await probe(page, 'bottom, at rest');

    /* Forcing the visible state and holding it, so the same worst case can be read at the top of
       the page and at the foot. The foot is its own question: 2.6.1 padded the footer so the chip
       would clear it, and that padding is gone now on the grounds that a transient chip is not
       furniture the page has to accommodate. Whether the footer is in fact covered while the chip
       speaks is a fact, not a preference, so it gets measured rather than asserted. */
    await scrollTo(page, 0);
    /* `speaking` is the transient state, forced rather than waited for: which tab is hiding a
       treat decides when a find happens, and the chip's footprint is the same either way. Worst
       case on both axes at once — the widest caption the game can produce, in the state that
       shows it. Then wait for the opacity to actually arrive: `#cat-score` carries
       `transition: opacity 0.45s` under `prefers-reduced-motion: no-preference`, so reading the
       computed value in the same frame as the class change reports 0 and the probe declares the
       chip hidden when it is in fact on its way up. */
    await page.evaluate(() => {
      const s = document.getElementById('cat-score');
      s?.classList.add('speaking');
      const c = s?.querySelector('.cat-caption');
      if (c) c.textContent = '7 / 7 \u00b7 all found \u2014 good hunting';
    });
    await page
      .waitForFunction(
        () => getComputedStyle(document.getElementById('cat-score')).opacity === '1',
        null,
        { timeout: 4000, polling: 50 },
      )
      .catch(() => console.log('      !! forced .speaking never reached opacity 1'));
    await probe(page, 'top, speaking, worst caption');
    await scrollTo(page, 1);
    await probe(page, 'bottom, speaking, worst caption');
  }
  await ctx.close();
}
await browser.close();
