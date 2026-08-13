/**
 * First-run harness — the check 1.3 exists because nobody had written it.
 *
 * The playtest that shipped 1.2 opened a fight as a cold visitor with no treats,
 * did nothing, and the cat said nothing: the opening state (territory 0.55, nothing
 * freed, nothing spent) sat in the dead band between rattled-50 and bluff-75, so the
 * first words a confused player ever heard were support-idle's "you can stop any time."
 * at 8 seconds, and the fight truced at 20.
 *
 * This harness is that visit, automated, with two assertions:
 *
 *   1. **The opening is not silent.** A cold visitor opens a fight and does nothing;
 *      the cat must tell them what to do inside OPENING_GRACE_MS (2.5s), where §5.3
 *      guarantees the cat cannot pounce — the teach line's safe context.
 *   2. **The fight is winnable doing only what it said.** Then the visitor plays
 *      exactly one verb — hold still on a claimed element until it comes back — and
 *      the fight must actually be winnable that way (a treatless win, the arena8 §4
 *      gate, re-measured here because B's regrow clocks changed the arithmetic).
 *
 * Usage (after `npm run build` and a preview server on :4416):
 *   node scratchpad/first-run.mjs
 *
 * Depends on playwright-core + a real Chrome (the same bargain the earlier arena
 * harnesses made). Prints PASS/FAIL per check and exits non-zero on failure.
 *
 * **Every `waitForFunction` here passes its options in the third position, and that is not a
 * style rule (fixed in 1.4).** Playwright's signature is `(pageFunction, arg, options)`, so
 * `{ timeout: N }` in the second slot becomes the page function's *argument* and the bound
 * silently falls back to Playwright's 30s default — measured, a wait asking for 4000ms took
 * 30104ms. Twenty of those seconds belong to a game rule: §11 ends a fight `IDLE_TRUCE_MS`
 * after the last input, so an over-running wait **ends the fight it is waiting on**, and the
 * harness then reports the emptied board as a loss. It cost 1.4 a red `arena8` section 1 that
 * read exactly like a broken game.
 */
import { fresh, launch } from './lib/fixture.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:4416';
const OPENING_GRACE_MS = 2500;
const SCRUB_MS = 1400;
let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

const browser = await launch();
/*
 * **A cold visitor, in manual mode.** `welcomed: false` is the whole subject of this file — nothing
 * stored, no treats found, the welcome never dismissed — and the viewport is Playwright's own default
 * rather than the fleet's 1280×900, because that is what these measurements were taken at. The mode
 * declaration (§13.8's chip, pressed the way a visitor presses it) is `fresh`'s job now; this file
 * carried the third copy of it.
 */
