/**
 * Build step 6 — the ink curtain (§14) — checked in a real browser.
 *
 * The curtain introduces one genuinely new hazard, and it is the reason this script exists
 * rather than more unit tests: a full-screen element whose luminance changes. §11's
 * photosensitivity rule is not a property of `curtainAlpha`, it is a property of *the page*,
 * so it gets sampled off the page.
 *
 * The other thing only a browser can answer is the ordering guarantee §14.3 rests on: the
 * arena is built during the hold, so no claim may ever be visible on an uncovered screen.
 * That is a claim about two subsystems agreeing on a clock, which is exactly the kind of
 * thing that is true in the arithmetic and false in the build.
 */
import {
  BASE,
  fresh as context,
  launch,
  report,
} from './lib/fixture.mjs';

/*
 * The reporter, the context factory, the launcher and the open/close waits come from
 * `lib/fixture.mjs` (§12.1's charter). This file carried its own copy of each, which is how one
 * idea ended up with eleven implementations and a fix at one call site could never be a fix.
 */
const browser = await launch();
const { ok, note, fixture, done } = report();

/**
 * A desktop context. This file measures the ink curtain, which belongs to the toggle rather than to
 * either mode — but manual mode is declared anyway, so the fights it opens are §3's fights and the
 * pillar-2 snapshots have no squad in them.
 */
const fresh = (opts = {}) => context(browser, { mode: 'manual', ...opts });



/*
 * `#cat-curtain` joins the excluded furniture for the same reason the ribbon and the
 * territory bar are on the list: it is the arena's own widget, not the page. It earns its
 * place by carrying a sized backing store between transitions, which is state about the
 * curtain rather than a mark left on anything of the visitor's.
 */
const SNAP_LIST = `(() => [...document.querySelectorAll('*')]
  .filter((el) => !el.closest('#site-cat, #cat-hud, #cat-treat, #cat-scrub, #cat-throw, #cat-ribbon, #cat-territory, #cat-curtain, header'))
  .map((el, i) => i + ':' + el.tagName + ':' + el.className + ':' + (el.getAttribute('style') ?? '')))()`;

async function snapDiff(page, clean) {
  const now = await page.evaluate(SNAP_LIST);
  const diffs = [];
  for (let i = 0; i < Math.max(clean.length, now.length); i++) {
    if (clean[i] !== now[i]) diffs.push({ before: clean[i], after: now[i] });
  }
  return {
    n: diffs.length,
    detail: diffs.length
      ? `${diffs.length} differences, first: ${diffs[0].before} → ${diffs[0].after}`
      : 'identical',
  };
}

async function settled(page, ms = 6000) {
  await page
    .waitForFunction(
      () =>
        document.getElementById('cat-arena-toggle')?.getAttribute('aria-pressed') === 'false' &&
        !document.querySelector('.cat-claimed') &&
        !document.querySelector('.cat-freed') &&
        document.getElementById('cat-curtain')?.hidden !== false,
      undefined,
      { timeout: ms },
    )
    .catch(() => {});
  await page.waitForTimeout(120);
}

/**
 * Record the transition from inside the page, one sample per animation frame.
 *
 * Sampling from Playwright cannot work here: a round-trip plus a screenshot costs more than
 * a beat, so the recording would have fewer points than the thing being recorded and every
 * beat would look identical. Everything below is measured in the page's own rAF loop and
 * handed back at the end.
 *
 * Two numbers per frame. `alpha` is the curtain's own mean opacity, which answers "is the
 * screen covered". `lum` is the *composited* luminance of a strip of the page, read back
 * through `drawImage` of the curtain over a still of what is underneath — which is what an
 * eye receives, and therefore the only honest input to a photosensitivity check.
 */
