/**
 * Build step 7 — the rubber band (§7.3) — checked in a real browser.
 *
 * §7.3's claim is that difficulty scales *as behaviour you can read*, so the checks have to
 * be about behaviour rather than about the scalar. The shape of every one of them is the
 * same: hold the **player's** conduct fixed, move the fight into a different tier, and show
 * that what the cat does changes. A test that drove the mood and then asserted the mood
 * would be asserting an assignment.
 *
 * The bait below is what makes that possible. Parking on a claim and jiggling ±8px on a
 * fixed cadence keeps scrub progress oscillating just past `POUNCE_THRESHOLD` (0.35) without
 * ever completing a hold: the cat is offered exactly the same provocation every ~520ms
 * forever. So the commitment rate is a clean read of the cat's *willingness*, which is the
 * thing aggression moves.
 *
 * Mirrors src/lib/arena.ts:
 */
const TELEGRAPH_MS = 420;
const SCRUB_MS = 1400;
const BAIT_MS = 520; // > POUNCE_THRESHOLD * SCRUB_MS (490), < the bored threshold's 910

import {
  BASE,
  armAmmo,
  deal,
  fresh as context,
  launch,
  press as sharedPress,
  release as sharedRelease,
  report,
  throwSpot,
  wants,
} from './lib/fixture.mjs';

/*
 * Shared with the rest of the fleet through `lib/fixture.mjs` (§12.1's charter): the reporter with its
 * fixture/assertion split, the context factory that declares the mode, the launcher, and the waits
 * that open and close a fight. This file used to carry its own copy of each.
 */
const browser = await launch();
const { ok, note, fixture, done } = report();




/** Shared with the fleet; this file has always allowed 8000ms for the curtain. */
const press = (page) => sharedPress(page, { timeout: 8000 });


const release = (page) => sharedRelease(page, { timeout: 8000 });


async function settled(page, ms = 8000) {
  await page
    .waitForFunction(
      () =>
        document.getElementById('cat-arena-toggle')?.getAttribute('aria-pressed') === 'false' &&
        !document.querySelector('.cat-claimed') &&
        document.getElementById('cat-curtain')?.hidden !== false,
      undefined,
      { timeout: ms },
    )
    .catch(() => {});
  await page.waitForTimeout(120);
}

/**
 * A desktop context playing **manual mode**: §7.3's tiers are measured against a pointer that plays.
 */
const fresh = (opts = {}) => context(browser, { mode: 'manual', ...opts });


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

/**
 * Watch the cat: every phase change, every mood change, every grooming beat, timestamped.
 *
 * One observer for all three because they have to be compared on the same clock — "did the
 * commitments thin out once it got bored" is a question about the interleaving, and two
 * recorders sampled separately cannot answer it.
 */
const RECORDER = () => {
  const root = document.getElementById('site-cat');
  const phase = () =>
    root.classList.contains('boss-telegraph')
      ? 'telegraph'
      : root.classList.contains('boss-leap')
        ? 'leap'
        : root.classList.contains('boss-recover')
          ? 'recover'
          : root.classList.contains('boss')
            ? 'stalk'
            : 'off';
  window.__log = [];
  let seenPhase = phase();
  let seenMood = root.dataset.mood ?? '';
  let seenGroom = root.classList.contains('grooming');
  const at = () => performance.now();
  window.__log.push({ k: 'phase', v: seenPhase, t: at() });
  window.__log.push({ k: 'mood', v: seenMood, t: at() });
  new MutationObserver(() => {
    const p = phase();
    if (p !== seenPhase) {
      seenPhase = p;
      window.__log.push({ k: 'phase', v: p, t: at() });
    }
    const m = root.dataset.mood ?? '';
    if (m !== seenMood) {
      seenMood = m;
      window.__log.push({ k: 'mood', v: m, t: at() });
    }
    const g = root.classList.contains('grooming');
    if (g !== seenGroom) {
      seenGroom = g;
      window.__log.push({ k: 'groom', v: g ? 'on' : 'off', t: at() });
    }
    // Territory is what the mood is a function of, so it belongs on the same timeline.
    const claimed = document.querySelectorAll('.cat-claimed').length;
    const last = window.__log.findLast((e) => e.k === 'claims');
    if (!last || last.v !== claimed) window.__log.push({ k: 'claims', v: claimed, t: at() });
  }).observe(root, { attributes: true, attributeFilter: ['class', 'data-mood'] });
};

