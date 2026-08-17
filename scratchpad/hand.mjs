/**
 * §16's invisible hand, asserted rather than looked at.
 *
 * `hand-look.mjs` answers "does it read", which is a question about pictures. This answers the
 * questions that have right answers: does a flick across the cat's path move it, does a flick *along*
 * its path not, does the cooldown bound how often, does the impulse ever put the sprite off the board,
 * do the two shipped modes stay untouched, and does a kitten that cannot finish actually leave.
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
  IMPULSE_TRAVEL_PX,
  SWIPE_COOLDOWN_MS,
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
  let was = false;
  const tick = () => {
    if (!boss.isConnected) return;
    const b = board.getBoundingClientRect();
    const r = boss.getBoundingClientRect();
    const now = boss.classList.contains('boss-swatted');
    if (now && !was) window.__swats += 1; // *edges*, not frames: one shove is one swat however long
    was = now;
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
 * `swipeCat` aims from `quarry − boss`, a *direction*, which exists whether the cat is sprinting or
 * standing still. So the requirement is only that there be a quarry and that the cat be in the phase
 * where the shove is applied. **A fixture should ask for what the check needs and not what a
 * neighbouring check needed** — the cost of getting that wrong is not a red, it is a suite that
 * measures the roll.
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
 * **A rate, not a single verdict**, and the reason is the quarry.
 *
 * The first version flicked once along the heading and asserted zero shoves. It failed, and not
 * because the dead zone is broken: the cat's heading is `quarry − boss` and the quarry is a *walking
 * kitten*, so over the ~120ms a flick takes to dispatch the aim rotates — the more so the closer the
 * cat is, where a small kitten step swings the line a long way. A flick launched exactly along the
 * heading is partly across the heading by the time `trySwipe` reads it. That is the game being alive,
 * not the guard being wrong, and no amount of in-situ care removes it.
 *
 * `tests/hand.test.ts` proves the geometry: rejection zero along, `SHOVE_MIN` dead zone to 8.6°, full
 * `|sin θ|` ramp beyond. What only the browser can show is that **the card is wired to that geometry**,
 * and the honest form of it is comparative: across should shove nearly every time, along should shove
 * rarely. A `trySwipe` that ignored `veer` and shoved on any flick would score the same on both, and
 * that is the failure this catches.
 */
const ATTEMPTS = 6;
{
  const rate = {};
  for (const axis of ['across', 'along']) {
    const f = await fightWith(browser, 'hand', r, `§1 ${axis}`);
    if (!f) continue;
    let aimed = 0;
    for (let i = 0; i < ATTEMPTS; i++) {
      const out = await swipeCat(f.page, { axis });
      if (out.aimed) aimed += 1;
      await f.page.waitForTimeout(SWIPE_COOLDOWN_MS + 80); // never let the cooldown be the reason
    }
    const swats = await f.page.evaluate(() => window.__swats);
    rate[axis] = { swats, aimed };
    await f.ctx.close();
  }
  if (!rate.across || !rate.along) {
    r.fixture('§1: a stalking fight for each axis', null, 1);
  } else {
    r.ok(
      '§1 across: a flick across the cat’s path shoves it',
      rate.across.swats >= Math.ceil(rate.across.aimed * 0.6),
      `${rate.across.swats} shoves from ${rate.across.aimed} flicks`,
    );
    r.ok(
      '§1 along: a flick down the cat’s path shoves far less often',
      rate.along.swats * 2 <= rate.across.swats,
      `along ${rate.along.swats}/${rate.along.aimed} vs across ${rate.across.swats}/${rate.across.aimed}`,
    );
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
 * §4 — the two shipped modes are untouched
 * ------------------------------------------------------------------ */

for (const mode of ['commander', 'manual']) {
  const f = await fightWith(browser, mode, r, `§4 ${mode}`, { needKitten: mode === 'commander' });
  if (f) {
    const before = await f.page.evaluate(() => window.__trail.length);
    const out = await swipeCat(f.page);
    await f.page.waitForTimeout(IMPULSE_MS + 160);
    const swats = await f.page.evaluate(() => window.__swats);
    const trail = await f.page.evaluate(() => window.__trail);
    /*
     * The whole reason §16 is a flag and not a chip: two shipped modes and twelve green harnesses that
     * assert on them must not notice this exists. `swats === 0` is the strong form — the shove's own
     * announcement never fires — and it also covers the treat swat, since no treat is thrown here.
     */
    r.ok(`§4 ${mode}: a flick at the cat does nothing`, swats === 0, `${swats} shoves after a ${Math.round(out.len ?? 0)}px flick`);
    r.note(`§4 ${mode}: travelled ${travelled(trail, out.perf, out.perf + IMPULSE_MS).toFixed(1)}px in the ${IMPULSE_MS}ms after (${trail.length - before} new samples)`);
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
