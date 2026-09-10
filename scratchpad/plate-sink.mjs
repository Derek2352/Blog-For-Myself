/**
 * plate-sink — how far every published plate lands from the card it is supposed to sink into.
 *
 * 2.6.1 verified the dark filter on **one** plate: `competitions`, at rgb(42 30 27) against a
 * surface of rgb(39 33 25), "within three points per channel, which is what 'sinks into the
 * ground' has to mean to be checkable". True, and one plate.
 *
 * `placeholderSVG` varies the ground's lightness by seed — `lift` is −4…+4 points around 88% —
 * and the dark theme reaches the plate through a blanket `invert(1) hue-rotate(180deg)`. A
 * hue-rotate is a fixed linear matrix, not a perceptual operation, so what it does to lightness
 * depends on where on the wheel it starts. Those two facts multiply, and neither the generator's
 * comment (which reasons about lift against the *light* ground) nor 2.6.1's check (one hue, one
 * lift) covers the product.
 *
 * The page audit's finding #6 named a suspect — "the `experience` hue (44) inverts to olive" —
 * off a scaled screenshot. This file exists to replace that guess with the distribution.
 */
import { readdir } from 'node:fs/promises';
import { launch, BASE, fresh } from './lib/fixture.mjs';

/** `--color-surface` on `.dark`, the token the plate sits on inside a card. */
const SURFACE = [39, 33, 25]; // #272119

const median = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];

/**
 * Median over the plate's interior — see plate-hues.mjs for why a single pixel lies.
 *
 * **It takes the entry's own cover, not the first plate on the page**, and that distinction arrived
 * the hard way. This used to be `document.querySelector('[data-plate]')` on the reasoning that the
 * cover is the first one in the DOM. True while every cover was a plate. The day one entry's cover
 * became a drawn *illustration*, the first `[data-drawn="plate"]` on that page was a card in the
 * related-entries section 6,711px down — outside the viewport, so Playwright refused the clip with
 * "clipped area is either empty or outside the resulting image" and the whole run died on entry one
 * of twenty-four. A harness that dies is not a harness that failed; it measured nothing at all.
 *
 * The cover is the first `[data-drawn]` element of *any* kind on the page, which is a property of
 * the layout rather than of what happens to be drawn today. If that first one is not a plate, this
 * page has nothing for this file to measure and returns null — which is a skip, not a failure.
 * `scrollIntoViewIfNeeded` follows plate-look.mjs: a clip is only valid inside the viewport.
 */
const sample = async (page) => {
  const rect = await page.evaluate(() => {
    const host = document.querySelector('[data-drawn]');
    if (!host || host.dataset.drawn !== 'plate') return null;
    const r = host.getBoundingClientRect();
    const inset = 14;
    if (r.width < 40 || r.height < 40) return null;
    return {
      x: Math.round(r.x + inset),
      y: Math.round(r.y + inset),
      width: Math.round(r.width - inset * 2),
      height: Math.round(r.height - inset * 2),
    };
  });
  if (!rect) return null;
  const buf = await page.screenshot({ clip: rect });
  return page.evaluate(async (b64) => {
    const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
    const bmp = await createImageBitmap(blob);
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const g = c.getContext('2d');
    g.drawImage(bmp, 0, 0);
    const d = g.getImageData(0, 0, bmp.width, bmp.height).data;
    const ch = [[], [], []];
    for (let i = 0; i < d.length; i += 4) {
      ch[0].push(d[i]);
      ch[1].push(d[i + 1]);
      ch[2].push(d[i + 2]);
    }
    return ch.map((a) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)]);
  }, buf.toString('base64'));
};

const slugs = (await readdir('src/content/entries', { withFileTypes: true }))
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const browser = await launch();
const rows = [];
for (const theme of ['light', 'dark']) {
  const ctx = await fresh(browser, { viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  if (theme === 'dark') {
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await page.evaluate(() => localStorage.setItem('theme', 'dark'));
  }
  for (const slug of slugs) {
    const res = await page.goto(BASE + `/entry/${slug}/`, { waitUntil: 'load' });
    if (!res || res.status() >= 400) continue; // drafts do not build
    if (theme === 'dark') await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForTimeout(320);
    await page
      .locator('[data-drawn]')
      .first()
      .scrollIntoViewIfNeeded()
      .catch(() => {});
    const med = await sample(page);
    if (!med) continue;
    let row = rows.find((r) => r.slug === slug);
    if (!row) rows.push((row = { slug }));
    row[theme] = med;
  }
  await ctx.close();
}
await browser.close();

const lightL = (m) => Math.round(((Math.max(...m) + Math.min(...m)) / 2 / 255) * 1000) / 10;
const worst = (d) => Math.max(...d.map(Math.abs));
const scored = rows
  .filter((r) => r.light && r.dark)
  .map((r) => ({ ...r, d: r.dark.map((v, i) => v - SURFACE[i]) }))
  .map((r) => ({ ...r, worst: worst(r.d) }))
  .sort((a, b) => b.worst - a.worst);

/*
 * **There may be no plates left to measure, and that is a result rather than a run.**
 *
 * Every entry now carries a drawn illustration (`art:` in its frontmatter), so this file's subject
 * has moved: the covers it was written for are gone, and the palette question it answered is
 * answered for the illustrations by `scratchpad/art-sink.mjs`, which samples all of them. What
 * still uses `placeholderSVG` is the `/about/` portrait and any entry created from here on before
 * somebody gives it a template.
 *
 * Said out loud rather than left to arithmetic. Without this the run printed `median undefined ·
 * max -Infinity · over 8: 0 of 0` and exited zero — a harness reporting success for having measured
 * nothing, which is the failure mode this fleet's fixture/assertion split exists to make visible.
 */
if (scored.length === 0) {
  console.log('\n  FIXTURE  no plates on any entry page — every entry carries drawn art now.');
  console.log('           the same question for illustrations is scratchpad/art-sink.mjs.\n');
  process.exit(1);
}
console.log(`\n  ${scored.length} plates, dark surface rgb(${SURFACE.join(' ')})\n`);
console.log('  worst  slug                                        light L   dark plate      Δ r g b');
for (const r of scored) {
  console.log(
    `  ${String(r.worst).padStart(5)}  ${r.slug.padEnd(42)} ${String(lightL(r.light)).padStart(5)}%   rgb(${r.dark.join(' ').padEnd(10)})  ${r.d.map((v) => (v > 0 ? `+${v}` : `${v}`).padStart(4)).join(' ')}`,
  );
}
const ws = scored.map((r) => r.worst);
console.log(
  `\n  median worst-channel Δ ${median(ws)} · max ${Math.max(...ws)} · over 8: ${ws.filter((v) => v > 8).length} of ${ws.length}`,
);
