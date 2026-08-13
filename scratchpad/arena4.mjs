/**
 * Build step 4: territory, endings, dialogue — "first full loop".
 *
 * A loop is only closed if both ends are reachable, so this harness *plays two whole
 * fights*: one lost on purpose (stand still with no treats and let the cat take the page)
 * and one won (browse for ammo, then work the far side of the board). Anything less than
 * playing them proves the code runs, not that the game ends.
 *
 * Mirrors src/lib/arena.ts:
 */
const SCRUB_MS = 1400;

import { chromium } from 'playwright-core';

const BASE = 'http://localhost:4416';
const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

/**
 * Esc, and wait for the fight to actually be gone.
 *
 * Same reason as `press`: the exit goes out through the curtain now, so the arena is still
 * live for ~700ms after the key. The re-roll loops below press Esc and immediately press the
 * toggle again — against an instant swap that was two clean transitions, and against a
 * transition it is a press landing while the previous intent is still standing, which toggles
 * the wrong way and leaves the loop rolling the same fight forever.
 */
async function release(page, timeout = 7000) {
  await page.keyboard.press('Escape');
  await page
    .waitForFunction(() => !document.querySelector('.cat-claimed'), undefined, { timeout })
    .catch(() => {});
}

/**
 * Wait for a fight to be genuinely over, not merely conceded.
 *
 * Step 7 made `aria-pressed` follow the visitor's *intent* rather than the arena's state
 * (§13.5): the button answers the press, and a curtain runs afterwards. So the loops below,
 * which broke on `aria-pressed === 'false'`, now exit while the exit transition is still up
 * and `close()` has not run — and the snapshot that follows caught `cat-arena-on` still on
 * `<html>` and reported 15 differences. What the page being restored looks like is the
 * *claims* being gone.
 */
async function overFor(page, ms = 8000) {
  await page
    .waitForFunction(
      () =>
        !document.querySelector('.cat-claimed') &&
        !document.documentElement.classList.contains('cat-arena-on'),
      undefined,
      { timeout: ms },
    )
    .catch(() => {});
  await page.waitForTimeout(120);
}

/**
 * Press the toggle and wait for the state change to have actually landed.
 *
 * Step 6 put a ~1.9s ink curtain between the press and the fight. Every `click` in these
 * scripts was followed by a fixed 120–200ms wait, which was ample against an instant swap and
 * is now a race the script always loses — the first symptom was `getBoundingClientRect` on a
 * null `.cat-claimed`. Waiting on the observable rather than on a stopwatch is both correct
 * and, on the close path, usually shorter.
 */
async function press(page, timeout = 7000) {
  const was = await page.evaluate(() => !!document.querySelector('.cat-claimed'));
  await page.click('#cat-arena-toggle');
  await page
    .waitForFunction((w) => !!document.querySelector('.cat-claimed') !== w, was, { timeout })
    .catch(() => {});
}

async function fresh(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...opts });
  await ctx.addInitScript(() => localStorage.setItem('welcomed', '1'));
  /*
   * 2.0: this harness measures **manual mode** (§3's fight). Commander mode is now the default, so
   * say which game before opening one — otherwise the pointer is not the verb and half these checks
   * are asking a spectator to hold still. Presses the HUD chip the way a visitor does, and waits for
   * `aria-pressed` rather than for a timeout.
   */
  await ctx.addInitScript(() => {
    const pick = () => {
      const b = document.getElementById('cat-manual-toggle');
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
  });
  return ctx;
}

const CLAIMS = `document.querySelectorAll('.cat-claimed').length`;
const AMMO = `document.querySelectorAll('#cat-score .cat-paw.got').length`;
const MINE = `parseFloat(document.querySelector('#cat-territory .territory-mine').style.width) || 0`;
const RIBBON = `(() => { const r = document.getElementById('cat-ribbon'); return r.hidden ? '' : r.textContent.trim(); })()`;

