/**
 * The fleet's shared strategy — one copy of everything sixteen harnesses were each solving alone.
 *
 * ## Why this file exists
 *
 * 2.0's ship gate produced three harness failures in one afternoon, and all three were the same
 * mistake: **a check asserting on the fixture a random roll handed it, instead of on what the build
 * does.** `commander.mjs` aimed an order at the claim furthest from the squad, which on some boards
 * is a claim inside a link, so the click navigated and the fight ended — reported as "nobody arrived
 * in 8s". `arena8` §2 and `top-state` measured the lure strategy against an unpinned stance, which
 * plateaus against siege by design. `touch-fight` asserted "some claim on this board sits inside a
 * link" and skipped five checks on the deal that had none.
 *
 * Each was fixed where it was found, and each fix was already present elsewhere in the fleet:
 * `pickSpot` re-dealt six times, `forceStance` re-rolled a hundred and twenty fights, `arena.mjs`
 * re-rolled stance and placement together. The fleet knew the answer three times over and had no way
 * to propagate it, because `fresh` existed in eleven copies, `forceFighter`/`forceStance` in four
 * with three different budgets, `place`, `throwSpot` and `lureCat` in three each. §12's own lesson
 * says it: **a fault in a shared strategy fixed at one call site is not fixed.** There was no shared
 * strategy to fix. This is it.
 *
 * ## The rule this module encodes
 *
 * Two kinds of statement, and they must not be confused:
 *
 * - **A fixture** is what a harness needs before it can measure anything: a board with a claim in
 *   view, a stance that leaps, a claim inside a link, treats in hand. Fixtures come from rolls —
 *   `pickClaims` seeds from the clock and every fight rolls a stance — so a harness **re-rolls until
 *   it gets one, and reports which attempt it took**. Running out of attempts is a failure of the
 *   *harness*, and prints as `FIXTURE` so it can never be mistaken for the game misbehaving.
 * - **An assertion** is what the build does with that fixture. It is never retried, never softened,
 *   never re-rolled. `SAFE_WORK_PX`, the byte-identical restore, "a hit takes tempo and never
 *   ground" — those stand or fall on the first look.
 *
 * The boundary is the whole point, because the opposite mistake is worse than the one being fixed: a
 * suite loosened until it stays green is worse than a red one. Re-rolling a *fixture* is not
 * weakening a check. Re-running an *assertion* until it passes would be, and nothing here does that.
 *
 * ## Conventions this file is the single home for
 *
 * - **`bounded()` puts Playwright's options in the third argument.** 1.4 found all twenty-two call
 *   sites in the fleet passing `{ timeout }` in the *second* slot, where it silently becomes the page
 *   function's argument: a wait asking for 4000ms measured 30104ms, and twenty of those seconds
 *   belong to §11's idle truce, so an over-running wait ended the fight it was waiting on.
 * - **Every wait is on an observable, never on a stopwatch.** There is a ~1.9s ink curtain between
 *   the toggle and the fight (§13), and `aria-pressed` follows the visitor's *intent* rather than the
 *   arena's state, so "the button says off" and "the page is restored" are different moments.
 * - **Mode is declared before a fight is opened.** Commander mode is 2.0's default; a manual-mode
 *   harness that does not say so is asking a spectator to hold a pointer still.
 * - **Snapshots keep their own exclusion list.** `snapshotOf()` takes one rather than defaulting,
 *   because the list is the load-bearing part of pillar 2's check and the correct list differs per
 *   harness: `#cat-ribbon` legitimately keeps a line after a truce (§8.4), and `#cat-squad` only
 *   exists in commander mode.
 */
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

/* ------------------------------------------------------------------ *
 * Constants mirrored from src/lib — literals, so drift shows up as a failing check rather than as a
 * harness quietly measuring against a number the game no longer uses. One copy now, so a drift is
 * one edit instead of sixteen.
 * ------------------------------------------------------------------ */
export const SCRUB_MS = 1400; // src/lib/arena.ts:223
export const POUNCE_RANGE = 90; // :344
export const STALK_SPEED = 170; // :366
export const AGGRO_DESPERATE = 1.4; // :956
export const RECOVER_MS = 700; // :341
export const TELEGRAPH_MS = 420; // :317
export const LEAP_MS = 260; // :320
export const IDLE_TRUCE_MS = 20_000; // :1560
export const ROUND_BEAT_MS = 1500; // :920
export const INITIAL_CLAIM_FRACTION = 0.55; // :160
export const SIEGE_REGROW_MS = 9000; // §9.3's table

/** 1.0's measured counter-play distance: pounce range plus the cat's walk for the length of a hold. */
export const SAFE_FLEE_PX = POUNCE_RANGE + STALK_SPEED * AGGRO_DESPERATE * (SCRUB_MS / 1000); // 423px

export const KITTEN_SPEED = 250; // src/lib/squad.ts:80
export const ARRIVE_PX = 26; // :89
export const KITTEN_FLINCH_MS = 220; // :116
export const KITTEN_WORK_MS = 1000; // :142
export const KITTEN_CAP = 4; // :153
export const ROUND_REGROW_STEP = 0.82; // :341
export const ROUND_AGGRO_CAP = 1.35; // :377
export const WATCH_TRUCE_MS = 180_000; // :479
export const BEST_ROUND_KEY = 'cat-best-round'; // :502

/* §2.2's card scale: every distance constant on the card's board is the page value / 5,
 * while every duration is unchanged. Mirrored from src/lib/card.ts. */
export const CARD_SCALE = 1 / 5;
export const CARD_STALK_SPEED = STALK_SPEED * CARD_SCALE; // 34
export const CARD_KITTEN_SPEED = KITTEN_SPEED * CARD_SCALE; // 50
export const CARD_POUNCE_RANGE = POUNCE_RANGE * CARD_SCALE; // 18
export const CARD_HIT_RADIUS = 46 * CARD_SCALE; // ~9
export const CARD_SAFE_FLEE_PX = SAFE_FLEE_PX * CARD_SCALE; // ~85

