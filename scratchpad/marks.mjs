/**
 * marks — the two earned marks stay *on* the cat.
 *
 * §7.1's rewards are a collar (patience) and an ear notch (confrontation), and both are strokes
 * laid over a silhouette that has now been redrawn under them. Between them they have needed four
 * corrections, every one of the same shape: **a stroke seated by eye against geometry it no longer
 * matches.** The notch ran past the ear's outer edge, then sat 0.4 units inside it, which the paper
 * halo closed up into looking flush anyway. The collar sat inside the body where nothing showed,
 * then hung under the jaw where it read as a tongue.
 *
 * Eyeballing a 1.4px mark is what produced all four. So this measures instead.
 *
 * **The rule, and it is the same rule for both marks:** every point of a mark's *stroke outline* —
 * not its path, its outline, caps included — must fall inside the fill of the shape it is a mark
 * *on*. A round cap is half a stroke-width longer than its path, which is most of the margin at
 * this size and is exactly what the notch's first correction missed.
 *
 * Measured in SVG user space through `getScreenCTM`, so the ear's own rotation, the head's, the
 * gaze's and the sprite's `scaleX(-1)` are all accounted for rather than assumed away. `isPointInFill`
 * is the browser's own answer to "is this point inside that path", which beats any polygon test I
 * would write.
 */
import { launch, BASE, fresh, report } from './lib/fixture.mjs';

const { ok, note, fixture, done } = report();

/* Sample density. 96 points along the path plus 24 around each cap is well past the resolution of
   the fault being looked for — the notch is 1.7 user units long, so this is a sample every 0.02
   units, and the smallest escape any of the four corrections involved was 0.4. */
const ALONG = 96;
const CAP = 24;

const probe = (page, mark, hosts) =>
  page.evaluate(
    ({ mark, hosts }) => {
      const root = document.getElementById('site-cat');
      const el = root?.querySelector(mark);
      if (!el) return { err: `no ${mark}` };
      const targets = hosts.map((h) => root.querySelector(h)).filter(Boolean);
      if (targets.length !== hosts.length) return { err: `missing host of ${hosts.join('/')}` };

      const w = parseFloat(getComputedStyle(el).strokeWidth) || 0;
      const half = w / 2;
      const len = el.getTotalLength();
      const mine = el.getScreenCTM();
      const inv = targets.map((t) => t.getScreenCTM().inverse());

      /* A point of the stroke outline, in the mark's own user space, mapped to each host's. A
         point counts as contained if *any* host holds it: the collar crosses a throat made of two
         overlapping shapes, and being inside either is being on the cat. */
      const held = (px, py) => {
        const p = new DOMPoint(px, py).matrixTransform(mine);
        return targets.some((t, i) => t.isPointInFill(p.matrixTransform(inv[i])));
      };

      let out = 0;
      let total = 0;
      let worst = null;
      const look = (px, py, where) => {
        total++;
        if (held(px, py)) return;
        out++;
        if (!worst) worst = { x: +px.toFixed(2), y: +py.toFixed(2), where };
      };

      for (let i = 0; i <= ALONG_N; i++) {
        const s = (i / ALONG_N) * len;
        const a = el.getPointAtLength(Math.max(0, s - 0.01));
        const b = el.getPointAtLength(Math.min(len, s + 0.01));
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const m = Math.hypot(dx, dy) || 1;
        const nx = -dy / m;
        const ny = dx / m;
        const p = el.getPointAtLength(s);
        look(p.x + nx * half, p.y + ny * half, 'edge+');
        look(p.x - nx * half, p.y - ny * half, 'edge-');
      }
      /* The caps. `stroke-linecap: round` puts a half-width disc past each end, and the whole
         point of measuring is that this is the part seating by eye keeps forgetting. */
      for (const s of [0, len]) {
        const p = el.getPointAtLength(s);
        for (let i = 0; i < CAP_N; i++) {
          const th = (i / CAP_N) * Math.PI * 2;
          look(p.x + Math.cos(th) * half, p.y + Math.sin(th) * half, `cap@${s === 0 ? 'start' : 'end'}`);
        }
      }
      return { out, total, worst, width: +w.toFixed(2), len: +len.toFixed(2) };
    },
    { mark, hosts },
  );

