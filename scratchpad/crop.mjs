/**
 * Cut a band out of an audit screenshot so it can be read at true size.
 *
 * The audit shoots full pages, and a full page is the right thing to *rank* — composition, rhythm,
 * where the eye lands. It is the wrong thing to *read*: a 4223px page scaled to fit turns every
 * label into a grey smear, and a review that cannot see the type is a review of the boxes only.
 * So: rank from the whole, then cut the band and look at it 1:1.
 *
 * There is no ImageMagick and no PIL on this box. There is a browser, which decodes PNGs and has a
 * canvas — the same route `plate-look.mjs` takes to sample a pixel out of a shot.
 *
 * Usage: node scratchpad/crop.mjs <file> <topCSSpx> <heightCSSpx> [out]
 *   Offsets are in CSS pixels, matching the page's own scroll position; the shots are
 *   deviceScaleFactor 2, and the scaling is done here so nobody has to remember that.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { launch, BASE, fresh } from './lib/fixture.mjs';

const [file, topArg, hArg, outArg] = process.argv.slice(2);
if (!file) throw new Error('usage: node scratchpad/crop.mjs <file> <top> <height> [out]');

const src = new URL(`./audit/${file}`, import.meta.url);
const top = Number(topArg ?? 0);
const height = Number(hArg ?? 900);
const out = new URL(`./audit/${outArg ?? `crop-${file}`}`, import.meta.url);

const browser = await launch();
const ctx = await fresh(browser);
const page = await ctx.newPage();
await page.goto(BASE);

const png = await page.evaluate(
  async ({ b64, top, height }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const dpr = 2; // the audit shoots at deviceScaleFactor 2
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = Math.min(height * dpr, img.height - top * dpr);
    const g = c.getContext('2d');
    g.drawImage(img, 0, -top * dpr);
    return { data: c.toDataURL('image/png').split(',')[1], w: c.width, h: c.height, full: img.height };
  },
  { b64: (await readFile(src)).toString('base64'), top, height },
);

await writeFile(out, Buffer.from(png.data, 'base64'));
console.log(`${file}  ${top}–${top + height}css  →  ${png.w}×${png.h}px  (page is ${png.full / 2}css tall)`);
await browser.close();