/** The cat's current mood, straight off the element. */
const MOOD = `document.getElementById('site-cat')?.dataset.mood ?? ''`;
const CLAIMS = `document.querySelectorAll('.cat-claimed').length`;
const AMMO = `document.querySelectorAll('#cat-score .cat-paw.got').length`;





/** Throw a treat away from where the player is working, if one is in hand. */
async function bribe(page, awayFrom) {
  if ((await page.evaluate(AMMO)) === 0) return false;
  if (await page.evaluate(`!document.getElementById('cat-throw').hidden`)) return false;
  const spot = await throwSpot(page, {
    x: awayFrom.x > 640 ? 60 : 1220,
    y: awayFrom.y > 450 ? 180 : 780,
  });
  if (!spot) return false;
  await page.mouse.move(spot.x, spot.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(140);
  return true;
}

/**
 * Offer the cat the same provocation, over and over, and never complete a scrub.
 *
 * Returns when `until()` says so or the clock runs out. The jiggle is what makes this a
 * *constant* stimulus: `stillEnough` restarts the hold on any drift past 6px, so progress
 * saws between 0 and ~0.37 — over `POUNCE_THRESHOLD` at the even tier, under it once the
 * bored tier's patience is added. Same player, different cat.
 */
async function bait(page, ms, until = null) {
  const t0 = Date.now();
  let n = 0;
  let spot = null;
  while (Date.now() - t0 < ms) {
    // Re-pick only when the current point stops landing on a claim. Scrolling every cycle
    // would jerk the view and change what the cat is walking towards mid-measurement; and
    // late in a fight there may be two claims left, both below the fold — the run that
    // measured the desperate tier at 0.30/s had simply run out of anything to provoke with,
    // so it was comparing a baited cat against an unbaited one.
    const still = spot
      ? await page.evaluate(
          ([x, y]) => !!document.elementFromPoint(x, y)?.closest('.cat-claimed'),
          [spot.x, spot.y],
        )
      : false;
    if (!still) spot = await parkableSpot(page);
    if (!spot) break;
    await page.mouse.move(spot.x + (n % 2 ? 8 : -8), spot.y);
    n++;
    await page.waitForTimeout(BAIT_MS);
    if (until && (await until())) break;
  }
  return Date.now() - t0;
}

/**
 * Scroll the claim furthest from the cat to the middle of the screen and return a point on
 * it that is genuinely parkable — verified, not assumed.
 *
 * Three attempts at "which claims can a harness use" and only this one is right. Filtering
 * by position and `height < 420` left only about **three** usable claims at 900px, because
 * `boardSlice` borrows from below the fold to make its floor — so the climb stalled at three
 * reclaims, every later attempt finding nothing. Widening the viewport worked at 1800px and
 * not at 2200px, which is a coin toss dressed as a fix. Scrolling fixed most of it, and the
 * last claim still failed: the survivors were the *tall* ones the height filter excluded.
 *
 * `elementFromPoint` answers the question the filters were approximating. Scroll it to the
 * centre — where a point is always in the viewport, whatever the element's height — then ask
 * the document whether that point actually lands on this claim, and move on if it does not.
 * Which is also what the arena itself does to decide what you are scrubbing (`claimUnder`),
 * so the harness and the game agree on what "on a claim" means.
 */
async function parkableSpot(page) {
  const spot = await page.evaluate(() => {
    const cat = document.getElementById('site-cat').getBoundingClientRect();
    const cx = cat.left + cat.width / 2;
    const cy = cat.top + cat.height / 2;
    const claims = [...document.querySelectorAll('.cat-claimed')];
    claims.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return (
        Math.hypot(rb.left + rb.width / 2 - cx, rb.top + rb.height / 2 - cy) -
        Math.hypot(ra.left + ra.width / 2 - cx, ra.top + ra.height / 2 - cy)
      );
    });
    for (const el of claims) {
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = el.getBoundingClientRect();
      const x = Math.round(Math.min(Math.max(r.left + r.width / 2, 60), innerWidth - 60));
      const y = Math.round(Math.min(Math.max(r.top + r.height / 2, 200), innerHeight - 120));
      if (document.elementFromPoint(x, y)?.closest('.cat-claimed') === el) return { x, y };
    }
    return null;
  });
  if (spot) await page.waitForTimeout(250); // let the scroll settle before parking
  return spot;
}