const browser = await launch();
const ctx = await fresh(browser, { viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.addInitScript(
  ([a, c]) => {
    window.ALONG_N = a;
    window.CAP_N = c;
  },
  [ALONG, CAP],
);
await page.goto(BASE + '/about/', { waitUntil: 'load' });

/* Both marks are off by default — one wants every treat, the other a won fight — so a harness that
   waited for them to be earned would be testing the game, not the drawing. Forced. */
const forced = await page.evaluate(() => {
  const c = document.getElementById('site-cat');
  c?.classList.add('lv6', 'notched');
  return Boolean(c && getComputedStyle(c.querySelector('.cat-collar')).opacity !== '0');
});
fixture('collar and notch forced visible', forced || null);

/* Three poses, because the mark's host moves underneath it and containment is only interesting
   where it is hardest. The head yaws toward the pointer (§17), and the collar is deliberately
   *outside* the gaze group — a collar sits on a neck, and a neck does not turn with a head — so a
   full deflection is the pose that could slide the jaw off the collar. Both extremes, and neutral. */
for (const [pose, mx] of [
  ['neutral', null],
  ['gaze right', 1240],
  ['gaze left', 40],
]) {
  if (mx === null) {
    await page.mouse.move(640, 450);
    await page.waitForFunction(
      () => {
        const g = document.querySelector('#site-cat .cat-gaze');
        const r = g && g.style.rotate;
        return !r || Math.abs(parseFloat(r)) < 0.2;
      },
      undefined,
      { timeout: 6000 },
    ).catch(() => note('gaze never returned to neutral'));
  } else {
    await page.mouse.move(mx, 200);
    /* Wait for the eased yaw to arrive rather than sleeping past it: GAZE_TAU_MS is 200, so the
       value is still visibly moving for the best part of a second. */
    await page
      .waitForFunction(
        () => {
          const g = document.querySelector('#site-cat .cat-gaze');
          const now = Math.abs(parseFloat(g?.style.rotate ?? '0')) || 0;
          const was = window.__yaw ?? -1;
          window.__yaw = now;
          return now > 0.5 && Math.abs(now - was) < 0.05;
        },
        undefined,
        { timeout: 6000 },
      )
      .catch(() => note(`${pose}: yaw never settled — measured wherever it was`));
  }

  for (const [name, sel, hosts] of [
    ['notch', '.cat-notch', ['.ear-near path']],
    ['collar', '.cat-collar', ['.cat-skull', '.cat-body']],
  ]) {
    const r = await probe(page, sel, hosts);
    if (r.err) {
      /* The element is missing, so nothing was measured — that is the harness failing to set
         itself up, not the drawing being wrong, and `fixture()` is the reporter that says so. */
      fixture(`${pose}: ${name} measurable`, null, r.err);
      continue;
    }
    const pct = ((r.out / r.total) * 100).toFixed(1);
    ok(
      `${pose}: the ${name} stays inside its host`,
      r.out === 0,
      r.out === 0
        ? `${r.total} outline points, stroke ${r.width}, path ${r.len}`
        : `${r.out}/${r.total} points outside (${pct}%), worst ${r.worst.where} at ${r.worst.x},${r.worst.y}`,
    );
  }
}

/* The other half of "on the cat": a mark can be fully contained and still invisible, which is what
   the collar was before it was moved after the head. Contained *and* on top is what shows. */
const draws = await page.evaluate(() => {
  const svg = document.querySelector('#site-cat .cat-svg');
  const order = [...svg.querySelectorAll('*')];
  const i = (s) => order.indexOf(svg.querySelector(s));
  return { collar: i('.cat-collar'), head: i('.cat-gaze'), notch: i('.cat-notch'), ear: i('.ear-near path') };
});
ok(
  'the collar is painted after the head, not under it',
  draws.collar > draws.head && draws.head >= 0,
  `collar at ${draws.collar}, head group at ${draws.head}`,
);
ok(
  'the notch is painted after its ear',
  draws.notch > draws.ear && draws.ear >= 0,
  `notch at ${draws.notch}, ear at ${draws.ear}`,
);

/* Proportion, which is the fault the eye caught and no containment check can: a mark that fits
   inside the ear can still be most of the ear. Both marks are measured against the shape they sit
   on, in that shape's own units, so shrinking the ear shows up here rather than at 8× on a screen. */
const scale = await page.evaluate(() => {
  const root = document.getElementById('site-cat');
  const box = (s) => {
    const b = root.querySelector(s).getBBox();
    return { w: b.width, h: b.height };
  };
  const strokeBox = (s) => {
    const el = root.querySelector(s);
    const b = el.getBBox();
    const w = parseFloat(getComputedStyle(el).strokeWidth) || 0;
    return { w: b.width + w, h: b.height + w, stroke: w };
  };
  const ear = box('.ear-near path');
  const notch = strokeBox('.cat-notch');
  const head = box('.cat-skull');
  const collar = strokeBox('.cat-collar');
  return {
    notchW: notch.w / ear.w,
    notchH: notch.h / ear.h,
    collarH: collar.h / head.h,
    ear: [+ear.w.toFixed(2), +ear.h.toFixed(2)],
    notch: [+notch.w.toFixed(2), +notch.h.toFixed(2)],
  };
});
note(
  `near ear ${scale.ear[0]}×${scale.ear[1]}, notch ${scale.notch[0]}×${scale.notch[1]} incl. stroke`,
);
/* [PH 0.55] of the ear's width. A nick reads as a nick because the ear is plainly bigger than it;
   past about half the ear the mark stops being a mark on an ear and becomes a tag clipped to one.
   The number is loose on purpose — this check exists to catch the mark and its host drifting apart
   by a factor, not to police a tenth. */
ok(
  'the notch is a mark on the ear, not most of it',
  scale.notchW <= 0.55,
  `${(scale.notchW * 100).toFixed(0)}% of the ear's width, ${(scale.notchH * 100).toFixed(0)}% of its height`,
);

await ctx.close();
await browser.close();
process.exit(done() ? 0 : 1);