/*
 * A `CARD_MERCY_BUDGET_MS` lived here briefly — the bored cat's walk across the board diagonal,
 * derived from stalk speed, `AGGRO_BORED` and the grooming it stops for, so `arena7` §1's mercy
 * timeout would move with `CARD_SCALE` instead of sitting frozen at `26000`.
 *
 * It is gone because the better fix was not a better budget. `d6b89a5` found that the check was
 * waiting on the wrong things twice over: its "claims changed" signal nets out on the card (a
 * hold flips its tile claimed→scrubbing while the last one clears back, so the count never
 * moves), and `parkableSpot` handed it the claim *furthest* from the boss — so the harness was
 * timing a board-length walk that its subject, "does a bored cat still answer a hold", never
 * needed. Holding the *nearest* claim and reading the telegraph alone bounds it by the regrow
 * clock (~12s measured) instead.
 *
 * Kept as a note because the lesson is not about cats: **deriving a number correctly is not the
 * same as needing the number.** The derivation was sound and measured within 1s of the literal
 * it replaced, and it was still modelling a wait the check should not have been doing.
 */

/** The same walk-and-hold arithmetic `squad.ts` proves, for a kitten rather than a hand. */
export const SAFE_WORK_PX = POUNCE_RANGE + STALK_SPEED * AGGRO_DESPERATE * (SCRUB_MS / 1000);

/* §16's invisible hand. Mirrored from src/lib/hand.ts, which states these in *card* px already —
 * the hand exists only on the card, so unlike every constant above there is no page figure to
 * scale down from, and no `CARD_` prefix to earn. */
export const SWIPE_MIN_SPEED = 240; // src/lib/hand.ts
export const SWIPE_RADIUS = 20;
export const IMPULSE_MS = 420;
export const IMPULSE_SPEED = 90;
export const SWIPE_COOLDOWN_MS = 460;
export const SHOVE_FOOTING = 0.35;
/** Derived there and here alike: ∫₀¹(1−t²)dt = ⅔, so travel is peak × ⅔ × duration. ~25px. */
export const IMPULSE_TRAVEL_PX = IMPULSE_SPEED * (2 / 3) * (IMPULSE_MS / 1000);

/** Mirrors `INTERACTIVE` in src/lib/arena.ts — and deliberately *not* `PROTECTED`. */
export const INTERACTIVE = 'a[href], button, input, select, textarea, summary, label, [contenteditable]';

export const BASE = process.env.BASE_URL ?? 'http://localhost:4416';

/* ------------------------------------------------------------------ *
 * Machine-state readers. Every assertion in the fleet reads one of these; none of them reads prose.
 * §12 has recorded the alternative often enough — a check that reads a caption is a check that passes
 * while the mechanic is broken.
 *
 * 2.2: these read the **card game** now. The page-board game is gone (§2.2's drop), so claims are
 * `.cat-tile[data-state="claimed"]`, the boss is `[data-boss]`, and the "arena on" question is
 * whether the card's panel is open.
 * ------------------------------------------------------------------ */
export const CLAIMS = `document.querySelectorAll('.cat-tile[data-state="claimed"]').length`;
export const FREED = `document.querySelectorAll('.cat-tile[data-state="unclaimed"]').length`;
export const AMMO = `document.querySelectorAll('#cat-score .cat-paw.got').length`;
export const FOUND = `document.querySelectorAll('#cat-score .cat-paw.got').length`;
export const ARMED = `!document.querySelector('#cat-card-panel').hidden`;
export const STANCE = `document.querySelector('[data-boss]')?.dataset.stance ?? ''`;
export const MOOD = `document.querySelector('[data-boss]')?.dataset.mood ?? ''`;
export const PHASE = `document.querySelector('[data-boss]')?.dataset.phase ?? ''`;
export const ROUND = `Number((document.querySelector('[data-round]')?.textContent ?? '0').replace(/\\D/g, '')) || 0`;
export const KITS = `document.querySelectorAll('.cat-card-kit').length`;
export const MINE = `parseFloat(document.querySelector('[data-territory]')?.style.getPropertyValue('--territory')) || 0`;
export const RIBBON = `(() => { const r = document.querySelector('[data-ribbon]'); return !r || r.hidden ? '' : r.textContent.trim(); })()`;

/**
 * The page as pillar 2 defines it: every element's tag, classes and inline style, in order.
 *
 * The exclusion list is an argument rather than a default on purpose — see the header. Pass the
 * cat's own overlays plus whatever this harness legitimately expects to differ.
 */
export const snapshotOf = (exclude) =>
  `(() => [...document.querySelectorAll('*')]
    .filter((el) => !el.closest(${JSON.stringify(exclude)}))
    .map((el, i) => i + ':' + el.tagName + ':' + el.className + ':' + (el.getAttribute('style') ?? '')))()`;

/**
 * How the page differs from a baseline, **and where**.
 *
 * A boolean "it differs" is a check that makes you write a second script to find out why, which is
 * exactly what happened twice. Reports the first difference.
 */
export async function snapDiff(page, snap, clean) {
  const now = await page.evaluate(snap);
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

/* ------------------------------------------------------------------ *
 * Browser, contexts, reporting
 * ------------------------------------------------------------------ */
/*
 * The union of every list the fleet had, so consolidating cannot make an environment worse. The
 * `PLAYWRIGHT_BROWSERS_PATH` entry was added in 1.4 for the cloud sessions this gate usually runs in —
 * without it a harness exits 2 before a single check, and an unrun gate in a sweep of green ones is the
 * quietest possible failure. The Windows paths came from `first-run.mjs`, the only file that had them.
 */
const CHROME = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  process.env.PLAYWRIGHT_BROWSERS_PATH ? `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium` : null,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean);