/**
 * Somewhere that is not a claim.
 *
 * The header is `PROTECTED_TREE`, so `claimUnder` finds nothing and no scrub progress
 * accrues — which makes it the only honest place to leave the cursor between actions.
 * Without this the climb stalemated at eight claims after **thirteen** successful reclaims:
 * the pointer sat on whatever claim it had just finished while the harness scrolled and
 * counted, progress kept building, and the cat took back exactly as much as it lost. The
 * cursor is an input, so parking it on the board is playing the game by accident.
 */
async function parkNeutral(page) {
  await page.mouse.move(640, 60);
  await page.waitForTimeout(80);
}

/**
 * Hold perfectly still on a parkable claim until it is taken back.
 *
 * `spend` throws a treat first, and it is not optional for a player trying to actually win.
 * Holding still alone stalemates: the run before this one reclaimed **twelve** claims and
 * finished on the same eight it started with, because every landed pounce takes one back and
 * the two rates match. That is not a harness artefact — it is §5.4's "the safe window is a
 * real decision", arrived at from the other direction. Treats are what convert holding still
 * into progress, and without them an even fight sits near the opening ratio indefinitely.
 */
async function scrubOne(page, ms = 7000, spend = false) {
  const spot = await parkableSpot(page);
  if (!spot) return false;
  if (spend) await bribe(page, spot);
  const before = await page.evaluate(CLAIMS);
  await page.mouse.move(spot.x, spot.y);
  const t0 = Date.now();
  let won = false;
  while (Date.now() - t0 < ms) {
    await page.waitForTimeout(200);
    if ((await page.evaluate(CLAIMS)) < before) {
      won = true;
      break;
    }
  }
  await parkNeutral(page);
  return won;
}

/**
 * Every interval the cat spent in a given tier.
 *
 * Not "from the first bored marker to the end", which is what the first version did with
 * `findLast` — and with a hysteresis band wide enough to actually be left, a fight can go
 * even→bored→even→bored, so that put an earlier *bored* stretch inside the "even" baseline
 * and duly reported a grooming beat while the fight was supposedly even. A tier is a set of
 * intervals, so the statistics have to be taken over a union of them.
 */
function tierSpans(log, tier, endT, notBefore = 0) {
  const moods = log.filter((e) => e.k === 'mood' && e.v);
  const spans = [];
  for (let i = 0; i < moods.length; i++) {
    if (moods[i].v !== tier) continue;
    const from = Math.max(moods[i].t, notBefore);
    const to = moods[i + 1]?.t ?? endT;
    if (to > from) spans.push([from, to]);
  }
  return spans;
}

/**
 * How far into a fresh hold the cat commits, in ms, over several attempts.
 *
 * This is the measurement that fits what aggression actually does to willingness. The
 * commitment *rate* does not: the cat's cycle is telegraph + leap + **recovery**, and step 7
 * deliberately leaves recovery alone (see `telegraphScale`), so at ambush the cycle is
 * ~1.6s even and ~1.5s desperate — a 6% difference that a 520ms bait cadence buries in
 * noise. Two runs duly reported the desperate cat committing *less* often.
 *
 * Latency from hold-start to wind-up-start is what the patience change moves, directly and
 * with no recovery in it: `POUNCE_THRESHOLD` 0.35 of a 1400ms scrub is ~490ms at the even
 * tier and ~280ms at the desperate one. The hold is 1250ms — long enough for both, short
 * enough never to complete a scrub and end the exchange early.
 */
/**
 * A point near `spot` that is **not** on any claim, so the cat can be lured into range
 * without the player accruing any scrub progress.
 */
async function lurePoint(page, spot) {
  return page.evaluate(
    ([x, y]) => {
      for (const r of [55, 75, 95, 120]) {
        for (const deg of [0, 45, 90, 135, 180, 225, 270, 315]) {
          const px = Math.round(x + r * Math.cos((deg * Math.PI) / 180));
          const py = Math.round(y + r * Math.sin((deg * Math.PI) / 180));
          if (px < 40 || py < 150 || px > innerWidth - 40 || py > innerHeight - 60) continue;
          const el = document.elementFromPoint(px, py);
          if (el && !el.closest('.cat-claimed') && !el.closest('#cat-hud, header')) {
            return { x: px, y: py };
          }
        }
      }
      return null;
    },
    [spot.x, spot.y],
  );
}

