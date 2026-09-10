/**
 * art-sink — does the drawn illustration survive the dark theme's filter?
 *
 * `scratchpad/plate-sink.mjs` asked this of the plate and answered it with a distribution: twenty-one
 * plates sampled against the dark surface token, eleven off by more than eight points on some channel,
 * which is what fixed `placeholderSVG`'s ground at 88% lightness and its saturation at 18%.
 *
 * `scripts/cover-art.mjs` then *inherited* those two values rather than choosing its own, and the
 * comment there claims the inversion therefore lands where the plate's lands. That claim is why
 * `html.dark [data-drawn] img` is one rule and not two, and it is exactly the kind of claim that is
 * true when written and quietly false three redesigns later — an illustration is a whole palette,
 * not one tone, and a future template could pick anything at all.
 *
 * ## What it measures, and the first version's mistake
 *
 * The first draft compared four sampled tones against four dark *tokens* — ground to `--color-surface`,
 * the bars to `--color-ink`, the disc to `--color-secondary`. Ground passed by 3. The other three
 * failed by 88, 136 and 200, and they were right to: **the tokens are not what those tones are.** A
 * bar drawn at 0.8 opacity over the ground is not the dark theme's body text; a pale sage *fill* is
 * not the light sage the dark theme writes text in. Three of the four expectations were about the
 * wrong quantity, and the ground passing was the only real result in the run.
 *
 * So the assertions here are the filter's own claim instead, which global.css states outright:
 * *inverting reverses lightness and takes the hue with it; the rotation puts the hue back and leaves
 * only the lightness reversed.* That is checkable per point, against the same point on the light
 * theme, without anybody having to decide in advance what a given bar "should" be:
 *
 *   1. lightness is reversed — `L_dark ≈ 100 − L_light`
 *   2. hue survives — for the two points with enough saturation to have one
 *   3. the ground still sinks into `--color-surface`, which is the one comparison to a token that
 *      *is* about the same quantity, and the reason the rule exists at all
 *
 * Plus the light theme, because "sinks into the dark" is half a requirement: the same drawing has to
 * sit on the light card too.
 *
 * Sampling is a median over a small patch, never one pixel: the drawing is anti-aliased and a single
 * pixel on a rounded edge reports a blend of two colours it was never asked about. That is the lesson
 * `plate-hues.mjs` recorded.
 */
import { launch, BASE, fresh, report } from './lib/fixture.mjs';

const SLUG = 'ah-gaap-alipayhk-ux-design-2026';
const SEL = '[data-drawn="art"] img';

/** `--color-surface` on `.dark` — the card the cover sits in. */
const DARK_SURFACE = [39, 33, 25]; // #272119
/** `--color-surface` on the light theme. */
const LIGHT_SURFACE = [255, 252, 245]; // #fffcf5

/**
 * The two brand tokens the drawing is required to use, on the light theme.
 *
 * These pin the *palette*; everything else here pins the *filter*, and the difference matters. When
 * this file was first proved able to fail — by serving a version of the cover repainted in a cool
 * blue at mid lightness — the two ground checks went red and **every lightness and hue check still
 * passed**, because reversing lightness and keeping hue is what the filter does to any colour at
 * all. Those checks catch a filter that stopped working. They cannot catch a template that quietly
 * chose its own accent, and a drawing whose wine is somebody else's blue is a real failure of the
 * thing this system is for. So the tokens are asserted directly.
 */
const LIGHT_ACCENT = [142, 47, 69]; // --color-accent    #8e2f45
const LIGHT_SECONDARY = [100, 117, 84]; // --color-secondary #647554

/**
 * Where each tone can be sampled, as a fraction of the *image* box.
 *
 * Fractions rather than pixels because the cover is drawn at 1600×1000 and displayed at whatever
 * the column is; a pixel offset would measure a different part of the drawing at every viewport.
 * Every point below is the centre of a named shape in scripts/cover-art.mjs, computed from the
 * geometry there rather than found by eye:
 *
 *   ground  empty ground inside the frame, above and left of the diagram
 *   ink     the source bar — x 96..536, y 448..478 → centre (316, 463)
 *   accent  the wine share — x 466..536, y 518..544 → centre (501, 531)
 *   sageMark  the asterisk at the disc's centre — local (150,190) through translate(1120 150)
 *             rotate(12) → (1227, 367). This one is `--color-secondary` itself, undiluted, which
 *             makes it the most useful sample on the drawing: it is a site token, so what the filter
 *             does to it is what the filter does to the site.
 *   sageDisc  the pale fill around it — local (180,190) → (1257, 373), 30 units off centre inside a
 *             radius of 44 and clear of the mark's 7-wide arms
 *
 * **The two sage points exist because the first run had only one and it was not where I thought.**
 * It was aimed at the disc and landed on the mark — the give-away was the sample reading L 39, h 91,
 * s 16%, which is `#647554` to the point, not the pale `hsl(88 26% 82%)` the disc is filled with. A
 * 7-unit stroke is about 5 display pixels under a 6-pixel patch, so the median was the glyph. Rather
 * than move the point, both are sampled: the accident found the better of the two measurements.
 *
 * `saturated` marks the points whose hue is worth asserting. The ground and the bars are within a few
 * points of neutral by design, and a hue angle computed from a near-grey is noise.
 */
