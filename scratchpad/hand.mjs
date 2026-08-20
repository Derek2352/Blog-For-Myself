/**
 * §16's invisible hand, asserted rather than looked at.
 *
 * `hand-look.mjs` answers "does it read", which is a question about pictures. This answers the
 * questions that have right answers: does a flick across the cat's path move it, does a flick *along*
 * its path not, does the cooldown bound how often, does the impulse ever put the sprite off the board,
 * does §3's manual mode keep its own verb, and does a kitten that cannot finish actually leave.
 *
 * ## What it deliberately does *not* re-measure
 *
 * How far a shove displaces the cat. That figure fought the homing walk and every in-situ attempt to
 * pin it down at ~20fps against a moving kitten produced a different answer — the spread was wide
 * enough that one reading of it concluded the mechanic did nothing, and was wrong.
 * `tests/hand.test.ts` integrates `stepBoss`'s stalk branch deterministically instead, which is where
 * a question about arithmetic belongs. **The line between the two files is the point:** in the browser
 * this asserts only what is robust to a frame or two of jitter — did it register, did it not, did it
 * stay on the board — and every quantity that needs three significant figures lives in a unit test.
 *
 * ## The one thing the shared flick cannot prove
 *
 * `swipeCat` dispatches synthetic `PointerEvent`s, because that is the only way to control a
 * gesture's *timing* through CDP (see `fixture.mjs`). Synthetic events skip the browser's input
 * pipeline, so §5 below drives the real mouse instead: it cannot control the cadence, so it cannot
 * assert a speed, but it can establish that a physical pointer reaches the same handler at all. Both
 * halves are needed and neither substitutes for the other.
 */
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
  HEADING_MIN_SPEED,
  HEADING_TAU_MS,
  SHOVE_MIN,
  SWIPE_COOLDOWN_MS,
  SWIPE_MIN_SPEED,
  SWIPE_RADIUS,
  CARD_SAFE_FLEE_PX,
  swipeCat,
} from './lib/fixture.mjs';