async function commitLatencies(page, attempts = 6) {
  const out = [];
  for (let i = 0; i < attempts; i++) {
    const spot = await parkableSpot(page);
    if (!spot) break;
    /*
     * Wait next to the claim, not on it. Three attempts to get this right:
     *
     * 1. Park somewhere neutral, then jump onto the claim — read 1016ms at *both* tiers, in
     *    multiples of ~508ms, because the number was the cat **walking back from the header**
     *    at `STALK_SPEED` plus a restarted hold. Travel, not willingness.
     * 2. Park on the claim and wait for the cat to be near *and* stalking — never fired at
     *    all, because a still player has progress well past the threshold by the time the cat
     *    arrives, so it commits on the same frame it comes into range. The window being waited
     *    for does not exist.
     * 3. This: hold the cursor on a **non-claim** point a few tens of pixels away. Progress
     *    cannot accrue, so the cat can never commit; it walks over and settles into a stable
     *    stalk beside the cursor. Then move onto the claim, which starts a fresh hold with the
     *    animal already in range — and the clock measures exactly one thing, which is how far
     *    into that hold it decides.
     */
    const lure = await lurePoint(page, spot);
    if (!lure) continue;
    await page.mouse.move(lure.x, lure.y);
    const ready = await page
      .waitForFunction(
        ([x, y]) => {
          const root = document.getElementById('site-cat');
          const r = root.getBoundingClientRect();
          const near = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y) <= 80;
          const stalking = !['boss-telegraph', 'boss-leap', 'boss-recover', 'boss-eat', 'boss-fetch'].some(
            (c) => root.classList.contains(c),
          );
          return near && stalking;
        },
        [spot.x, spot.y],
        { timeout: 8000 },
      )
      .then(() => true)
      .catch(() => false);
    if (!ready) continue;

    const probe = await page.evaluate(
      async ([x, y, cap]) => {
        const root = document.getElementById('site-cat');
        // Tagged with the tier it was actually taken in, because the probe *changes* the
        // tier: every landed pounce takes ground back, so six probes at the desperate tier
        // walked the cat up past `DESPERATE_LEAVE` and four of them were really measuring an
        // even cat. The rubber band undoing the measurement is the feature working.
        const mood = root.dataset.mood ?? '';
        // Nudged 8px, which fails `stillEnough` and so restarts the hold — that restart is
        // the zero of this measurement. Dispatched rather than driven through Playwright so
        // the clock starts in the same task the pointer moves in; a round-trip would be a
        // sizeable fraction of the number being measured.
        const t0 = performance.now();
        document.dispatchEvent(
          new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true }),
        );
        while (performance.now() - t0 < cap) {
          if (root.classList.contains('boss-telegraph')) {
            return { latency: performance.now() - t0, mood };
          }
          await new Promise((r) => requestAnimationFrame(r));
        }
        return { latency: -1, mood };
      },
      [spot.x, spot.y, 1250],
    );
    if (probe.latency > 0) out.push(probe);
    // Let the pounce it just started play out before offering another hold.
    await page.waitForTimeout(400);
  }
  return out;
}

/** Count commitments, grooming beats and wind-up lengths across a union of intervals. */
function spanStats(log, spans, guardMs = 400) {
  const trimmed = spans.map(([a, b]) => [a + guardMs, b]).filter(([a, b]) => b > a);
  const inAny = (t) => trimmed.some(([a, b]) => t >= a && t <= b);
  const phases = log.filter((e) => e.k === 'phase');
  const telegraphs = [];
  let commits = 0;
  for (let i = 0; i < phases.length; i++) {
    if (phases[i].v !== 'telegraph' || !inAny(phases[i].t)) continue;
    commits++;
    const next = phases[i + 1];
    if (next) telegraphs.push(next.t - phases[i].t);
  }
  const seconds = trimmed.reduce((n, [a, b]) => n + (b - a), 0) / 1000;
  return {
    commits,
    grooms: log.filter((e) => e.k === 'groom' && e.v === 'on' && inAny(e.t)).length,
    telegraphs,
    /*
     * The **shortest** wind-up, not the mean, and this is not a way of picking a friendlier
     * number. A bell doubles the next telegraph (§9.5), and the climb to the desperate tier
     * has to spend treats to get there — so a mean over three wind-ups with one bell in it
     * says nothing about the tier. Aggression sets a *floor* on the wind-up; the minimum is
     * the statistic that floor is about, and the confound only ever lengthens, never
     * shortens, so it cannot flatter the result.
     */
    fastest: telegraphs.length ? Math.min(...telegraphs) : 0,
    seconds,
    rate: seconds > 0 ? commits / seconds : 0,
  };
}