export async function launch(opts = {}) {
  const executablePath = CHROME.find((p) => existsSync(p));
  if (!executablePath) {
    console.error('No Chrome found. Set CHROME_PATH or install Chrome.');
    process.exit(2);
  }
  return chromium.launch({
    executablePath,
    headless: true,
    // Long harnesses (arena7's 5-page ammo run + multi-round fights) can exhaust
    // headless Chrome's default /dev/shm and kill the renderer mid-probe — measured as
    // "Page crashed" at the second commitLatencies call. These two flags are the standard
    // container fix and are harmless on a desktop. --mute-audio is for a different,
    // nastier crash: headless Chrome has no audio device, and enough rapid playCue() calls
    // (arena7's desperate tier fires telegraph/land/reclaim cues back-to-back) make the
    // WebAudio renderer throw "The AudioContext encountered an error from the audio device"
    // and take the whole renderer down. Audio synthesis is not what these harnesses verify,
    // so mute it rather than fight a device that is not there.
    args: ['--disable-dev-shm-usage', '--no-sandbox', '--mute-audio', '--disable-gpu'],
    ...opts,
  });
}

/**
 * 2.0: **say which game before opening one.** Commander mode is the default, so a harness measuring
 * §3's manual fight has to press the mode chip first or the pointer is not the verb and half its
 * checks are asking a spectator to hold still. Pressed the way a visitor presses it, and waited on
 * `aria-pressed` rather than on a timeout. 2.2: the chip lives in the card header now
 * (`#cat-card-mode`), not the page HUD.
 */
const PICK_MANUAL = () => {
  const pick = () => {
    const b = document.getElementById('cat-card-mode');
    if (!b) return false;
    if (b.getAttribute('aria-pressed') === 'true') return true;
    b.click();
    return b.getAttribute('aria-pressed') === 'true';
  };
  addEventListener('DOMContentLoaded', () => {
    if (pick()) return;
    const t = setInterval(() => {
      if (pick()) clearInterval(t);
    }, 40);
    setTimeout(() => clearInterval(t), 8000);
  });
};

/**
 * 2.5: **the hand is chosen before the page runs, not clicked afterwards.**
 *
 * There is no chip for `hand` mode and deliberately so — §16 is a prototype behind a flag, because
 * three modes on a portfolio is too much game. `CatCard` reads `?cat=hand` first and
 * `localStorage.cat-mode` second, and this uses the storage key rather than the query string for one
 * reason: a harness that navigates (`armAmmo` hops five pages to seed treats) would drop a query
 * param on the first hop and quietly measure commander mode while its name said otherwise. The key
 * survives every navigation in the context.
 *
 * Set at init rather than after load, since `mode` is read once when the card's script runs.
 */
const PICK_HAND = () => {
  try {
    localStorage.setItem('cat-mode', 'hand');
  } catch {
    /* DENY_STORAGE is a legitimate combination: the card then stays on commander, which is the
     * documented fallback, and a harness asserting the hand will fail loudly rather than silently. */
  }
};

/** A browser that refuses storage — private mode, a hardened profile, a policy. */
const DENY_STORAGE = () => {
  const boom = () => {
    throw new Error('storage denied');
  };
  Object.defineProperty(window, 'localStorage', {
    get: () => ({ getItem: boom, setItem: boom, removeItem: boom }),
  });
};

/**
 * Stub out WebAudio before any page script runs.
 *
 * Headless Chrome has no audio device, and enough rapid `playCue()` calls (arena7's
 * desperate tier fires telegraph/land/reclaim cues back-to-back) make the real
 * `AudioContext` throw "The AudioContext encountered an error from the audio device" and
 * take the whole renderer down mid-probe. `--mute-audio` is not enough — the context is
 * still created and still throws. The card's `audio()` already tolerates a missing
 * `AudioContext` (returns null, plays nothing), so giving it a stub that reports a state
 * and swallows every node method keeps the game running while the harness measures
 * behaviour, not sound. The stub is deliberately minimal: it must only satisfy the code
 * in `cat-sfx.ts` (`new AudioContext()`, `.state`, `.resume()`, `.currentTime`,
 * `.createOscillator/.createGain/.createBiquadFilter/.createBuffer`, `.destination`,
 * `.sampleRate`) and is replaced by the real thing on any normal desktop run.
 */
const NO_AUDIO = () => {
  const node = {
    connect: () => node,
    disconnect: () => {},
    start: () => {},
    stop: () => {},
    setValueAtTime: () => {},
    exponentialRampToValueAtTime: () => {},
    linearRampToValueAtTime: () => {},
  };
  const param = { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {}, linearRampToValueAtTime: () => {} };
  const stub = {
    state: 'running',
    currentTime: 0,
    sampleRate: 44100,
    destination: node,
    resume: () => Promise.resolve(),
    createOscillator: () => ({ ...node, type: 'sine', frequency: { ...param } }),
    createGain: () => ({ ...node, gain: { ...param } }),
    createBiquadFilter: () => ({ ...node, type: 'lowpass', frequency: { ...param } }),
    createBuffer: (_ch, len) => ({ getChannelData: () => new Float32Array(len) }),
    createBufferSource: () => ({ ...node, buffer: null }),
  };
  Object.defineProperty(window, 'AudioContext', { value: function () { return stub; }, writable: true });
  Object.defineProperty(window, 'webkitAudioContext', { value: undefined, writable: true });
};

/**
 * A context with the welcome dismissed and the mode declared.
 *
 * @param mode     'manual' presses §13.8's chip before any fight; 'hand' sets §16's flag, which has
 *                 no chip to press; 'commander' (default) leaves 2.0's default alone. Passing
 *                 nothing means commander, because that is what a visitor gets.
 * @param storage  false installs a `localStorage` that throws, for §13.4's boundary.
 * @param phone    the 390×844 touch profile `touch-fight` measures on.
 */
export async function fresh(browser, { mode = 'commander', storage = true, phone = false, welcomed = true, ...ctxOpts } = {}) {
  const ctx = await browser.newContext({
    viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 900 },
    ...(phone ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}),
    ...ctxOpts,
  });
  if (welcomed) await ctx.addInitScript(() => localStorage.setItem('welcomed', '1'));
  await ctx.addInitScript(NO_AUDIO);
  if (mode === 'manual') await ctx.addInitScript(PICK_MANUAL);
  if (mode === 'hand') await ctx.addInitScript(PICK_HAND);
  if (!storage) await ctx.addInitScript(DENY_STORAGE);
  return ctx;
}