/** Every line the ribbon shows, with a timestamp. */
const WATCH_LINES = () => {
  const node = document.getElementById('cat-ribbon');
  window.__said = [];
  const push = () => {
    const t = node.hidden ? '' : node.textContent.trim();
    if (t && window.__said.at(-1)?.text !== t) window.__said.push({ text: t, t: performance.now() });
  };
  push();
  new MutationObserver(push).observe(node, {
    attributes: true,
    childList: true,
    characterData: true,
    subtree: true,
  });
};

const SNAP_LIST = `(() => [...document.querySelectorAll('*')]
  .filter((el) => !el.closest('#site-cat, #cat-hud, #cat-treat, #cat-scrub, #cat-throw, #cat-ribbon, #cat-territory, header'))
  .map((el, i) => i + ':' + el.tagName + ':' + el.className + ':' + (el.getAttribute('style') ?? '')))()`;

const SNAPSHOT = `(() => [...document.querySelectorAll('*')]
  .filter((el) => !el.closest('#site-cat, #cat-hud, #cat-treat, #cat-scrub, #cat-throw, #cat-ribbon, #cat-territory, header'))
  .map((el, i) => i + ':' + el.tagName + ':' + el.className + ':' + (el.getAttribute('style') ?? ''))
  .join('|'))()`;

/**
 * How the page differs from a baseline, and where.
 *
 * A boolean "it differs" is a check that makes you go and write a second script to find
 * out why — which is exactly what happened twice here. Report the first difference.
 */
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

async function armAmmo(page, hops = 5) {
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll('.tabbar a[href]')]
      .filter((a) => !a.closest('.tab-flyout') && a.offsetParent !== null)
      .map((a) => a.getAttribute('href'))
      .slice(0, 6),
  );
  for (const href of hrefs.slice(0, hops)) {
    await page.click(`.tabbar a[href="${href}"]`);
    await page.waitForTimeout(650);
  }
  await page.click('a[href="/timeline/"]');
  await page.waitForTimeout(750);
  return page.evaluate(AMMO);
}

/**
 * A claim to work on, re-rolling the board if this fight dealt none in view.
 *
 * Which claims land above the fold varies per fight (the seed is fresh each time), and a
 * run that dealt none used to crash the harness rather than report anything.
 */
/**
 * Roll the fight until it is both winnable-by-measurement and losable at all.
 *
 * Step 5's stances made both endings conditional on the opponent, which is what stances are
 * *for* and is also why three harnesses started timing out: a **sleepy** cat will not
 * interrupt a hold at all (it waits until 70%, by which point the hold is done) and takes no
 * ground, so standing still empty-handed *wins* rather than loses; a **siege** cat cannot
 * reach anything off the floor. Neither is a bug. But a check that says "a fight can be lost"
 * has to be given a cat that can win one.
 *
 * Stance and board are chosen in the same loop on purpose: separate helpers that each re-roll
 * the fight spend their time undoing each other.
 */
async function forceFighter(page, want = ['ambush', 'trickster'], tries = 40) {
  for (let i = 0; i < tries; i++) {
    const state = await page.evaluate(() => ({
      stance: document.getElementById('site-cat').dataset.stance ?? '',
      board: [...document.querySelectorAll('.cat-claimed')]
        .map((n) => n.getBoundingClientRect())
        .filter((r) => r.top > 160 && r.bottom < innerHeight - 40 && r.height < 420).length,
    }));
    if (state.board > 0 && want.includes(state.stance)) return state.stance;
    await release(page);
    await press(page);
    await page.waitForTimeout(190);
  }
  return null;
}

async function pickSpot(page, tries = 6) {
  const find = () =>
    page.evaluate(() => {
      const c = [...document.querySelectorAll('.cat-claimed')]
        .map((n) => n.getBoundingClientRect())
        .filter((r) => r.top > 160 && r.bottom < innerHeight - 40 && r.height < 420)[0];
      return c ? { x: Math.round(c.left + c.width / 2), y: Math.round(c.top + c.height / 2) } : null;
    });
  for (let i = 0; i < tries; i++) {
    const hit = await find();
    if (hit) return hit;
    await press(page);
    await page.waitForTimeout(200);
    await press(page);
    await page.waitForTimeout(240);
  }
  return null;
}