const POINTS = {
  ground: { at: [0.06, 0.12], saturated: false },
  ink: { at: [0.1975, 0.463], saturated: false },
  accent: { at: [0.313, 0.531], saturated: true },
  sageDisc: { at: [0.7854, 0.3733], saturated: true },
  sageMark: { at: [0.767, 0.367], saturated: true },
};

const PATCH = 6; // px square, median over 36 samples

const sampleAt = async (page, fx, fy) => {
  const clip = await page.evaluate(
    ([s, x, y, n]) => {
      const img = document.querySelector(s);
      if (!img) return null;
      const r = img.getBoundingClientRect();
      if (r.width < 100) return null;
      return {
        x: Math.round(r.x + r.width * x - n / 2),
        y: Math.round(r.y + r.height * y - n / 2),
        width: n,
        height: n,
      };
    },
    [SEL, fx, fy, PATCH],
  );
  if (!clip) return null;
  const buf = await page.screenshot({ clip });
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

/** HSL, in the units the generator writes its colours in. */
const hsl = ([r, g, b]) => {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === R) h = ((G - B) / d) % 6;
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s: s * 100, l: l * 100 };
};

/** Shortest way round the wheel, so 350 and 10 are 20 apart rather than 340. */
const hueGap = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/*
 * The tolerances, each with the reason it is that number — and one of them was wrong first time.
 *
 * **L_TOL is two numbers, because the error is a function of saturation.** `invert()` reverses
 * lightness exactly. `hue-rotate()` is a fixed linear matrix in RGB, not a perceptual operation, and
 * on a saturated colour it pushes toward the gamut edge — which lifts lightness as a side effect.
 * The first version of this file used one tolerance of 12 for everything, with a comment claiming
 * the shipped plate misses perfect reversal by 5. That arithmetic was simply wrong. global.css
 * records the plate's own crosshair, `#8e2f45`, arriving at `rgb(255 164 186)`: L 37 → 82, where
 * perfect reversal is 63. **The shipped plate misses by 19**, and this drawing reproduces it to the
 * point, because it uses the same wine. A threshold under 19 fails the thing the drawing was built
 * to match, which would make this a measurement of the wrong quantity.
 *
 * So: 12 for a near-neutral tone, where `hue-rotate` has almost nothing to act on and the reversal
 * really is close to exact — and 22 for a saturated one, which is the shipped 19 with a little room.
 * A tone that had genuinely failed to invert would be 40 or more out, so both still catch that.
 *
 * The split is on measured saturation rather than on the `saturated` flag: the flag says "this
 * point has a hue worth asserting", which is a different question from "this point is far enough
 * from grey for the matrix to distort it", even though today the same points answer both.
 *
 * H_TOL 25 — the same matrix rotates hue slightly unevenly across the wheel. The site's own token
 * pairs are the calibration: wine #8e2f45 (h 345) against dark accent #efa397 (h 8) is 23 apart, and
 * sage #647554 (h 88) against #a4b28c (h 82) is 6. 25 clears both; a hue that had genuinely turned
 * would be 60 or more out.
 *
 * SINK_TOL 12 — what "sinks into the ground" has to mean to be checkable. plate-sink used 8 as the
 * line for a *distribution* of twenty-one plates; this is one drawing at one hue and it currently
 * lands at 3, so 12 is a ceiling with room, not a bar lowered to meet a result.
 */
const L_TOL_NEUTRAL = 12;
const L_TOL_SATURATED = 22;
const SAT_SPLIT = 25; // % saturation, measured on the light sample
const H_TOL = 25;
const SINK_TOL = 12;

const { ok, note, fixture, done } = report();
const browser = await launch();

const shoot = async (dark) => {
  const ctx = await fresh(browser, { viewport: { width: 1280, height: 1000 } });
  const page = await ctx.newPage();
  if (dark) {
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await page.evaluate(() => localStorage.setItem('theme', 'dark'));
  }
  await page.goto(BASE + `/entry/${SLUG}/`, { waitUntil: 'load' });
  if (dark) await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.waitForTimeout(420);
  const filter = await page.evaluate(
    (s) => (document.querySelector(s) ? getComputedStyle(document.querySelector(s)).filter : 'no such element'),
    SEL,
  );
  const at = {};
  for (const [name, { at: [fx, fy] }] of Object.entries(POINTS)) at[name] = await sampleAt(page, fx, fy);
  await ctx.close();
  return { filter, at };
};

