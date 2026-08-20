/**
 * §16, judged by eye: **what does the shove actually look like on a 318×217 board?**
 *
 * This is not an assertion harness — `hand.mjs` is that. This one exists because the question the
 * prototype was built to answer is a *visual* one, and the plan says so: "the prototype is judged by
 * looking at it." The stated risk was that `CARD_SCALE` is 1/5 and the cat is 28px, so a shove big
 * enough to read might also be a shove that throws the cat across the board. No number settles that.
 *
 * What it produces, in `scratchpad/out/`:
 *
 * - **A frame strip per case**, board-only element screenshots at `deviceScaleFactor: 3`, each
 *   labelled with milliseconds since the flick. Three times is not an upscale — the raster really is
 *   954px wide, so a 25px displacement is 75 honest pixels rather than a blur.
 * - **The cat's own path**, drawn from a `requestAnimationFrame` recorder rather than from the
 *   screenshots. Screenshots cost 20–60ms each and cannot sample a 60Hz walk; the trail can, and it
 *   is the only way to see the *kink* — a deflection is a change of direction, and a direction needs
 *   two samples the eye cannot get from a contact sheet.
 * - **The same flick along the heading**, where nothing should happen at all. A demo of a new
 *   mechanic that does not show the control is a demo of nothing: the cat wanders on its own, and
 *   "it moved after I swiped" has to be distinguished from "it was going there anyway". See `CASES`
 *   for why 2.6 moved that control from a mode to an axis.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  launch,
  fresh,
  press,
  waitOpen,
  report,
  bounded,
  BASE,
  IMPULSE_MS,
  IMPULSE_SPEED,
  IMPULSE_TRAVEL_PX,
  MIN_FLICK_PX,
  SWIPE_RADIUS,
  swipeCat,
} from './lib/fixture.mjs';

const OUT = 'scratchpad/out';

/** Every nth screencast frame goes in the strip — ~40fps is more frames than a page wants. */
const STRIP_EVERY = 4;

/**
 * The strip's crop, in board px — **one window, locked for the whole strip.**
 *
 * Two mistakes were made here in order, and the second is the more interesting one.
 *
 * First the frames showed the entire 318×225 board, and at that size the cat is a 28px smudge among
 * ten tiles: correct frames that told the reader nothing. So each frame was cropped around its own
 * action — and that was worse, because a crop that follows the cat is a **tracking shot**. The cat
 * sits still in the middle of every frame while the tiles slide past behind it, which is precisely
 * the opposite of what the strip is for. Movement is only visible against something that is not
 * moving.
 *
 * So the window is computed once, from every position the strip will show, and every frame is cropped
 * identically: a locked-off camera, against which the sprite's travel is the thing that moves. These
 * are the *minimum* dimensions; the real window is the union of the action plus padding.
 */
const CROP_MIN_W = 130;
const CROP_MIN_H = 96;
const CROP_PAD = 26; // a shove's worth of room around the outermost position

/** How much of the trail the path panel draws. The whole fight is 10s of walking and one 420ms event. */
const PATH_BEFORE_MS = 700;
const PATH_AFTER_MS = 900;

/**
 * **There is no edge-room requirement, and that is the finding.**
 *
 * The first version asked for 44px of clear board on every side, being `SWIPE_RADIUS + 24` so the
 * flick could extend symmetrically around the cat. It timed out in one run and *scraped through* in
 * the other at y=180, which is the worse of the two outcomes: a fixture that passes half the time is
 * measuring the roll rather than the game.
 *
 * Instrumenting it showed why, and it is about the cat rather than about the harness: **the cat
 * spends long stretches pinned to the floor.** It spawns at `y = h`, `onBoard` clamps it to its own
 * half-height, and it was observed walking a full 4 seconds along `y = 216` on a 225px board — 9px
 * from the bottom, i.e. exactly against the clamp. Any fixture with a vertical room requirement is
 * waiting for behaviour the game does not reliably offer.
 *
 * So the geometry is solved instead of waited for: `segmentHit` clamps to the segment, so a flick
 * that *starts beside the cat* and travels across it hits just as well as one centred on it. The
 * flick's endpoints are clamped into the board and the only remaining question — is what is left
 * still long enough to be a flick — is answered from the clamped segment itself, below.
 */

/** Inset the flick keeps from the board's edge, so a clamped endpoint stays over the board. */
const FLICK_INSET = 2;

/*
 * `MIN_FLICK_PX` — the shortest flick whose *segments* still clear the gesture floor — is derived in
 * `fixture.mjs` beside `swipeCat`, which is also where the gesture itself lives now. It moved there
 * when `hand.mjs` needed the same flick: §12.1's rule is that a shared strategy fixed at one call
 * site is not fixed, and this one had already been got wrong twice.
 */

/**
 * The window the fixture measures "is it walking?" over, and the floor it applies.
 *
 * 180ms and "more than 2px" was the first attempt, and it was two mistakes at once. The cat's stance
 * scales its stalk, and a `sleepy` or `ambush` roll walks it at 9–19px/s rather than
 * `CARD_STALK_SPEED`'s 34 — which over 180ms is 1.6–3.4px, straddling the threshold. And at
 * `deviceScaleFactor: 3` this page renders at **~25–30fps, not 60**, so a 180ms window holds only
 * 3–6 samples and `length > 3` was itself marginal. Stated as a speed rather than a distance so the
 * window length and the floor cannot drift apart again.
 */
