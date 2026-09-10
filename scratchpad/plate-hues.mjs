/**
 * plate-hues — what each category's plate actually becomes in the dark theme.
 *
 * Finding #6 of the page audit was read off a screenshot: "the `experience` hue (44) inverts to
 * olive rgb(31 27 16) beside two warm plums — off-palette". A colour read off a scaled-down
 * full-page shot is a colour read through resampling, and one sample of one plate cannot say
 * whether 44 is an outlier or whether the whole wheel drifts. So: sample every category's plate
 * from the composited page, in both themes, next to the ground it is supposed to sink into.
 *
 * `invert(1) hue-rotate(180deg)` is the filter (see 2.6.1). Inversion reverses lightness *and*
 * hue and the rotate returns the hue — but a rotate is a fixed matrix, not a perceptual
 * operation, so how well it returns depends on where on the wheel you started. That is exactly
 * the shape of a fault that shows on one hue and not its neighbours, and exactly why it needs
 * the whole set rather than the one that got shot.
 */
/*
 * **As of the drawn-cover pass this reports nothing, because there are no plates on entry pages.**
 * Every entry names a template in `art:`, so the covers this walks are illustrations and it skips
 * them. Kept because the plate generator is still what a new entry gets before somebody gives it a
 * drawing, and because `/about/`'s portrait is still one. See the note in plate-sink.mjs.
 */

import { launch, BASE, fresh } from './lib/fixture.mjs';

/** slug → hue, from src/data/categories.ts. Read here rather than imported: this is a `.mjs`. */
const HUES = {
  competitions: 12,
  'creative-ai': 350,
  'study-trips': 26,
  experience: 44,
  leadership: 32,
  community: 20,
  career: 340,
  'leisure-time': 38,
};

/**
 * The whole plate, not a point.
 *
 * The first version sampled the plate's centre and read the crosshair. The second moved to
 * (⅓, ⅓) and read *something*, but the numbers said leadership's plate was 16 points darker
 * than every other one — and a hue rotation cannot change lightness like that. What changes at
 * (⅓, ⅓) between plates is which bit of the drawing is under the point: the ledger grid's
 * 1.5px rules, the border, or bare paper. A single pixel cannot tell those apart from a colour.
 *
 * So the reading is a **median over the plate's interior**, which is bare paper on every plate
 * by area, plus the spread so a plate that is mostly ink cannot hide inside its own median.
 */
const sample = async (page) => {
  const rect = await page.evaluate(() => {
    const host = document.querySelector('[data-drawn="plate"]');
    if (!host) return null;
    const r = host.getBoundingClientRect();
    // Inset past the border and the card's own rounding, so nothing but the plate is in frame.
    const inset = 12;
    return {
      x: Math.round(r.x + inset),
      y: Math.round(r.y + inset),
      width: Math.round(r.width - inset * 2),
      height: Math.round(r.height - inset * 2),
    };
  });
  if (!rect || rect.width < 8 || rect.height < 8) return null;
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
    const med = ch.map((a) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)]);
    const p05 = ch.map((a) => a[Math.floor(a.length * 0.05)]);
    return { med, p05 };
  }, buf.toString('base64'));
};

const browser = await launch();
const dist = (a, b) => a.map((v, i) => v - b[i]);
console.log('  slug            hue   light plate median   dark plate median    Δ vs dark surface');
for (const [slug, hue] of Object.entries(HUES)) {
  const out = [];
  let darkMed = null;
  for (const theme of ['light', 'dark']) {
    const ctx = await fresh(browser, { viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + `/${slug}/`, { waitUntil: 'load' });
    if (theme === 'dark') await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForTimeout(500);
    const r = await sample(page);
    if (!r) {
      out.push('(no plate)');
    } else {
      out.push(`rgb(${r.med.join(' ')})`);
      if (theme === 'dark') darkMed = r.med;
    }
    await ctx.close();
  }
  // The dark surface token, the thing the plate is supposed to disappear into.
  const SURFACE = [39, 33, 25]; // #272119
  const d = darkMed ? dist(darkMed, SURFACE) : null;
  const flag = d && Math.max(...d.map(Math.abs)) > 8 ? '  ← off' : '';
  console.log(
    `  ${slug.padEnd(15)} ${String(hue).padStart(3)}   ${(out[0] ?? '').padEnd(20)} ${(out[1] ?? '').padEnd(20)} ${d ? d.map((v) => (v > 0 ? `+${v}` : `${v}`)).join(' ') : ''}${flag}`,
  );
}
await browser.close();