/** Sample the boss every frame, so a shove's effect is not read off two lucky positions. */
const RECORD = () => {
  const board = document.querySelector('[data-board]');
  const boss = document.querySelector('[data-boss]');
  if (!board || !boss) return;
  window.__trail = [];
  window.__swats = 0;
  window.__grazes = 0;
  let was = false;
  let wasG = false;
  const tick = () => {
    if (!boss.isConnected) return;
    const b = board.getBoundingClientRect();
    const r = boss.getBoundingClientRect();
    const now = boss.classList.contains('boss-swatted');
    if (now && !was) window.__swats += 1; // *edges*, not frames: one shove is one swat however long
    was = now;
    // §16's dead-zone tell, counted the same way. A flick that crossed the cat but ran along its line
    // gets this instead of a shove; before 2.5.1 it got nothing at all, and nothing at all is also what
    // a flick that missed entirely gets — which is the ambiguity this counter exists to prove is gone.
    const g = boss.classList.contains('boss-grazed');
    if (g && !wasG) window.__grazes += 1;
    wasG = g;
    window.__trail.push({
      t: performance.now(),
      x: r.left - b.left + r.width / 2,
      y: r.top - b.top + r.height / 2,
      w: r.width,
      h: r.height,
      phase: boss.dataset.phase ?? '',
    });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

/**
 * The fixture: **a stalking cat with something to stalk.** That is all `swipeCat` needs.
 *
 * The first version also demanded the cat be walking faster than 17px/s — copied from
 * `hand-look.mjs`, where it is load-bearing because that script measures a *deflection off a line* and
 * a crawling cat has no line. Here it was cargo, and it cost four of six fights: the cat's stance is
 * rolled and `sleepy`/`ambush` walk it at 8–19px/s, so a floor at 17 turns a fixture into a coin toss.
 *
 * `swipeCat` aims from the cat's *measured velocity* and needs no kitten at all, so the requirement is
 * only that the cat be in the phase where the shove is applied. A kitten is still asked for where the
 * check wants a normal hand-mode fight rather than a degenerate one — but it is no longer what the aim
 * depends on. **A fixture should ask for what the check needs and not what a neighbouring check
 * needed** — the cost of getting that wrong is not a red, it is a suite that measures the roll.
 */
const STALKING = (needKitten) => {
  const el = document.querySelector('[data-boss]');
  if (!el || el.dataset.phase !== 'stalk') return false;
  // Manual mode never spawns a squad — its quarry is the pointer — so a kitten is only required where
  // the aim depends on one. Asking for it everywhere reported §3's whole mode as a missing fixture.
  return !needKitten || document.querySelectorAll('.cat-card-kit').length > 0;
};

/**
 * Open a fight, arm the recorder, and wait for a walking cat.
 *
 * Returns `null` and reports a `FIXTURE` when the roll never offers one, because the stance is rolled
 * and the route is the cat's own choice — neither is something the build got wrong.
 */
async function fightWith(browser, mode, r, label, { needKitten = true } = {}) {
  const ctx = await fresh(browser, { mode });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await press(page);
  await waitOpen(page);

  const declared = await page.evaluate(() => document.querySelector('#cat-card-panel')?.dataset.mode ?? '');
  if (declared !== mode) {
    r.ok(`${label}: the card is in ${mode} mode`, false, `data-mode=${declared || '(unset)'}`);
    await ctx.close();
    return null;
  }
  await page.evaluate(RECORD);
  const stalking = await bounded(page, STALKING, 14_000, needKitten);
  if (!stalking) {
    r.fixture(`${label}: a stalking cat${needKitten ? ' with a kitten to chase' : ''}`, null, 1);
    await ctx.close();
    return null;
  }
  return { ctx, page };
}

/** Straight-line distance covered between two moments — direction-free, so no aim to get wrong. */
const travelled = (trail, from, to) => {
  const seg = trail.filter((p) => p.t >= from && p.t <= to);
  let d = 0;
  for (let i = 1; i < seg.length; i++) d += Math.hypot(seg[i].x - seg[i - 1].x, seg[i].y - seg[i - 1].y);
  return d;
};

const browser = await launch();
const r = report();

/* ------------------------------------------------------------------ *
 * §1 — across the path shoves; along it does not
 * ------------------------------------------------------------------ */

/*
 * **Sweep the angle, measure what you got, and check the card agrees with it.**
 *
 * Four versions, and the first three were all trying to hit a target the harness cannot hit.
 *
 * v1 flicked once along the heading and asserted zero shoves. v2 made it comparative — across should
 * shove nearly always, along rarely — which is the right *shape* of claim but compared two separate
 * fights, so the two rates never measured the same geometry: it scored along 2/6, then 3/6, then 6/6
 * from unchanged code. v3 put both axes in one fight and added a distance floor, on the theory that the
 * aim rotates as `quarry movement / distance to quarry`. It still failed at 5/6.
 *
 * **So the aim was probed instead of theorised about**, recording the angle the card actually saw at
 * each contact against the distance to the quarry:
 *
 * | quarry | angle | | quarry | angle |
 * |---|---|---|---|---|
 * | 11px | 36° | | 108px | 11° |
 * | 43px | 14° | | 143px | 10° |
 * | 76px | 11° | | 174px | 6° |
 *
 * The distance effect is real — but underneath it sat a **~6–11° residual that never went away**, from
 * reconstructing the cat's heading out of `.cat-card-kit` rects one frame late, against a dead zone
 * then 8.6° wide.
 *
 * **2.5.2 removed the axis those numbers were about.** The heading is the cat's own velocity now, which
 * this harness can *observe* rather than infer — the table above is kept because it is the evidence
 * that moved it. The sweep and the measure-what-you-got design survive unchanged, because they were
 * never really about the kitten line: they are about not asking an instrument to hit a target.
 *
 * The fix is to stop needing the aim to be right. This sweeps a range of offsets, and at each contact
 * records **the angle the card itself saw** — the crossing segment against `quarry − boss`, captured in
 * the capture phase so it is the triggering segment and not a later one. Then it asserts the only thing
 * that matters: **the card's classification agrees with the geometry it was given.** Contacts whose
 * measured `IMPULSE_SPEED · |sin θ|` falls below `SHOVE_MIN` must be grazes; the rest must be shoves.
 * Wherever the aim lands is fine, because the check reads where it landed.
 */
/**
 * A half-circle of offsets at 12°, which **guarantees** a near-parallel flick without needing the aim
 * to be accurate.
 *
 * The earlier sweeps hand-picked offsets near 0° and 180° and then failed to land inside the 8.6° dead
 * zone, because the reconstructed heading is only good to ~10° — so "aim along the heading" is a target
 * this instrument cannot hit, and no list of offsets fixes that.
 *
 * Sweeping the whole half-circle removes the dependency instead of fighting it. `|sin θ|` is symmetric
 * about 90°, so 0–180° covers every distinguishable angle; at 12° spacing, whatever the true heading
 * turns out to be, some flick in the sweep lands within **6°** of parallel — inside the dead zone by
 * construction rather than by luck. The offsets are still measured on arrival, so an inaccurate estimate
 * costs nothing: it shifts which flick is the parallel one, not whether there is one.
 */
const SWEEP = Array.from({ length: 15 }, (_, i) => i * 12);
/**
 * Contacts whose measured impulse sits this close to `SHOVE_MIN` are recorded but not judged.
 *
 * Even with the snapshot taken in the same event as the card's own read (below), one difference
 * remains and cannot be closed from outside: the card's `quarry` is assigned once per animation frame
 * in `tick()`, so it can be up to a frame staler than the DOM this reads. A kitten at
 * `CARD_KITTEN_SPEED` covers ~2.5px in 50ms, which at 100px of separation is ~1.4° — sin 0.025. 0.08
 * covers that with room, and excluding a band around the threshold is honest in a way that widening
 * the threshold would not be: these contacts are still counted and reported, just not used to judge a
 * boundary this instrument cannot resolve.
 *
 * **0.08 was still too tight**, and the arithmetic says so once done properly rather than sketched. At
 * 48px of separation a kitten covers 2.5px in one 50ms frame, swinging the heading ~3°; near the
 * threshold `d(sin)/dθ ≈ cos 20° = 0.94 per radian`, so 3° is Δsin 0.049 — **4.4px/s from the stale
 * frame alone**, before this recorder's own rect-versus-logical error. A contact measured at 38.4px/s
 * against a 30.8px/s threshold was classified a graze and flagged: 7.6px/s out, which is inside the
 * error budget and outside the old band. 0.12 covers it.
 *
 * What survives at this resolution is worth having anyway: the check exists to catch a *gross* wiring
 * fault — an inverted comparison, the wrong constant, `veer` bypassed — which would misclassify most
 * contacts rather than one at the edge. The exact boundary is `tests/hand.test.ts`'s job, where it can
 * be examined at machine precision instead of through a 20fps window.
 */
const BOUNDARY_SLACK = IMPULSE_SPEED * 0.12;

/**
 * Contacts made while the cat was travelling slower than this are recorded but not judged — **the
 * angle is not measurable there**, whatever the aim was.
 *
 * The floor used to be a *distance to the quarry* (40px), because the old kitten-line axis went wild
 * when the cat was on top of what it was chasing; it discarded 9 of 14 contacts in one run, since a cat
 * spends most of its time near its kitten. With the axis now being velocity, the equivalent condition is
 * a *speed*: a direction derived from a barely-moving sprite is noise, and it is the same condition the
 * card itself applies via `HEADING_MIN_SPEED` before it will use a heading at all. Same arithmetic,
 * pointed at the quantity that actually governs it, and it discards far less.
 */
const MEASURE_MIN_SPEED = HEADING_MIN_SPEED * 1.5;

/**
 * Record, at each contact, the geometry the card must have used to classify it.
 *
 * **`tau` is a parameter and not a closure**, which cost a run to learn. The smoothing constant was
 * written as the imported `HEADING_TAU_MS` — a *Node* binding — inside a function that runs in the
 * *page*, so it threw `ReferenceError` on the first frame, the observer was never installed, and the
 * sweep reported `0 contacts from 15 flicks`. The failure looked exactly like the game refusing to
 * register a swipe, and the give-away was that `window.__grazes` (set by a different page function,
 * one that closes over nothing) kept counting perfectly well throughout.
 */
const WATCH_CONTACTS = ({ tau }) => {
  window.__contacts = [];
  const board = document.querySelector('[data-board]');
  const boss = document.querySelector('[data-boss]');
  let last = null;
  let snap = null;
  /*
   * A rolling estimate of the cat's **velocity**, which is the axis `trySwipe` now measures against.
   *
   * This recorder used to reconstruct `quarry − boss` from `.cat-card-kit` rects, and inherited every
   * problem that axis had: unmeasurable when the kitten was close (a 40px floor had to discard 9 of 14
   * contacts), and 6–11° off even when it was far. Velocity is directly observable — successive
   * positions of the sprite — so the instrument gets simpler at the same time as the thing it measures.
   */
  let prev = null;
  let vel = { x: 0, y: 0 };
  const track = () => {
    if (!boss.isConnected) return;
    const r = board.getBoundingClientRect();
    const br = boss.getBoundingClientRect();
    const p = { x: br.left - r.left + br.width / 2, y: br.top - r.top + br.height / 2, t: performance.now() };
    if (prev) {
      const ms = p.t - prev.t;
      if (ms > 0) {
        // The card smooths over `HEADING_TAU_MS`; matching that here keeps the estimate comparable to
        // the value the card is actually using rather than to a jumpier one.
        const k = 1 - Math.exp(-ms / tau);
        vel = { x: vel.x + (((p.x - prev.x) / ms) * 1000 - vel.x) * k, y: vel.y + (((p.y - prev.y) / ms) * 1000 - vel.y) * k };
      }
    }
    prev = p;
    requestAnimationFrame(track);
  };
  requestAnimationFrame(track);
  /*
   * **The whole snapshot is taken in the capture phase**, not just the segment.
   *
   * Capture runs before the card's own `pointermove` listener, so this sees exactly the board the card
   * is about to judge. The first version recorded only the segment here and read the boss and kitten
   * positions later, inside the MutationObserver — a different instant, by however long the card's
   * handler and the microtask queue took. That is invisible in the middle of the range and decisive at
   * the boundary, where it produced one misclassification per run or so: the check was comparing the
   * card's answer against a geometry the card never saw.
   */
  board.addEventListener(
    'pointermove',
    (e) => {
      const r = board.getBoundingClientRect();
      const p = { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
      if (last) {
        const sx = p.x - last.x;
        const sy = p.y - last.y;
        const sl = Math.hypot(sx, sy);
        const hl = Math.hypot(vel.x, vel.y);
        // |sin θ| straight from the 2-D cross product — the same quantity `veer`'s magnitude is.
        const ms = p.t - last.t;
        if (sl && hl && ms > 0) {
          snap = {
            sin: Math.abs((sx * vel.y - sy * vel.x) / (sl * hl)),
            headingPxS: hl,
            // The segment's own speed. Needed because 2.5.2 gave the *speed* floor the same graze tell
            // as the angle dead zone — deliberately, since both mean "you touched me and got no
            // purchase" to a player. For this check they are different causes, and a graze earned by
            // being slow says nothing about whether the angle was classified correctly.
            speed: (sl / ms) * 1000,
          };
        }
      }
      last = p;
    },
    true,
  );
  new MutationObserver(() => {
    const shove = boss.classList.contains('boss-swatted');
    const graze = boss.classList.contains('boss-grazed');
    if ((!shove && !graze) || !snap) return;
    window.__contacts.push({ kind: shove ? 'shove' : 'graze', ...snap });
  }).observe(boss, { attributes: true, attributeFilter: ['class'] });
};

{
  const f = await fightWith(browser, 'hand', r, '§1');
  if (!f) {
    r.fixture('§1: a stalking fight', null, 1);
  } else {
    await f.page.evaluate(WATCH_CONTACTS, { tau: HEADING_TAU_MS });
    // Which flick first produced a graze, counted properly. It used to report `SWEEP.length` for
    // "somewhere in the sweep", which cannot show an improvement inside the sweep — and the whole point
    // of 2.5.2's axis change was to move exactly that number.
    let grazeAt = 0;
    for (let i = 0; i < SWEEP.length; i++) {
      const before = await f.page.evaluate(() => window.__grazes);
      await swipeCat(f.page, { angleDeg: SWEEP[i] });
      await f.page.waitForTimeout(SWIPE_COOLDOWN_MS + 80); // never let the cooldown be the reason
      if (!grazeAt && (await f.page.evaluate(() => window.__grazes)) > before) grazeAt = i + 1;
    }
    const contacts = await f.page.evaluate(() => window.__contacts);
    /*
     * Only contacts where the **angle** was the deciding factor can test the angle's classification.
     * A segment slower than `SWIPE_MIN_SPEED` earns the graze tell whatever its angle, so including
     * those was comparing the card's answer to a question it was not asked — it produced six
     * "misclassified" grazes at sin 0.5–1.0 in one run, every one of them correct.
     */
    const measurable = contacts.filter((c) => c.headingPxS >= MEASURE_MIN_SPEED && c.speed >= SWIPE_MIN_SPEED);
    const judged = measurable.filter((c) => Math.abs(c.sin * IMPULSE_SPEED - SHOVE_MIN) > BOUNDARY_SLACK);
    const shoves = judged.filter((c) => c.sin * IMPULSE_SPEED >= SHOVE_MIN);
    const grazes = judged.filter((c) => c.sin * IMPULSE_SPEED < SHOVE_MIN);
    r.note(
      `§1: ${contacts.length} contacts from ${SWEEP.length} flicks — ` +
        `${contacts.length - measurable.length} taken below ${MEASURE_MIN_SPEED.toFixed(1)}px/s (angle not measurable), ` +
        `${measurable.length - judged.length} within ${BOUNDARY_SLACK.toFixed(1)}px/s of the threshold, ${judged.length} judged`,
    );

    /*
     * **Two claims, and they need different evidence — which took four attempts to see.**
     *
     * The versions before this tried to make one check carry both, and kept failing on the fixture
     * rather than on the build: it wanted a contact that was simultaneously *near-parallel* (to exercise
     * the dead zone) and *far from the quarry* (so the angle is measurable), and the cat spends most of
     * its time close to its kitten — 9 of 14 contacts in one run. Those two conditions are close to
     * mutually exclusive in a live fight, so the suite was reporting the difficulty of staging a
     * coincidence as though it were a finding about the game.
     *
     * They are separate claims and only one of them needs the angle at all.
     */

    /*
     * (A) **Both outcomes are reachable — and the rate is the finding.**
     *
     * This was written as a flat assertion ("a swept half-circle produces both") and it failed two runs
     * in three, at 8.6° and again at 20°. That is not the check being fragile. Sweeping a half-circle at
     * 12° spacing guarantees a flick within 6° of the heading *this recorder estimates*, and the graze
     * still almost never happens, because two errors stack on top of that 6°: the estimate is ±10° off,
     * and the heading itself rotates 6–11° during the ~104ms the flick takes (36° when the cat is on
     * top of its kitten). **The axis the player is asked to aim along is invisible and moving** — it is
     * the line from the cat to a walking kitten, which is drawn nowhere.
     *
     * So the shove is the assertion and the graze is a **roll**: re-flicked until it lands, reporting
     * which attempt it took, exactly as §12.1 prescribes for anything that comes from a roll. The
     * attempt count is not bookkeeping here, it *is* the measurement — it says how often a player
     * genuinely trying to swipe along the cat's back would succeed, which is the number §16.7 needs and
     * no flat pass/fail could ever have reported.
     */
    r.ok(
      '§1: the sweep shoves the cat',
      contacts.some((c) => c.kind === 'shove'),
      `${contacts.filter((c) => c.kind === 'shove').length} shoves, ${contacts.filter((c) => c.kind === 'graze').length} grazes from ${SWEEP.length} swept flicks`,
    );

    if (!grazeAt) {
      // Aim as parallel as this instrument can, and keep trying. Small alternating offsets rather than a
      // fixed 0°, so a systematic bias in the estimate cannot make every attempt fail the same way.
      const NUDGE = [0, 4, -4, 8, -8, 2, -2, 6, -6, 10, -10, 0, 4, -4, 0];
      for (let i = 0; i < NUDGE.length; i++) {
        const before = await f.page.evaluate(() => window.__grazes);
        await swipeCat(f.page, { angleDeg: NUDGE[i] });
        await f.page.waitForTimeout(SWIPE_COOLDOWN_MS + 80);
        if ((await f.page.evaluate(() => window.__grazes)) > before) {
          grazeAt = SWEEP.length + i + 1;
          break;
        }
      }
    }
    r.fixture(
      '§1: a flick that grazes rather than shoves',
      { value: grazeAt || null, deal: grazeAt, deals: SWEEP.length + 15 },
    );
    r.note(
      `§1: a deliberate graze took ${grazeAt || '>' + (SWEEP.length + 15)} flicks. ` +
        `Before 2.5.2 aimed at the cat's own velocity instead of the invisible line to its kitten, a swept ` +
        `half-circle produced 14–15 shoves and 0 grazes — this number is how that change is judged.`,
    );

    // (B) The card's classification agrees with the geometry it was handed — on the contacts where that
    // geometry can actually be measured. This is the wiring check: a `trySwipe` that ignored `veer` and
    // shoved on everything would pass (A) never and this always, so both are needed.
    if (judged.length < 2) {
      r.fixture(`§1: two contacts with the cat travelling faster than ${MEASURE_MIN_SPEED.toFixed(1)}px/s`, null, 1);
    } else {
      const show = (c) => `sin ${c.sin.toFixed(3)} (${(c.sin * IMPULSE_SPEED).toFixed(1)}px/s) while walking ${Math.round(c.headingPxS)}px/s → ${c.kind}`;
      const wrong = judged.filter((c) => (c.sin * IMPULSE_SPEED >= SHOVE_MIN ? 'shove' : 'graze') !== c.kind);
      /*
       * **A rate, not zero**, and the bound is set by this instrument rather than by taste.
       *
       * The axis is reconstructed here from the sprite's painted position, one frame behind the card's
       * own `boss.vx/vy`; when the cat is turning, a frame is worth a real angle. Demanding perfect
       * agreement makes this a test of the reconstruction. What it is *for* is catching a gross wiring
       * fault — an inverted comparison, the wrong constant, `veer` bypassed — and those misclassify
       * most contacts, not one in ten. The exact boundary belongs to `tests/hand.test.ts`, where it can
       * be examined at machine precision instead of through a 20fps window.
       */
      const rate = wrong.length / judged.length;
      r.ok(
        '§1: contacts are classified as their own geometry demands',
        rate <= 0.25,
        `${judged.length} judged (${shoves.length} above SHOVE_MIN, ${grazes.length} below), ${wrong.length} disagreeing with this rig's reconstruction (${Math.round(rate * 100)}%)${wrong.length ? ': ' + wrong.map(show).join(', ') : ''}`,
      );
    }

    await f.ctx.close();
  }
}

/* ------------------------------------------------------------------ *
 * §2 — the cooldown bounds how often
 * ------------------------------------------------------------------ */

{
  const f = await fightWith(browser, 'hand', r, '§2');
  if (f) {
    // Four flicks as fast as the harness can issue them. Without a cooldown every one of them shoves,
    // and scrubbing the pointer over the cat pins it in place — a fidget with no failure state.
    let aimed = 0;
    const t0 = await f.page.evaluate(() => performance.now());
    for (let i = 0; i < 4; i++) {
      const out = await swipeCat(f.page);
      if (out.aimed) aimed += 1;
    }
    const spanMs = (await f.page.evaluate(() => performance.now())) - t0;
    await f.page.waitForTimeout(IMPULSE_MS + 160);
    const swats = await f.page.evaluate(() => window.__swats);
    const ceiling = Math.ceil(spanMs / SWIPE_COOLDOWN_MS) + 1; // +1 for the one that starts the window
    if (aimed < 4) r.fixture('§2: four aimable flicks', null, 1);
    else
      r.ok(
        '§2: the cooldown bounds how often a shove can land',
        swats <= ceiling,
        `${swats} shoves from 4 flicks over ${Math.round(spanMs)}ms — ceiling ${ceiling} at ${SWIPE_COOLDOWN_MS}ms apart`,
      );
    await f.ctx.close();
  }
}

/* ------------------------------------------------------------------ *
 * §3 — the impulse never puts the sprite off the board
 * ------------------------------------------------------------------ */

{
  const f = await fightWith(browser, 'hand', r, '§3');
  if (f) {
    // Shove repeatedly and check the *sprite*, not its centre: `onBoard` clamps by half the sprite's
    // real size, and the literals it used to clamp by were the previous sprite's, which is how a cat
    // ends up half off the board while every centre-based check stays green.
    for (let i = 0; i < 5; i++) {
      await swipeCat(f.page);
      await f.page.waitForTimeout(140);
    }
    await f.page.waitForTimeout(IMPULSE_MS);
    const board = await f.page.locator('[data-board]').boundingBox();
    const trail = await f.page.evaluate(() => window.__trail);
    const off = trail.filter(
      (p) => p.x - p.w / 2 < -0.5 || p.y - p.h / 2 < -0.5 || p.x + p.w / 2 > board.width + 0.5 || p.y + p.h / 2 > board.height + 0.5,
    );
    r.ok(
      '§3: no shove takes the sprite off the board',
      off.length === 0,
      `${off.length} of ${trail.length} samples outside 0..${Math.round(board.width)}×${Math.round(board.height)}`,
    );
    await f.ctx.close();
  }
}

/* ------------------------------------------------------------------ *
 * §4 — manual mode has its own verb and does not answer this one
 * ------------------------------------------------------------------ */

/*
 * **This was two modes and is now one, because the hand stopped being an outsider.**
 *
 * Until 2.6 §16 was a prototype behind a flag, and the claim worth checking was that neither shipped
 * mode noticed it existed. The hand is the default game now, so "commander ignores a flick" is not a
 * property to protect — it is the opposite of the product.
 *
 * What survives is the half that is still true and still load-bearing: **§3's manual mode has its own
 * verb.** There the visitor holds a claim with the pointer and the cat hunts the cursor, so a fast
 * drag across the board is something a player does *while playing*, and answering it with a shove
 * would fight the mode's core mechanic. `swats === 0 && grazes === 0` is the strong form — neither
 * tell fires — and it covers the treat swat too, since no treat is thrown here.
 */
{
  const f = await fightWith(browser, 'manual', r, '§4 manual', { needKitten: false });
  if (f) {
    const before = await f.page.evaluate(() => window.__trail.length);
    const out = await swipeCat(f.page);
    await f.page.waitForTimeout(IMPULSE_MS + 160);
    const swats = await f.page.evaluate(() => window.__swats);
    const grazes = await f.page.evaluate(() => window.__grazes);
    const trail = await f.page.evaluate(() => window.__trail);
    r.ok(
      '§4 manual: a flick at the cat does nothing — the pointer is already the verb',
      swats === 0 && grazes === 0,
      `${swats} shoves, ${grazes} grazes after a ${Math.round(out.len ?? 0)}px flick`,
    );
    r.note(`§4 manual: travelled ${travelled(trail, out.perf, out.perf + IMPULSE_MS).toFixed(1)}px in the ${IMPULSE_MS}ms after (${trail.length - before} new samples)`);
    await f.ctx.close();
  }
}

/* ------------------------------------------------------------------ *
 * §5 — a real pointer reaches the same handler
 * ------------------------------------------------------------------ */

{
  const f = await fightWith(browser, 'hand', r, '§5');
  if (f) {
    /*
     * The half `swipeCat` cannot cover. Real `mouse.move` calls cost ~100ms of round trip each, so the
     * cadence — and therefore the measured px/s — is not the harness's to choose; `{ steps }` makes it
     * ~1ms instead, which is a flick by any measure but proves nothing about a *slow* one. So this
     * asserts only the part that does not depend on timing: **a trusted pointer event, crossing the
     * cat fast, is a shove.** If synthetic events ever diverged from real ones — `isTrusted` checks,
     * a coalescing change, `pointerrawupdate` — this is the check that would notice.
     */
    const board = await f.page.locator('[data-board]').boundingBox();
    const seen = await f.page.evaluate(() => {
      const b = document.querySelector('[data-board]').getBoundingClientRect();
      const r2 = document.querySelector('[data-boss]').getBoundingClientRect();
      return { x: r2.left - b.left + r2.width / 2, y: r2.top - b.top + r2.height / 2 };
    });
    const reach = SWIPE_RADIUS + 24;
    const y0 = Math.max(2, Math.min(board.height - 2, seen.y - reach));
    const y1 = Math.max(2, Math.min(board.height - 2, seen.y + reach));
    await f.page.mouse.move(board.x + seen.x, board.y + y0);
    await f.page.waitForTimeout(30);
    await f.page.mouse.move(board.x + seen.x, board.y + y1, { steps: 3 });
    await f.page.waitForTimeout(IMPULSE_MS + 160);
    const swats = await f.page.evaluate(() => window.__swats);
    r.ok('§5: a real pointer flick reaches the same handler', swats > 0, `${swats} shoves from a trusted ${Math.round(y1 - y0)}px flick`);
    await f.ctx.close();
  }
}

/* ------------------------------------------------------------------ *
 * §6 — a kitten that cannot finish leaves
 * ------------------------------------------------------------------ */

{
  const f = await fightWith(browser, 'hand', r, '§6');
  if (f) {
    /*
     * `shouldFlee` is `near && !canFinish(...)` and its arithmetic is unit-tested in
     * `tests/squad.test.ts`. What cannot be unit-tested is that `stepSquad` consults it, so this asks
     * the weaker but un-fakeable question: **over a stretch of fight, does a kitten inside the cat's
     * safe radius ever stop working and move away?** A kitten that only ever re-picks a target when it
     * arrives — which is what 2.4 did — never produces that sample.
     *
     * Sampled rather than staged, because staging it means putting the cat somewhere, and the levers
     * for that (a treat's lure, a hold) are the very things whose absence this mode is about.
     */
    /*
     * Sampled on a **stride's** timescale, not a frame's.
     *
     * The first version compared each look against the previous one inside a `waitForFunction`, which
     * polls every animation frame — so it was asking whether a kitten gained 6px of separation in
     * ~16ms, i.e. moved at 375px/s. `CARD_KITTEN_SPEED` is 50. The check could not have passed however
     * well the game behaved, and reported "no retreat seen in 20s" as though that were a finding.
     *
     * `RETREAT_WINDOW_MS` is the interval over which a fleeing kitten could plausibly gain
     * `RETREAT_PX`: 6px at 50px/s is 120ms of walking, so 400ms leaves room for the flinch and the
     * turn. Recorded in the page and analysed here, so the two looks are a known distance apart.
     */
    const RETREAT_WINDOW_MS = 400;
    const RETREAT_PX = 6;
    await f.page.evaluate(() => {
      window.__gaps = [];
      const board = document.querySelector('[data-board]');
      const boss = document.querySelector('[data-boss]');
      const tick = () => {
        if (!boss.isConnected) return;
        const b = board.getBoundingClientRect();
        const br = boss.getBoundingClientRect();
        const bx = br.left - b.left + br.width / 2;
        const by = br.top - b.top + br.height / 2;
        const row = { t: performance.now(), d: [] };
        for (const k of document.querySelectorAll('.cat-card-kit')) {
          const kr = k.getBoundingClientRect();
          row.d.push(Math.hypot(kr.left - b.left + kr.width / 2 - bx, kr.top - b.top + kr.height / 2 - by));
        }
        window.__gaps.push(row);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await f.page.waitForTimeout(20_000);
    const gaps = await f.page.evaluate(() => window.__gaps);
    let best = 0;
    for (let i = 0; i < gaps.length; i++) {
      const j = gaps.findIndex((g) => g.t >= gaps[i].t + RETREAT_WINDOW_MS);
      if (j < 0) break;
      const n = Math.min(gaps[i].d.length, gaps[j].d.length);
      for (let k = 0; k < n; k++) {
        // Inside the danger radius at both ends, and further away at the second: it did not merely
        // finish and wander off, it backed away while the cat was still on top of it.
        if (gaps[i].d[k] < CARD_SAFE_FLEE_PX && gaps[j].d[k] < CARD_SAFE_FLEE_PX) {
          best = Math.max(best, gaps[j].d[k] - gaps[i].d[k]);
        }
      }
    }
    r.ok(
      '§6: a kitten inside the cat’s safe radius backs off',
      best >= RETREAT_PX,
      `best retreat ${best.toFixed(1)}px in ${RETREAT_WINDOW_MS}ms while within ${Math.round(CARD_SAFE_FLEE_PX)}px (needs ${RETREAT_PX}px), ${gaps.length} samples`,
    );
    await f.ctx.close();
  }
}

await browser.close();
r.note(`one shove is nominally ${IMPULSE_TRAVEL_PX.toFixed(1)}px over ${IMPULSE_MS}ms — how much of that survives the homing walk is measured in tests/hand.test.ts, not here`);
process.exit(r.done('hand') ? 0 : 1);