/**
 * A cat that leaps, on a board with something in reach — one deal, both conditions.
 *
 * Fourteen deals is this file's own budget: an ambush is one of four weighted stances, and the band
 * here is 80px off the bottom rather than 40 because §7.3's measurements park the pointer low.
 */
const leaper = (page, want = 'ambush') =>
  deal(page, wants.stance([want], { claims: 'inView', top: 160, bottom: 80, maxHeight: 420 }), {
    deals: 14,
    settle: 0,
    // This file's own 8000ms open and close, so a re-deal waits exactly as long as it always has.
    reopen: async () => {
      await release(page);
      await press(page);
    },
  });


// ---- 1. bored: the cat eases off a player who is behind and out of options
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1800);

  /*
   * Run the page end to end before baselining — arena4's trick, needed here for a second
   * reason as well.
   *
   * Scrolling permanently adds the site's scroll-reveal classes, so a baseline from an
   * unscrolled page can never match one taken after a fight that scrolled. And this harness
   * scrolls to reach claims, which also warms Astro's link prefetch: `<link rel="prefetch">`
   * elements get injected into `<head>`, so every index in the snapshot shifts and the
   * compare reported **123 differences** starting with `BODY` turning into `LINK`. Neither
   * has anything to do with whether the arena put the page back.
   */
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 180) {
      scrollTo({ top: y, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 80));
    }
    scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.waitForTimeout(600);
  const clean = await page.evaluate(SNAP_LIST);

  await press(page);
  const stance = await leaper(page);
  ok('dealt a cat that actually leaves the floor', !!stance, stance ?? 'no ambush in 14 rolls');
  await page.evaluate(RECORDER);
  const opened = await page.evaluate(() => performance.now());

  ok('a fight opens even', (await page.evaluate(MOOD)) === 'even', await page.evaluate(MOOD));

  /*
   * Feed it. Baiting without ever finishing a hold means every landed pounce is a net gain
   * for the cat, so territory climbs — which is the only honest way to reach the tier that
   * fires when the player is losing.
   */
  const fed = await bait(page, 70_000, async () => (await page.evaluate(MOOD)) === 'bored');
  const reachedBored = (await page.evaluate(MOOD)) === 'bored';
  ok(
    'a player who keeps losing ground reaches the bored tier',
    reachedBored,
    `${Math.round(fed / 1000)}s, ${await page.evaluate(CLAIMS)} claims, mood=${await page.evaluate(MOOD)}`,
  );

  if (reachedBored) {
    // Keep doing exactly the same thing for another stretch, now that the cat has changed.
    await bait(page, 22_000);
    const log = await page.evaluate(() => window.__log);
    const endT = log.at(-1).t;
    // The opening grace pins the cat to watching, so it is not part of any tier's baseline.
    const even = spanStats(log, tierSpans(log, 'even', endT, opened + 2500));
    const bored = spanStats(log, tierSpans(log, 'bored', endT));

    ok(
      'and then it stops trying — same bait, fewer commitments',
      even.rate > 0 && bored.rate < even.rate * 0.6,
      `${even.rate.toFixed(2)}/s even vs ${bored.rate.toFixed(2)}/s bored ` +
        `(${even.commits} in ${even.seconds.toFixed(0)}s, ${bored.commits} in ${bored.seconds.toFixed(0)}s)`,
    );
    ok(
      'a bored cat washes itself (§7.3’s tell)',
      bored.grooms > 0,
      `${bored.grooms} grooming beats in ${bored.seconds.toFixed(0)}s`,
    );
    ok(
      'and never does while the fight is even',
      even.grooms === 0,
      `${even.grooms} in ${even.seconds.toFixed(0)}s of even play`,
    );
    /*
     * Mercy, not surrender — and the first version of this check was worthless: it asserted
     * `bored.seconds > 0`, which is true of any window, and reported "0 commitments" as a
     * pass. It has to ask a different question than the one above it.
     *
     * The bait is calibrated to sit *just* over the even tier's threshold, so a bored cat
     * ignoring it is the feature working, not the cat giving up. What separates the two is
     * a real hold: park properly, let progress run to 1, and a cat that still wants the page
     * will come. §10's floor is that below about 0.4 aggression the cat stops being a threat
     * — this is that floor, measured.
     */
    const before = await page.evaluate(CLAIMS);
    const still = await parkableSpot(page);
    let answered = false;
    if (still) {
      await page.mouse.move(still.x, still.y);
      answered = await page
        .waitForFunction(
          (n) =>
            document.getElementById('site-cat').classList.contains('boss-telegraph') ||
            document.querySelectorAll('.cat-claimed').length !== n,
          before,
          { timeout: 9000 },
        )
        .then(() => true)
        .catch(() => false);
    }
    ok(
      'mercy, not surrender — a real hold still gets answered',
      answered,
      answered ? 'the cat committed or lost ground' : 'nothing happened in 9s of holding still',
    );
  }

  ok('no console errors through a rubber-banded fight', errors.length === 0, errors.slice(0, 2).join(' | '));

  await release(page);
  await settled(page);
  const diff = await snapDiff(page, clean);
  ok('the page comes back byte-identical', diff.n === 0, diff.detail);
  const leftovers = await page.evaluate(() => {
    const c = document.getElementById('site-cat');
    return { groom: c.classList.contains('grooming'), mood: c.dataset.mood ?? '(none)' };
  });
  ok('no grooming class left on the ambient cat', leftovers.groom === false);
  ok('and no mood left on it either', leftovers.mood === '(none)', leftovers.mood);
  await ctx.close();
}

