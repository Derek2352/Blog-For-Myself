/**
 * Build step 2: the Pounce. Checked against a real browser and a real clock.
 *
 * The claims that matter here are all about *time*: the telegraph must be long
 * enough to react to, the leap must never start before it is over, and a whiff must
 * cost the cat a window. So this harness records phase changes with timestamps via a
 * MutationObserver and asserts on the intervals rather than on end states.
 *
 * Mirrors src/lib/arena.ts:
 */
const TELEGRAPH_MS = 420;
const LEAP_MS = 260;
const RECOVER_MS = 700;
const POUNCE_RANGE = 90;
const HIT_RADIUS = 46;
const OPENING_GRACE_MS = 2500;
const SCRUB_MS = 1400;
/** Stance multipliers on the telegraph — mirrors STANCES in src/lib/arena.ts. */
const TELEGRAPH_MUL = { ambush: 0.78, siege: 1, trickster: 1.1, sleepy: 1.6 };

import {
  BASE,
  deal,
  fresh as context,
  launch,
  press,
  release,
  report,
  wants,
} from './lib/fixture.mjs';

/*
 * The reporter, the context factory, the launcher and the open/close waits come from
 * `lib/fixture.mjs` (§12.1's charter). This file carried its own copy of each, which is how one
 * idea ended up with eleven implementations and a fix at one call site could never be a fix.
 */
const browser = await launch();
const { ok, note, fixture, done } = report();



/**
 * Press the toggle and wait for the state change to have actually landed.
 *
 * Step 6 put a ~1.9s ink curtain between the press and the fight. Every `click` in these
 * scripts was followed by a fixed 120–200ms wait, which was ample against an instant swap and
 * is now a race the script always loses — the first symptom was `getBoundingClientRect` on a
 * null `.cat-claimed`. Waiting on the observable rather than on a stopwatch is both correct
 * and, on the close path, usually shorter.
 */


/**
 * A desktop context playing **manual mode** — 2.0 made commander mode the default, and every check
 * in this file is about what a *pointer* does, so the mode is declared before any fight opens.
 */
const fresh = (opts = {}) => context(browser, { mode: 'manual', ...opts });

/** Records every phase change on the cat, with a timestamp. */
const RECORDER = () => {
  const root = document.getElementById('site-cat');
  window.__phases = [];
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
  let seen = phase();
  window.__phases.push({ phase: seen, t: performance.now() });
  window.__ringLow = -1;
  new MutationObserver(() => {
    const p = phase();
    if (p !== seen) {
      seen = p;
      window.__phases.push({ phase: p, t: performance.now() });
      // How empty does the scrub ring get once a pounce lands? A reset shows as the
      // dashoffset going back to full; a *trimmed* hold would not.
      if (p === 'recover' && window.__ringLow < 0) {
        window.__ringLow = 0;
        const until = performance.now() + 260;
        const sample = () => {
          const fill = document.querySelector('#cat-scrub .scrub-fill');
          const off = parseFloat(getComputedStyle(fill).strokeDashoffset) / 106.81;
          if (off > window.__ringLow) window.__ringLow = off;
          if (performance.now() < until) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }
    }
  }).observe(root, { attributes: true, attributeFilter: ['class'] });
};

const catCentre = () => {
  const r = document.getElementById('site-cat').getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

/**
 * Walk the cat to the cursor without letting a scrub finish.
 *
 * Nudging by more than the still-tolerance resets the hold every step, so progress
 * never reaches 1 while the cat crosses the room — which is how the cursor can be
 * parked on a claim *and* have the cat arrive, the state a pounce needs.
 */
async function lureCat(page, target, within = 70, budgetMs = 12000) {
  const started = Date.now();
  let flip = 1;
  while (Date.now() - started < budgetMs) {
    await page.mouse.move(target.x + flip * 9, target.y);
    flip = -flip;
    await page.waitForTimeout(60);
    const d = await page.evaluate(
      ([tx, ty]) => {
        const r = document.getElementById('site-cat').getBoundingClientRect();
        return Math.hypot(r.left + r.width / 2 - tx, r.top + r.height / 2 - ty);
      },
      [target.x, target.y],
    );
    if (d <= within) return d;
  }
  return -1;
}

/**
 * Claims usable as targets: on screen, and not so tall that their centre is
 * somewhere the pointer can't sensibly sit.
 *
 * The board is re-rolled per fight, so which claims land above the fold varies. A
 * run that happened to get none of them used to crash the harness — re-roll instead,
 * and say so if even that fails.
 */
const IN_VIEW = () =>
  [...document.querySelectorAll('.cat-claimed')]
    .map((c) => {
      const r = c.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), r };
    })
    .filter((c) => c.r.top > 150 && c.r.bottom < innerHeight - 40 && c.r.height < 420).length;