async function record(page, action, ms) {
  return page.evaluate(
    async ({ action, ms }) => {
      const canvas = document.getElementById('cat-curtain');
      const frames = [];
      const t0 = performance.now();

      /*
       * The page under the curtain, sampled once as a flat luminance. It does not change
       * during a transition — the arena's claims are outlines and washes on existing
       * elements, applied behind full cover.
       *
       * Read from whichever ancestor actually paints a ground. Reading `body` alone gave
       * `rgba(0,0,0,0)` on this site, so the baseline was *black* and every check that asked
       * "does the screen only darken" was comparing dark ink against a page it believed was
       * darker still. A wrong baseline does not make a check fail loudly; it makes it answer
       * a different question.
       */
      const bodyLum = (() => {
        for (const el of [document.body, document.documentElement]) {
          const c = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
          if (!c) continue;
          const alpha = c.length > 3 ? +c[3] : 1;
          if (alpha < 0.99) continue; // transparent: keep looking
          return (0.2126 * +c[0] + 0.7152 * +c[1] + 0.0722 * +c[2]) / 255;
        }
        return 1;
      })();

      const probe = document.createElement('canvas');
      probe.width = 64;
      probe.height = 40;
      const pc = probe.getContext('2d', { willReadFrequently: true });

      /*
       * `at` is the rAF timestamp, not `performance.now()`, and the difference matters.
       * The curtain paints the state belonging to the frame's vsync time; a sampler that
       * stamps its own execution time instead disagrees with it by however long the callback
       * queue took, which varies per frame. Measured that way the flood appeared to advance
       * 0.05 over 85ms and then 0.25 over 25ms, alternating — an artefact of two clocks, read
       * as a snap. Same clock, same story.
       */
      const sample = (at) => {
        let alpha = 0;
        let lum = bodyLum;
        const hidden = canvas.hidden;
        if (!hidden && canvas.width > 0) {
          pc.clearRect(0, 0, probe.width, probe.height);
          pc.drawImage(canvas, 0, 0, probe.width, probe.height);
          const d = pc.getImageData(0, 0, probe.width, probe.height).data;
          let sumA = 0;
          let sumL = 0;
          const n = probe.width * probe.height;
          for (let i = 0; i < d.length; i += 4) {
            const a = d[i + 3] / 255;
            sumA += a;
            // The ink over the page's own ground: what actually reaches the eye.
            const ink = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
            sumL += a * ink + (1 - a) * bodyLum;
          }
          alpha = sumA / n;
          lum = sumL / n;
        }
        frames.push({
          t: at - t0,
          hidden,
          alpha,
          lum,
          claims: document.querySelectorAll('.cat-claimed').length,
        });
      };

      sample(performance.now());
      if (action === 'open' || action === 'toggle') {
        document.getElementById('cat-arena-toggle').click();
      } else if (action === 'esc') {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      }

      await new Promise((resolve) => {
        const loop = (ts) => {
          sample(ts);
          if (ts - t0 >= ms) resolve();
          else requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      });
      return frames;
    },
    { action, ms },
  );
}

/**
 * How many times a series changes direction, ignoring noise below `eps`.
 *
 * §11 allows one reversal per direction of travel: the screen may darken once and lighten
 * once. Anything more is a flicker, and a flicker across the whole viewport is the failure
 * mode the rule exists for.
 */
function reversals(values, eps = 0.004) {
  let dirn = 0;
  let changes = 0;
  let anchor = values[0];
  for (const v of values) {
    if (Math.abs(v - anchor) < eps) continue;
    const d = v > anchor ? 1 : -1;
    if (d !== dirn) {
      if (dirn !== 0) changes++;
      dirn = d;
    }
    anchor = v;
  }
  return changes;
}

// ---- 1. the ordering guarantee: covered before anything changes
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(2200);

  const frames = await record(page, 'open', 2400);
  const first = frames.find((f) => f.claims > 0);
  ok('the fight opens at all', !!first, first ? `${first.claims} claims` : 'no claims ever appeared');
  if (first) {
    ok(
      'the screen is covered before any claim appears',
      first.alpha >= 0.98,
      `cover at first claim = ${first.alpha.toFixed(3)}`,
    );
  }

  const peak = Math.max(...frames.map((f) => f.alpha));
  ok('the flood reaches full cover', peak >= 0.995, `peak cover ${peak.toFixed(3)}`);

  /*
   * §14.4 forbids the curtain arriving on one frame. Two checks, and the first one had to be
   * rewritten after it failed for the wrong reason.
   *
   * The obvious version — cap the per-frame change — turned out to be a measurement of *this
   * machine's frame rate*, not of the curtain: the idle page here manages 31fps with 80ms
   * hitches, so an 80ms gap through the steep middle of a smoothstep legitimately moves the
   * cover a quarter of the way. Capping that would have meant demanding a frame rate the
   * environment cannot supply, and "fixing" it would have meant slowing the flood.
   *
   * What actually belongs to the curtain is its *rate*: cover per millisecond, which is a
   * property of the animation and identical at 15fps and 144fps. A smoothstep's steepest
   * slope is 1.5 across its span, so anything past that plus slack means the flood moved
   * without time passing — the snap, which is the thing being forbidden.
   *
   * The ceiling carries a second factor that a first pass missed. `rise` is not coverage:
   * the ragged front travels from a band-depth below the bottom edge to a band-depth above
   * the top, which is 1.52 screen-heights for one unit of rise. Coverage therefore moves
   * 1.52× as fast as the easing does, and a ceiling built from the easing alone accuses a
   * correct flood of snapping.
   */
  const FLOOD_MS = 680;
  const FRONT_TRAVEL = 1 + 2 * 0.26; // `edge` is 26% of the grid height, at both ends
  const rising = frames.filter((f) => f.t < 900);
  let worst = { rate: 0, d: 0, dt: 0 };
  for (let i = 0; i < rising.length; i++) {
    // Over a window rather than adjacent samples: a single rAF pair is short enough that a
    // one-frame read ordering wobble dominates, and 50ms is still a fourteenth of the flood.
    const j = rising.findIndex((f, k) => k > i && f.t - rising[i].t >= 50);
    if (j < 0) break;
    const dt = rising[j].t - rising[i].t;
    const d = Math.abs(rising[j].alpha - rising[i].alpha);
    if (d / dt > worst.rate) worst = { rate: d / dt, d, dt };
  }
  const ceiling = (1.5 * FRONT_TRAVEL) / FLOOD_MS;
  ok(
    'the flood is paced by the clock, never faster than its own easing',
    worst.rate <= ceiling * 1.25,
    `peak ${(worst.rate * 1000).toFixed(2)}/s vs ceiling ${(ceiling * 1000).toFixed(2)}/s (${worst.d.toFixed(3)} over ${Math.round(worst.dt)}ms)`,
  );
  const steps = frames.filter((f) => f.alpha > 0.03 && f.alpha < 0.97).length;
  ok(
    'and it is resolved into enough steps to read as a climb',
    steps >= 8,
    `${steps} intermediate frames`,
  );

  ok(
    'the curtain takes itself away',
    frames.at(-1).hidden === true,
    `hidden=${frames.at(-1).hidden} at ${Math.round(frames.at(-1).t)}ms`,
  );

  const gone = frames.find((f, i) => i > 3 && f.hidden);
  ok(
    'and does it inside the wall clock',
    gone && gone.t <= 2100,
    gone ? `${Math.round(gone.t)}ms` : 'still up at 2400ms',
  );

  // §11, measured.
  const lums = frames.map((f) => f.lum);
  ok(
    'page luminance reverses once, not more (WCAG 2.3.1, §11)',
    reversals(lums) <= 1,
    `${reversals(lums)} reversals, ${Math.min(...lums).toFixed(3)}..${Math.max(...lums).toFixed(3)}`,
  );
  ok(
    'and only ever darkens — no full-screen flash (§14.4)',
    Math.max(...lums) <= lums[0] + 0.01,
    `start ${lums[0].toFixed(3)}, peak ${Math.max(...lums).toFixed(3)}`,
  );

  ok('no console errors through the transition', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---- 2. the same, in the dark theme, where a light flood would be a flashbang
{
  const ctx = await fresh();
  await ctx.addInitScript(() => localStorage.setItem('theme', 'dark'));
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(2200);

  const frames = await record(page, 'open', 2400);
  const lums = frames.map((f) => f.lum);
  ok(
    'dark mode darkens too — the ink is not the pale ink (§14.4)',
    Math.max(...lums) <= lums[0] + 0.01,
    `start ${lums[0].toFixed(3)}, peak ${Math.max(...lums).toFixed(3)}`,
  );
  ok(
    'dark mode reverses once as well',
    reversals(lums) <= 1,
    `${reversals(lums)} reversals`,
  );
  const first = frames.find((f) => f.claims > 0);
  ok(
    'dark mode covers before it claims',
    first && first.alpha >= 0.98,
    first ? `cover ${first.alpha.toFixed(3)}` : 'no claims',
  );
  await ctx.close();
}

// ---- 3. Esc during the flood reverses from where it is
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(2200);
  const clean = await page.evaluate(SNAP_LIST);

  const t0 = Date.now();
  await page.evaluate(() => document.getElementById('cat-arena-toggle').click());
  await page.waitForTimeout(320); // mid-flood: past the commit, well short of the hold
  const midFlood = await page.evaluate(() => {
    const c = document.getElementById('cat-curtain');
    return { hidden: c.hidden, claims: document.querySelectorAll('.cat-claimed').length };
  });
  ok('a curtain is actually up mid-flood', midFlood.hidden === false);
  ok('and nothing has been claimed yet', midFlood.claims === 0, `${midFlood.claims} claims`);

  await page.keyboard.press('Escape');
  await settled(page);
  const back = Date.now() - t0;

  const diff = await snapDiff(page, clean);
  ok('Esc mid-flood leaves the page byte-identical', diff.n === 0, diff.detail);
  ok(
    'and no curtain left on screen',
    await page.evaluate(() => document.getElementById('cat-curtain').hidden === true),
  );
  ok(
    'and the toggle is back off',
    (await page.evaluate(() =>
      document.getElementById('cat-arena-toggle').getAttribute('aria-pressed'),
    )) === 'false',
  );
  ok('interrupting does not have to wait out the animation', back < 4000, `${back}ms`);
  ok('no errors on the interrupted path', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---- 4. leaving is quicker than arriving, and leaves nothing behind
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(2200);
  const clean = await page.evaluate(SNAP_LIST);

  const inFrames = await record(page, 'open', 2400);
  const inDone = inFrames.find((f, i) => i > 3 && f.hidden);

  const outFrames = await record(page, 'esc', 1400);
  const outDone = outFrames.find((f, i) => i > 3 && f.hidden);
  ok(
    'the way out is shorter than the way in (§14.3)',
    inDone && outDone && outDone.t < inDone.t,
    `in ${inDone ? Math.round(inDone.t) : '?'}ms, out ${outDone ? Math.round(outDone.t) : '?'}ms`,
  );
  const outLums = outFrames.map((f) => f.lum);
  ok(
    'the exit darkens once and lifts once, same as the entry',
    reversals(outLums) <= 1,
    `${reversals(outLums)} reversals`,
  );
  ok(
    'the exit covers the screen before restoring it',
    Math.max(...outFrames.map((f) => f.alpha)) >= 0.9,
    `peak ${Math.max(...outFrames.map((f) => f.alpha)).toFixed(3)}`,
  );
  const firstBare = outFrames.find((f, i) => i > 2 && f.claims === 0);
  const coverThen = firstBare ? firstBare.alpha : 0;
  ok(
    'the page is put back behind cover, not in front of the visitor',
    coverThen >= 0.85,
    `cover when the last claim went = ${coverThen.toFixed(3)}`,
  );

  await settled(page);
  const diff = await snapDiff(page, clean);
  ok('a full round trip restores the page', diff.n === 0, diff.detail);
  await ctx.close();
}

// ---- 5. a full-screen fixed canvas must not disturb the page it covers
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/timeline/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  /*
   * `behavior: 'instant'`, and then wait for the number to actually be there.
   *
   * The site sets `scroll-behavior: smooth`, so a plain `scrollTo(0, 900)` animates. A
   * baseline read on a timer caught it at 731 the first time and at 0 the second — and both
   * times the check reported the *arena* moving the page, when what moved it was the scroll
   * still finishing. A flaky baseline is worse than no check: it accuses the code under test.
   */
  await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' }));
  await page.waitForFunction(() => window.scrollY === 900, undefined, { timeout: 4000 }).catch(() => {});

  const before = await page.evaluate(() => ({
    y: window.scrollY,
    hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    height: document.documentElement.scrollHeight,
    // A count, not a zero: the page has its own `hidden` furniture (flyouts, the skip link's
    // targets), and asserting "none at all" would be asserting something about the site
    // rather than about the curtain.
    gone: [...document.querySelectorAll('main *')].filter(
      (el) => getComputedStyle(el).display === 'none',
    ).length,
  }));

  // A real click, so focus lands on the toggle the way a visitor's would. `evaluate(click)`
  // fires the handler without focusing anything, which makes any focus check below vacuous.
  await page.click('#cat-arena-toggle');
  await page.waitForTimeout(400); // mid-flood, canvas up at full size
  const during = await page.evaluate(() => ({
    y: window.scrollY,
    focus: document.activeElement?.id ?? '',
    hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    events: getComputedStyle(document.getElementById('cat-curtain')).pointerEvents,
    hiddenFromAT: document.getElementById('cat-curtain').getAttribute('aria-hidden'),
    // §14: the curtain may not display:none anything. A layout that is torn down and rebuilt
    // loses scroll anchoring, and the visitor comes back to a different place on the page.
    gone: [...document.querySelectorAll('main *')].filter(
      (el) => getComputedStyle(el).display === 'none',
    ).length,
    // The canvas is sized in grid cells now, so "does it actually cover the viewport" is a
    // real question rather than a tautology.
    box: (() => {
      const r = document.getElementById('cat-curtain').getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    })(),
  }));

  ok('scroll position survives the flood', during.y === before.y, `${before.y} → ${during.y}`);
  ok('no horizontal scrollbar under a full-screen canvas', during.hscroll === before.hscroll);
  ok('the curtain is inert to the pointer', during.events === 'none', during.events);
  ok('and invisible to assistive tech', during.hiddenFromAT === 'true');
  ok(
    'the curtain covers the viewport, not a corner of it',
    during.box.w >= 1280 && during.box.h >= 900,
    `${during.box.w}×${during.box.h}`,
  );
  ok(
    'the curtain display:none-s nothing to make room',
    during.gone === before.gone,
    `${before.gone} → ${during.gone}`,
  );

  await page.keyboard.press('Escape');
  await settled(page);
  const after = await page.evaluate(() => ({
    y: window.scrollY,
    focus: document.activeElement?.id ?? '',
    height: document.documentElement.scrollHeight,
  }));
  ok('scroll position survives the round trip', after.y === before.y, `${before.y} → ${after.y}`);
  ok('page height is unchanged', after.height === before.height, `${before.height} → ${after.height}`);
  /*
   * Not "focus is restored" — nothing restores it, because nothing takes it. The arena opens
   * no dialog and traps nothing, so the control the visitor pressed simply keeps focus for
   * the whole round trip. That is the stronger property, and it is the one worth pinning: a
   * full-screen canvas appearing over the page must not blur what you were using.
   */
  ok(
    'the curtain does not steal focus mid-flood',
    during.focus === 'cat-arena-toggle',
    during.focus || '(none)',
  );
  ok(
    'and focus is still on the toggle afterwards',
    after.focus === 'cat-arena-toggle',
    after.focus || '(none)',
  );
  await ctx.close();
}

// ---- 6. the hero wash stands down while the fight is on (§14.2)
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(2600);

  /**
   * "Is it painting" cannot be asked directly, so it is asked as "does its canvas change".
   * The wash is slow by design (10fps, long dwell), so the windows are long enough that a
   * still result means stopped rather than merely between frames — and the control sample
   * below proves the measurement can see movement at all.
   */
  const digest = () =>
    page.evaluate(() => {
      const c = document.querySelector('canvas.ink-wash');
      if (!c || !c.width) return null;
      const g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let h = 0;
      for (let i = 3; i < d.length; i += 4 * 97) h = (h * 31 + d[i]) >>> 0;
      return h;
    });

  const a = await digest();
  // Not a roll and not a check on the build: if the selector stops matching, this harness cannot
  // measure anything, and saying so as a `FIXTURE` keeps it from reading as the wash being broken.
  fixture('the hero wash canvas was found', a === null ? null : true, a === null ? 'selector needs updating' : '');
  if (a !== null) {
    await page.waitForTimeout(900);
    const b = await digest();
    ok('control: the wash is painting before the fight', a !== b, `${a} → ${b}`);

    await page.evaluate(() => document.getElementById('cat-arena-toggle').click());
    await page.waitForTimeout(2200); // past the whole transition, fight running
    const c1 = await digest();
    await page.waitForTimeout(1200);
    const c2 = await digest();
    ok('the wash stops painting during a fight (§14.2)', c1 === c2, `${c1} → ${c2}`);

    await page.keyboard.press('Escape');
    await settled(page);
    const d1 = await digest();
    await page.waitForTimeout(1200);
    const d2 = await digest();
    ok('and starts again afterwards', d1 !== d2, `${d1} → ${d2}`);
  }
  await ctx.close();
}

