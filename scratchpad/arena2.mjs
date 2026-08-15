/**
 * Build step 2: the Pounce — on the card game (2.2). Checked against a real browser and a
 * real clock.
 *
 * The claims that matter here are all about *time*: the telegraph must be long enough to
 * react to, the leap must never start before it is over, and a whiff must cost the cat a
 * window. So this harness records phase changes with timestamps via a MutationObserver and
 * asserts on the intervals rather than on end states.
 *
 * 2.2: the boss is the card's own sprite (`[data-boss]`, phases in its `dataset.phase`),
 * claims are `.cat-tile[data-state="claimed"]`, and the "room" is the card's board — the
 * boss never leaves it, just as the page cat never left the viewport. Durations are
 * unchanged by the card scale; distances are not (CARD_* constants).
 */
const TELEGRAPH_MS = 420;
const LEAP_MS = 260;
const RECOVER_MS = 700;
const HIT_RADIUS = 46;
const OPENING_GRACE_MS = 2500;
const SCRUB_MS = 1400;
/** Stance multipliers on the telegraph — mirrors STANCES in src/lib/arena.ts. */
const TELEGRAPH_MUL = { ambush: 0.78, siege: 1, trickster: 1.1, sleepy: 1.6 };

import {
  BASE,
  CARD_HIT_RADIUS,
  CARD_POUNCE_RANGE,
  deal,
  fresh as context,
  launch,
  press,
  release,
  report,
  wants,
} from './lib/fixture.mjs';

const browser = await launch();
const { ok, note, fixture, done } = report();

/** A desktop context playing **manual mode** — every check here is about what a *pointer* does. */
const fresh = (opts = {}) => context(browser, { mode: 'manual', ...opts });

/** Records every phase change on the boss, with a timestamp. */
const RECORDER = () => {
  const root = document.querySelector('[data-boss]');
  window.__phases = [];
  const phase = () => root?.dataset.phase ?? 'off';
  let seen = phase();
  window.__phases.push({ phase: seen, t: performance.now() });
  window.__ringLow = -1;
  new MutationObserver(() => {
    const p = phase();
    if (p !== seen) {
      seen = p;
      window.__phases.push({ phase: p, t: performance.now() });
      // How empty does the scrub progress get once a pounce lands? A reset shows as the
      // tile's --scrub going back to zero; a *trimmed* hold would not.
      if (p === 'recover' && window.__ringLow < 0) {
        window.__ringLow = 0;
        const until = performance.now() + 260;
        const sample = () => {
          const t = document.querySelector('.cat-tile[data-state="scrubbing"]');
          const v = t ? Number(t.style.getPropertyValue('--scrub') || 0) : 0;
          if (v > window.__ringLow) window.__ringLow = v;
          if (performance.now() < until) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }
    }
  }).observe(root, { attributes: true, attributeFilter: ['data-phase'] });
};

const bossCentre = () =>
  page.evaluate(() => {
    const r = document.querySelector('[data-boss]')?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: -1, y: -1 };
  });

/**
 * Walk the boss to the cursor without letting a scrub finish, and only report it arrived
 * once it can actually pounce.
 *
 * Nudging by more than the still-tolerance resets the hold every step, so progress never
 * reaches 1 while the boss crosses the board — which is how the cursor can be parked on a
 * claim *and* have the boss arrive, the state a pounce needs. Two conditions land together,
 * in the page's clock: the boss inside pounce range **and** the opening grace over. A boss
 * that converges fast is still inside OPENING_GRACE_MS, where it provably cannot pounce —
 * the hold would reclaim the tile silently (a scrub is 1400ms against a 2500ms grace) and
 * the telegraph this file waits on never comes (§4's timeout flake). A missing
 * `data-openedAt` tell is a reported fixture, not a flake.
 */
async function lureCat(page, target, within = 18, budgetMs = 12000) {
  const started = Date.now();
  let flip = 1;
  while (Date.now() - started < budgetMs) {
    await page.mouse.move(target.x + flip * 9, target.y);
    flip = -flip;
    await page.waitForTimeout(60);
    const d = await page.evaluate(
      ([tx, ty, w, grace]) => {
        const r = document.querySelector('[data-boss]')?.getBoundingClientRect();
        if (!r) return -1;
        const dist = Math.hypot(r.left + r.width / 2 - tx, r.top + r.height / 2 - ty);
        const raw = document.querySelector('[data-boss]')?.dataset.openedAt;
        if (raw === undefined) return -1;
        const openedAt = Number(raw);
        return dist <= w && performance.now() - openedAt > grace ? dist : -1;
      },
      [target.x, target.y, within, OPENING_GRACE_MS],
    );
    if (d > 0) return d;
  }
  return -1;
}