const WALK_WINDOW_MS = 400;

/**
 * How fast the cat must be walking for any of this to mean anything.
 *
 * 5px/s was the first floor and it let through a cat crawling at 8–12px/s, which broke every derived
 * figure downstream at once: the measured heading was noise, so the perpendicular was arbitrary, so
 * the peak offset came out as 0.0px and the post-flick heading as "not measurable". The report was
 * green and said nothing.
 *
 * Half of `CARD_STALK_SPEED` (34px/s) is the floor now. A cat that slow is not walking a line, and a
 * deflection is defined against a line.
 */
const WALK_FLOOR_PX_S = 17;

/**
 * The recorder, installed in the page.
 *
 * Reads the boss's centre from its own layout — `placeBoss` writes `translate(x - w/2, y - h/2)`, so
 * the rect's centre *is* `boss.x/boss.y` in board coordinates, and the harness never has to reach
 * into the card's closure for it.
 */
const RECORD = () => {
  const board = document.querySelector('[data-board]');
  const boss = document.querySelector('[data-boss]');
  if (!board || !boss) return;
  window.__trail = [];
  const tick = () => {
    if (!boss.isConnected) return;
    const b = board.getBoundingClientRect();
    const r = boss.getBoundingClientRect();
    const x = r.left - b.left + r.width / 2;
    const y = r.top - b.top + r.height / 2;
    /*
     * The cat's **quarry**, reconstructed from the DOM.
     *
     * This was here to *aim* with, back when `trySwipe` took the heading as `quarry − boss`. 2.5.2
     * moved the heading to the cat's own smoothed velocity, and `swipeCat` aims from two frames of
     * measured motion — so nothing steers by this any more, and the comment that said it did was
     * left standing for a whole version. What the quarry still explains is the *erosion*: the homing
     * walk cancels a lateral offset at a rate proportional to `1/dist`, so `toQuarryPx` below is the
     * difference between "the shove is too small" and "the shove was eaten by a cat standing on its
     * kitten". Kept for that, and only that. When there is no kitten there is nothing to home on and
     * `q` is null, which is a reading rather than a gap.
     */
    let q = null;
    for (const k of document.querySelectorAll('.cat-card-kit')) {
      const kr = k.getBoundingClientRect();
      const kx = kr.left - b.left + kr.width / 2;
      const ky = kr.top - b.top + kr.height / 2;
      const d = Math.hypot(kx - x, ky - y);
      if (!q || d < q.d) q = { x: kx, y: ky, d };
    }
    window.__trail.push({
      t: performance.now(),
      x,
      y,
      qx: q ? q.x : null,
      qy: q ? q.y : null,
      phase: boss.dataset.phase ?? '',
      hit: boss.classList.contains('boss-swatted') ? 1 : 0,
    });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

/**
 * Mean heading over a window of the trail, as a unit vector plus the speed that produced it.
 *
 * Returns the **measured span** rather than the requested window, and the speed derived from it, for
 * the same reason the fixture does: at ~25fps a 400ms request holds 10 samples spread over whatever
 * the frames actually were, and dividing by the number you asked for instead of the one you got is
 * how a derived figure goes quietly wrong. `null` when the cat covered under a pixel — that is a
 * stand, and a stand has no heading to be across.
 */
function headingOver(trail, fromMs, toMs) {
  const seg = trail.filter((p) => p.t >= fromMs && p.t <= toMs);
  if (seg.length < 2) return null;
  const dx = seg[seg.length - 1].x - seg[0].x;
  const dy = seg[seg.length - 1].y - seg[0].y;
  const len = Math.hypot(dx, dy);
  const span = seg[seg.length - 1].t - seg[0].t;
  if (len < 1 || span <= 0) return null;
  return { x: dx / len, y: dy / len, len, span, speed: (len / span) * 1000 };
}

/**
 * Frames of the shove itself, through CDP's screencast.
 *
 * **Why not `locator.screenshot()` in a loop.** That was the first version, and the result was a
 * contact sheet of the wrong 2.6 seconds: each element screenshot costs a full round trip and cost
 * ~330ms at `deviceScaleFactor: 3`, so the *first* frame arrived at +332ms — by which point a 420ms
 * impulse is most of the way spent — and the last at +2400ms. Every frame was honestly labelled and
 * the strip still showed nothing but a cat walking, because the mechanic had finished before the
 * camera opened.
 *
 * `Page.startScreencast` pushes a frame whenever the compositor swaps one, with no per-frame round
 * trip, so the cadence is the renderer's rather than the harness's — ~40fps here, which is a dozen
 * frames across the impulse instead of one and a bit. Each frame is acknowledged immediately, because
 * Chrome stops sending until the previous one is acked.
 *
 * **Start and stop are separate, and that is not an incidental shape.** The first version took a
 * duration and did `start → wait 80ms → flick → wait out the clock`, which put the flick at the
 * *start* of the recording on paper and at the *end* of it in fact: every `mouse.move` is its own
 * CDP round trip, so a flick advertised as ~104ms of pointer movement actually took ~700ms of the
 * 940ms window, and the recording stopped 161ms after the shove began. A duration fixed in advance
 * cannot bracket an event whose own cost is unknown — so the caller stops it a known interval after
 * the moment it cares about, which it only knows once the flick has returned.
 */
function screencastStart(cdp) {
  const frames = [];
  const onFrame = async (f) => {
    frames.push({ data: f.data, at: f.metadata.timestamp * 1000 }); // seconds → ms, same basis as Date.now()
    await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  };
  cdp.on('Page.screencastFrame', onFrame);
  const started = cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, everyNthFrame: 1 });
  return {
    frames,
    stop: async () => {
      await started.catch(() => {});
      await cdp.send('Page.stopScreencast').catch(() => {});
      cdp.off('Page.screencastFrame', onFrame);
      return frames;
    },
  };
}

