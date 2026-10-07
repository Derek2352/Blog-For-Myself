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
 * ## Since the covers were rendered
 *
 * The drawings are built and lit in Blender now (scripts/render-art.mjs), and each carries its own
 * dark render instead of taking the filter — inverting light turns shadows into glows. Two things
 * in this file changed with that, and the reasons are worth keeping:
 *
 * - **The filter check is reversed.** The question is no longer "does the filter reach the
 *   illustration" but "does it stay *off* it on both themes" — a filtered render is the bug now.
 * - **The per-shape points went.** They were centres of named shapes in the flat drawing, and the
 *   render's camera is tilted, so every shape moved. The lightness-reversal and hue checks were
 *   about what the filter does to a colour, and there is no filter. What replaces them is the
 *   property they protected: the brand colours are really *in* the picture — counted over the whole
 *   image, since a lit face shows its albedo exactly (diorama.py calibrates the light for that) —
 *   and in the dark render they are the dark theme's versions of themselves. The ground checks
 *   stand as they were: the board is the drawing's ground, and it still has to sink.
 *
 * Sampling is a median over a small patch, never one pixel: the drawing is anti-aliased and a single
 * pixel on a rounded edge reports a blend of two colours it was never asked about. That is the lesson
 * `plate-hues.mjs` recorded.
 */
import { launch, BASE, fresh, report } from './lib/fixture.mjs';

const SLUG = 'ah-gaap-alipayhk-ux-design-2026';
const SEL = '[data-drawn="render"] img';

/** `--color-surface` on `.dark` — the card the cover sits in. */
const DARK_SURFACE = [38, 33, 25]; // #262119 — paper.925, src/design/tokens.mjs
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
  /* Only the ground is a fixed point now: the rendered board, inside the frame's top-left corner,
     which the tilted camera keeps clear (see "Since the covers were rendered" above). The shape
     points listed here before the render are gone; the palette is counted instead. */
  ground: { at: [0.06, 0.12], saturated: false },
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

/*
 * SINK_TOL 12 — what "sinks into the ground" has to mean to be checkable. plate-sink used 8 as the
 * line for a *distribution* of twenty-one plates; this is one drawing at one hue, so 12 is a
 * ceiling with room, not a bar lowered to meet a result. (The lightness and hue tolerances that
 * stood here measured what the dark filter does to a colour; rendered covers take no filter.)
 */
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
  const box = await page.evaluate((sel) => {
    const r = document.querySelector(sel)?.getBoundingClientRect();
    return r ? { x: Math.round(r.x), y: Math.round(r.y), width: Math.floor(r.width), height: Math.floor(r.height) } : null;
  }, SEL);
  let pixels = [];
  if (box) {
    const buf = await page.screenshot({ clip: box });
    const { default: sharp } = await import('sharp');
    const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += info.channels) pixels.push([data[i], data[i + 1], data[i + 2]]);
  }
  await ctx.close();
  return { filter, at, pixels };
};

const light = await shoot(false);
const dark = await shoot(true);
await browser.close();

/* A rendered cover brings its own dark picture; the filter must stay off it on both themes. */
ok('no filter on the rendered cover, dark theme', dark.filter === 'none', dark.filter);
ok('no filter on the rendered cover, light theme', light.filter === 'none', light.filter);

/*
 * Since the covers became studio still lifes (art/blender/scenes.py) the drawing's ground is a
 * photographed sweep, not a flat tone, so "the ground sinks into --color-surface" stopped being
 * the claim. The claims now are the two the dark theme depends on: the filter stays off, and the
 * page shows the *night* render — measurably darker overall than the day one, which a filter-free
 * light render in a dark room would not be.
 */
const lum = (px) => px.reduce((a, [r, g, b]) => a + 0.2126 * r + 0.7152 * g + 0.0722 * b, 0) / Math.max(1, px.length);
fixture('both renders were captured', light.pixels.length && dark.pixels.length ? 1 : null, `${light.pixels.length} / ${dark.pixels.length} px`);
const Ld = lum(light.pixels);
const Dd = lum(dark.pixels);
/* 15%, not more: a night render is a lamp on the subject, and split-bill's subject is two white
   handsets in the pool of light, so its mean only falls from 208 to 150 (28%). A light render left
   showing would measure the same as the light theme, so any clear drop proves the switch. */
ok('the dark theme shows the night render (mean luminance at least 15% lower)', Dd < Ld * 0.85, `light ${Ld.toFixed(0)}, dark ${Dd.toFixed(0)}`);

note(`${PATCH}×${PATCH} ground medians and whole-image palette counts, both themes`);

/*
 * ## Every other drawn cover, on the dark theme
 *
 * Everything above is measured on `split-bill`, which is the calibration drawing: it is the one
 * whose palette was derived from `placeholderSVG`'s measured values, and the four points are named
 * shapes inside it. That settles the *palette*. It does not settle the *set* — there are twenty-four
 * drawn covers now across fifteen templates and eight category hues, and a template is free to draw
 * anything at all in the top-left corner of the frame.
 *
 * So the ground of every one of them is sampled, on the dark theme, against the surface token. It is
 * the one point every template leaves clear (the frame's inset corner, above and left of whatever
 * the drawing is) and the one property the shared CSS rule depends on. A template that filled that
 * corner would report a wrong colour here rather than looking wrong on somebody's screen — which is
 * the correct failure, because "the ground sinks" is the claim, and a drawing with no visible ground
 * is not making it.
 */
const browser2 = await launch();
const dctx = await fresh(browser2, { viewport: { width: 1280, height: 1000 } });
const dpage = await dctx.newPage();
await dpage.goto(BASE + '/', { waitUntil: 'load' });
await dpage.evaluate(() => localStorage.setItem('theme', 'dark'));
const { readdir } = await import('node:fs/promises');
const all = (await readdir('src/content/entries', { withFileTypes: true }))
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();
const off = [];
let measured = 0;
for (const slug of all) {
  const res = await dpage.goto(BASE + `/entry/${slug}/`, { waitUntil: 'load' });
  if (!res || res.status() >= 400) continue; // drafts do not build
  await dpage.evaluate(() => document.documentElement.classList.add('dark'));
  await dpage.waitForTimeout(260);
  const kind = await dpage.evaluate(() => document.querySelector('[data-drawn]')?.dataset.drawn ?? '');
  if (kind !== 'render') continue;
  const got = await sampleAt(dpage, ...POINTS.ground.at);
  if (!got) continue;
  measured++;
  // The night sweep is deep; a light render left showing in the dark would read far brighter.
  const bright = Math.max(...got);
  if (bright > 120) off.push(`${slug} rgb(${got.join(' ')})`);
}
await dctx.close();
await browser2.close();
fixture('every drawn cover was sampled on the dark theme', measured || null, `${measured} of ${all.length} entries carry art and built`);
ok(
  'every rendered cover shows its night render on the dark theme (sweep below 120)',
  off.length === 0,
  off.length ? off.join(' · ') : `${measured} covers, all dark`,
);

process.exit(done() ? 0 : 1);