const ctx = await fresh(browser, { mode: 'manual', welcomed: false, viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();

/** A cold visitor: fresh context, no treats found yet, nothing stored. */
await page.goto(BASE, { waitUntil: 'networkidle' });

// The arena toggle starts hidden and is revealed by CatArena's init.
await page.waitForSelector('#cat-arena-toggle:not([hidden])', { timeout: 10_000 });

/** Open the fight; returns the timestamp when the board actually appeared. */
async function openFight() {
  await page.click('#cat-arena-toggle');
  await page.waitForSelector('html.cat-arena-on', { timeout: 10_000 });
  // The curtain has a beat; wait until at least one claim is visibly placed.
  await page.waitForFunction(
    () => document.querySelectorAll('.cat-claimed').length > 0,
    undefined,
    { timeout: 10_000 },
  );
  return Date.now();
}

/** What the ribbon currently says ('' when hidden/empty). */
const ribbonText = () =>
  page
    .evaluate(() => {
      const r = document.getElementById('cat-ribbon');
      return r ? r.textContent?.trim() ?? '' : '';
    })
    .catch(() => '');

// ---------------------------------------------------------------- check 1
// Open a fight and do nothing. The teach line must appear inside the opening grace.
const t0 = await openFight();
const deadline = t0 + OPENING_GRACE_MS;
let saw = '';
while (Date.now() < deadline && !saw) {
  saw = await ribbonText();
  if (!saw) await page.waitForTimeout(100);
}
const graceText = await ribbonText();
check(
  'the cat teaches the verb inside the opening grace',
  graceText.length > 0 && Date.now() - t0 <= OPENING_GRACE_MS,
  `saw "${graceText}" at ${Date.now() - t0}ms`,
);

// It must be the teach line, not mercy ("you can stop any time").
check(
  'the first words are the teach line, not support-idle',
  /hold still/i.test(graceText),
  `"${graceText}"`,
);

// Close the check-1 fight cleanly, then **reload the page** so check 2 runs in a fresh
// renderer context. The close→reopen dance was measured to crash the renderer during
// check-2 holds (the double curtain animation leaves the canvas compositor unstable);
// a fresh load gives check 2 the same stable page probe14 played on, which never crashed.
await page.waitForTimeout(400);
const closeToggle = await page.$('#cat-arena-toggle');
if (closeToggle && (await page.evaluate(() => document.documentElement.classList.contains('cat-arena-on')))) {
  await closeToggle.click();
}
await page.waitForTimeout(1500); // let the restore finish
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('#cat-arena-toggle:not([hidden])', { timeout: 10_000 });
await page.waitForTimeout(600);

// ---------------------------------------------------------------- check 2
// Play only what it told you: hold still on a claimed element until it comes back.
// Keep doing that until the page is clear. A treatless fight must be winnable.
//
// The win must be asserted as a *win*, not as "the arena closed": a truce also
// restores the page, and the 1.1 finding was exactly that the two look identical from
// outside. The notch is only ever awarded by `finish('win')`, so it is the signal.
//
// Strategy — the loop that measured fastest (10 reclaims, ~6s/claim, against a 12s
// regrow clock): work the largest **on-screen** claim (figure/article/card — small
// claims overlap bigger ones and their centre can map to a sibling's child), hold past
// the scrub time, and move on. Scroll only when nothing is on screen, and when two
// holds in a row fail (the cat is camping the cursor), lure it back to the bottom
// corner before resuming — a pounce costs ~1s of the cat's recovery, and re-holding
// through it is faster than the clock. Luring every cycle was measured to add seconds
// of dead time per claim; luring on failure costs nothing when it is not needed.
//
// Freed is the marked node itself losing `.cat-claimed` — the marker carries identity
// across the hold, and regrow/pounce only ever *re-claim*, never remove.
//
// And the rematch: §9.4's floor has no margin — the 1.1 measurement was "zero stalls
// win, one stall loses", which is `isLost` working as §2 writes it. The design's own
// answer to a stall-loss is the rematch ("a retry — which is what §9.4 says a rematch
// *is* — was the honest fix"). So a fight that closes without a win is re-opened
// (pressing the toggle again), up to a few tries, exactly as the visitor would.
async function catPosition() {
  return page.evaluate(() => {
    const cat = document.getElementById('site-cat')?.getBoundingClientRect();
    return cat ? { x: cat.left + cat.width / 2, y: cat.top + cat.height / 2 } : { x: 0, y: 10_000 };
  });
}

let won = false;
let reclaimed = 0;
/*
 * **The rematch budget is a fixture, and six was too few to be one.**
 *
 * 1.3 measured a 25–50% per-fight win rate for this playstyle, because the fight is stance-varied:
 * siege and sleepy convert fast, ambush and trickster can grind, and §9.4's answer to a stall-loss is
 * a rematch rather than a bigger margin. At six attempts the chance of no win in a *working* build is
 * 0.75⁶ ≈ 18% — about one run in five red for no reason at all, which is what happened in sweep 1 of
 * 2.0's gate (six fights, 13 claims reclaimed, none won; sweep 2 won on the same build).
 *
 * Twelve puts it at 0.75¹² ≈ 3%. This is not the assertion being loosened — the claim is still that a
 * treatless fight is winnable doing only the taught verb, and one win still has to happen. It is the
 * *budget* being made big enough to be evidence, which is the whole of §12.1's fixture rule applied to
 * a stochastic gate.
 *
 * **One constant, used in both places.** Raising this from six to twelve without noticing that the
 * rematch block below was gated on a *second*, hard-coded `fight < 5` bought six fights that never
 * opened: each ran its forty-second loop against a closed arena, reclaimed nothing, and reported the
 * ribbon left over from the last real truce. The log said `reclaimed=0 ... ribbon="sensible."` six
 * times in a row, which reads like the game refusing to start and was the harness never asking it to.
 * A budget expressed as two numbers is a budget that will disagree with itself.
 */
const FIGHTS = 12;
for (let fight = 0; fight < FIGHTS && !won; fight++) {
  // Open a fresh fight for this attempt.
  if (fight === 0) {
    const freshToggle = await page.$('#cat-arena-toggle');
    if (freshToggle) {
      await freshToggle.click();
      await page.waitForSelector('html.cat-arena-on', { timeout: 10_000 }).catch(() => {});
      await page
        .waitForFunction(() => document.querySelectorAll('.cat-claimed').length > 0, undefined, { timeout: 10_000 })
        .catch(() => {});
    }
  }
  // The loop that MEASURED a win at 15s regrow (diag9 run 3: ambush WIN t=21s, 6
  // reclaims): work the on-screen claim farthest from the cat; when nothing is far
  // enough (dist < 400), give the cat a short 900ms lure to the bottom corner instead
  // of holding into the pounce. A 480px SAFE gate was tried and lured forever; the
  // fixed 900ms beat is what actually converts.
  const winDeadline = Date.now() + 40_000; // winning runs measure 21-34s; 40s is enough, and more
  // attempts fit in the gate budget (the fight is stance-varied: siege/sleepy convert
  // fast, ambush/trickster can grind — rematch is §9.4's own answer to a stall-loss)
  let fightReclaimed = 0;
  let ribbon = '';
  while (Date.now() < winDeadline) {
    const notched = await page.evaluate(() =>
      document.getElementById('site-cat')?.classList.contains('notched'),
    );
    if (notched) {
      won = true;
      break;
    }
    const on = await page.evaluate(() => document.documentElement.classList.contains('cat-arena-on'));
    if (!on) {
      // Truce or loss — grab the ribbon so the rematch log says which.
      ribbon = await page.evaluate(() => document.getElementById('cat-ribbon')?.textContent?.trim() ?? '');
      break;
    }
    const total = await page.evaluate(() => document.querySelectorAll('.cat-claimed').length);
    if (total === 0) {
      await page.waitForTimeout(300); // ending beat (win re-claims one element) or a moment of grace
      continue;
    }
    const cat = await page.evaluate(() => {
      const c = document.getElementById('site-cat')?.getBoundingClientRect();
      return c ? { x: c.left + c.width / 2, y: c.top + c.height / 2 } : { x: 0, y: 10_000 };
    });
    const claims = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('.cat-claimed')) {
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        if (y < 90 || y > window.innerHeight - 90) continue;
        out.push({ x, y });
      }
      return out;
    });
    if (!claims.length) {
      // Nothing on screen. Wheel alone does NOT refresh `scrub.seen` — a harness stuck
      // wheeling for IDLE_TRUCE_MS (20s) triggers the truce mid-grind (measured: fights
      // ending at 0-1 reclaims with ribbon "sensible."). Scroll the largest claim into
      // view instead — the same reveal, but it also counts as pointer activity.
      const scrolled = await page.evaluate(() => {
        let best = null;
        let bestArea = -1;
        for (const el of document.querySelectorAll('.cat-claimed')) {
          const r = el.getBoundingClientRect();
          const area = r.width * r.height;
          if (area > bestArea) {
            bestArea = area;
            best = el;
          }
        }
        if (!best) return false;
        best.scrollIntoView({ block: 'center', inline: 'nearest' });
        return true;
      });
      if (!scrolled) {
        await page.mouse.move(60, 300); // still counts as activity; avoid the truce
        await page.waitForTimeout(200);
        continue;
      }
      await page.waitForTimeout(400);
      continue;
    }
    claims.sort((a, b) => {
      const da = Math.hypot(a.x - cat.x, a.y - cat.y);
      const db = Math.hypot(b.x - cat.x, b.y - cat.y);
      return db - da;
    });
    const target = claims[0];
    const dist = Math.hypot(target.x - cat.x, target.y - cat.y);
    if (dist < 400) {
      // Inside the cat's reach — holding gets pounced. Short lure, then re-pick.
      await page.mouse.move(40, 660);
      await page.waitForTimeout(900);
      continue;
    }
    await page.mouse.move(target.x, target.y);
    await page.waitForTimeout(1750);
    const freed = await page.evaluate(([x, y]) => {
      const hit = document.elementFromPoint(x, y);
      return !(hit && hit.closest && hit.closest('.cat-claimed'));
    }, [target.x, target.y]);
    if (freed) {
      reclaimed++;
      fightReclaimed++;
    }
  }
  console.log(`  fight ${fight}: reclaimed=${fightReclaimed} won=${won}${ribbon ? ` ribbon="${ribbon}"` : ''}`);
  if (!won && fight < FIGHTS - 1) {
    // Rematch: the toggle is the only way in, and pressing it again is the acceptance
    // (§9.4). Wait for the page to restore, then re-open.
    await page.waitForFunction(
      () => !document.documentElement.classList.contains('cat-arena-on'),
      undefined,
      { timeout: 10_000 },
    ).catch(() => {});
    await page.waitForTimeout(800);
    const toggle = await page.$('#cat-arena-toggle');
    if (toggle) {
      await toggle.click();
      await page.waitForSelector('html.cat-arena-on', { timeout: 10_000 }).catch(() => {});
      const opened = await page.evaluate(() => document.documentElement.classList.contains('cat-arena-on'));
      if (!opened) {
        // The toggle may have been mid-restore and swallowed the click — try again.
        await page.waitForTimeout(1000);
        const toggle2 = await page.$('#cat-arena-toggle');
        if (toggle2) await toggle2.click();
        await page.waitForSelector('html.cat-arena-on', { timeout: 10_000 }).catch(() => {});
      }
      await page
        .waitForFunction(() => document.querySelectorAll('.cat-claimed').length > 0, undefined, { timeout: 10_000 })
        .catch(() => {});
    }
  }
}

check('a treatless fight is winnable doing only the taught verb', won, `${reclaimed} claims reclaimed`);

await browser.close();
console.log(failures === 0 ? '\nAll first-run checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