/**
 * Wait for the card's open animation to settle before measuring anything about it.
 *
 * `panel.waitFor({ state: 'visible' })` fires the moment `hidden` drops, but the panel then runs
 * `cat-card-open` (0.18s, `scale(0.86) → scale(1)`), and `boundingBox()` includes the transform —
 * so a read inside that window reports 320 × 0.86 ≈ 275 and "the card is ~320px wide" fails on a
 * card that is exactly 320px wide.
 *
 * Shared rather than kept where it was found. `card-check` had it; `card-mechanics` cleared the
 * same race with a bare `waitForTimeout(500)`, which works only for as long as nobody makes the
 * animation slower — a magic sleep is this fault waiting to come back. §12.1: one strategy, one
 * copy. A `waitForFunction` also returns the instant it settles instead of always paying 500ms.
 */
export async function waitOpen(page, { timeout = 3000, settle = 50 } = {}) {
  await page
    .waitForFunction(
      () => {
        const el = document.querySelector('#cat-card-panel');
        if (!el || el.hidden) return false;
        const t = getComputedStyle(el).transform;
        return t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)';
      },
      undefined,
      { timeout },
    )
    .catch(() => {});
  await page.waitForTimeout(settle);
}

/**
 * The reporter, with the fixture/assertion split built in.
 *
 * `ok` is an assertion: one look, pass or fail. `fixture` takes what `deal()` returned and reports
 * **which attempt produced it**, so intermittency becomes a number in the log rather than a red that
 * appears once a fortnight. A missing fixture prints `FIXTURE`, not `FAIL`, because the game is not
 * what failed — but it still counts, and it still sets the exit code, since a harness that could not
 * set itself up measured nothing.
 */
export function report() {
  const results = [];
  const ok = (name, pass, detail = '') => {
    results.push({ name, pass, detail, kind: 'check' });
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
    return pass;
  };
  const note = (s) => console.log(`      · ${s}`);
  const fixture = (name, dealt, detail = '') => {
    const got = dealt && typeof dealt === 'object' && 'value' in dealt ? dealt.value : dealt;
    const pass = got !== null && got !== undefined && got !== false;
    const where = dealt && typeof dealt === 'object' && 'deal' in dealt
      ? pass
        ? `on deal ${dealt.deal} of ${dealt.deals}`
        : `no deal in ${dealt.deals} offered one`
      : '';
    const bits = [detail, where].filter(Boolean).join(', ');
    results.push({ name, pass, detail: bits, kind: 'fixture' });
    console.log(`${pass ? 'PASS' : 'FIXTURE'}  ${name}${bits ? '  — ' + bits : ''}`);
    return pass;
  };
  const done = () => {
    const bad = results.filter((r) => !r.pass);
    console.log(`\n${results.length - bad.length}/${results.length} checks passed`);
    if (bad.length) {
      console.log('failed:');
      for (const r of bad) console.log(`  - [${r.kind}] ${r.name}${r.detail ? '  — ' + r.detail : ''}`);
    }
    return bad.length === 0;
  };
  return { ok, note, fixture, done, results };
}

/** Playwright's options in the **third** argument, which is the only place it reads them. */
export const bounded = (page, fn, ms, arg = undefined) =>
  page.waitForFunction(fn, arg, { timeout: ms }).then(
    () => true,
    () => false,
  );

/* ------------------------------------------------------------------ *
 * Opening, closing, and re-dealing a fight
 * ------------------------------------------------------------------ */

/**
 * Press the toggle and wait for the state change to have **landed**.
 *
 * 2.2: the toggle is the collapsed card icon and the fight opens immediately — there is no ink
 * curtain to wait through. What "landed" looks like is the panel visible with tiles dealt.
 */
export async function press(page, { timeout = 7000, tap = false } = {}) {
  const was = await page.evaluate(() => !document.querySelector('#cat-card-panel').hidden);
  if (tap) await page.locator('#cat-card-toggle').tap();
  else await page.click('#cat-card-toggle');
  await page.waitForFunction(
    (w) => (!document.querySelector('#cat-card-panel').hidden) !== w,
    was,
    { timeout },
  ).catch(() => {});
}

/**
 * End the fight and wait for the card to actually be back.
 *
 * Escape closes the card (the card's own truce). On a phone there is no Escape key, so the
 * close button is the way out.
 */
export async function release(page, { timeout = 8000, tap = false } = {}) {
  if (tap) await page.locator('#cat-card-close').tap();
  else await page.keyboard.press('Escape');
  await page
    .waitForFunction(() => document.querySelector('#cat-card-panel').hidden, undefined, { timeout })
    .catch(() => {});
}

/** Both halves: the board gone *and* the panel hidden. */
export async function overFor(page, ms = 8000) {
  await page
    .waitForFunction(
      () => document.querySelector('#cat-card-panel').hidden && !document.querySelectorAll('.cat-tile').length,
      undefined,
      { timeout: ms },
    )
    .catch(() => {});
  await page.waitForTimeout(120);
}

/**
 * **Deal again rather than assert the deal.** This is the fix the whole module exists for.
 *
 * `want(page)` returns the fixture or null. If it is null, the fight is closed and re-opened — a
 * fresh seed, a fresh stance, a fresh board — up to `deals` times. Returns
 * `{ value, deal, deals }`, and `report().fixture` prints which attempt it took.
 *
 * **One loop, all predicates.** `arena4`'s `forceFighter` learned this the expensive way and left the
 * note: separate helpers that each re-roll the fight spend their time undoing each other. So a
 * harness that needs a leaping cat *and* a claim in view asks for both in one `want` — `wants.all`
 * composes them — instead of calling two re-rollers in sequence.
 *
 * Six deals is the default because it is what `pickSpot` used and what the one measured case needed
 * (touch-fight's link-wrapped claim arrived on deal 2). A fixture that needs more than six is
 * probably not a fixture but a claim about the page's content, and belongs in a unit test.
 */