/** A claimed tile on the board the pointer can actually sit on. */
const IN_VIEW = () =>
  [...document.querySelectorAll('.cat-tile[data-state="claimed"]')]
    .map((c) => {
      const r = c.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), r };
    })
    .filter((c) => c.r.height < 200).length;

/**
 * The fight this file needs: an **ambush** cat, and a claimed tile on the board.
 * A sleepy cat stalks at 0.55x and never pounces from a distance; a siege cat cannot leave
 * the floor. This file measures the pounce, so it pins the one stance that always throws one.
 */
const fighter = (page, want = ['ambush']) =>
  deal(page, wants.stance(want, { claims: 'inView' }), { deals: 40, settle: 180 });

/** A claimed tile to fight over, preferring one the boss can reach quickly. */
const pickTarget = () =>
  (() => {
    const b = document.querySelector('[data-board]').getBoundingClientRect();
    const boss = document.querySelector('[data-boss]')?.getBoundingClientRect();
    const cx = boss ? boss.left + boss.width / 2 : b.left;
    const cy = boss ? boss.top + boss.height / 2 : b.top;
    const claims = [...document.querySelectorAll('.cat-tile[data-state="claimed"]')]
      .map((c) => {
        const r = c.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), r };
      })
      .filter((c) => c.r.bottom < b.bottom - 6 && c.r.top > b.top + 6);
    claims.sort((a, z) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(z.x - cx, z.y - cy));
    return claims[0] ?? null;
  })();