/**
 * Crop the screencast frames to the board — **in the page**, where the scale is knowable.
 *
 * A screencast frame is the whole viewport in *device* pixels while `boundingBox()` is in CSS
 * pixels, so cropping needs the ratio between them. Rather than assume it equals the
 * `deviceScaleFactor` this script asked for — CDP clamps frames to `maxWidth`/`maxHeight` and would
 * silently hand back a smaller image — this derives it from the frame itself:
 * `img.naturalWidth / innerWidth`. Measured, not assumed, which is the same rule the constants
 * follow.
 */
const CROP = (jobs) =>
  Promise.all(
    jobs.map(
      ({ data, rect }) =>
        new Promise((done) => {
          const img = new Image();
          img.onload = () => {
            const s = img.naturalWidth / window.innerWidth;
            const c = document.createElement('canvas');
            c.width = Math.round(rect.width * s);
            c.height = Math.round(rect.height * s);
            c.getContext('2d').drawImage(
              img,
              Math.round(rect.x * s),
              Math.round(rect.y * s),
              c.width,
              c.height,
              0,
              0,
              c.width,
              c.height,
            );
            done(c.toDataURL('image/jpeg', 0.92));
          };
          img.onerror = () => done('');
          img.src = 'data:image/jpeg;base64,' + data;
        }),
    ),
  );

/**
 * The two runs the strip compares, and **why the control changed shape in 2.6.**
 *
 * Until 2.6 the control was a *mode*: the same flick in commander mode, where the hand was switched
 * off entirely. Commander mode is gone — §16 is the game — so that control had to be replaced, and
 * the replacement is deliberately not the nearest survivor. Manual mode switches the hand off the
 * same way, but it also changes what the cat is doing: it stalks the pointer, and `swipeCat`
 * dispatches its flick as pointer events on the board, so the control strip would show a cat being
 * dragged across the frame by the very gesture that is meant to do nothing. A reader comparing two
 * strips of a moving cat cannot subtract that.
 *
 * So the control moves from the mode to the **axis**: same mode, same machinery, same cat behaviour,
 * and the only difference is the angle of the flick — which is the exact quantity `veer()` is about.
 * The shove is the perpendicular rejection of the swipe against the heading, so a flick *along* the
 * heading has nothing to reject and the cat simply keeps walking. That is a stronger control than
 * the old one: it holds everything constant except the thing being demonstrated, instead of
 * switching off the whole subsystem and asking the reader to trust that nothing else moved with it.
 *
 * `hand.mjs` still owns the along case as arithmetic. What arithmetic cannot do is show it.
 */
const CASES = [
  { id: 'across', mode: 'hand', axis: 'across', registers: true },
  { id: 'along', mode: 'hand', axis: 'along', registers: false },
];