// ---- 7. the territory bar arrives, rather than being found already there (§14.3)
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(2200);

  const widths = await page.evaluate(async () => {
    const probe = document.createElement('canvas');
    probe.width = 32;
    probe.height = 20;
    const pc = probe.getContext('2d', { willReadFrequently: true });
    const out = [];
    const t0 = performance.now();
    document.getElementById('cat-arena-toggle').click();
    while (performance.now() - t0 < 2600) {
      await new Promise((r) => requestAnimationFrame(r));
      const fill = document.querySelector('#cat-territory .territory-mine');
      const bar = document.getElementById('cat-territory');
      const c = document.getElementById('cat-curtain');
      /*
       * How much ink is actually in the way, not whether a canvas element exists. The first
       * version asked "is the curtain hidden", which is only true *after* the reveal has
       * finished — so it scored a sweep that plays through the drying ink, exactly as
       * intended, as a sweep nobody could see.
       */
      let cover = 0;
      if (!c.hidden && c.width) {
        pc.clearRect(0, 0, probe.width, probe.height);
        pc.drawImage(c, 0, 0, probe.width, probe.height);
        const d = pc.getImageData(0, 0, probe.width, probe.height).data;
        let s = 0;
        for (let i = 3; i < d.length; i += 4) s += d[i];
        cover = s / (probe.width * probe.height * 255);
      }
      out.push({
        t: performance.now() - t0,
        w: bar && !bar.hidden && fill ? fill.getBoundingClientRect().width : -1,
        cover,
      });
    }
    return out;
  });

  const visible = widths.filter((s) => s.w >= 0);
  ok('the territory bar shows up', visible.length > 0);
  const settledW = visible.at(-1)?.w ?? 0;
  ok('and ends at the player’s share, not at zero', settledW > 20, `${Math.round(settledW)}px`);
  const grew = visible.filter((s, i) => i > 0 && s.w > visible[i - 1].w + 0.5).length;
  ok(
    'it sweeps out rather than snapping into place',
    grew >= 5,
    `${grew} frames of growth, ${Math.round(visible[0]?.w ?? -1)}px → ${Math.round(settledW)}px`,
  );
  const seenGrowth = visible.filter(
    (s, i) => i > 0 && s.w > visible[i - 1].w + 0.5 && s.cover < 0.5,
  ).length;
  ok(
    'and most of the sweep happens where it can be seen',
    seenGrowth >= Math.ceil(grew * 0.5),
    `${seenGrowth}/${grew} growth frames with the ink under half cover`,
  );
  await ctx.close();
}