// ---- 1. the card owns its own boss: the ambient cat keeps walking untouched
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(700);

  const walkingBefore = await page.evaluate(async () => {
    const a = document.getElementById('site-cat').getBoundingClientRect().left;
    await new Promise((r) => setTimeout(r, 700));
    return Math.abs(document.getElementById('site-cat').getBoundingClientRect().left - a);
  });
  ok('the ambient cat walks on its own before a fight', walkingBefore > 1, `${walkingBefore.toFixed(1)}px`);

  await press(page);
  await page.waitForTimeout(200);
  await fighter(page);
  ok(
    'opening the card does not take the ambient cat over',
    await page.evaluate(() => !document.getElementById('site-cat').classList.contains('boss')),
  );
  ok(
    'and the card has its own boss sprite',
    await page.evaluate(() => !!document.querySelector('[data-boss]')),
  );

  // the card's boss stalks: park the pointer on the board and watch the distance close
  const boardMid = await page.evaluate(() => {
    const b = document.querySelector('[data-board]').getBoundingClientRect();
    return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) };
  });
  await page.mouse.move(boardMid.x, boardMid.y);
  await page.waitForTimeout(300);
  const closed = await page.evaluate(async ([mx, my]) => {
    const d = () => {
      const r = document.querySelector('[data-boss]')?.getBoundingClientRect();
      if (!r) return Infinity;
      return Math.hypot(r.left + r.width / 2 - mx, r.top + r.height / 2 - my);
    };
    const before = d();
    await new Promise((r) => setTimeout(r, 900));
    return { before, after: d() };
  }, [boardMid.x, boardMid.y]);
  ok(
    'it stalks the cursor across the board',
    closed.after < closed.before - 15,
    `${closed.before.toFixed(0)}px → ${closed.after.toFixed(0)}px`,
  );

  await release(page);
  await page.waitForTimeout(200);
  ok(
    'a truce hands the card back to collapsed',
    await page.evaluate(() => document.querySelector('#cat-card-panel').hidden),
  );
  const walkingAfter = await page.evaluate(async () => {
    const a = document.getElementById('site-cat').getBoundingClientRect().left;
    await new Promise((r) => setTimeout(r, 900));
    return Math.abs(document.getElementById('site-cat').getBoundingClientRect().left - a);
  });
  ok('and the ambient cat still walks afterwards', walkingAfter > 1, `${walkingAfter.toFixed(1)}px`);
  ok('no console errors across an open-close', errors.length === 0, errors.join(' | '));
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
  await page.waitForTimeout(200);
  const foe = (await fighter(page)).value;
  await page.evaluate(RECORDER);
  // The game's own open time, not a `performance.now()` read here — a read here sits ~200ms
  // after the click (the waitForTimeout below + the deal), which under-measures the opening
  // grace by that offset and flakes the check. `dataset.openedAt` is the game's clock at the
  // moment `startFight` ran, so `tele.t - openedAt` is the true elapsed time.
  //
  // Read with no fallback, deliberately. `... || performance.now()` was the first shape here,
  // and a fallback to `performance.now()` is a fallback to *the exact measurement this line
  // exists to replace* — so a renamed or dropped tell would not go red, it would quietly go
  // back to flaking. The hygiene test cannot catch this one: `tests/harness-hygiene.test.ts`
  // records that the `x || fallback` shape was tried and dropped for flagging four correct
  // sites, so the call site has to hold the rule itself. A missing tell is a missing fixture.
  const openedAt = await page.evaluate(() => {
    const raw = document.querySelector('[data-boss]')?.dataset.openedAt;
    return raw === undefined ? null : Number(raw);
  });
  fixture(
    "the boss carries the game's open time",
    Number.isFinite(openedAt),
    openedAt === null ? 'no data-openedAt on [data-boss]' : `openedAt=${openedAt.toFixed(0)}`,
  );

  fixture('the board offers a claimed tile and a cat that fights', await fighter(page));
  const targetDeal = await deal(page, (p) => p.evaluate(pickTarget), { deals: 6, settle: 180 });
  const target = targetDeal.value;
  fixture('found a claimed tile to fight over', targetDeal, target ? `at ${target.x},${target.y}` : '');

  const dist = await lureCat(page, target, 18);
  ok('the boss closes on a parked cursor', dist > 0, `${dist.toFixed(0)}px away`);

  // now hold perfectly still: progress climbs, and past 0.35 the boss commits
  await page.mouse.move(target.x, target.y);
  await page.waitForTimeout(2200);

  const log = await page.evaluate(() => window.__phases);
  const tele = log.find((p) => p.phase === 'telegraph');
  const leap = log.find((p) => p.phase === 'leap');
  const rec = log.find((p) => p.phase === 'recover');
  ok('holding still provokes a pounce', !!tele && !!leap, log.map((p) => p.phase).join('→'));
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
  fixture('the pinned cat telegraphed at all', tele, tele ? `at +${(tele.t - openedAt).toFixed(0)}ms` : '');
  if (tele) {
    ok(
      'nothing pounces during the opening grace',
      tele.t - openedAt >= OPENING_GRACE_MS - 60,
      `first telegraph at +${(tele.t - openedAt).toFixed(0)}ms`,
    );
  }

  // A landed pounce costs the hold: the tile's --scrub resets to zero, not trimmed.
  const worst = await page.evaluate(() => window.__ringLow ?? -1);
  ok(
    'a landed pounce resets the hold rather than trimming it',
    worst < 0.5,
    `scrub left at ${(worst * 100).toFixed(0)}% after the hit`,
  );
  ok('no errors through a pounce', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---- 2b. a landed pounce takes a tile back
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await press(page);
  await page.waitForTimeout(200);
  await fighter(page);
  await page.evaluate(RECORDER);

  // bank one claim somewhere the boss is not, so there is something to lose
  fixture('the board offers a claimed tile and a cat that fights', await fighter(page));
  const far = await page.evaluate(() => {
    const b = document.querySelector('[data-board]').getBoundingClientRect();
    const boss = document.querySelector('[data-boss]')?.getBoundingClientRect();
    const cx = boss ? boss.left + boss.width / 2 : b.left;
    const cy = boss ? boss.top + boss.height / 2 : b.top;
    const claims = [...document.querySelectorAll('.cat-tile[data-state="claimed"]')]
      .map((c) => {
        const r = c.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), r };
      })
      .filter((c) => c.r.bottom < b.bottom - 6 && c.r.top > b.top + 6);
    claims.sort((a, z) => Math.hypot(z.x - cx, z.y - cy) - Math.hypot(a.x - cx, a.y - cy));
    return claims[0] ?? null;
  });
  await page.mouse.move(far.x, far.y);
  await page.waitForTimeout(SCRUB_MS + 300);
  const banked = await page.evaluate(() => document.querySelectorAll('.cat-tile[data-state="claimed"]').length);

  // now get caught
  await fighter(page);
  const target = await page.evaluate(pickTarget);
  await lureCat(page, target, 18);
  const banked2 = await page.evaluate(() => document.querySelectorAll('.cat-tile[data-state="claimed"]').length);
  /*
   * Wait for a pounce that **landed**, not merely for one that happened: `recover` follows
   * every leap, hit or miss. Offer it several holds and wait for the ground to move.
   */
  let after = null;
  for (let attempt = 0; attempt < 4 && !after; attempt++) {
    const mark = await page.evaluate(() => window.__phases.length);
    await page.mouse.move(target.x + (attempt % 2 ? 1 : 0), target.y);
    const landed = await page
      .waitForFunction(
        ([from, n]) =>
          window.__phases.slice(from).some((p) => p.phase === 'recover') &&
          document.querySelectorAll('.cat-tile[data-state="claimed"]').length !== n,
        [mark, banked2],
        { timeout: 9000 },
      )
      .then(() => true)
      .catch(() => false);
    if (!landed) continue;
    await page.waitForTimeout(120);
    after = await page.evaluate(() => ({
      claims: document.querySelectorAll('.cat-tile[data-state="claimed"]').length,
    }));
  }
  after ??= { claims: -1 };
  ok(
    'a landed pounce takes back the thing you just earned',
    after.claims === banked2 + 1,
    `${banked2} claims → ${after.claims}`,
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
  await page.waitForTimeout(200);
  // Ambush only here. A trickster bluffs about a third of its wind-ups, and a bluff has no
  // leap and no landing — so a check that waits for the cat to touch down waits forever, for
  // a reason that is the trickster working correctly.
  const foe = (await fighter(page, ['ambush'])).value;
  fixture('pinned an ambush for the dodge', foe, foe ?? '');
  // RECORDER after the final deal: a re-deal reopens the card and the boss element is
  // re-created, so a recorder installed before it observes a detached node and records
  // nothing (the waits then time out and the windowing measures nothing).
  await page.evaluate(RECORDER);
  const target = await page.evaluate(pickTarget);
  await lureCat(page, target, 18);
  await page.mouse.move(target.x, target.y);

  // Wait for the telegraph, then move away (the dodge the design intends).
  await page.waitForFunction(() => window.__phases.some((p) => p.phase === 'telegraph'), undefined, {
    timeout: 8000,
  });
  const claimsBefore = await page.evaluate(() => document.querySelectorAll('.cat-tile[data-state="claimed"]').length);
  await page.mouse.move(target.x + 90, target.y + 60);
  await page.waitForFunction(() => window.__phases.some((p) => p.phase === 'recover'), undefined, {
    timeout: 6000,
  });
  await page.waitForTimeout(80);

  const landed = await page.evaluate(() => {
    const r = document.querySelector('[data-boss]')?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: -1, y: -1 };
  });
  const missBy = Math.hypot(landed.x - (target.x + 90), landed.y - (target.y + 60));
  ok(
    'the cat lands where it aimed, not where you went',
    missBy > CARD_HIT_RADIUS,
    `${missBy.toFixed(0)}px from the dodged-to point (hit radius ${CARD_HIT_RADIUS.toFixed(0)}px)`,
  );
  /*
   * A dodged pounce takes nothing back — asserted on the *held tile*, not the global
   * count. The global count cannot isolate the pounce: ambush regrows on its own 15s
   * clock, and a fight whose lure ran ~14s crosses it exactly when the dodge lands —
   * measured `5 → 6` on a miss that provably took nothing (aim check above). The held
   * tile is the pounce's target; if the miss is real, that tile is still claimed
   * whether or not a regrow added a different one.
   */
  const heldStill = await page.evaluate(
    ([x, y]) => !!document.elementFromPoint(x, y)?.closest('.cat-tile[data-state="claimed"]'),
    [target.x, target.y],
  );
  ok('a dodged pounce takes nothing back', heldStill, `held tile at ${target.x},${target.y}: ${heldStill ? 'still claimed' : 'taken'}`);

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