// ---- 2. desperate: pushing the cat down makes the endgame cost something
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1800);
  // A player who is winning is a player who has been exploring — the desperate tier is only
  // reachable by someone spending the resource §5.4 exists for. Ammo does not gate this tier
  // (unlike bored), so arming up here changes nothing about what is being measured.
  const armed = await armAmmo(page, { hops: 5, pool: 6, dwell: 650, settle: 750, home: '/timeline/' });
  ok('armed like a player who has been round the site', armed >= 3, `${armed} treats`);

  await press(page);
  const leapDeal = await leaper(page);
  fixture('dealt a leaping cat for the desperate measurements too', leapDeal, leapDeal.value ?? '');
  await page.evaluate(RECORDER);
  const opened = await page.evaluate(() => performance.now());

  /*
   * A short baseline of the cat at the even tier, under the constant bait.
   *
   * Short on purpose: baiting *feeds* the cat, so a long baseline grows the board it then
   * has to be driven off. The first run spent 16s here, arrived at the climb with ten
   * claims instead of eight, and never reached the tier.
   */
  await bait(page, 6_000);
  const probes = await commitLatencies(page);
  const evenEnd = await page.evaluate(() => performance.now());

  // Then take the page off it. Holding perfectly still completes holds, which is the
  // playstyle 0.7 found the cat has no answer to — so this is also the route a real
  // winning player takes.
  let taken = 0;
  for (let i = 0; i < 26; i++) {
    if ((await page.evaluate(MOOD)) === 'desperate') break;
    if (await scrubOne(page, 7000, true)) taken++;
    if ((await page.evaluate(CLAIMS)) === 0) break;
  }
  const mood = await page.evaluate(MOOD);
  const reachedDesperate = mood === 'desperate';
  ok(
    'a player who is winning drives the cat into the desperate tier',
    reachedDesperate,
    `${taken} reclaimed, ${await page.evaluate(CLAIMS)} claims left, mood=${mood}`,
  );

  if (reachedDesperate) {
    /*
     * Let the last thrown treat finish before measuring. A treat in flight or being eaten
     * means the cat cannot pounce at all (§5.3), so its window would read as a cat that has
     * lost interest — the opposite of the tier under test.
     */
    await page
      .waitForFunction(() => document.getElementById('cat-throw')?.hidden !== false, undefined, {
        timeout: 8000,
      })
      .catch(() => {});
    await page.waitForTimeout(600);
    const despFrom = await page.evaluate(() => performance.now());
    await bait(page, 8_000, async () => (await page.evaluate(CLAIMS)) === 0);
    /*
     * Probe, and **re-enter the tier when the probing knocks us out of it.**
     *
     * Every probe ends in a landed pounce, which takes ground back, which walks the cat up past
     * `DESPERATE_LEAVE` — so the desperate window is only a couple of samples wide and closes
     * behind you. One regression run collected fourteen even samples and *zero* desperate ones
     * and reported a failure on a build that was fine. Tagging each probe with its tier made
     * that visible; this makes it not happen: push the cat back down and probe again until
     * there are enough samples to compare, or the attempts run out.
     */
    /*
     * **1.4 widened this loop, because the tier now digs itself out faster.** §7.3's last stand
     * shortens the regrow clock (`LAST_STAND_REGROW`) exactly while the cat is cornered, so the
     * board rebuilds sooner and territory climbs back over `DESPERATE_LEAVE` sooner — the window
     * this loop is chasing is *narrower in time* than the one the note above was written against.
     * A 6-round budget with one scrub per round collected zero desperate samples and reported a
     * failure on a build where the tier was working; the tier measuring itself out of existence is
     * the feature, not the fault.
     *
     * So: more rounds, and each round pushes as far down as it takes rather than one claim at a
     * time — the harness has to out-work a mechanic designed to out-work the player.
     */
    for (let round = 0; round < 14; round++) {
      if (probes.filter((pr) => pr.mood === 'desperate').length >= 2) break;
      if ((await page.evaluate(MOOD)) !== 'desperate') {
        let pushed = 0;
        while (pushed < 4 && (await page.evaluate(MOOD)) !== 'desperate') {
          if ((await page.evaluate(CLAIMS)) === 0) break;
          if (!(await scrubOne(page, 7000, true))) break;
          pushed++;
        }
        if ((await page.evaluate(MOOD)) !== 'desperate') continue;
      }
      probes.push(...(await commitLatencies(page, 2)));
    }
    const log = await page.evaluate(() => window.__log);
    const endT = log.at(-1).t;
    // Clipped to the baited baseline, so both tiers are measured under the same stimulus:
    // the scrubbing stretch in between is the player holding still, which provokes
    // differently and would flatter whichever tier happened to contain it.
    const even = spanStats(
      log,
      tierSpans(log, 'even', endT, opened + 2500).map(([a, b]) => [a, Math.min(b, evenEnd)]),
    );
    // Clipped to start after the treats settled, for the reason above.
    const desp = spanStats(
      log,
      tierSpans(log, 'desperate', endT).map(([a, b]) => [Math.max(a, despFrom), b]),
    );

    ok(
      'a desperate cat winds up faster than an even one (§7.3)',
      desp.fastest > 0 && even.fastest > 0 && desp.fastest < even.fastest * 0.9,
      `fastest wind-up ${even.fastest.toFixed(0)}ms even vs ${desp.fastest.toFixed(0)}ms desperate ` +
        `(all: even ${even.telegraphs.map((t) => t.toFixed(0)).join('/')}, ` +
        `desperate ${desp.telegraphs.map((t) => t.toFixed(0)).join('/')})`,
    );
    ok(
      'but never faster than a human can react to (§5.3’s floor)',
      desp.telegraphs.every((t) => t > 200),
      `shortest ${Math.min(...desp.telegraphs).toFixed(0)}ms`,
    );
    /*
     * "Comes at you sooner", not "more often" — and the change of wording is the finding.
     *
     * The rate cannot show this, because the cat's cycle is dominated by the recovery step 7
     * deliberately leaves alone: ~1.6s even against ~1.5s desperate at ambush, a 6%
     * difference that two runs resolved the wrong way. What the patience change actually
     * moves is *how early in your hold it decides*, and that has no recovery in it.
     */
    const med = (xs) => (xs.length ? [...xs].sort((a, b) => a - b)[xs.length >> 1] : -1);
    const at = (m) => probes.filter((p) => p.mood === m).map((p) => p.latency);
    const evenLat = at('even');
    const despLat = at('desperate');
    ok(
      'and it decides sooner — the endgame is no longer free',
      evenLat.length > 0 && despLat.length > 0 && med(despLat) < med(evenLat) * 0.8,
      `commits ${med(evenLat).toFixed(0)}ms into a hold when even (${evenLat.map((v) => v.toFixed(0)).join('/')}), ` +
        `${med(despLat).toFixed(0)}ms when desperate (${despLat.map((v) => v.toFixed(0)).join('/')})`,
    );
    ok(
      'a desperate cat does not groom',
      desp.grooms === 0,
      `${desp.grooms} grooming beats`,
    );
  }

  ok('no console errors driving the cat to the wall', errors.length === 0, errors.slice(0, 2).join(' | '));
  await release(page);
  await settled(page);
  await ctx.close();
}

