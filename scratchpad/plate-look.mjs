/**
 * The cover plate in both themes — the only way to judge a filter is to look at one.
 *
 * `npm run covers` and the schema can both tell you a plate is a plate. Neither can tell you the
 * dark one belongs in the room, which is the entire claim the `[data-drawn="plate"]` rule in global.css
 * makes. So this shoots both places a plate appears, on both themes, and prints the pixel the plate
 * actually lands on, rather than the pixel the arithmetic in that comment predicts.
 *
 * **Two pages, because they are two code paths.** The category grid reaches the plate through
 * `EntryCard.astro`. The entry hero reaches it through `[...slug].astro`, where the same commit also
 * removed the LQIP and the `blurup` class — the plate has nothing to preview, and on dark the light
 * blur painted first and the filtered plate arrived over it, a flash on every entry page. A grid
 * screenshot says nothing about that, so both get shot.
 *
 * **It goes through `fresh()` rather than `browser.newContext()`, and that is not a detail.** The
 * first version opened its own context, the first-visit `<dialog class="welcome">` opened over the
 * page, and its `::backdrop` dimmed everything behind it — so the light strip came back a flat
 * grey-brown and the plate measured rgb(139 129 123) against an SVG that plainly says 88% lightness.
 * A screenshot harness that photographs a modal it did not notice will report anything you like.
 *
 * Usage: node scratchpad/plate-look.mjs   (writes scratchpad/plate-look.png, scratchpad/plate-hero.png)
 */
import { writeFile } from 'node:fs/promises';
import { launch, BASE, fresh } from './lib/fixture.mjs';

/** Both routes a plate can be painted through, and the file each strip is written to. */
const TARGETS = [
  { name: 'grid', path: '/competitions/', out: 'plate-look.png' },
  { name: 'hero', path: '/entry/nextgen-video-challenge-2025/', out: 'plate-hero.png' },
];

const browser = await launch();
const samples = {};

for (const target of TARGETS) {
  const shots = [];

  for (const theme of ['light', 'dark']) {
    const ctx = await fresh(browser, { viewport: { width: 1120, height: 820 }, deviceScaleFactor: 2 });
    await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
    const page = await ctx.newPage();
    await page.goto(`${BASE}${target.path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    // Put the plate in the frame the way a visitor scrolling the page would see it.
    await page.locator('[data-drawn="plate"]').first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    samples[`${target.name}/${theme}`] = await page.evaluate(() => {
      const wrap = document.querySelector('[data-drawn="plate"]');
      const img = wrap.querySelector('img');
      const r = img.getBoundingClientRect();
      // Read the plate off the composited page, not off the file: the filter lives outside the SVG,
      // so only the drawn pixel can answer for it. A quarter in from the corner is plate ground —
      // off the frame, off the dashed rules, off the crosshair.
      return {
        filter: getComputedStyle(img).filter,
        ground: getComputedStyle(document.documentElement).backgroundColor,
        surface: getComputedStyle(wrap.closest('.card') ?? wrap).backgroundColor,
        // A blur-up on a plate is the bug this commit removed, so the harness has to be able to see
        // it come back: `.blurup` on the wrapper is the class that holds the LQIP behind the image.
        blurup: wrap.classList.contains('blurup') || Boolean(wrap.closest('.blurup')),
        at: { x: Math.round(r.left + r.width / 4), y: Math.round(r.top + r.height / 4) },
        box: `${Math.round(r.width)}×${Math.round(r.height)}`,
      };
    });

    shots.push({ theme, buf: await page.screenshot() });
    await ctx.close();
  }

  // Sample the plate out of each shot, and build the strip, in a page that can decode PNGs.
  const ctx = await fresh(browser);
  const page = await ctx.newPage();
  await page.goto(BASE);

  for (const s of shots) {
    const key = `${target.name}/${s.theme}`;
    samples[key].plate = await page.evaluate(
      async ({ b64, at }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        const scale = img.width / 1120; // the shot is deviceScaleFactor-sized; the sample is CSS px
        const [r, gr, bl] = g.getImageData(Math.round(at.x * scale), Math.round(at.y * scale), 1, 1).data;
        return `rgb(${r} ${gr} ${bl})`;
      },
      { b64: s.buf.toString('base64'), at: samples[key].at },
    );
  }

  const strip = await page.evaluate(
    async (items) => {
      const imgs = await Promise.all(
        items.map(async (b64) => {
          const i = new Image();
          i.src = `data:image/png;base64,${b64}`;
          await i.decode();
          return i;
        }),
      );
      const scale = 0.5;
      const pad = 20;
      const w = imgs.reduce((n, i) => n + i.width * scale, 0) + pad * (imgs.length + 1);
      const h = Math.max(...imgs.map((i) => i.height * scale)) + pad * 2;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      g.fillStyle = '#8a8078';
      g.fillRect(0, 0, w, h);
      let x = pad;
      for (const i of imgs) {
        g.drawImage(i, x, pad, i.width * scale, i.height * scale);
        x += i.width * scale + pad;
      }
      return c.toDataURL('image/png').split(',')[1];
    },
    shots.map((s) => s.buf.toString('base64')),
  );

  await writeFile(new URL(`./${target.out}`, import.meta.url), Buffer.from(strip, 'base64'));
  await ctx.close();
}

for (const [key, s] of Object.entries(samples)) {
  console.log(
    `${key.padEnd(12)} plate ${s.plate.padEnd(18)} page ${s.ground.padEnd(20)} card ${s.surface.padEnd(20)} ${s.box}`,
  );
  console.log(`             filter ${s.filter}   blurup ${s.blurup}`);
}
for (const t of TARGETS) console.log(`\nwrote scratchpad/${t.out}  (${t.name}: left light, right dark)`);
await browser.close();