// ---- 4. leaving the board mid-leap is a whiff, never a hit
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await press(page);
  await page.waitForTimeout(200);
  const foe = (await fighter(page)).value;
  fixture('pinned a fighter for the leave-the-board check', foe, foe ?? '');
  // RECORDER after the final deal — see section 3's note.
  await page.evaluate(RECORDER);
  const target = await page.evaluate(pickTarget);
  await lureCat(page, target, 18);
  await page.mouse.move(target.x, target.y);
  await page.waitForFunction(() => window.__phases.some((p) => p.phase === 'telegraph'), undefined, {
    timeout: 8000,
  });
  const before = await page.evaluate(() => document.querySelectorAll('.cat-tile[data-state="claimed"]').length);
  // the pointer leaves the board entirely, mid-telegraph
  await page.mouse.move(30, 30);
  await page.waitForTimeout(TELEGRAPH_MS + LEAP_MS + 250);
  /*
   * Same isolation as section 3: assert on the *held tile* (the pounce's target), not
   * the global count. A pointer that left the board cannot be caught, so the tile the
   * boss was aimed at must still be claimed — whether or not ambush's 15s regrow clock
   * fired somewhere else in the same moment.
   */
  const heldStill = await page.evaluate(
    ([x, y]) => !!document.elementFromPoint(x, y)?.closest('.cat-tile[data-state="claimed"]'),
    [target.x, target.y],
  );
  ok('a pointer that left the board cannot be caught', heldStill, `held tile: ${heldStill ? 'still claimed' : 'taken'}`);
  await ctx.close();
}