/**
 * The fight this file needs: an **ambush** cat, and a claim in view to use it against.
 *
 * A sleepy cat stalks at 0.55x and never pounces from a distance; a siege cat cannot leave the
 * floor. This file measures the pounce, so it pins the one stance that always throws one, and every
 * section that touches the cat pins it — the two that did not were the last two failures.
 *
 * **Both conditions in one deal, deliberately.** This file used to have two re-rollers — one for the
 * board, one for the stance — and calling them in sequence had each undoing the other, which is how
 * it went back to timing out after the stance pin was added. `deal()` takes one predicate for exactly
 * that reason (§12.1), and forty tries is this file's own budget kept: an ambush is one of four
 * weighted stances, so six deals is not enough to be sure of getting one.
 */
const fighter = (page, want = ['ambush']) =>
  deal(page, wants.stance(want, { claims: 'inView', top: 150, bottom: 40, maxHeight: 420 }), { deals: 40, settle: 180 });

/** A claim to fight over, preferring one the cat can reach quickly. */
const pickTarget = () =>
  (() => {
    const cat = (() => {
      const r = document.getElementById('site-cat').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })();
    const claims = [...document.querySelectorAll('.cat-claimed')]
      .map((c) => {
        const r = c.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), r };
      })
      .filter((c) => c.r.top > 150 && c.r.bottom < innerHeight - 60 && c.r.height < 400);
    claims.sort((a, b) => Math.hypot(a.x - cat.x, a.y - cat.y) - Math.hypot(b.x - cat.x, b.y - cat.y));
    return claims[0] ?? null;
  })();

