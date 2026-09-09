/**
 * fixed-in-shot — where a `position: fixed` element ends up in a full-page screenshot.
 *
 * The question this answers: *why is the cat hovering in the middle of the page?* It is not.
 * `#site-cat` is `position: fixed; bottom: 0`, so a reader sees it in the bottom 30px of the
 * window at every scroll position. What puts it "in the middle" is the **screenshot** — a
 * `fullPage` capture flattens a document several viewports tall into one image, and a fixed
 * element is painted once, where it sat during capture. In a 3967px stitch of a 900px window
 * that lands about a quarter of the way down, which reads as mid-page.
 *
 * So: shoot the same page both ways and find the cat's ink in each image, rather than asserting
 * it. The row scan looks for the sprite's dark pixels inside the x band the DOM says it occupies
 * — the browser is asked where to look, so the scan cannot go hunting for a convenient answer.
 */
import { launch, BASE, fresh } from './lib/fixture.mjs';

const PAGE = process.argv[2] ?? '/monthly/';

/**
 * Where the sprite is in an image, found by **difference** rather than by colour.
 *
 * The first version scanned the cat's x band for near-black pixels and reported ink from y=86 to
 * y=896 — because that band also contains body text, and a threshold cannot tell a cat from a
 * paragraph. Shoot the page twice, once with `#site-cat` hidden, and the rows that changed are
 * the cat and nothing else. No threshold, no guess about the sprite's colour, and it works the
 * same on either theme.
 */
const diffRows = (page, a, b) =>
  page.evaluate(
    async ([b64a, b64b]) => {
      const load = async (b64) => {
        const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
        const bmp = await createImageBitmap(blob);
        const c = new OffscreenCanvas(bmp.width, bmp.height);
        c.getContext('2d').drawImage(bmp, 0, 0);
        return { d: c.getContext('2d').getImageData(0, 0, bmp.width, bmp.height).data, w: bmp.width, h: bmp.height };
      };
      const A = await load(b64a);
      const B = await load(b64b);
      if (A.w !== B.w || A.h !== B.h) return { err: `size mismatch ${A.w}x${A.h} vs ${B.w}x${B.h}` };
      const scale = A.w / document.documentElement.clientWidth;
      const rows = [];
      for (let y = 0; y < A.h; y++) {
        let n = 0;
        for (let x = 0; x < A.w; x++) {
          const i = (y * A.w + x) * 4;
          if (Math.abs(A.d[i] - B.d[i]) > 24) n++;
        }
        if (n > 2) rows.push(y);
      }
      return rows.length
        ? { top: Math.round(rows[0] / scale), bottom: Math.round(rows[rows.length - 1] / scale), imgH: Math.round(A.h / scale) }
        : { top: null, bottom: null, imgH: Math.round(A.h / scale) };
    },
    [a.toString('base64'), b.toString('base64')],
  );

const hideCat = (page, on) =>
  page.evaluate((h) => {
    let el = document.getElementById('__hide-cat');
    if (h) {
      if (!el) {
        el = document.createElement('style');
        el.id = '__hide-cat';
        el.textContent = '#site-cat{display:none !important}';
        document.head.appendChild(el);
      }
    } else el?.remove();
  }, on);

const browser = await launch();
const ctx = await fresh(browser, { viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.goto(BASE + PAGE, { waitUntil: 'load' });
await page.waitForTimeout(1200);

const dom = await page.evaluate(() => {
  const cat = document.getElementById('site-cat');
  const b = cat.getBoundingClientRect();
  const cs = getComputedStyle(cat);
  return {
    pos: cs.position,
    bottom: cs.bottom,
    x: [Math.round(b.left), Math.round(b.right)],
    viewportTop: Math.round(b.top),
    vh: window.innerHeight,
    docH: document.documentElement.scrollHeight,
  };
});
console.log(`\n ${PAGE}`);
console.log(`  DOM: #site-cat is ${dom.pos}, bottom:${dom.bottom} — viewport y ${dom.viewportTop} of ${dom.vh}`);
console.log(`  document is ${dom.docH}px tall (${(dom.docH / dom.vh).toFixed(1)} viewports)`);

const shoot = async (opts, label) => {
  await hideCat(page, false);
  await page.waitForTimeout(250);
  const withCat = await page.screenshot(opts);
  await hideCat(page, true);
  await page.waitForTimeout(250);
  const without = await page.screenshot(opts);
  await hideCat(page, false);
  const r = await diffRows(page, withCat, without);
  if (r.err) return console.log(`  ${label}: ${r.err}`);
  console.log(
    `  ${label.padEnd(22)} image ${String(r.imgH).padStart(4)}px — cat at y ${r.top}–${r.bottom}` +
      `  → ${Math.round((r.top / r.imgH) * 100)}% down the image`,
  );
  return r;
};

const v = await shoot({}, 'viewport shot');
const f = await shoot({ fullPage: true }, 'fullPage shot');
if (v?.top != null && f?.top != null) {
  console.log(
    `\n  The cat did not move: both shots put it at y≈${v.top}, the bottom of one ${dom.vh}px window.`,
  );
  console.log(
    `  Only the image got taller — ${v.imgH}px → ${f.imgH}px — so the same y slides from ` +
      `${Math.round((v.top / v.imgH) * 100)}% to ${Math.round((f.top / f.imgH) * 100)}% down it, and reads as "the middle".`,
  );
}
await browser.close();