// ---- 8. hammering the toggle must not strand a curtain or a fight
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(2200);
  const clean = await page.evaluate(SNAP_LIST);

  /*
   * Two schedules, because the first one was not the test it looked like.
   *
   * A ramp of short waits never lets a curtain reach its hold, so every press lands during a
   * flood and `open()` never runs — the sequence exercises one path six times. The second
   * schedule deliberately alternates long waits (past the hold, with a board on the page)
   * against short ones (mid-flood), which is what actually found the bug: a press during the
   * *exit* transition, whose `close()` arrived after the new intent and cancelled it.
   */
  /*
   * **Reported once, always** — this loop used to call `ok(..., false)` only when it found something
   * stranded, so a clean run left no record that the check had happened at all. Silence is not
   * success: a green suite has to be able to show what it looked at.
   */
  const beats = [90, 220, 350, 480, 610, 740, 1150, 200, 1300, 320, 950, 160];
  let stranded = 0;
  let strandedAt = 0;
  for (const wait of beats) {
    await page.evaluate(() => document.getElementById('cat-arena-toggle').click());
    await page.waitForTimeout(wait);
    stranded = await page.evaluate(
      () =>
        [...document.querySelectorAll('[style*="--claim-tilt"]')].filter(
          (el) => !el.classList.contains('cat-claimed'),
        ).length,
    );
    if (stranded) {
      strandedAt = wait;
      break;
    }
  }
  ok(
    'no claim styling is stranded at any beat',
    stranded === 0,
    stranded ? `${stranded} stranded after a ${strandedAt}ms beat` : `clean across ${beats.length} beats`,
  );
  await page.evaluate(() => {
    const b = document.getElementById('cat-arena-toggle');
    if (b.getAttribute('aria-pressed') === 'true') b.click();
  });
  await settled(page, 8000);

  const diff = await snapDiff(page, clean);
  ok('twelve toggles across every beat still restore the page', diff.n === 0, diff.detail);
  ok(
    'the toggle ends up agreeing with the arena (§13.5)',
    await page.evaluate(
      () =>
        (document.getElementById('cat-arena-toggle').getAttribute('aria-pressed') === 'true') ===
        !!document.querySelector('.cat-claimed'),
    ),
  );
  ok(
    'no curtain stranded on screen',
    await page.evaluate(() => document.getElementById('cat-curtain').hidden === true),
  );
  ok('no errors from the hammering', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

await browser.close();
if (!done()) process.exit(1);