// ---- 1. the takeover: the arena drives the cat, and gives it back
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(700);

  const walkingBefore = await page.evaluate(async () => {
    const a = document.getElementById('site-cat').getBoundingClientRect().left;
    await new Promise((r) => setTimeout(r, 700));
    return Math.abs(document.getElementById('site-cat').getBoundingClientRect().left - a);
  });
  ok('the cat walks on its own before a fight', walkingBefore > 1, `${walkingBefore.toFixed(1)}px`);

  await press(page);
  await page.waitForTimeout(150);
  // A sleepy cat stalks at 0.55x and a siege one cannot leave the floor, so "it closes on
  // the cursor" is a claim about a particular opponent.
  await fighter(page);
  ok(
    'opening the arena takes the cat over',
    await page.evaluate(() => document.getElementById('site-cat').classList.contains('boss')),
  );
  ok(
    'and lifts it into two dimensions',
    await page.evaluate(() => {
      const t = document.getElementById('site-cat').style.transform;
      return /translate\(/.test(t) && t.split(',').length === 2;
    }),
    await page.evaluate(() => document.getElementById('site-cat').style.transform),
  );
  ok(
    'the boss cannot be booped — it is not a pet right now',
    await page.evaluate(
      () => getComputedStyle(document.querySelector('#site-cat .cat-svg')).pointerEvents === 'none',
    ),
  );

  // it stalks: park the pointer and watch the distance close
  await page.mouse.move(1100, 300);
  const closed = await page.evaluate(async () => {
    const d = () => {
      const r = document.getElementById('site-cat').getBoundingClientRect();
      return Math.hypot(r.left + r.width / 2 - 1100, r.top + r.height / 2 - 300);
    };
    const before = d();
    await new Promise((r) => setTimeout(r, 900));
    return { before, after: d() };
  });
  ok(
    'it stalks the cursor across the page',
    closed.after < closed.before - 60,
    `${closed.before.toFixed(0)}px → ${closed.after.toFixed(0)}px`,
  );

  await release(page);
  await page.waitForTimeout(150);
  ok(
    'a truce hands the cat back',
    await page.evaluate(() => {
      const c = document.getElementById('site-cat');
      return !c.classList.contains('boss') && !c.classList.contains('boss-telegraph');
    }),
  );
  const walkingAfter = await page.evaluate(async () => {
    const a = document.getElementById('site-cat').getBoundingClientRect().left;
    await new Promise((r) => setTimeout(r, 900));
    return Math.abs(document.getElementById('site-cat').getBoundingClientRect().left - a);
  });
  ok('and it walks again afterwards', walkingAfter > 1, `${walkingAfter.toFixed(1)}px`);
  ok(
    'it comes back to the floor, not left mid-air',
    await page.evaluate(() => {
      const r = document.getElementById('site-cat').getBoundingClientRect();
      return Math.abs(r.bottom - innerHeight) < 2;
    }),
  );
  ok('no console errors across a takeover', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---- 2. the pounce: telegraph, then leap, then recover — in that order, on time
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await press(page);
  await page.waitForTimeout(120);
  const foe = (await fighter(page)).value;
  await page.evaluate(RECORDER);
  const openedAt = await page.evaluate(() => performance.now());

  fixture('the board offers a reachable claim and a cat that fights', await fighter(page));
  /*
   * The claim itself, dealt for rather than asserted. `pickTarget` prefers the claim the cat can
   * reach quickest, and a fight that dealt none in the reachable band is a fight this check cannot be
   * made in — which is a property of the deal, not of the build.
   */
  const targetDeal = await deal(page, (p) => p.evaluate(pickTarget), { deals: 6, settle: 180 });
  const target = targetDeal.value;
  fixture('found a claim to fight over', targetDeal, target ? `at ${target.x},${target.y}` : '');

  const dist = await lureCat(page, target, 70);
  ok('the cat closes on a parked cursor', dist > 0, `${dist.toFixed(0)}px away`);

  // now hold perfectly still: progress climbs, and past 0.35 the cat commits
  await page.mouse.move(target.x, target.y);
  await page.waitForTimeout(2200);

  const log = await page.evaluate(() => window.__phases);
  const tele = log.find((p) => p.phase === 'telegraph');
  const leap = log.find((p) => p.phase === 'leap');
  const rec = log.find((p) => p.phase === 'recover');
  ok('holding still provokes a pounce', !!tele && !!leap, log.map((p) => p.phase).join('→'));
  /*
   * Scaled by the stance, not the baseline. An ambush wind-up is 0.78x — 328ms — so an
   * assertion pinned to the 420ms baseline fails against exactly the stance §9.3 describes as
   * "short telegraph, long recovery". What has to hold is that the wind-up matches the
   * opponent that turned up.
   */
  const wantTele = TELEGRAPH_MS * (TELEGRAPH_MUL[foe] ?? 1);
  ok(
    'the telegraph comes first, and lasts as long as this stance promises',
    !!tele && !!leap && leap.t - tele.t >= wantTele - 30,
    tele && leap
      ? `${(leap.t - tele.t).toFixed(0)}ms of warning from a ${foe} (expects ~${wantTele.toFixed(0)}ms)`
      : 'no leap',
  );
  ok(
    'the leap is a leap, not a stroll',
    !!leap && !!rec && rec.t - leap.t < LEAP_MS + 120,
    leap && rec ? `${(rec.t - leap.t).toFixed(0)}ms airborne` : 'never landed',
  );
  /*
   * Two statements, split apart. **That the cat telegraphed at all** is a fixture — a pinned ambush
   * will, but a recording that caught none has measured nothing. **When it first telegraphed** is the
   * assertion. Written as one check, a fight that produced no telegraph read as the grace being
   * violated, which is the opposite of what it means.
   */
  fixture('the pinned cat telegraphed at all', tele, tele ? `at +${(tele.t - openedAt).toFixed(0)}ms` : '');
  if (tele) {
    ok(
      'nothing pounces during the opening grace',
      tele.t - openedAt >= OPENING_GRACE_MS - 60,
      `first telegraph at +${(tele.t - openedAt).toFixed(0)}ms`,
    );
  }

  // A landed pounce costs the hold. Note what it does *not* do: hide the ring for
  // long. The player is still holding, so a fresh hold starts immediately and the
  // ring comes back at zero — which is why this measures progress, not visibility.
  // (The first version of this check asserted a hidden ring and failed on correct
  // behaviour.)
  const worst = await page.evaluate(() => window.__ringLow ?? -1);
  ok(
    'a landed pounce resets the hold rather than trimming it',
    worst >= 0.95,
    `ring emptied to ${(worst * 100).toFixed(0)}% of full after the hit`,
  );
  ok('no errors through a pounce', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---- 2b. a landed pounce takes an element back
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await press(page);
  await page.waitForTimeout(150);
  // Ambush again: a siege board regrows on its own timer, so "the pounce took one back"
  // becomes "something took two back" and the check is measuring two things at once.
  await fighter(page);
  await page.evaluate(RECORDER);

  // bank one claim somewhere the cat is not, so there is something to lose
  fixture('the board offers a reachable claim and a cat that fights', await fighter(page));
  const far = await page.evaluate(() => {
    const cat = document.getElementById('site-cat').getBoundingClientRect();
    const claims = [...document.querySelectorAll('.cat-claimed')]
      .map((c) => {
        const r = c.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), r };
      })
      .filter((c) => c.r.top > 150 && c.r.bottom < innerHeight - 40 && c.r.height < 420);
    claims.sort((a, b) => Math.hypot(b.x - cat.left, b.y - cat.top) - Math.hypot(a.x - cat.left, a.y - cat.top));
    return claims[0] ?? null;
  });
  await page.mouse.move(far.x, far.y);
  await page.waitForTimeout(SCRUB_MS + 300);
  const banked = await page.evaluate(() => document.querySelectorAll('.cat-claimed').length);

  // now get caught
  await fighter(page);
  const target = await page.evaluate(pickTarget);
  await lureCat(page, target, 70);
  /*
   * Anchored to the *next* landing, and the count taken right before the hold.
   *
   * `phases.some(p => p.phase === 'recover')` is satisfied by any pounce in the whole
   * recording, including one that landed while the first claim was being banked — so the
   * check would resolve instantly and then read the page after a second landing had also
   * happened. It reported "took two back" and looked like a `RECLAIM_ON_HIT` bug.
   */
  const banked2 = await page.evaluate(() => document.querySelectorAll('.cat-claimed').length);
  /*
   * Wait for a pounce that **landed**, not merely for one that happened.
   *
   * `recover` follows every leap, hit or miss, so waiting on it and then asserting that
   * ground changed makes an ordinary whiff look like a `RECLAIM_ON_HIT` bug — which is
   * exactly how this reported "8 claims → 8" once in a regression run and passed on the
   * re-run. The cat is entitled to miss; the claim under test is about what a *hit* does. So
   * offer it several holds and wait for the ground to move.
   */
  let after = null;
  for (let attempt = 0; attempt < 4 && !after; attempt++) {
    const mark = await page.evaluate(() => window.__phases.length);
    await page.mouse.move(target.x + (attempt % 2 ? 1 : 0), target.y);
    const landed = await page
      .waitForFunction(
        ([from, n]) =>
          window.__phases.slice(from).some((p) => p.phase === 'recover') &&
          document.querySelectorAll('.cat-claimed').length !== n,
        [mark, banked2],
        { timeout: 9000 },
      )
      .then(() => true)
      .catch(() => false);
    if (!landed) continue;
    await page.waitForTimeout(120);
    after = await page.evaluate(() => ({
      claims: document.querySelectorAll('.cat-claimed').length,
      caption: document.querySelector('#cat-score .cat-caption').textContent,
    }));
  }
  after ??= { claims: -1, caption: 'no pounce landed in four holds' };
  ok(
    'a landed pounce takes back the thing you just earned',
    after.claims === banked2 + 1,
    `${banked2} claims → ${after.claims}, caption "${after.caption}"`,
  );
  await ctx.close();
}