export async function deal(page, want, { deals = 6, settle = 220, tap = false, reopen } = {}) {
  const again =
    reopen ??
    (async () => {
      await release(page, { tap });
      await press(page, { tap });
    });
  for (let i = 1; i <= deals; i++) {
    const value = await want(page);
    if (value !== null && value !== undefined && value !== false) return { value, deal: i, deals };
    if (i < deals) {
      await again();
      await page.waitForTimeout(settle);
    }
  }
  return { value: null, deal: deals, deals };
}

/* ------------------------------------------------------------------ *
 * What harnesses ask a deal for
 *
 * Each is a function of `page` returning the fixture or null, so it can be handed to `deal()` or
 * called once on its own when the caller genuinely wants a single look.
 * ------------------------------------------------------------------ */
export const wants = {
  /**
   * A claimed tile the pointer can sit on: on the card's board, clear of the boss's strip,
   * and not so small its centre is nowhere near it. Card-relative, so no scrolling is needed —
   * §2.2's whole point.
   */
  spot:
    () =>
    (page) =>
      page.evaluate(() => {
        const b = document.querySelector('[data-board]')?.getBoundingClientRect();
        if (!b) return null;
        const r = [...document.querySelectorAll('.cat-tile[data-state="claimed"]')]
          .map((n) => n.getBoundingClientRect())
          .filter((c) => c.top > b.top + 6 && c.bottom < b.bottom - 6)[0];
        return r ? { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) } : null;
      }),

  /**
   * A stance from `list`, and by default a claim **on the board** to use it against.
   *
   * Both in one look because §9.3's stances are not interchangeable opponents: a **sleepy** cat will
   * not interrupt a hold at all, and a **siege** cat cannot reach anything off the floor. Neither is
   * a bug, and a check that says "a fight can be lost" has to be given a cat that can win one.
   *
   * `claims` is three-valued because the copies this replaced were, and flattening them broke a
   * harness. `'inView'` is `arena2`/`arena4`/`arena7`'s condition — a claim on the reachable board.
   * `'any'` is `arena8`/`battle`'s — the board merely has to exist, which mattered because a deal
   * checked immediately after a re-open can catch a fight whose claims are not placed yet; converting
   * `battle` to `'ignore'` sent three checks red, including a treat that never left the HUD.
   * `'ignore'` is `arena3`/`arena5`'s — those sections scroll to whatever they need and only care
   * which cat turned up. **The distinctions between copies of a helper are usually load-bearing.**
   */
  stance:
    (list, { claims = 'inView' } = {}) =>
    async (page) => {
      const got = await page.evaluate(() => ({
        stance: document.querySelector('[data-boss]')?.dataset.stance ?? '',
        all: document.querySelectorAll('.cat-tile[data-state="claimed"]').length,
        inView: document.querySelectorAll('.cat-tile[data-state="claimed"]').length,
      }));
      if (!list.includes(got.stance)) return null;
      if (claims === 'inView' && got.inView === 0) return null;
      if (claims === 'any' && got.all === 0) return null;
      return got.stance;
    },

  /**
   * A claimed tile whose centre sits at `at` in the card's board coords, and the point to hold.
   *
   * 2.2: the card has no scroll — the whole board is on screen by construction — so "placed"
   * becomes "is this tile actually at that spot on the board". `at` is in board coordinates
   * (0..boardW, 0..boardH), matching how the card game positions the boss and kittens.
   */
  placed:
    (at, { tol = 30 } = {}) =>
    (page) =>
      page.evaluate(
        async ([atX, atY, tolPx]) => {
          const board = document.querySelector('[data-board]');
          if (!board) return null;
          const b = board.getBoundingClientRect();
          const boss = document.querySelector('[data-boss]');
          const bossRect = boss?.getBoundingClientRect();
          const cx = bossRect ? bossRect.left + bossRect.width / 2 : 0;
          const cy = bossRect ? bossRect.top + bossRect.height / 2 : 0;
          for (const el of document.querySelectorAll('.cat-tile[data-state="claimed"]')) {
            const r = el.getBoundingClientRect();
            const x = Math.round(r.left + r.width / 2);
            const y = Math.round(r.top + r.height / 2);
            const bx = x - b.left;
            const by = y - b.top;
            if (Math.abs(bx - atX) > tolPx || Math.abs(by - atY) > tolPx) continue;
            return {
              x,
              y,
              d: Math.round(Math.hypot(x - cx, y - cy)),
              href: null,
            };
          }
          return null;
        },
        [at.x ?? 0, at.y ?? 0, tol],
      ),

  /**
   * A claim a commander can actually give an order about: on the board, hit-testable, and **not
   * underneath a kitten** (an order aimed at a claim a kitten is already standing on reads as a
   * no-op to the squad, so the check would be measuring the fixture rather than the mechanic).
   */
  orderable:
    ({ awayFrom = '.cat-card-kit' } = {}) =>
    (page) =>
      page.evaluate(
        ([away]) => {
          const centre = (el) => {
            const r = el.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          };
          const others = [...document.querySelectorAll(away)].map(centre);
          let best = null;
          for (const el of document.querySelectorAll('.cat-tile[data-state="claimed"]')) {
            const r = el.getBoundingClientRect();
            const x = Math.round(r.left + r.width / 2);
            const y = Math.round(r.top + r.height / 2);
            const at = document.elementFromPoint(x, y);
            if (at?.closest('.cat-tile') !== el) continue;
            const gap = others.length ? Math.min(...others.map((o) => Math.hypot(o.x - x, o.y - y))) : Infinity;
            if (!best || gap > best.away) best = { x, y, away: Math.round(gap === Infinity ? 0 : gap) };
          }
          return best;
        },
        [awayFrom],
      ),

  /** A link inside the page (still a thing worth asserting in 2.2 — the card must not eat it). */
  linkInBand:
    ({ from = 0, to = 100000 } = {}) =>
    (page) =>
      page.evaluate(
        async ([bandFrom, bandTo]) => {
          const mid = (bandFrom + bandTo) / 2;
          for (const link of document.querySelectorAll('main a[href]')) {
            const r0 = link.getBoundingClientRect();
            const target = Math.max(0, Math.min(document.documentElement.scrollHeight - innerHeight, Math.round(r0.top + scrollY + r0.height / 2 - mid)));
            scrollTo({ top: target, behavior: 'instant' });
            const r = link.getBoundingClientRect();
            const x = Math.round(r.left + r.width / 2);
            const y = Math.round(r.top + r.height / 2);
            if (y < bandFrom || y > bandTo) continue;
            if (document.elementFromPoint(x, y)?.closest('a[href]') !== link) continue;
            return { x, y, href: link.getAttribute('href') };
          }
          return null;
        },
        [from, to],
      ),

  /** Every predicate, satisfied by the same deal. Returns the array of values, or null. */
  all:
    (...list) =>
    async (page) => {
      const got = [];
      for (const w of list) {
        const v = await w(page);
        if (v === null || v === undefined || v === false) return null;
        got.push(v);
      }
      return got;
    },
};

