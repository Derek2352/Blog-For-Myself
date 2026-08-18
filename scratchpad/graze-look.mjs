/**
 * §16's three outcomes, rendered side by side at true size and then magnified.
 *
 * The dead-zone tell exists to make two failures distinguishable — "you missed the cat" and "you were
 * on the cat and pushed along its line". That claim is only worth anything if a person can actually
 * tell the three states apart on a 318px board, and the way this session has repeatedly got that wrong
 * is by confirming a class is applied rather than by looking at what it draws. `hand.mjs` proves the
 * class arrives; this proves it means something.
 *
 * Deliberately **static**, unlike `hand-look.mjs`. A graze has no displacement to record — its whole
 * content is a posture — and the posture is held for `GRAZE_MS` in the reduced-motion form anyway, so
 * a still frame is the honest medium. Each state is captured against the same cat in the same fight,
 * so nothing but the class differs.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch, fresh, press, waitOpen, report, bounded, BASE } from './lib/fixture.mjs';

const OUT = 'scratchpad/out';
const STATES = [
  { cls: '', label: 'neutral', note: 'nothing happened — or you missed the cat' },
  { cls: 'boss-grazed', label: 'graze', note: 'you crossed it, along its line: no purchase' },
  { cls: 'boss-swatted', label: 'shove', note: 'you crossed it, across its line' },
];

const browser = await launch();
const r = report();
const ctx = await fresh(browser, { mode: 'hand', deviceScaleFactor: 4 });
const page = await ctx.newPage();
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await press(page);
await waitOpen(page);

const armed = await bounded(page, () => !document.querySelector('#cat-card-panel').hidden && document.querySelectorAll('.cat-tile').length > 0, 8000);
if (!armed) {
  r.fixture('a fight to look at', null, 1);
} else {
  /*
   * **Actually freeze the cat**, which the first version claimed to do and did not.
   *
   * It relied on `locator.screenshot()` cropping to the element, reasoning that a moving element takes
   * its crop with it. It does not: Playwright measures the box, then captures, and each capture costs
   * ~300ms here — during which the cat walks about its own body width. The result was three frames each
   * cropped to where the cat had been, showing legs and a tail sliding out of frame, which is a
   * comparison of nothing. A comment asserting a freeze that no code performs is the same fault this
   * whole pass keeps finding, committed in the tool built to find it.
   *
   * `placeBoss` writes `style.transform` every frame, so an author stylesheet with `!important` beats
   * it — the cat is pinned to one board position for all three shots without reaching into the closure
   * or stopping the loop.
   */
  await page.addStyleTag({ content: '[data-boss]{transform:translate(130px,70px)!important}' });
  await page.waitForTimeout(120);
  const shots = [];
  for (const st of STATES) {
    await page.evaluate((cls) => {
      const b = document.querySelector('[data-boss]');
      b.classList.remove('boss-grazed', 'boss-swatted');
      if (cls) b.classList.add(cls);
      // Re-trigger the animation deterministically, then let it settle on its held form for the shot.
      void b.offsetWidth;
    }, st.cls);
    await page.waitForTimeout(st.cls === 'boss-grazed' ? 120 : 60); // catch the graze near its peak
    const buf = await page.locator('[data-boss]').screenshot({ scale: 'device' });
    shots.push({ ...st, b64: buf.toString('base64') });
  }
  await page.evaluate(() => document.querySelector('[data-boss]').classList.remove('boss-grazed', 'boss-swatted'));

  r.ok('all three states rendered', shots.every((s) => s.b64.length > 400), shots.map((s) => `${s.label} ${Math.round(s.b64.length / 100)}`).join(', '));
  /*
   * The states must be *pixel-different from each other*, which is the check that a class doing nothing
   * would fail. It is deliberately weak — different bytes is not the same as legibly different — because
   * the strong version of this question is the picture below, and a harness that claimed to answer it
   * would be overstating what it can see.
   */
  const uniq = new Set(shots.map((s) => s.b64)).size;
  r.ok('the three states are not the same picture', uniq === 3, `${uniq} distinct of 3`);

  mkdirSync(OUT, { recursive: true });
  const html = `<!doctype html><meta charset="utf-8"><title>§16 — telling the three outcomes apart</title>
<style>
  :root { color-scheme: light; --ink:#1a1614; --paper:#f6f2ec; --accent:#8c2f39; --dim:#8a7f76; }
  body { margin:0; padding:2rem 2.2rem 3rem; background:var(--paper); color:var(--ink);
         font:15px/1.5 ui-sans-serif, system-ui, sans-serif; }
  h1 { font-size:1.3rem; margin:0 0 .2rem; }
  p.lede { margin:0 0 2rem; color:var(--dim); max-width:64ch; }
  .row { display:flex; gap:2.4rem; align-items:flex-start; margin-bottom:2.6rem; }
  figure { margin:0; text-align:center; }
  figure img { display:block; image-rendering:pixelated; background:#fffdf9;
               border:1px solid #ddd4c8; margin:0 auto .5rem; }
  b { display:block; font-size:.95rem; }
  small { color:var(--dim); display:block; max-width:22ch; margin:.15rem auto 0; }
  h2 { font-size:.85rem; text-transform:uppercase; letter-spacing:.08em; color:var(--dim);
       border-bottom:1px solid #ddd4c8; padding-bottom:.3rem; margin:0 0 1.1rem; }
</style>
<h1>§16 — telling the three outcomes apart</h1>
<p class="lede">The same cat in the same fight, differing only by class. <b style="display:inline">Top row is true size</b> —
the sprite is 28×18 CSS px, which is how anyone actually plays. The bottom row is the same frames at 6×,
to show what the top row is made of. If the three are not distinguishable in the <i>top</i> row, the tell
does not work, however good it looks magnified.</p>
<h2>true size — 28 × 18 px</h2>
<div class="row">${shots.map((s) => `<figure><img src="data:image/png;base64,${s.b64}" width="28"><b>${s.label}</b></figure>`).join('')}</div>
<h2>the same frames at 6×</h2>
<div class="row">${shots.map((s) => `<figure><img src="data:image/png;base64,${s.b64}" width="168"><b>${s.label}</b><small>${s.note}</small></figure>`).join('')}</div>`;
  writeFileSync(`${OUT}/graze-look.html`, html);
  const shot = await launch();
  const p = await (await shot.newContext({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 })).newPage();
  await p.goto(`file://${process.cwd()}/${OUT}/graze-look.html`, { waitUntil: 'load' });
  await p.screenshot({ path: `${OUT}/graze-look.png`, fullPage: true });
  await shot.close();
  console.log(`\nwrote ${OUT}/graze-look.html and ${OUT}/graze-look.png`);
}
await browser.close();
process.exit(r.done('graze-look') ? 0 : 1);