// ---- 3. it is dodgeable, and a whiff costs the cat a window
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await press(page);
  await page.waitForTimeout(120);
  await fighter(page);
  await page.evaluate(RECORDER);

  /*
   * Ambush only here. A trickster bluffs about a third of its wind-ups, and a bluff has no
   * leap and no landing — so a check that waits for the cat to touch down waits forever, for
   * a reason that is the trickster working correctly.
   */
  await fighter(page, ['ambush']);
  const target = await page.evaluate(pickTarget);
  await lureCat(page, target, 70);
  await page.mouse.move(target.x, target.y);

  /*
   * Wait for the telegraph, then move away.
   *
   * This is the dodge the design intends, and it only exists because the aim locks
   * when the wind-up *starts*. The first version of this check dodged and then
   * asserted the cat had missed — and it landed 0px away, because the build re-aimed
   * at the end of the telegraph and simply followed. Same test, opposite meaning:
   * that failure was the mechanic, not the harness.
   */
  await page.waitForFunction(() => window.__phases.some((p) => p.phase === 'telegraph'), undefined, {
    timeout: 8000,
  });
  const claimsBefore = await page.evaluate(() => document.querySelectorAll('.cat-claimed').length);
  await page.mouse.move(target.x + 220, target.y + 140);
  // wait for the landing itself rather than guessing at the clock: the telegraph may
  // already have been part-way through when waitForFunction noticed it
  await page.waitForFunction(() => window.__phases.some((p) => p.phase === 'recover'), undefined, {
    timeout: 6000,
  });
  await page.waitForTimeout(80);

  const landed = await page.evaluate(() => {
    const r = document.getElementById('site-cat').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  const missBy = Math.hypot(landed.x - (target.x + 220), landed.y - (target.y + 140));
  ok(
    'the cat lands where it aimed, not where you went',
    missBy > HIT_RADIUS,
    `${missBy.toFixed(0)}px from the dodged-to point`,
  );
  const claimsAfter = await page.evaluate(() => document.querySelectorAll('.cat-claimed').length);
  ok('a dodged pounce takes nothing back', claimsAfter <= claimsBefore, `${claimsBefore} → ${claimsAfter}`);

  // and the recovery window is real: no new telegraph for RECOVER_MS
  const gap = await page.evaluate(() => {
    const log = window.__phases;
    const rec = log.find((p) => p.phase === 'recover');
    const after = log.filter((p) => p.phase === 'telegraph' && rec && p.t > rec.t)[0];
    return { rec: rec?.t ?? -1, next: after?.t ?? -1 };
  });
  ok(
    'a whiff buys a window the cat cannot pounce in',
    gap.rec > 0 && (gap.next < 0 || gap.next - gap.rec >= RECOVER_MS - 30),
    gap.next < 0 ? 'no second pounce yet' : `${(gap.next - gap.rec).toFixed(0)}ms clear`,
  );
  await ctx.close();
}

// ---- 4. leaving the window mid-leap is a whiff, never a hit
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await press(page);
  await page.waitForTimeout(120);
  await fighter(page);
  await page.evaluate(RECORDER);
  await fighter(page);
  const target = await page.evaluate(pickTarget);
  await lureCat(page, target, 70);
  await page.mouse.move(target.x, target.y);
  await page.waitForFunction(() => window.__phases.some((p) => p.phase === 'telegraph'), undefined, {
    timeout: 8000,
  });
  const before = await page.evaluate(() => document.querySelectorAll('.cat-claimed').length);
  // the pointer leaves the document entirely, mid-telegraph
  await page.evaluate(() =>
    document.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, relatedTarget: null })),
  );
  await page.waitForTimeout(TELEGRAPH_MS + LEAP_MS + 250);
  const after = await page.evaluate(() => document.querySelectorAll('.cat-claimed').length);
  ok('a pointer that left the window cannot be caught', after <= before, `${before} → ${after}`);
  await ctx.close();
}