/* ------------------------------------------------------------------ *
 * Playing
 * ------------------------------------------------------------------ */

/**
 * A point inside the card's board that belongs to nobody — no tile — so a pointer parked
 * there cannot scrub anything, and a click there is unambiguously a throw. 2.2: the board
 * is the whole game surface and there is no page to scroll, so this is asked once and stays
 * valid.
 *
 * The hit-test is load-bearing. The game's own `tileUnder` tests tiles by *inclusive*
 * board-relative `getBoundingClientRect` bounds, while `elementFromPoint` snap-hits the
 * painted box — the two disagree by a pixel at the padding/tile boundary, so a point
 * `elementFromPoint` calls open ground is, to the game, the top-left tile, and a cursor
 * parked there scrubs the claim straight back off (arena5 §2's regrow-watch flake). So this
 * scans the way the game does, and starts inside the 0.6rem padding (the tiles start after
 * it), so the point it returns is tile-free for both.
 */
export async function idlePoint(page, { avoidClaims = true } = {}) {
  return page.evaluate(
    () => {
      const board = document.querySelector('[data-board]');
      if (!board) return null;
      const b = board.getBoundingClientRect();
      const tiles = [...document.querySelectorAll('.cat-tile')].map((n) => {
        const r = n.getBoundingClientRect();
        return { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height };
      });
      const under = (x, y) => tiles.some((t) => x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h);
      for (let y = 5; y < b.height - 5; y += 12)
        for (let x = 5; x < b.width - 5; x += 12) {
          if (under(x, y)) continue;
          const el = document.elementFromPoint(b.left + x, b.top + y);
          if (el && el.closest('.cat-tile')) continue;
          return { x: Math.round(b.left + x), y: Math.round(b.top + y) };
        }
      return null;
    },
  );
}

/**
 * The nearest throwable point to somewhere in particular.
 *
 * `avoidClaims` defaults to **false** — the three copies this replaced aimed at a far corner,
 * where claims are unlikely. It has to be `true` when aiming *at the cat*, because the cat
 * usually stands on a claim and a click on a claim throws nothing at all. Two callers, two
 * correct answers, so it is an argument.
 */
export async function throwSpot(page, near, { avoidClaims = false } = {}) {
  return page.evaluate(
    ([nx, ny, noClaims]) => {
      const board = document.querySelector('[data-board]');
      if (!board) return null;
      const b = board.getBoundingClientRect();
      const inBoard = (x, y) => x >= b.left + 4 && x <= b.right - 4 && y >= b.top + 4 && y <= b.bottom - 4;
      const okAt = (x, y) => {
        if (!inBoard(x, y)) return null;
        const el = document.elementFromPoint(x, y);
        if (!el || el.closest('.cat-tile')) return null;
        if (noClaims && el.closest('.cat-tile[data-state="claimed"]')) return null;
        return { x, y };
      };
      const here = okAt(nx, ny);
      if (here) return here;
      let best = null;
      let bestD = Infinity;
      for (let y = b.top + 6; y < b.bottom - 6; y += 12)
        for (let x = b.left + 6; x < b.right - 6; x += 12) {
          if (!okAt(x, y)) continue;
          const d = Math.hypot(x - nx, y - ny);
          if (d < bestD) {
            bestD = d;
            best = { x, y };
          }
        }
      return best;
    },
    [near.x, near.y, avoidClaims],
  );
}

/**
 * A claimed tile the pointer can sit on, preferring the one furthest from the boss.
 *
 * 2.2: the whole board is on screen by construction, so there is nothing to scroll to — the
 * card's fight is entirely visible, which is the point. Returns the claim furthest from the
 * boss, which is how §5.2 says to play it.
 */
export async function reachClaim(page) {
  return page.evaluate(() => {
    const boss = document.querySelector('[data-boss]')?.getBoundingClientRect();
    const cx = boss ? boss.left + boss.width / 2 : 0;
    const cy = boss ? boss.top + boss.height / 2 : 0;
    const band = [...document.querySelectorAll('.cat-tile[data-state="claimed"]')]
      .map((n) => n.getBoundingClientRect())
      .filter((r) => r.width > 20);
    if (!band.length) return null;
    band.sort(
      (a, b) =>
        Math.hypot(b.left + b.width / 2 - cx, b.top + b.height / 2 - cy) -
        Math.hypot(a.left + a.width / 2 - cx, a.top + a.height / 2 - cy),
    );
    const r = band[0];
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  });
}