// ---- 3. the tier does not strobe while territory trades back and forth
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1800);
  await press(page);
  await page.evaluate(RECORDER);

  // Trade: bait for a while (cat gains), then scrub (player gains), repeatedly. This is the
  // shape of play that a boundary with no memory turns into a strobe.
  for (let i = 0; i < 4; i++) {
    await bait(page, 6000);
    await scrubOne(page, 4000);
    if ((await page.evaluate(CLAIMS)) === 0) break;
  }

  const log = await page.evaluate(() => window.__log);
  const moods = log.filter((e) => e.k === 'mood' && e.v);
  const claimSeries = log.filter((e) => e.k === 'claims').map((e) => e.v);
  const swings = claimSeries.filter((v, i) => i > 0 && v !== claimSeries[i - 1]).length;
  ok(
    'territory really did move back and forth',
    swings >= 4,
    `${swings} changes across ${claimSeries.length} samples`,
  );
  /*
   * The band's own guarantee, measured — not a ratio picked to look strict.
   *
   * "Fewer mood changes than territory changes, over three" was arbitrary and duly failed at
   * 4 vs 8 on a run that was behaving correctly. What the design actually promises is that
   * the band is at least two claims wide, so **no two tier changes can be one claim apart**.
   * That is a statement about the gaps rather than the count, and it is the thing that would
   * break if the band were narrowed again.
   */
  const claimsLog = log.filter((e) => e.k === 'claims');
  const gaps = [];
  for (let i = 1; i < moods.length; i++) {
    const between = claimsLog.filter((c) => c.t > moods[i - 1].t && c.t <= moods[i].t);
    const moved = between.filter((c, j) => j === 0 || c.v !== between[j - 1].v).length;
    gaps.push(moved);
  }
  ok(
    'no two tier changes happen within one claim of each other',
    gaps.every((g) => g >= 2),
    moods.length < 2
      ? `only ${moods.length} tier change, nothing to space out`
      : `gaps of ${gaps.join('/')} claims between ${moods.map((m) => m.v).join('→')}`,
  );
  await release(page);
  await settled(page);
  await ctx.close();
}