// ---- 5. the cat stays inside the room, and the room stays the same size
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await press(page);
  await page.waitForTimeout(120);

  const samples = [];
  for (const [x, y] of [
    [4, 4],
    [1276, 6],
    [1278, 894],
    [2, 890],
    [640, 450],
  ]) {
    await page.mouse.move(x, y);
    await page.waitForTimeout(700);
    samples.push(
      await page.evaluate(() => {
        const r = document.getElementById('site-cat').getBoundingClientRect();
        const de = document.documentElement;
        return {
          inside: r.left >= -1 && r.top >= -1 && r.right <= de.clientWidth + 1 && r.bottom <= de.clientHeight + 1,
          hscroll: de.scrollWidth - de.clientWidth,
        };
      }),
    );
  }
  ok(
    'the cat never leaves the viewport, even chasing a cursor into a corner',
    samples.every((s) => s.inside),
    `${samples.filter((s) => s.inside).length}/${samples.length} samples inside`,
  );
  ok(
    'and never widens the page',
    samples.every((s) => s.hscroll === 0),
    samples.map((s) => s.hscroll).join(','),
  );
  await ctx.close();
}

// ---- 6. a fight is winnable: flee, then scrub where the cat isn't
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await press(page);
  await page.waitForTimeout(150);
  // Not a siege: its board regrows on a timer, so "did holding still win ground" measures the
  // race between you and the regrow rather than the loop this check is about.
  await fighter(page, ['ambush', 'trickster']);
  const start = await page.evaluate(() => document.querySelectorAll('.cat-claimed').length);

  // the loop the design predicts: pick a claim far from the cat, hold it, and move
  // on before the cat arrives
  for (let round = 0; round < 6; round++) {
    const spot = await page.evaluate(() => {
      const cat = document.getElementById('site-cat').getBoundingClientRect();
      const cx = cat.left + cat.width / 2;
      const cy = cat.top + cat.height / 2;
      const claims = [...document.querySelectorAll('.cat-claimed')]
        .map((c) => {
          const r = c.getBoundingClientRect();
          return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), r };
        })
        .filter((c) => c.r.top > 150 && c.r.bottom < innerHeight - 40);
      claims.sort(
        (a, b) => Math.hypot(b.x - cx, b.y - cy) - Math.hypot(a.x - cx, a.y - cy),
      );
      return claims[0] ?? null;
    });
    if (!spot) break;
    await page.mouse.move(spot.x, spot.y);
    await page.waitForTimeout(SCRUB_MS + 260);
  }
  const end = await page.evaluate(() => document.querySelectorAll('.cat-claimed').length);
  ok(
    'fleeing to a far claim and holding still wins ground',
    end < start,
    `${start} claims → ${end} after six rounds`,
  );
  await ctx.close();
}

await browser.close();
if (!done()) process.exit(1);