/**
 * Earn treats the way a visitor does — by browsing. **Never `page.goto`:** a full document load
 * resets the cat's session state and the found set with it.
 *
 * **`home` is not cosmetic — it is which board the fight will be fought on, so pass it.** Arming
 * otherwise finishes on whichever tab was last, and a fight measured there is a fight on an unknown
 * board: the first run of `touch-fight` reported "found a claim to hold — none" because the tab it
 * landed on had nothing placeable in the safe band.
 *
 * The copies this replaced did **not** agree. `arena3`, `arena4`, `arena7` and `arena8` end on
 * `/timeline/` — 24 claims, of which only about four are in view at once, which is the board their
 * measurements were calibrated against — while `arena5`, `battle` and `touch-fight` end on `/`.
 * Consolidating them onto one default silently moved two harnesses to a different board, and
 * `arena7`'s desperate-tier measurement collected zero samples as a result: the fight simply
 * developed differently. Caught by a red, which is the only reason it is documented here rather than
 * shipped. **A shared helper's default is a decision, not a convenience** — so every caller states
 * its own board.
 *
 * The same afternoon produced the sibling of that fault, from the other direction: `arena8` called the
 * old copy as `armAmmo(page, 1)` — a positional `hops` — and against this signature the `1` became an
 * options object with no `hops` in it, so a section whose entire point was "explore almost nothing"
 * explored five tabs and found five treats instead of one. It failed loudly only because the check
 * reads the *treat count* rather than trusting the helper. **Consolidating helpers means converting
 * call shapes, not just names.** Every knob the copies disagreed on — `pool`, `dwell`, `settle`,
 * `hops`, `home` — is now a named parameter, and every call site passes the numbers its own
 * measurements were calibrated against.
 */
export async function armAmmo(page, { hops = 5, tap = false, home = '/', pool = 6, dwell = 650, settle = 750 } = {}) {
  const hrefs = await page.evaluate(
    (n) =>
      [...document.querySelectorAll('.tabbar a[href]')]
        // Top-level tabs only. `.tabbar` also holds each tab's flyout of entry links, hidden until
        // hover — clicking one of those just times out.
        .filter((a) => !a.closest('.tab-flyout') && a.offsetParent !== null)
        .map((a) => a.getAttribute('href'))
        .slice(0, n),
    pool,
  );
  for (const href of hrefs.slice(0, hops)) {
    if (tap) {
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForTimeout(120);
      await page.locator(`.tabbar a[href="${href}"]`).first().tap();
    } else {
      await page.click(`.tabbar a[href="${href}"]`);
    }
    await page.waitForTimeout(dwell);
  }
  // One more hop, so the last page's treat is credited too, and so the fight below happens on a board
  // this harness has chosen rather than on whichever tab arming ended on.
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(120);
  if (tap) await page.locator(`.tabbar a[href="${home}"], a[href="${home}"]`).first().tap();
  else await page.click(`a[href="${home}"]`).catch(() => {});
  await page.waitForTimeout(settle);
  return page.evaluate(AMMO);
}

/**
 * Walk the cursor towards a point until the boss is within `px` of it, and report the gap.
 *
 * The boss stalks the pointer (manual mode), so luring is how a harness gets the two of them
 * into the same place without teleporting a cursor — which is not a thing a hand can do, and
 * 2.0 measured what happens to a policy that assumes it can.
 */
export async function lureCat(page, at, px = 70, { steps = 26, timeout = 12_000 } = {}) {
  const t0 = Date.now();
  let gap = Infinity;
  while (Date.now() - t0 < timeout) {
    await page.mouse.move(at.x, at.y, { steps });
    gap = await page.evaluate(
      ([x, y]) => {
        const r = document.querySelector('[data-boss]')?.getBoundingClientRect();
        if (!r) return Infinity;
        return Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
      },
      [at.x, at.y],
    );
    if (gap <= px) return gap;
    await page.waitForTimeout(180);
  }
  return gap;
}

/**
 * A real finger, through CDP.
 *
 * Playwright's `touchscreen` only taps, and the core verb is a **hold** — a finger that lands and
 * then emits nothing at all, which is the one thing a cursor never does.
 */
export async function finger(cdp, x, y, hold = 0) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  if (hold) await new Promise((r) => setTimeout(r, hold));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/* ------------------------------------------------------------------ *
 * §16's flick — the invisible hand's gesture
 * ------------------------------------------------------------------ */

/** Segments per flick and the gap between them: together these set the gesture's measured px/s. */
export const FLICK_SEGMENTS = 6;
export const FLICK_GAP_MS = 16;

/** Shortest flick whose *segments* still clear the gesture floor, with 20% headroom. */
export const MIN_FLICK_PX = Math.ceil((SWIPE_MIN_SPEED * (FLICK_GAP_MS / 1000) * FLICK_SEGMENTS) / 0.8);

/**
 * One flick at the cat, aimed and dispatched **inside the page**. Shared because `hand-look` needs it
 * to make a picture and `hand` needs it to make assertions, and it has already been got wrong twice.
 *
 * ## Why the events are synthetic
 *
 * Two versions using real input came first, and they fail in opposite directions:
 *
 * - `mouse.move(x, y, { steps: n })` dispatches every step back-to-back with ~1ms between them, so
 *   *any* drag reads as a 10,000px/s flick and a harness could "prove" a gesture floor it never
 *   tested.
 * - `mouse.move` in a loop with `waitForTimeout(16)` between calls looks like the fix and is not:
 *   **every `mouse.move` is its own CDP round trip**, ~100ms in this container. The page therefore saw
 *   8.5px moves 100ms apart — 85px/s, comfortably *below* `SWIPE_MIN_SPEED`'s 240 — so whether the
 *   flick registered came down to how busy the socket was. Two runs passed and the third did not, from
 *   identical code.
 *
 * `PointerEvent`s dispatched in the page put the cadence on the page's own clock, accurate to a frame.
 * The trade is real and named rather than hidden: these are `isTrusted: false` and skip the browser's
 * input pipeline, so this proves *the card's handler* answers a gesture of a given speed, not that a
 * physical pointer produces such a gesture. `hand.mjs` keeps one real-mouse check for that half.
 *
 * ## Why it aims in the page too
 *
 * Reading the heading in Node, deciding the perpendicular and dispatching costs 200–300ms of round
 * trips, during which the cat walks and its quarry moves. The flick then arrives across a heading the
 * cat no longer has — and because `veer` returns `strength · |sin θ|`, a heading rotated to nearly
 * parallel yields a shove of almost nothing. `trySwipe` only bails on an *exactly* zero rejection, so
 * it still adds `.boss-swatted` and still plays the cue: the report showed a cat flashing red, shoved
 * by 0.0px, and called it 8 swat frames. **A visible acknowledgement of a shove that did not happen is
 * the worst failure available, because it looks like success.**
 *
 * @param axis  'across' aims perpendicular to the cat's heading — the gesture the mechanic is about.
 *              'along' aims down its heading, which `veer` must reject: the control case.
 */