const light = await shoot(false);
const dark = await shoot(true);
await browser.close();

/* Nothing below means anything until the rule is actually reaching the image: an unfiltered drawing
   would still sample "near a token" for whichever tone happened to be close. */
ok('the dark filter reaches the illustration', dark.filter.includes('invert'), dark.filter);
ok('no filter on the light theme', light.filter === 'none', light.filter);

for (const [name, { saturated }] of Object.entries(POINTS)) {
  const l = light.at[name];
  const d = dark.at[name];
  if (!l || !d) {
    /* A sample that never came back is the harness failing to set itself up, not the drawing being
       wrong — `fixture()` rather than `ok()`, which is the rule `tests/harness-hygiene.test.ts`
       enforces and which caught this line the first time it ran. It still counts and still sets the
       exit code: a check that measured nothing has not passed. */
    fixture(`${name} sampled on both themes`, l && d ? [l, d] : null, `light ${l} dark ${d}`);
    continue;
  }
  const L = hsl(l);
  const D = hsl(d);
  const missed = Math.abs(D.l - (100 - L.l));
  const tol = L.s >= SAT_SPLIT ? L_TOL_SATURATED : L_TOL_NEUTRAL;
  ok(
    `${name}: lightness reverses (±${tol})`,
    missed <= tol,
    `L ${L.l.toFixed(0)} → ${D.l.toFixed(0)}, wanted ${(100 - L.l).toFixed(0)}, off by ${missed.toFixed(0)} (s ${L.s.toFixed(0)}%)`,
  );
  if (saturated) {
    const gap = hueGap(L.h, D.h);
    ok(
      `${name}: hue survives the rotation (±${H_TOL}°)`,
      gap <= H_TOL,
      `h ${L.h.toFixed(0)}° → ${D.h.toFixed(0)}°, ${gap.toFixed(0)}° apart (s ${L.s.toFixed(0)}% → ${D.s.toFixed(0)}%)`,
    );
  }
}

/* The one comparison to a token that is about the same quantity as the thing sampled — and the whole
   reason the filter exists. */
const sink = dark.at.ground.map((v, i) => v - DARK_SURFACE[i]);
ok(
  `the ground sinks into --color-surface (±${SINK_TOL})`,
  Math.max(...sink.map(Math.abs)) <= SINK_TOL,
  `rgb(${dark.at.ground.join(' ')}) vs rgb(${DARK_SURFACE.join(' ')}) — Δ ${sink.map((n) => (n > 0 ? '+' + n : n)).join(' ')}`,
);

/*
 * The palette checks. ±14 per channel is anti-aliasing and PNG round-tripping, not licence to be a
 * different colour: the two points are the interiors of a 26-unit-tall bar and a 7-unit stroke, both
 * of which are several display pixels across, so a correct drawing lands within a couple of points
 * and a drawing using a different tone is tens out. The blue-palette run above missed the accent by
 * 47, 40 and 73.
 */
const TOKEN_TOL = 14;
for (const [name, want] of [
  ['the wine is --color-accent', LIGHT_ACCENT],
  ['the sage mark is --color-secondary', LIGHT_SECONDARY],
]) {
  const got = light.at[want === LIGHT_ACCENT ? 'accent' : 'sageMark'];
  const d = got.map((v, i) => v - want[i]);
  ok(
    `${name} (±${TOKEN_TOL})`,
    Math.max(...d.map(Math.abs)) <= TOKEN_TOL,
    `rgb(${got.join(' ')}) vs rgb(${want.join(' ')}) — Δ ${d.map((n) => (n > 0 ? '+' + n : n)).join(' ')}`,
  );
}

/* And on the light theme the ground is deliberately a shade *under* the card — the cover reads as a
   print resting on it rather than as a hole in it. Under on every channel, by 6 to 60. */
const gap = Math.max(...light.at.ground.map((v, i) => LIGHT_SURFACE[i] - v));
const under = light.at.ground.every((v, i) => v < LIGHT_SURFACE[i]);
ok(
  'the light ground sits under the card, not on it',
  under && gap >= 6 && gap <= 60,
  `rgb(${light.at.ground.join(' ')}) vs surface rgb(${LIGHT_SURFACE.join(' ')}), largest gap ${gap}`,
);
note(`${PATCH}×${PATCH} medians at ${Object.keys(POINTS).join(', ')}, both themes`);

process.exit(done() ? 0 : 1);