// ---- 4. the ambient cat is handed back unaffected
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/?ink=20260802', { waitUntil: 'load' });
  await page.waitForTimeout(1800);
  await press(page);
  await bait(page, 9000);
  await release(page);
  await settled(page);
  await page.waitForTimeout(1500);

  /*
   * Total distance travelled, sampled, over a window long enough to contain a walk.
   *
   * The endpoint-minus-startpoint version read 2.1px and failed — not because the cat was
   * stuck but because SiteCat alternates walking with idle beats, so a 2.2s window can land
   * entirely inside one, and a cat that walks out and back nets zero anyway. "Did it move
   * at all" is the question; a sum answers it and a difference does not.
   */
  const travelled = await page.evaluate(async () => {
    const c = document.getElementById('site-cat');
    let last = c.getBoundingClientRect().left;
    let total = 0;
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 120));
      const x = c.getBoundingClientRect().left;
      total += Math.abs(x - last);
      last = x;
    }
    return total;
  });
  const after = await page.evaluate(() => {
    const c = document.getElementById('site-cat');
    return {
      boss: c.classList.contains('boss'),
      groom: c.classList.contains('grooming'),
      mood: c.dataset.mood ?? '(none)',
    };
  });
  ok('the cat walks again after a rubber-banded fight', travelled > 20, `${travelled.toFixed(0)}px over 7s`);
  ok('and is not still a boss', after.boss === false);
  ok('and is not still grooming on the arena’s behalf', after.groom === false);
  ok('and carries no mood into ambient browsing', after.mood === '(none)', after.mood);
  await ctx.close();
}

await browser.close();
if (!done()) process.exit(1);
void TELEGRAPH_MS;
void SCRUB_MS;