/**
 * Scroll until a claim is somewhere the pointer can sit on it, and return that point.
 *
 * Most of the board is below the fold on this site — on /timeline/ only 4 of 24 claims
 * are in view at once — so a harness that only fights what it can already see runs out of
 * targets and then reports a fight that "ended" when it actually gave up. A player
 * scrolls; so does this. It walks candidate scroll positions rather than trusting one,
 * because a claim taller than the band is reachable from a different offset.
 */
async function reachClaim(page) {
  const cands = await page.evaluate(() =>
    [...document.querySelectorAll('.cat-claimed')]
      .map((n) => n.getBoundingClientRect().top + scrollY)
      .sort((a, b) => a - b),
  );
  for (const top of cands) {
    await page.evaluate((y) => scrollTo({ top: Math.max(0, y), behavior: 'instant' }), top - 320);
    await page.waitForTimeout(130);
    const hit = await page.evaluate(() => {
      const band = [...document.querySelectorAll('.cat-claimed')]
        .map((n) => n.getBoundingClientRect())
        .filter((r) => r.top > 170 && r.bottom < innerHeight - 50 && r.width > 30);
      if (!band.length) return null;
      const cat = document.getElementById('site-cat').getBoundingClientRect();
      const cx = cat.left + cat.width / 2;
      const cy = cat.top + cat.height / 2;
      // farthest from the cat, which is how the design says to play it
      band.sort(
        (a, b) =>
          Math.hypot(b.left + b.width / 2 - cx, b.top + b.height / 2 - cy) -
          Math.hypot(a.left + a.width / 2 - cx, a.top + a.height / 2 - cy),
      );
      const r = band[0];
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    });
    if (hit) return hit;
  }
  return null;
}

async function throwSpot(page, near) {
  return page.evaluate(
    ([nx, ny]) => {
      // Mirrors INTERACTIVE in src/lib/arena.ts, and *not* PROTECTED. Using the
      // protected list here is what let three harnesses agree that throwing worked:
      // it matches `<main tabindex="-1">`, so every scan skipped the entire content
      // area and settled on the strip above it.
      const PROT = 'a[href], button, input, select, textarea, summary, label, [contenteditable]';
      const okAt = (x, y) => {
        const el = document.elementFromPoint(x, y);
        return el && !el.closest(PROT) && !el.closest('#cat-hud') ? { x, y } : null;
      };
      let best = okAt(nx, ny);
      if (best) return best;
      let bestD = Infinity;
      for (let y = 100; y < innerHeight - 50; y += 16)
        for (let x = 14; x < innerWidth - 14; x += 16) {
          if (!okAt(x, y)) continue;
          const d = Math.hypot(x - nx, y - ny);
          if (d < bestD) {
            bestD = d;
            best = { x, y };
          }
        }
      return best;
    },
    [near.x, near.y],
  );
}

// ---- 1. the bar
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  ok('no bar before a fight', await page.evaluate(() => document.getElementById('cat-territory').hidden));

  await press(page);
  await page.waitForTimeout(250);
  const bar = await page.evaluate(() => {
    const b = document.getElementById('cat-territory');
    const r = b.getBoundingClientRect();
    return { h: r.height, top: r.top, wide: r.width, text: b.textContent.trim(), aria: b.getAttribute('aria-hidden') };
  });
  ok('the bar is 3px on the top edge, full width', bar.h === 3 && bar.top === 0 && bar.wide >= 1279, JSON.stringify(bar));
  ok('and carries no numbers (§6)', bar.text === '', JSON.stringify(bar.text));
  ok('and is aria-hidden like the rest of the cat', bar.aria === 'true');

  const opening = await page.evaluate(MINE);
  ok('it opens showing the visitor’s minority share', opening > 20 && opening < 60, `${opening.toFixed(1)}% mine`);

  // free one claim and watch the bar move
  const spot = await pickSpot(page);
  ok('the board dealt a claim in view', !!spot, spot ? `${spot.x},${spot.y}` : 'none');
  await page.mouse.move(spot.x, spot.y);
  await page.waitForTimeout(SCRUB_MS + 700);
  const after = await page.evaluate(MINE);
  ok('the bar tracks a reclaim', after > opening, `${opening.toFixed(1)}% → ${after.toFixed(1)}%`);
  ok('no console errors', errors.length === 0, errors.join(' | '));

  await release(page);
  await page.waitForTimeout(150);
  ok('the bar goes away with the fight', await page.evaluate(() => document.getElementById('cat-territory').hidden));
  await ctx.close();
}