async function run(browser, kase, r) {
  const { id, mode, axis, registers } = kase;
  const ctx = await fresh(browser, { mode, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await press(page);
  await waitOpen(page);

  const armed = await bounded(page, () => !document.querySelector('#cat-card-panel').hidden && document.querySelectorAll('.cat-tile').length > 0, 8000);
  if (!armed) return r.fixture(`${id}: a fight to look at`, null, 1);

  // The mode the card thinks it is in, not the mode this script asked for. Worth one assertion
  // rather than a note: the flag goes through `localStorage`, and a run that silently fell back to
  // the default would still produce a strip, a path and a plausible-looking report of nothing. It
  // earned that keep in 2.6 — with both cases now asking for `hand`, this is the only line standing
  // between a mistyped mode and two identical strips presented as a comparison.
  const declared = await page.evaluate(() => document.querySelector('#cat-card-panel')?.dataset.mode ?? '');
  r.ok(`${id}: the card agrees it is in ${mode} mode`, declared === mode, `data-mode=${declared || '(unset)'}`);

  await page.evaluate(RECORD);

  // Fixture: a cat that is stalking and actually walking. Its stance, its quarry and its route are
  // all rolls, so this waits rather than asserts, and reports the wait.
  const placed = await bounded(
    page,
    ({ win, floor }) => {
      const el = document.querySelector('[data-boss]');
      if (el.dataset.phase !== 'stalk') return false;
      const trail = window.__trail ?? [];
      const now = performance.now();
      const seg = trail.filter((p) => p.t > now - win);
      if (seg.length < 3) return false;
      const span = seg[seg.length - 1].t - seg[0].t;
      if (span < win * 0.5) return false; // not enough of the window recorded yet to judge
      const moved = Math.hypot(seg[seg.length - 1].x - seg[0].x, seg[seg.length - 1].y - seg[0].y);
      return (moved / span) * 1000 > floor;
    },
    12_000,
    { win: WALK_WINDOW_MS, floor: WALK_FLOOR_PX_S },
  );
  if (!placed) return r.fixture(`${id}: a cat walking faster than ${WALK_FLOOR_PX_S}px/s`, null, 1);

  const board = await page.locator('[data-board]').boundingBox();

  // The camera opens *before* the gesture. Obvious in hindsight and it was the first version's whole
  // failure: a recording started after the flick cannot contain the flick. The aim is `FLICK_IN`'s
  // job, in the page, for the staleness reason documented there — everything below reads back what it
  // actually did rather than telling it what to do.
  const cdp = await page.context().newCDPSession(page);
  const cast = screencastStart(cdp);
  await page.waitForTimeout(120); // a few frames of the undisturbed walk, for the strip to open on
  const t0 = await swipeCat(page, { inset: FLICK_INSET, axis });
  await page.waitForTimeout(IMPULSE_MS + 200); // measured from the flick, not from the camera
  const raw = await cast.stop();
  await cdp.detach().catch(() => {});

  if (!t0.aimed) return r.fixture(`${id}: a kitten on the board to be stalking`, null, 1);
  const { from, to, dir } = t0;
  if (t0.len < MIN_FLICK_PX) {
    return r.fixture(`${id}: room for a ${MIN_FLICK_PX}px flick ${axis} the heading`, null, 1);
  }
  const flickLen = t0.len;

  const trail = await page.evaluate(() => window.__trail);

  /*
   * Everything is measured **at the moment the shove began**, from the trail, after the fact.
   *
   * The first version read the cat's position and heading before dispatching the flick and treated
   * that as the origin — but the flick lands 200–300ms later, and over 300ms a homing cat has already
   * steered. So the counterfactual was anchored to a position and a direction the cat had left, and
   * the "would have been" line drifted for reasons that had nothing to do with the shove. Reading it
   * out of the recorded trail at `t0` costs nothing and is anchored to the right instant by
   * construction.
   */
  const at = (t) => trail.reduce((best, p) => (Math.abs(p.t - t) < Math.abs(best.t - t) ? p : best), trail[0]);
  const before = at(t0.perf);
  const head = headingOver(trail, t0.perf - WALK_WINDOW_MS, t0.perf);
  if (!head) return r.fixture(`${id}: a measurable heading at the moment of the flick`, null, 1);

  const after = headingOver(trail, t0.perf + 40, t0.perf + IMPULSE_MS);
  // `null`, not `0`. The first version collapsed "walked dead straight" and "stood still, nothing to
  // measure" into the same `0.0°`, and the control run's 0.0° was in fact the second — a report that
  // cannot tell a measurement from a missing one is the fault this whole session has been chasing.
  const turned =
    after === null
      ? null
      : (Math.acos(Math.max(-1, Math.min(1, head.x * after.x + head.y * after.y))) * 180) / Math.PI;

  /*
   * The number the picture is actually about: **how far from its own course did the cat end up?**
   *
   * Heading angle alone is a poor witness — the cat turns on its own whenever its quarry moves. This
   * takes where the cat would have been had it simply kept walking (its pre-flick heading, at its
   * measured pre-flick speed) and measures the gap to where it really is when the impulse expires.
   * In the along run the gap is whatever the cat's own steering did; in the across run it should
   * carry roughly `IMPULSE_TRAVEL_PX` on top of that.
   */
  const end = at(t0.perf + IMPULSE_MS);
  const coast = (end.t - before.t) / 1000;
  const wouldBe = {
    x: before.x + head.x * head.speed * coast,
    y: before.y + head.y * head.speed * coast,
  };
  const strayed = Math.hypot(end.x - wouldBe.x, end.y - wouldBe.y);
  const hits = trail.filter((p) => p.hit).length;

  /*
   * Diagnosis, not decoration. `strayed` at the end of the impulse came out at 10.6px against a
   * nominal `IMPULSE_TRAVEL_PX` of 25.2, and there are two quite different explanations:
   *
   * - the cat's walk is **homing** (`step` is recomputed toward the quarry every frame), so a lateral
   *   offset is actively eroded while the shove is still being applied; or
   * - the impulse is only added inside `stepBoss`'s **stalk** branch, so a telegraph or a pounce part
   *   way through the window means most of the 420ms was never applied at all.
   *
   * These want opposite responses — one is a tuning question, the other a placement bug — so the
   * harness measures both: the *peak* offset along the shove direction over the window (a homing
   * cat's offset rises then falls), and which phases the cat was actually in while it lasted.
   */
  const win = trail.filter((p) => p.t >= t0.perf && p.t <= t0.perf + IMPULSE_MS);
  /** Where the cat would have been at this sample's moment had it just kept walking. */
  const ghostAt = (t) => {
    const s = (t - before.t) / 1000;
    return { x: before.x + head.x * head.speed * s, y: before.y + head.y * head.speed * s };
  };
  /*
   * Sideways travel, measured from **where the cat was when the shove began** rather than from the
   * ghost.
   *
   * Projecting `p − ghost` onto the shove direction looked like the more informative figure and was in
   * fact the noisier one, because the ghost is an extrapolation and it inherits every error in
   * `head.speed`. That speed is measured off a ~20fps trail with jittery frame gaps, and the recorded
   * top instantaneous speeds — 17, 90, 131px/s in three consecutive runs of the same walk — show how
   * badly. A ghost racing ahead at 131px/s while the cat walks at 20 pushes `p − ghost` backwards
   * along the *heading*, and since `dir` is perpendicular to the cat's **aim** rather than to its
   * measured velocity, part of that error lands on `dir` and swamps a 25px signal.
   *
   * `p − before` has no such term. The cat's own walk contributes to it only through whatever
   * component the walk has along `dir`, which is near zero by construction, and the shove contributes
   * all of itself. The ghost stays in the drawing, where being approximate is fine.
   */
  const along = (p) => (p.x - before.x) * dir.x + (p.y - before.y) * dir.y;
  const peak = win.reduce((m, p) => Math.max(m, along(p)), 0);
  const phases = {};
  for (const p of win) phases[p.phase] = (phases[p.phase] ?? 0) + 1;
  const stalkShare = win.length ? (phases.stalk ?? 0) / win.length : 0;

  /*
   * The decisive measurement: **how fast was the cat moving, frame to frame?**
   *
   * The offset figures above can be small for two entirely different reasons — the impulse is applied
   * and then eroded, or the impulse never reaches the cat — and no amount of staring at positions
   * separates them. Instantaneous speed does. `IMPULSE_SPEED` is 90px/s on top of a ~20px/s walk, so
   * if the shove lands the cat's top speed during the window has to jump towards 90; if the top speed
   * stays at walking pace, nothing was ever added and the offset arithmetic is beside the point.
   */
  const speeds = (from, to) => {
    const seg = trail.filter((p) => p.t >= from && p.t <= to);
    const out = [];
    for (let i = 1; i < seg.length; i++) {
      const ms = seg[i].t - seg[i - 1].t;
      if (ms > 0) out.push((Math.hypot(seg[i].x - seg[i - 1].x, seg[i].y - seg[i - 1].y) / ms) * 1000);
    }
    return out;
  };
  const topBefore = Math.max(0, ...speeds(t0.perf - WALK_WINDOW_MS, t0.perf));
  const topDuring = Math.max(0, ...speeds(t0.perf, t0.perf + IMPULSE_MS));

  /*
   * **Path length over the impulse window** — the one figure that assumes nothing.
   *
   * Every directional measure above depends on knowing which way the shove pushed, and the two runs
   * disagreed on that in ways that took several rewrites to pin down. Distance travelled needs no
   * direction at all: `IMPULSE_TRAVEL_PX` is 25px of extra travel, so if the impulse reaches the cat
   * its path over those 420ms must be about 25px longer than the same window in the along run, no
   * matter where the homing walk aims it. If the two are equal, the shove is not being applied and
   * every offset figure is beside the point.
   */
  const pathLen = (from, to) => {
    const seg = trail.filter((p) => p.t >= from && p.t <= to);
    let d = 0;
    for (let i = 1; i < seg.length; i++) d += Math.hypot(seg[i].x - seg[i - 1].x, seg[i].y - seg[i - 1].y);
    return d;
  };
  const walkedBefore = pathLen(t0.perf - IMPULSE_MS, t0.perf);
  const walkedDuring = pathLen(t0.perf, t0.perf + IMPULSE_MS);

  /*
   * **Distance to the quarry**, which turns out to be the number the whole mechanic hinges on.
   *
   * The homing walk erases a lateral offset δ at `step · δ / dist` per frame — so the erosion is not a
   * fixed drag, it is *inversely proportional to how far the cat is from what it is chasing*. At
   * dist = 40px the shove keeps most of its 25px; at dist = 10px the correction is four times
   * stronger and eats almost all of it. Recording it alongside the travel is what makes the two
   * separable, instead of leaving a spread of results with no explanation.
   */
  const q = at(t0.perf);
  const toQuarryPx = q.qx === null ? null : Math.hypot(q.qx - q.x, q.qy - q.y);

  // Assertions, one look each — the picture is the deliverable but these are the claims it must not
  // contradict, and a picture is a poor place to notice that the cat left the board.
  const w = board.width;
  const h = board.height;
  const off = trail.filter((p) => p.x < 0 || p.y < 0 || p.x > w || p.y > h);
  r.ok(`${id}: the shove never puts the cat off the board`, off.length === 0, `${off.length} of ${trail.length} samples outside 0..${Math.round(w)}×${Math.round(h)}`);

  const reg = registers;
  r.ok(
    `${id}: the flick ${reg ? 'registers' : 'does nothing'}`,
    reg ? hits > 0 : hits === 0,
    `${hits} swatted frames`,
  );

  r.note(`${id}: heading turned ${turned === null ? '(not measurable — the cat stood)' : turned.toFixed(1) + '°'}`);
  r.note(`${id}: strayed ${strayed.toFixed(1)}px from its own course, peaking at ${peak.toFixed(1)}px along the shove (nominal ${IMPULSE_TRAVEL_PX.toFixed(1)}px)`);
  r.note(`${id}: ${(stalkShare * 100).toFixed(0)}% of the impulse window was spent stalking — ${JSON.stringify(phases)}`);
  r.note(`${id}: top frame-to-frame speed ${topBefore.toFixed(0)}px/s before → ${topDuring.toFixed(0)}px/s during (a landed shove peaks near ${IMPULSE_SPEED}px/s on top of the walk)`);
  r.note(`${id}: travelled ${walkedBefore.toFixed(1)}px in the ${IMPULSE_MS}ms before the flick → ${walkedDuring.toFixed(1)}px in the ${IMPULSE_MS}ms after (a landed shove adds ~${IMPULSE_TRAVEL_PX.toFixed(0)}px)`);
  r.note(`${id}: ${toQuarryPx === null ? 'no kitten to chase' : `${toQuarryPx.toFixed(0)}px from its quarry when the flick landed — the homing correction scales as 1/dist`}`);
  r.note(`${id}: board ${Math.round(w)}×${Math.round(h)}, cat at ${Math.round(before.x)},${Math.round(before.y)} walking ${head.speed.toFixed(0)}px/s, flick ${Math.round(flickLen)}px`);
  r.note(`${id}: ${trail.length} trail samples over ${((trail[trail.length - 1].t - trail[0].t) / 1000).toFixed(1)}s = ${((trail.length / (trail[trail.length - 1].t - trail[0].t)) * 1000).toFixed(0)}fps at 3×`);

  /*
   * Turn the screencast into a strip.
   *
   * `t0` was read in both clocks so the frames can be placed on the trail's timeline; from there each
   * frame carries the cat's position and its **ghost** — where an undisturbed walk would have put it
   * at that same instant. Marking both is the difference between a strip you can read and one you
   * cannot: the first attempt drew nothing, and at 28px on a 318px board the eye simply cannot find
   * the cat, let alone judge whether it is off course.
   */
  const skew = t0.epoch - t0.perf; // add to a perf time to get an epoch time
  const rel = raw.map((f) => ({ ...f, rel: f.at - t0.epoch }));
  r.note(`${id}: screencast delivered ${raw.length} frames, ${Math.round(rel[0]?.rel ?? 0)}ms … ${Math.round(rel[rel.length - 1]?.rel ?? 0)}ms relative to the flick`);
  const kept = rel.filter((f) => f.rel >= -140 && f.rel <= IMPULSE_MS + 200);

  const marks = kept.map((f) => ({ p: at(f.at - skew), g: ghostAt(f.at - skew), rel: f.rel, data: f.data }));

  // One window for every frame, framed on the union of what the strip will show, then grown to the
  // minimum, then slid back inside the board so no frame shows the page behind it.
  const xs = marks.flatMap((m) => [m.p.x, m.g.x]);
  const ys = marks.flatMap((m) => [m.p.y, m.g.y]);
  const vwWant = Math.max(CROP_MIN_W, Math.max(...xs) - Math.min(...xs) + CROP_PAD * 2);
  const vhWant = Math.max(CROP_MIN_H, Math.max(...ys) - Math.min(...ys) + CROP_PAD * 2);
  const vwUse = Math.min(board.width, vwWant);
  const vhUse = Math.min(board.height, vhWant);
  const view = {
    x: Math.max(0, Math.min(board.width - vwUse, (Math.min(...xs) + Math.max(...xs)) / 2 - vwUse / 2)),
    y: Math.max(0, Math.min(board.height - vhUse, (Math.min(...ys) + Math.max(...ys)) / 2 - vhUse / 2)),
    width: vwUse,
    height: vhUse,
  };
  const rect = { ...view, x: board.x + view.x, y: board.y + view.y };

  const cropped = marks.length ? await page.evaluate(CROP, marks.map(({ data }) => ({ data, rect }))) : [];
  const frames = marks.map((m, i) => ({
    src: cropped[i] ?? '',
    at: Math.round(m.rel),
    view,
    cat: { x: m.p.x, y: m.p.y },
    ghost: m.g,
    phase: m.p.phase,
    hit: m.p.hit,
  }));
  r.ok(`${id}: the recording covers the shove`, frames.some((f) => f.at <= 20) && frames.some((f) => f.at >= IMPULSE_MS - 60), `${frames.length} frames, ${frames[0]?.at}ms … ${frames[frames.length - 1]?.at}ms`);

  const out = { id, mode, axis, board: { w, h }, before, head, dir, from, to, t0: t0.perf, turned, strayed, peak, stalkShare, hits, frames, trail };
  await ctx.close();
  return out;
}

/**
 * The report page.
 *
 * Two decisions worth stating, both learned from the first version being unreadable:
 *
 * - **The strip carries its own markers.** A ring on the cat and a hollow ring on the ghost — where
 *   an undisturbed walk would have put it at that instant. Without them the frames are a board with
 *   tiles on it: a 28px sprite in a 318px board is not something the eye picks out of a contact
 *   sheet, and "is it off course" is a comparison against a position that does not exist in the
 *   picture at all.
 * - **The path panel zooms to the action.** Drawn over the whole board, a 15px deflection was four
 *   pixels of ink in a mostly empty rectangle. It now frames the trail's own bounds, with the board's
 *   edges still drawn so the scale stays honest, and the ghost line beside the real one so the gap
 *   between "where it went" and "where it was going" is the thing you actually see.
 */
function html(runs) {
  const path = (t) => t.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const panel = (d) => {
    if (!d || !d.trail) return `<section><h2>${d?.id ?? '?'}</h2><p class="miss">no run</p></section>`;
    // A window around the flick, not the whole fight: the trail can run to 10s of ordinary walking,
    // and drawn end to end it zooms the one 420ms event down to four pixels of ink.
    const pre = d.trail.filter((p) => p.t <= d.t0 && p.t >= d.t0 - PATH_BEFORE_MS);
    const post = d.trail.filter((p) => p.t >= d.t0 && p.t <= d.t0 + IMPULSE_MS);
    const rest = d.trail.filter((p) => p.t > d.t0 + IMPULSE_MS && p.t <= d.t0 + PATH_AFTER_MS);
    const ghost = d.frames.map((f) => f.ghost);

    // Frame the trail, not the board: pad generously, then clamp to the board so the drawing can
    // never imply the cat went somewhere it could not.
    const pts = [...d.trail, ...ghost];
    const pad = 34;
    const vx = Math.max(0, Math.min(...pts.map((p) => p.x)) - pad);
    const vy = Math.max(0, Math.min(...pts.map((p) => p.y)) - pad);
    const vw = Math.min(d.board.w, Math.max(...pts.map((p) => p.x)) + pad) - vx;
    const vh = Math.min(d.board.h, Math.max(...pts.map((p) => p.y)) + pad) - vy;
    const zoom = Math.min(760 / vw, 460 / vh);

    const shot = (f) => `<figure class="${f.hit ? 'hit' : ''}">
      <div class="shot" style="width:${Math.round(f.view.width * 3)}px;height:${Math.round(f.view.height * 3)}px">
        <img src="${f.src}" alt="">
        <svg viewBox="${f.view.x} ${f.view.y} ${f.view.width} ${f.view.height}">
          <line x1="${f.ghost.x}" y1="${f.ghost.y}" x2="${f.cat.x}" y2="${f.cat.y}" class="gap"/>
          <circle cx="${f.ghost.x}" cy="${f.ghost.y}" r="11" class="mark ghostmark"/>
          <circle cx="${f.cat.x}" cy="${f.cat.y}" r="11" class="mark catmark"/>
        </svg>
      </div>
      <figcaption>${f.at >= 0 ? '+' : ''}${f.at}ms${f.hit ? ' · shoved' : ''}</figcaption>
    </figure>`;

    return `<section>
  <h2>${d.id}<small>${d.turned === null ? 'no heading to measure' : `turned ${d.turned.toFixed(1)}°`}
    · peak ${d.peak.toFixed(1)}px off its own course (nominal ${IMPULSE_TRAVEL_PX.toFixed(1)})
    · ${(d.stalkShare * 100).toFixed(0)}% stalking · ${d.hits} swat frame${d.hits === 1 ? '' : 's'}</small></h2>
  <div class="strip">${d.frames.filter((_, i) => i % STRIP_EVERY === 0).map(shot).join('')}</div>
  <div class="pathwrap">
    <svg viewBox="${vx} ${vy} ${vw} ${vh}" width="${Math.round(vw * zoom)}" height="${Math.round(vh * zoom)}">
      <rect x="0" y="0" width="${d.board.w}" height="${d.board.h}" class="bg"/>
      <polyline points="${path(ghost)}" class="ghost"/>
      <polyline points="${path(pre)}" class="pre"/>
      <polyline points="${path(post)}" class="post"/>
      <polyline points="${path(rest)}" class="rest"/>
      <line x1="${d.from.x}" y1="${d.from.y}" x2="${d.to.x}" y2="${d.to.y}" class="swipe"/>
      <circle cx="${d.before.x}" cy="${d.before.y}" r="${SWIPE_RADIUS}" class="radius"/>
      <circle cx="${d.before.x}" cy="${d.before.y}" r="${2.5 / zoom * 2}" class="cat"/>
    </svg>
    <ul class="key">
      <li><i class="k-pre"></i>where it walked before the flick</li>
      <li><i class="k-post"></i>during the ${IMPULSE_MS}ms impulse</li>
      <li><i class="k-rest"></i>after it is spent — it recovers its own line</li>
      <li><i class="k-ghost"></i>where it was going: the undisturbed walk</li>
      <li><i class="k-swipe"></i>the flick, ${d.axis} the heading</li>
      <li><i class="k-radius"></i>${SWIPE_RADIUS}px hit radius</li>
    </ul>
  </div>
</section>`;
  };
  return `<!doctype html><meta charset="utf-8"><title>§16 — the invisible hand, looked at</title>
<style>
  :root { color-scheme: light; --ink:#1a1614; --paper:#f6f2ec; --accent:#8c2f39; --dim:#8a7f76; }
  body { margin:0; padding:2rem 2.2rem 3rem; background:var(--paper); color:var(--ink);
         font:15px/1.5 ui-sans-serif, system-ui, sans-serif; }
  h1 { font-size:1.35rem; margin:0 0 .2rem; letter-spacing:-.01em; }
  p.lede { margin:0 0 1.8rem; color:var(--dim); max-width:62ch; }
  section { margin-bottom:2.4rem; }
  h2 { font-size:1rem; text-transform:uppercase; letter-spacing:.08em; margin:0 0 .7rem;
       border-bottom:1px solid #ddd4c8; padding-bottom:.35rem; display:flex; justify-content:space-between; align-items:baseline; }
  h2 small { font-weight:400; text-transform:none; letter-spacing:0; color:var(--dim); }
  /* Wrap rather than scroll: a fullPage screenshot of an overflow-x container silently clips the
     frames past the fold, which cost this report its last two frames the first time round. */
  .strip { display:flex; flex-wrap:wrap; gap:8px; }
  figure { margin:0; flex:0 0 auto; }
  .shot { position:relative; }
  .shot img { display:block; width:100%; height:100%; border:1px solid #ddd4c8; background:#fff; }
  .shot svg { position:absolute; inset:0; border:0; }
  figure.hit .shot img { border-color:var(--accent); border-width:2px; }
  .mark { fill:none; stroke-width:1.4; vector-effect:non-scaling-stroke; }
  .catmark { stroke:var(--accent); stroke-width:2.4; }
  .ghostmark { stroke:#1a1614; opacity:.45; stroke-dasharray:3 2.5; }
  .gap { stroke:var(--accent); stroke-width:1.2; opacity:.6; vector-effect:non-scaling-stroke; }
  figcaption { font:11px/1.4 ui-monospace, monospace; color:var(--dim); text-align:center; padding-top:2px; }
  .pathwrap { display:flex; gap:1.4rem; align-items:flex-start; margin-top:1.1rem; }
  .pathwrap svg { border:1px solid #ddd4c8; }
  .bg { fill:#fffdf9; }
  .pre { fill:none; stroke:#b9ada2; stroke-width:1.6; vector-effect:non-scaling-stroke; }
  .post { fill:none; stroke:var(--accent); stroke-width:3.4; vector-effect:non-scaling-stroke; }
  .rest { fill:none; stroke:#6d8f7a; stroke-width:1.8; stroke-dasharray:4 3; vector-effect:non-scaling-stroke; }
  .ghost { fill:none; stroke:#1a1614; opacity:.32; stroke-width:1.4; stroke-dasharray:2 3; vector-effect:non-scaling-stroke; }
  .swipe { stroke:#1a1614; stroke-width:1.4; stroke-dasharray:5 3; vector-effect:non-scaling-stroke; }
  .radius { fill:none; stroke:#1a1614; stroke-width:1; opacity:.35; vector-effect:non-scaling-stroke; }
  .cat { fill:#1a1614; }
  .key { list-style:none; margin:0; padding:0; font-size:13px; color:var(--dim); }
  .key li { display:flex; align-items:center; gap:.5rem; margin-bottom:.4rem; }
  .key i { width:24px; flex:0 0 24px; height:0; border-top-width:3px; border-top-style:solid; }
  .k-pre{border-color:#b9ada2} .k-post{border-color:var(--accent)} .k-rest{border-color:#6d8f7a;border-top-style:dashed}
  .k-ghost{border-color:#1a1614;opacity:.32;border-top-style:dotted}
  .k-swipe{border-color:#1a1614;border-top-style:dashed} .k-radius{border-color:#1a1614;opacity:.35}
  .miss { color:var(--accent); }
</style>
<h1>§16 — the invisible hand, looked at</h1>
<p class="lede">The same flick, at the same length, in the same mode — <b>across</b> the cat's measured
heading and then <b>along</b> it. Across is the gesture; along is the control, and the only thing
that differs between the two panels is the angle. One shove is ${IMPULSE_TRAVEL_PX.toFixed(1)}px of travel on a
${runs[0]?.board ? Math.round(runs[0].board.w) + '×' + Math.round(runs[0].board.h) : '318×225'}px board,
decaying over ${IMPULSE_MS}ms. Frames come from a CDP screencast rather than from screenshots — a
screenshot costs ~330ms here, which is most of the shove. The solid ring is the cat; the hollow one is
where an undisturbed walk would have put it at the same instant, so the growing gap between them
<i>is</i> the mechanic.</p>
${runs.map(panel).join('\n')}`;
}

const browser = await launch();
const r = report();
const runs = [];
for (const kase of CASES) {
  try {
    const out = await run(browser, kase, r);
    if (out && out.trail) runs.push(out);
  } catch (e) {
    r.ok(`${kase.id}: the run completed`, false, String(e).slice(0, 160));
  }
}
await browser.close();

if (runs.length) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/hand-look.html`, html(runs));
  const shot = await launch();
  // Wide enough that three 3×-scaled frames sit on a row without the fourth being clipped: a
  // `fullPage` screenshot grows downwards only, so anything past the right edge is simply lost.
  const p = await (await shot.newContext({ viewport: { width: 1760, height: 1200 }, deviceScaleFactor: 2 })).newPage();
  await p.goto(`file://${process.cwd()}/${OUT}/hand-look.html`, { waitUntil: 'load' });
  await p.screenshot({ path: `${OUT}/hand-look.png`, fullPage: true });
  await shot.close();
  console.log(`\nwrote ${OUT}/hand-look.html and ${OUT}/hand-look.png`);
}
process.exit(r.done('hand-look') ? 0 : 1);
