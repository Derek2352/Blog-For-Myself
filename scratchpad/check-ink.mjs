import { chromium } from 'playwright-core';

const URL = 'http://localhost:4416/?ink=20260802';
const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

/** Count non-transparent pixels the ink canvas has actually painted. */
const inkPixels = `(() => {
  const c = document.querySelector('canvas.ink-wash');
  if (!c || c.hidden) return -1;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
  return n;
})()`;

/** Total alpha — the wash covers most pixels, so a count cannot see the trail. */
const inkMass = `(() => {
  const c = document.querySelector('canvas.ink-wash');
  if (!c || c.hidden) return -1;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let s = 0;
  for (let i = 3; i < d.length; i += 4) s += d[i];
  return s;
})()`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

/** Skip the first-visit welcome dialog — a real showModal() covers the hero. */
async function fresh(opts = {}) {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(() => localStorage.setItem('welcomed', '1'));
  return ctx;
}

// ---- 1. default: ink mounts, paints, and stays quiet in the console
{
  const ctx = await fresh({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  const hidden = await page.$eval('canvas.ink-wash', (c) => c.hidden);
  ok('canvas is revealed after load', hidden === false, `hidden=${hidden}`);

  const painted = await page.evaluate(inkPixels);
  ok('ink is actually painted', painted > 500, `${painted} non-transparent px`);

  const size = await page.$eval('canvas.ink-wash', (c) => ({ w: c.width, h: c.height }));
  ok('canvas sized to the hero', size.w > 300 && size.h > 100, `${size.w}x${size.h}`);

  // the wash must live in the left half only — sample the far right column
  const rightEdge = await page.evaluate(`(() => {
    const c = document.querySelector('canvas.ink-wash');
    const d = c.getContext('2d').getImageData(Math.floor(c.width * 0.9), 0, Math.floor(c.width * 0.1), c.height).data;
    let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return n;
  })()`);
  // The ink used to be *forced* into the left column by a CSS mask that faded
  // the layer out past 48% of the width, and this asserted that confinement.
  // The mask is gone deliberately — it was what made the mark a faint smudge —
  // so the composition is free to use the whole hero. What replaced the mask is
  // a tone ceiling over the words, and that is the thing worth checking: the
  // text is the palest part of the picture, wherever the ink happens to be.
  const paleness = await page.evaluate(`(() => {
    const c = document.querySelector('canvas.ink-wash');
    const cr = c.getBoundingClientRect();
    const t = document.querySelector('[data-ink-reserve]').getBoundingClientRect();
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const x0 = t.left - cr.left, x1 = t.right - cr.left;
    const y0 = t.top - cr.top, y1 = t.bottom - cr.top;
    let onText = 0, nText = 0, off = 0, nOff = 0, peakText = 0;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      const a = d[(y * c.width + x) * 4 + 3];
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) {
        onText += a; nText++; if (a > peakText) peakText = a;
      } else { off += a; nOff++; }
    }
    return { text: onText / nText, off: off / nOff, peakText: peakText / 255 };
  })()`);
  ok(
    'the words are the palest part of the picture',
    paleness.text < paleness.off && paleness.peakText <= 0.17,
    `mean over text ${paleness.text.toFixed(1)} vs ${paleness.off.toFixed(1)} elsewhere, peak ${paleness.peakText.toFixed(3)}`,
  );

  // Cursor trail. Measured in the band the cursor actually crossed rather than
  // over the whole canvas: the stroke itself carries most of the ink, so a few
  // droplets are a rounding error globally but obvious locally.
  // Measured in a tight box around the path the cursor actually takes, not in a
  // band across the whole canvas. The hero now carries a large mark, so six
  // small drips moved a full-width band's mass by under 1% — the drip's own
  // contribution had not changed, the denominator had. A box the size of the
  // stroke puts the signal back above the noise.
  const localMass = `(() => {
    const c = document.querySelector('canvas.ink-wash');
    const r = c.getBoundingClientRect();
    const x0 = Math.max(0, Math.round(560 - r.left));
    const y0 = Math.max(0, Math.round(300 - r.top));
    const w = Math.min(c.width - x0, 300);
    const h = Math.min(c.height - y0, 150);
    if (w <= 0 || h <= 0) return -1;
    const d = c.getContext('2d').getImageData(x0, y0, w, h).data;
    let s = 0; for (let i = 3; i < d.length; i += 4) s += d[i];
    return s;
  })()`;
  const localCells = `(() => {
    const c = document.querySelector('canvas.ink-wash');
    const r = c.getBoundingClientRect();
    const y0 = Math.max(0, Math.round(270 - r.top));
    const h = Math.min(c.height - y0, 160);
    if (h <= 0) return -1;
    const d = c.getContext('2d').getImageData(0, y0, c.width, h).data;
    let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
    return n;
  })()`;
  // Both drip checks run on a fresh load and finish well inside HOLD_MS.
  //
  // They used to run wherever the earlier checks left the clock, with fourteen
  // mouse moves in between — and each move is a round trip, so the moves alone
  // cost ~2s of wall time. That pushed the measurement past 5s into the drying
  // phase, where ink is *supposed* to be leaving, and both checks read normal
  // drying as the cursor failing to make a mark. Six moves and an early start
  // keep the whole comparison in the part of the cycle being asked about.
  await page.reload({ waitUntil: 'load' });
  // Late enough that the box already holds ink — starting at 700ms gave a
  // `before` of 0, which any drip beats and so tested nothing — and early
  // enough that everything below finishes inside HOLD_MS.
  //
  // That margin has now bitten three times, so it is generous: the sequence
  // below spends ~2.7s including six mouse round trips, against a 5s hold. It
  // used to end right on the drying edge, and CLEAR_MS shortening moved the
  // whole cycle under it.
  await page.waitForTimeout(900);
  const before = await page.evaluate(localMass);
  // Drawn below and right of the headline, deliberately. The old path ran
  // straight across the text block, and ink there is capped to 清 by the tone
  // ceiling — so the drips were landing all along and were simply held too pale
  // to measure. Verified separately: the same drips off the text move the whole
  // canvas from 20346989 to 20513306.
  await page.mouse.move(580, 320);
  for (let i = 0; i < 6; i++) await page.mouse.move(580 + i * 42, 320 + i * 16);
  // Wait for a repaint. The drips enter the field immediately but the canvas
  // only redraws at 15fps, so reading straight after the moves sampled the same
  // frame twice and reported a 0.0% change — the drips were landing all along.
  await page.waitForTimeout(200);
  const during = await page.evaluate(localMass);
  ok(
    'cursor leaves a trail',
    during > before * 1.01,
    `mass ${before} → ${during} (${(((during - before) / before) * 100).toFixed(1)}%)`,
  );

  // A drip is real ink: it soaks into the paper and bleeds outward rather than
  // fading on a timer. So the test is that it SPREADS.
  //
  // On its own fresh load, and measured once the main pour has *settled*. The
  // canvas stops changing around 3.2s — every drop has landed and its pigment
  // has deposited — so from there the background is static and any change in the
  // box is the drip. Three earlier attempts timed this against a moving
  // background instead and read the plume's own dynamics: at 900ms the box was
  // still being poured into and coverage fell whatever the drip did.
  const boxCells = `(() => {
    const c = document.querySelector('canvas.ink-wash');
    const r = c.getBoundingClientRect();
    const cx = Math.round(980 - r.left), cy = Math.round(600 - r.top);
    const x0 = Math.max(0, cx - 60), y0 = Math.max(0, cy - 50);
    const w = Math.min(c.width - x0, 120), h = Math.min(c.height - y0, 100);
    if (w <= 0 || h <= 0) return -1;
    const d = c.getContext('2d').getImageData(x0, y0, w, h).data;
    let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
    return n;
  })()`;
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3200);
  const settled = await page.evaluate(boxCells);
  await page.mouse.move(980, 600);
  await page.mouse.move(984, 604);
  await page.waitForTimeout(220);
  const spreadBefore = await page.evaluate(boxCells);
  await page.waitForTimeout(800);
  const spreadAfter = await page.evaluate(boxCells);
  ok(
    'a drip lands on the paper and stays there',
    /*
     * "Stays there" with a percent of slack, not bit-exact monotonicity. This failed on
     * **536 vs 537** — one cell out of five hundred, across 800ms of a live simulation that
     * is also drying. Demanding that a physical process never lose a single cell is not a
     * stronger version of the claim; it is a different and false one, and the pass/fail line
     * lands on noise. The drip must not vanish or wick away, which 95% pins.
     */
    spreadBefore > settled + 50 && spreadAfter >= spreadBefore * 0.95,
    `settled ${settled} → drip ${spreadBefore} → after ${spreadAfter}`,
  );
  // Note on what this does and does not claim. It used to assert the drip
  // visibly *spreads* over the measurement window, and passed on growth of
  // 364→706 cells — but that growth was the main plume still moving through the
  // box, not the drip. Against a settled background a drip barely spreads at
  // all, and correctly so: FILTRATION pins its pigment within a cell or two of
  // where it landed, which is the whole point of 滲透.
  //
  // So this checks what the browser can actually see — a drip renders, and does
  // not fade off on a timer — and the spreading claim lives where it can be
  // measured properly: "the water front leads the pigment front" in
  // tests/ink-field.test.ts, which shows water reaching 12.8 cells against ink's
  // 9.3 with a real watermark annulus between them.

  // loop parks when the hero scrolls away
  await page.evaluate(() => window.scrollTo(0, 3000));
  await page.waitForTimeout(700);
  const frames = await page.evaluate(
    () =>
      new Promise((res) => {
        let n = 0;
        const t = setTimeout(() => res(n), 600);
        const tick = () => { n++; requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
        setTimeout(() => clearTimeout, 0);
      }),
  );
  const paintedOffscreen = await page.evaluate(`(() => {
    const c = document.querySelector('canvas.ink-wash');
    const a = c.getContext('2d').getImageData(0,0,c.width,c.height).data.slice(0, 4000).join(',');
    return new Promise(r => setTimeout(() => {
      const b = c.getContext('2d').getImageData(0,0,c.width,c.height).data.slice(0, 4000).join(',');
      r(a === b);
    }, 700));
  })()`);
  ok('loop parks when hero is off screen', paintedOffscreen === true, 'canvas static after scroll');

  ok('no console errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

// ---- 2. reduced motion: nothing renders at all
{
  const ctx = await fresh({
    viewport: { width: 1280, height: 800 },
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(900);
  const hidden = await page.$eval('canvas.ink-wash', (c) => c.hidden);
  ok('reduced motion renders nothing', hidden === true, `hidden=${hidden}`);
  await ctx.close();
}

// ---- 3. touch: wash yes, trail no
{
  const ctx = await fresh({
    viewport: { width: 390, height: 780 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const painted = await page.evaluate(inkPixels);
  ok('wash still renders on a phone', painted > 200, `${painted} px`);
  const doc = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
  }));
  ok('no horizontal overflow at 390px', doc.scrollW <= doc.clientW, `${doc.scrollW} vs ${doc.clientW}`);
  await ctx.close();
}

// ---- 4. teardown: navigate away, exactly one loop on return
{
  const ctx = await fresh({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.click('a[href="/timeline/"]');
  await page.waitForTimeout(800);
  const gone = await page.evaluate(() => !document.querySelector('canvas.ink-wash'));
  ok('canvas is gone after navigating away', gone === true);
  await page.goBack();
  await page.waitForTimeout(1200);
  const backPainted = await page.evaluate(inkPixels);
  ok('ink returns on back-navigation', backPainted > 500, `${backPainted} px`);
  ok('no errors across navigation', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

// ---- 5. a background: normal compositing, theme-coloured, behind the text
for (const [label, dark] of [['light', false], ['dark', true]]) {
  const ctx = await fresh({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  if (dark) await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(3500);

  const css = await page.$eval('canvas.ink-wash', (c) => {
    const s = getComputedStyle(c);
    return { blend: s.mixBlendMode, z: Number(s.zIndex) };
  });
  ok(`${label}: composites normally`, css.blend === 'normal', css.blend);
  // The soak is gone: the wash sits behind the words and they lie on a tint,
  // rather than inverting inside it.
  ok(`${label}: sits behind the text`, css.z < 0, `z-index ${css.z}`);

  // Ink follows the theme again — inversion used to handle that for free.
  const lum = await page.evaluate(`(() => {
    const c = document.querySelector('canvas.ink-wash');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let sum = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i+3] > 8) { sum += d[i]; n++; }
    return n > 200 ? sum / n : -1;
  })()`);
  ok(
    `${label}: paints the theme's ink`,
    dark ? lum > 150 : lum >= 0 && lum < 120,
    `mean red ${Math.round(lum)}`,
  );
  await ctx.close();
}

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