// ---- 2. the cat talks, and obeys its own rules
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await press(page);
  await page.waitForTimeout(150);
  await page.evaluate(WATCH_LINES);

  // stand on a claim with no treats: it will interrupt, and it will comment
  const spot = await pickSpot(page);
  ok('the board dealt a claim in view', !!spot, spot ? `${spot.x},${spot.y}` : 'none');
  for (let i = 0; i < 26; i++) {
    await page.mouse.move(spot.x + (i % 2 ? 1 : 0), spot.y);
    await page.waitForTimeout(500);
  }
  const said = await page.evaluate(() => window.__said);
  ok('the cat says something', said.length > 0, said.map((s) => `“${s.text}”`).join(' '));
  ok(
    'never more than seven words, ever',
    said.every((s) => s.text.split(/\s+/).length <= 7),
    `longest ${Math.max(0, ...said.map((s) => s.text.split(/\s+/).length))} words`,
  );
  ok('never shouts', said.every((s) => !s.text.includes('!')));
  ok('stays lower-case', said.every((s) => s.text === s.text.toLowerCase()));
  ok('never says the same thing twice running', said.every((s, i) => i === 0 || s.text !== said[i - 1].text));
  ok(
    'leaves silence between lines',
    said.every((s, i) => i === 0 || s.t - said[i - 1].t > 1200),
    said.length > 1 ? `tightest gap ${Math.min(...said.slice(1).map((s, i) => s.t - said[i].t)).toFixed(0)}ms` : 'one line',
  );
  /*
   * Measured while a line is actually up. The first version of this check read the rect
   * whenever it happened to run, got 0,0 from a hidden element, and passed for the wrong
   * reason — a hidden ribbon is trivially not in the middle of the page.
   */
  /*
   * Polled from **out here**, with the jiggle still running.
   *
   * The first version of this wait sat inside one `page.evaluate` for twelve seconds without
   * touching the mouse, and was the flakiest check in the suite. A parked cursor gives the cat
   * almost nothing to say — and §8's "never says the same thing twice running" means the one
   * line it does have is then suppressed as a repeat, so the whole window can pass in silence
   * and the ribbon stays hidden for a reason that is the game working. Keeping the pointer
   * alive keeps lines coming, which is the state this check is actually about.
   */
  let placed = null;
  for (let i = 0; i < 48 && !placed; i++) {
    placed = await page.evaluate(() => {
      const node = document.getElementById('cat-ribbon');
      if (node.hidden) return null;
      const r = node.getBoundingClientRect();
      const cat = document.getElementById('site-cat').getBoundingClientRect();
      return {
        cx: r.left + r.width / 2,
        cy: r.top + r.height / 2,
        nearCat: Math.hypot(r.left + r.width / 2 - (cat.left + cat.width / 2), r.bottom - cat.top),
      };
    });
    if (placed) break;
    await page.mouse.move(spot.x + (i % 2 ? 1 : 0), spot.y);
    await page.waitForTimeout(250);
  }
  ok('the ribbon was on screen to be measured', !!placed);
  ok(
    'it sits above the cat, not in the middle of the page',
    placed && placed.nearCat < 140 && Math.hypot(placed.cx - 640, placed.cy - 450) > 120,
    placed ? `${placed.cx.toFixed(0)},${placed.cy.toFixed(0)} — ${placed.nearCat.toFixed(0)}px from the cat` : 'never shown',
  );

  // Esc gets its own line, and it outlives the fight
  await release(page);
  await page.waitForTimeout(150);
  const parting = await page.evaluate(RIBBON);
  ok('a truce gets a parting line', /sensible|cowardly/.test(parting), `“${parting}”`);
  ok(
    'and the page is already restored while it is still muttering',
    (await page.evaluate(CLAIMS)) === 0,
  );
  await ctx.close();
}

