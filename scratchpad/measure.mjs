/**
 * measure — characters per line in the running prose, on every page that has some.
 *
 * The colophon's column looked long against the entry pages' in the audit shots, which is the
 * sort of thing an eye is good at noticing and bad at quantifying: apparent line length changes
 * with type size, and the two pages do not use the same one. So it gets counted.
 *
 * The measure is the CSS `ch` unit, taken from the paragraph's own computed font — `1ch` is the
 * advance of "0" in that face, which is the conventional proxy for average character width in
 * proportional type. Typography's comfortable range for continuous reading is about 60–75
 * characters; under ~45 the eye returns too often, over ~85 it loses the start of the next line.
 */
import { launch, BASE, fresh } from './lib/fixture.mjs';

const PAGES = [
  ['colophon', '/colophon/'],
  ['entry', '/entry/nextgen-video-challenge-2025/'],
  ['about', '/about/'],
  ['home', '/'],
  ['search', '/search/'],
  ['category', '/competitions/'],
];

const browser = await launch();
for (const [w, h] of [
  [1280, 900],
  [390, 844],
]) {
  console.log(`\n=== ${w}px ===`);
  const ctx = await fresh(browser, { viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  for (const [name, path] of PAGES) {
    await page.goto(BASE + path, { waitUntil: 'load' });
    const r = await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
      // Running prose only. The length filter alone pulls in card *excerpts* — a 160-character
      // summary inside a 352px grid cell measures 40ch and gets flagged as "short", which is
      // not a finding, it is a card. A paragraph inside a link or an article card is furniture;
      // what this file is about is the text somebody sits and reads.
      const ps = [...document.querySelectorAll('main p')].filter(
        (p) =>
          (p.textContent ?? '').trim().length > 140 &&
          p.offsetParent !== null &&
          !p.closest('a, .card, li'),
      );
      if (!ps.length) return null;
      const out = ps.map((p) => {
        const cs = getComputedStyle(p);
        probe.style.font = cs.font || `${cs.fontSize} ${cs.fontFamily}`;
        p.appendChild(probe);
        probe.textContent = '0'.repeat(100);
        const chWidth = probe.getBoundingClientRect().width / 100;
        probe.remove();
        const width = p.getBoundingClientRect().width;
        return { ch: Math.round(width / chWidth), px: Math.round(width), size: cs.fontSize };
      });
      // Report the widest, which is the one a reader actually struggles with.
      return out.sort((a, b) => b.ch - a.ch)[0];
    });
    if (!r) {
      console.log(`  ${name.padEnd(10)} (no running prose)`);
      continue;
    }
    // The short end only means anything where there was room to be longer. At 390px the column
    // is the phone, and 41ch is what a phone gives you — flagging it says nothing about the
    // design and buries the one row that does.
    const verdict = r.ch > 85 ? ' ← long' : r.ch < 45 && w > 700 ? ' ← short' : '';
    console.log(
      `  ${name.padEnd(10)} ${String(r.ch).padStart(3)} ch   ${String(r.px).padStart(4)}px at ${r.size}${verdict}`,
    );
  }
  await ctx.close();
}
await browser.close();