// ---- 5. the boss stays inside the card's board, and the board never widens the page
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await press(page);
  await page.waitForTimeout(200);

  const samples = [];
  const spots = await page.evaluate(() => {
    const b = document.querySelector('[data-board]').getBoundingClientRect();
    return [
      { x: b.left + 4, y: b.top + 4 },
      { x: b.right - 4, y: b.top + 4 },
      { x: b.right - 4, y: b.bottom - 4 },
      { x: b.left + 4, y: b.bottom - 4 },
      { x: b.left + b.width / 2, y: b.top + b.height / 2 },
    ];
  });
  for (const [x, y] of spots.map((s) => [s.x, s.y])) {
    await page.mouse.move(x, y);
    await page.waitForTimeout(700);
    samples.push(
      await page.evaluate(() => {
        const r = document.querySelector('[data-boss]')?.getBoundingClientRect();
        const b = document.querySelector('[data-board]').getBoundingClientRect();
        const de = document.documentElement;
        return {
          inside: !!r && r.left >= b.left - 1 && r.top >= b.top - 1 && r.right <= b.right + 1 && r.bottom <= b.bottom + 1,
          hscroll: de.scrollWidth - de.clientWidth,
        };
      }),
    );
  }
  ok(
    'the boss never leaves the board, even chasing a cursor into a corner',
    samples.every((s) => s.inside),
    `${samples.filter((s) => s.inside).length}/${samples.length} samples inside`,
  );
  ok(
    'and the card never widens the page',
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
  await page.waitForTimeout(200);
  // Not a siege: its board regrows on a timer, so "did holding still win ground" measures the
  // race between you and the regrow rather than the loop this check is about.
  await fighter(page, ['ambush', 'trickster']);
  const start = await page.evaluate(() => document.querySelectorAll('.cat-tile[data-state="claimed"]').length);

  // the loop the design predicts: pick a claim far from the boss, hold it, and move
  // on before the boss arrives
  for (let round = 0; round < 6; round++) {
    const spot = await page.evaluate(() => {
      const b = document.querySelector('[data-board]').getBoundingClientRect();
      const boss = document.querySelector('[data-boss]')?.getBoundingClientRect();
      const cx = boss ? boss.left + boss.width / 2 : b.left;
      const cy = boss ? boss.top + boss.height / 2 : b.top;
      const claims = [...document.querySelectorAll('.cat-tile[data-state="claimed"]')]
        .map((c) => {
          const r = c.getBoundingClientRect();
          return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), r };
        })
        .filter((c) => c.r.bottom < b.bottom - 6 && c.r.top > b.top + 6);
      claims.sort(
        (a, z) => Math.hypot(z.x - cx, z.y - cy) - Math.hypot(a.x - cx, a.y - cy),
      );
      return claims[0] ?? null;
    });
    if (!spot) break;
    await page.mouse.move(spot.x, spot.y);
    await page.waitForTimeout(SCRUB_MS + 260);
  }
  const end = await page.evaluate(() => document.querySelectorAll('.cat-tile[data-state="claimed"]').length);
  ok(
    'fleeing to a far claim and holding still wins ground',
    end < start,
    `${start} claims → ${end} after six rounds`,
  );
  await ctx.close();
}

await browser.close();
if (!done()) process.exit(1);