// ---- 3. a fight lost, played out
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  const clean = await page.evaluate(SNAP_LIST);
  ok('starting a losing fight with nothing to throw', (await page.evaluate(AMMO)) === 0);

  await press(page);
  await page.waitForTimeout(150);
  /*
   * A siege, and then simply refuse to play.
   *
   * The obvious losing script — stand still on a claim empty-handed and let the cat grind you
   * down — turns out not to lose, and working out why is the most useful thing this check
   * found. A pounce resets your hold, but the cat then has to *recover* before it can commit
   * again: baseline that is 700ms, and every stance lengthens it (the whiff invariant forces
   * that). By the time it is ready your hold has already completed, so after the first hit the
   * player wins every subsequent exchange. **No stance's pounce can take the page from a
   * stationary player.** Ambush least of all, whose 1.45x recovery is exactly the "punish the
   * whiff" counter §9.3 promises.
   *
   * What can take the page is siege's regrowing board (§9.3), which does not care what you are
   * doing. So the losing player here is the one who stops playing: park somewhere harmless,
   * empty-handed, and watch the page close over.
   */
  const foe = await forceFighter(page, ['siege']);
  ok('rolled the one stance that can take a page on its own', !!foe, foe ?? 'never rolled one');
  await page.evaluate(WATCH_LINES);
  const board = await page.evaluate(() => document.querySelectorAll('.cat-claimed').length);

  const idle = await page.evaluate(() => {
    const PROT = 'a[href], button, input, select, textarea, summary, label, [contenteditable]';
    for (let y = 150; y < innerHeight - 70; y += 14)
      for (let x = 30; x < innerWidth - 30; x += 14) {
        const el = document.elementFromPoint(x, y);
        if (!el || el.closest(PROT) || el.closest('#cat-hud') || el.closest('.cat-claimed')) continue;
        return { x, y };
      }
    return null;
  });
  ok('found somewhere harmless to stand', !!idle, idle ? `${idle.x},${idle.y}` : 'nowhere');

  const t0 = Date.now();
  let ended = false;
  while (idle && Date.now() - t0 < 120000) {
    // keep the pointer alive without touching anything: the idle truce is 20s
    await page.mouse.move(idle.x, idle.y);
    await page.waitForTimeout(300);
    await page.mouse.move(idle.x + 1, idle.y);
    await page.waitForTimeout(300);
    if ((await page.getAttribute('#cat-arena-toggle', 'aria-pressed')) === 'false') {
      ended = true;
      // The button has conceded; the arena has not finished putting the page back yet.
      await overFor(page);
      break;
    }
  }

  const said = await page.evaluate(() => window.__said.map((s) => s.text));
  ok('a fight can be lost', ended, `${((Date.now() - t0) / 1000).toFixed(0)}s from ${board} claims`);
  ok(
    'and the cat says so, in character',
    said.some((t) => /you may read on/.test(t)),
    said.map((t) => `“${t}”`).join(' '),
  );
  const lossDiff = await snapDiff(page, clean);
  ok('losing restores the page anyway', lossDiff.n === 0, lossDiff.detail);
  ok('losing earns no notch', !(await page.evaluate(() => document.getElementById('site-cat').classList.contains('notched'))));
  ok('no console errors through a loss', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---- 4. a fight won, played out
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const armed = await armAmmo(page);
  ok('armed for a real fight', armed >= 3, `${armed} treats`);

  /*
   * Settle the page before snapshotting it. Scrolling fires the site's own scroll-reveal
   * observer, which permanently adds `io-in` to whatever came into view — so a snapshot
   * taken at the top of an unscrolled page can never match one taken after a fight that
   * scrolled, and the mismatch says nothing about whether the arena restored anything.
   * Run the page end to end once, come back, and then take the baseline.
   */
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 180) {
      scrollTo({ top: y, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 90));
    }
    scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.waitForTimeout(500);
  const clean = await page.evaluate(SNAP_LIST);

  await press(page);
  await page.waitForTimeout(200);
  // Pinned as well, so the duration below is a fight against a cat that fights back rather
  // than whichever one turned up.
  const opponent = await forceFighter(page);
  ok('rolled an opponent for the timed win', !!opponent, opponent ?? 'none');
  await page.evaluate(WATCH_LINES);
  const started = Date.now();

  // Play it the way the design says it should be played: work the far side of the board,
  // scroll to reach what is below the fold, and spend a treat when the cat closes in.
  let rounds = 0;
  let threw = 0;
  while (Date.now() - started < 170000) {
    if ((await page.getAttribute('#cat-arena-toggle', 'aria-pressed')) === 'false') {
      await overFor(page);
      break;
    }
    const target = await reachClaim(page);
    if (!target) break;

    const near = await page.evaluate(
      ([tx, ty]) => {
        const r = document.getElementById('site-cat').getBoundingClientRect();
        return Math.hypot(r.left + r.width / 2 - tx, r.top + r.height / 2 - ty);
      },
      [target.x, target.y],
    );
    const treatOut = await page.evaluate(`!document.getElementById('cat-throw').hidden`);
    if (near < 300 && !treatOut && (await page.evaluate(AMMO)) > 0) {
      const far = await throwSpot(page, {
        x: target.x > 640 ? 60 : 1220,
        y: target.y > 450 ? 180 : 780,
      });
      if (far) {
        await page.mouse.move(far.x, far.y);
        await page.mouse.down();
        await page.mouse.up();
        threw++;
        await page.waitForTimeout(140);
      }
    }
    await page.mouse.move(target.x, target.y);
    await page.waitForTimeout(SCRUB_MS + 300);
    rounds++;
  }
  const took = (Date.now() - started) / 1000;
  const said = await page.evaluate(() => window.__said.map((s) => s.text));
  /*
   * "Did it win" is a question about **state**, not about prose.
   *
   * This used to match the ribbon against `/keep it|bribe me|show-off/`, and §9.4 broke it by
   * adding a win line: a fight ending on "again? i keep one back." is a win the pattern does
   * not recognise, and the section reported a loss on a fight it had just won. The words the
   * cat says are content and will keep changing; the notch is the thing a win *does*.
   */
  const won = await page.evaluate(() =>
    document.getElementById('site-cat').classList.contains('notched'),
  );
  ok('a fight can be won', won, `${took.toFixed(0)}s over ${rounds} holds, ${threw} treats thrown`);
  /*
   * Reported, and only loosely bounded. §10's 90–180s is a target for a *human*, who has
   * to find the claims, misjudge dodges and decide when to spend. A script that always
   * picks the farthest claim and never mis-aims is strictly faster, so treating its time
   * as the human number would be measuring the harness. What is worth asserting is only
   * that the fight is neither trivial nor endless.
   *
   * **The floor was 15s and that was one sample's worth of calibration.** Measured across runs:
   * 17s over 9 holds, 15s over 8, and 13s over 7 — because the board is `MIN_BOARD`..`MAX_BOARD`
   * candidates and `pickClaims` takes 55% of them, so the number of holds a win needs varies by a
   * couple either way and the time follows it. A floor inside that variance fails on a build where
   * nothing changed except which claims were dealt, which is the most expensive kind of red line:
   * it costs an investigation and teaches nothing.
   *
   * So the floor is stated as arithmetic instead. The fastest a scripted win can *possibly* go is
   * about `MIN_BOARD × INITIAL_CLAIM_FRACTION` holds at `SCRUB_MS` each — 5.5 × 1.4s ≈ 7.7s with no
   * travel and no interruptions at all. Anything under 8s would mean the fight had stopped being a
   * fight; anything over 200s would mean it had stopped ending. Those are the two things this check
   * is for, and neither of them depends on the deal.
   */
  ok(
    'a win takes work but ends',
    won && took >= 8 && took <= 200,
    `${took.toFixed(0)}s scripted over ${rounds} holds (§10 targets 90–180s for a human, who is slower)`,
  );
  ok(
    'and says one of §8.4’s ending lines while doing it',
    // Kept as its own check rather than as the win signal: that the cat *speaks* on a win is
    // worth pinning, but it must not be what decides whether the win happened.
    said.some((t) => /keep it|bribe me|show-off|keep one back|kept everything/.test(t)),
    said.map((t) => `“${t}”`).join(' ') || '(silent)',
  );
  ok(
    'and the notch is actually drawn',
    await page.evaluate(() => {
      const n = document.querySelector('#site-cat .cat-notch');
      return !!n && getComputedStyle(n).display !== 'none';
    }),
  );
  // Wait for the `.cat-freed` flash to finish rather than guessing at a delay: the class
  // is part of the snapshot, so a lingering animation reads as an unrestored page.
  await page
    .waitForFunction(() => !document.querySelector('.cat-freed'), undefined, { timeout: 4000 })
    .catch(() => {});
  await page.waitForTimeout(200);
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(300);
  const winDiff = await snapDiff(page, clean);
  ok('the page comes back whole after a win', winDiff.n === 0, winDiff.detail);
  ok(
    // §7.1 says "for the rest of the session", so the interesting moment is *after* the fight
    // has ended and the page been restored — not during the win beat, when everything is still
    // up. Read here because the win signal moved to the notch and this is the claim it makes.
    'and the ear stays marked once the fight is over (§7.1)',
    await page.evaluate(() => document.getElementById('site-cat').classList.contains('notched')),
  );
  ok('the toggle un-presses itself', (await page.getAttribute('#cat-arena-toggle', 'aria-pressed')) === 'false');
  /*
   * **Wait for it to move; do not sample a window and hope.**
   *
   * This check is about the handover — SiteCat has the element back and is driving it. It read
   * 30–51px for five versions and was believed, then read `0.0px` and looked like a broken
   * handover. It was not. A trace (`diag-endwalk.mjs`) shows the cat wandering perfectly well
   * either side of the sample: `994 → 999 → 1056 → 1145 → 1178 → 1130`, with the `walking`
   * class coming and going.
   *
   * The cat's ambient loop *alternates*: `chooseNext` picks a walk, then an idle, and the idles
   * run for seconds — the same trace has one lasting 2.6s. A fixed 900ms sample is therefore a
   * coin toss against the phase of that cycle, and it had simply been landing heads. Nothing
   * about "the cat is walking" is true at every instant, so no instantaneous measurement of it
   * can be a reliable check.
   *
   * Poll instead, and give it several cycles. The pointer goes to a corner first because a
   * pointer resting low on the page is something the cat legitimately comes and sits beside —
   * a different correct behaviour that this line was never about, and the win loop above leaves
   * the cursor exactly there.
   */
  await page.mouse.move(20, 20);
  await page.waitForTimeout(300);
  const walking = await page.evaluate(async () => {
    const c = document.getElementById('site-cat');
    const a = c.getBoundingClientRect().left;
    let most = 0;
    for (let i = 0; i < 60 && most <= 1; i++) {
      await new Promise((r) => setTimeout(r, 150));
      most = Math.max(most, Math.abs(c.getBoundingClientRect().left - a));
    }
    return most;
  });
  ok('and the cat goes back to walking, notch and all', walking > 1, `${walking.toFixed(1)}px`);
  ok('no console errors through a win', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