const FLICK_IN = ({ segments, gapMs, reach, inset, travel, axis }) =>
  new Promise((done) => {
    const board = document.querySelector('[data-board]');
    const boss = document.querySelector('[data-boss]');
    if (!board || !boss) return done({ aimed: false, why: 'no board or boss' });
    const r = board.getBoundingClientRect();
    const rb = boss.getBoundingClientRect();
    const bx = rb.left - r.left + rb.width / 2;
    const by = rb.top - r.top + rb.height / 2;

    // The cat's heading as the *card* computes it: `quarry - boss`, quarry being `nearestKitten()`.
    // Reconstructed from `.cat-card-kit` positions, which is the only way in from outside the closure.
    let q = null;
    for (const k of document.querySelectorAll('.cat-card-kit')) {
      const kr = k.getBoundingClientRect();
      const kx = kr.left - r.left + kr.width / 2;
      const ky = kr.top - r.top + kr.height / 2;
      const d = Math.hypot(kx - bx, ky - by);
      if (!q || d < q.d) q = { x: kx, y: ky, d };
    }
    /*
     * No kitten: fall back to the cat's facing.
     *
     * §3 manual mode never spawns a squad — the cat's quarry there is the *pointer* — so a kitten-only
     * aim made `swipeCat` unusable in exactly the mode where "a flick must do nothing" most needs
     * checking, and reported it as a missing fixture rather than as the coverage hole it was. `facing`
     * is only ±1, which is why `trySwipe` does not use it for the real heading; but for a flick whose
     * expected effect is *nothing*, any direction near the cat is a fair test.
     */
    const fallback = !q;
    const face = Number(boss.dataset.facing || 1) >= 0 ? 1 : -1;
    const aLen = q ? Math.hypot(q.x - bx, q.y - by) || 1 : 1;
    const ax = q ? (q.x - bx) / aLen : face;
    const ay = q ? (q.y - by) / aLen : 0;
    // Across: rotate the aim by 90°. Along: the aim itself.
    const px = axis === 'along' ? ax : ay;
    const py = axis === 'along' ? ay : -ax;
    // Of the two directions, the one whose destination has more board around it — `onBoard` clamps the
    // cat, and a shove spent against a wall is indistinguishable from a shove too small to see.
    const room = (s) =>
      Math.min(
        bx + px * s * travel,
        by + py * s * travel,
        r.width - (bx + px * s * travel),
        r.height - (by + py * s * travel),
      );
    const sign = room(1) >= room(-1) ? 1 : -1;
    const dx = px * sign;
    const dy = py * sign;
    const clamp = (p) => ({
      x: Math.max(inset, Math.min(r.width - inset, p.x)),
      y: Math.max(inset, Math.min(r.height - inset, p.y)),
    });
    const from = clamp({ x: bx - dx * reach, y: by - dy * reach });
    const to = clamp({ x: bx + dx * reach, y: by + dy * reach });

    let hitAt = 0;
    const obs = new MutationObserver(() => {
      if (!hitAt && boss.classList.contains('boss-swatted')) hitAt = performance.now();
    });
    obs.observe(boss, { attributes: true, attributeFilter: ['class'] });

    const send = (p) =>
      board.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          cancelable: true,
          pointerType: 'mouse',
          clientX: r.left + p.x,
          clientY: r.top + p.y,
        }),
      );

    send(from); // land first: the opening move has no previous sample to measure a speed against
    let i = 0;
    const step = () => {
      i += 1;
      const k = i / segments;
      send({ x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k });
      if (i < segments) return void setTimeout(step, gapMs);
      obs.disconnect();
      const perf = performance.now();
      // Both clocks, read at the same instant: the trail and the card's timers are in
      // `performance.now()`, screencast frames are stamped `Network.TimeSinceEpoch`, and a frame
      // cannot be placed on the trail's timeline without the offset between them.
      done({
        aimed: true,
        perf,
        epoch: Date.now(),
        hitAt,
        skew: Date.now() - performance.now(),
        from,
        to,
        aim: { x: ax, y: ay },
        dir: { x: dx, y: dy },
        at: { x: bx, y: by },
        quarryPx: q ? q.d : null,
        fallback,
        len: Math.hypot(to.x - from.x, to.y - from.y),
      });
    };
    setTimeout(step, 24);
  });

/**
 * Flick at the cat and report what actually happened.
 *
 * `perf` is the moment the **shove** began — read from `.boss-swatted` appearing, which is the card's
 * own announcement — and falls back to the end of the gesture when nothing registered, which is the
 * expected outcome in the two shipped modes and in the `along` control case.
 */
export async function swipeCat(
  page,
  { axis = 'across', segments = FLICK_SEGMENTS, gapMs = FLICK_GAP_MS, reach = SWIPE_RADIUS + 24, inset = 2, travel = IMPULSE_TRAVEL_PX } = {},
) {
  const out = await page.evaluate(FLICK_IN, { segments, gapMs, reach, inset, travel, axis });
  if (!out.aimed) return out;
  const perf = out.hitAt || out.perf;
  return { ...out, perf, epoch: perf + out.skew, landed: out.hitAt > 0 };
}
