/**
 * Build steps 0 + 1 of the cat arena, checked in a real browser.
 *
 * The claims are transforms and filters on other people's elements, so the check
 * that matters most is the *restore*: a full snapshot of every element's class
 * list and style attribute before the fight, compared byte-for-byte after Esc.
 */
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:4416';
const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

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
  const ctx = await browser.newContext(opts);
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

/**
 * Every element's identity + what the arena could have touched.
 *
 * The cat's own furniture is excluded, and not for convenience: `#site-cat` is
 * walking, so its class list and transform change every frame. Including it made
 * this compare a live animation with itself, which is a coin toss rather than a
 * check. What is being asserted is that *the page* comes back as found — the arena's own
 * furniture (the ribbon, the territory bar, the thrown treat) is excluded for the same
 * reason and not out of convenience: it is not the page, and this list has to be extended
 * whenever the arena grows a new widget or the check quietly starts failing for it.
 */
const SNAPSHOT = `(() => [...document.querySelectorAll('*')]
  .filter((el) => !el.closest('#site-cat, #cat-hud, #cat-treat, #cat-scrub, #cat-throw, #cat-ribbon, #cat-territory'))
  .map((el, i) => i + ':' + el.tagName + ':' + el.className + ':' + (el.getAttribute('style') ?? ''))
  .join('|'))()`;

/**
 * Wait for a fight to be *over*, not merely told to stop.
 *
 * Step 4 gave the endings a beat: a win holds the page for `WIN_BEAT_MS` while the cat takes
 * one thing back and leaves. So a snapshot taken a fixed 200ms after pressing the toggle can
 * land in the middle of that and report an unrestored page — rarely, and only when a fight
 * happens to end in a win, which is exactly the kind of flake that gets explained away.
 */
async function settled(page, ms = 5000) {
  await page
    .waitForFunction(
      () =>
        document.getElementById('cat-arena-toggle')?.getAttribute('aria-pressed') === 'false' &&
        !document.querySelector('.cat-claimed') &&
        !document.querySelector('.cat-freed'),
      undefined,
      { timeout: ms },
    )
    .catch(() => {});
  await page.waitForTimeout(120);
}

const CLAIM_COUNT = `document.querySelectorAll('.cat-claimed').length`;

// ---- 1. the toggle: visible, real, and announced
{
  const ctx = await fresh({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(600);

  const btn = page.locator('#cat-arena-toggle');
  ok('the toggle is visible without being hunted for', await btn.isVisible());

  const shape = await btn.evaluate((b) => ({
    tag: b.tagName,
    type: b.getAttribute('type'),
    pressed: b.getAttribute('aria-pressed'),
    label: b.textContent.trim(),
    hiddenAncestor: !!b.closest('[aria-hidden="true"]'),
    box: b.getBoundingClientRect().height,
  }));
  ok('it is a real button, not a div with a handler', shape.tag === 'BUTTON' && shape.type === 'button');
  ok('it announces its state', shape.pressed === 'false', `aria-pressed=${shape.pressed}`);
  ok(
    'it is NOT inside anything aria-hidden',
    !shape.hiddenAncestor,
    'a control cannot be hidden and usable',
  );
  ok('the label says what it does', /cat/i.test(shape.label), JSON.stringify(shape.label));

  // it is focusable and operable from the keyboard alone
  const viaKeyboard = await page.evaluate(async () => {
    const b = document.getElementById('cat-arena-toggle');
    b.focus();
    const focused = document.activeElement === b;
    b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    b.click(); // what Enter does on a real button
    return { focused };
  });
  // The 100ms this used to wait was ample against an instant swap; step 6 puts a ~1.1s
  // curtain in front of the state change, so the wait has to be on the change itself.
  await page
    .waitForFunction(() => document.documentElement.classList.contains('cat-arena-on'), undefined, {
      timeout: 7000,
    })
    .catch(() => {});
  const armed = await page.evaluate(() =>
    document.documentElement.classList.contains('cat-arena-on'),
  );
  ok('reachable and operable by keyboard', viaKeyboard.focused && armed);

  const claims = await page.evaluate(CLAIM_COUNT);
  ok('pressing it claims part of the page', claims > 0, `${claims} claims`);
  ok(
    'aria-pressed follows the arena',
    (await btn.getAttribute('aria-pressed')) === 'true',
  );

  // ---- what it must never claim
  const forbidden = await page.evaluate(() => {
    const claimed = [...document.querySelectorAll('.cat-claimed')];
    return {
      inGlass: claimed.filter((c) => c.closest('.glass')).length,
      inHeader: claimed.filter((c) => c.closest('header, .tabbar')).length,
      inCatHud: claimed.filter((c) => c.closest('#cat-hud, #site-cat')).length,
      focusable: claimed.filter((c) => c.matches('a, button, input, select, textarea, [tabindex]'))
        .length,
      nested: claimed.filter((c) => claimed.some((o) => o !== c && o.contains(c))).length,
      tiny: claimed.filter((c) => {
        const r = c.getBoundingClientRect();
        return r.width * r.height < 900;
      }).length,
    };
  });
  ok('the hero pane is untouched, inside and out', forbidden.inGlass === 0);
  ok('the way out is untouched', forbidden.inHeader === 0);
  ok('the cat does not claim its own HUD', forbidden.inCatHud === 0);
  ok('nothing focusable is claimed', forbidden.focusable === 0);
  ok('no claim sits inside another', forbidden.nested === 0);
  ok('no claim is too small to read as one', forbidden.tiny === 0);

  // ---- the page must stay usable
  const usable = await page.evaluate(() => {
    const de = document.documentElement;
    const h1 = document.querySelector('.glass h1');
    return {
      hscroll: de.scrollWidth - de.clientWidth,
      heroLegible: !!h1 && !h1.closest('.cat-claimed'),
      linksClickable: [...document.querySelectorAll('main a[href]')].every(
        (a) => getComputedStyle(a).pointerEvents !== 'none',
      ),
      selectable: getComputedStyle(document.body).userSelect !== 'none',
      focusTrap: document.activeElement?.id === 'cat-arena-toggle',
    };
  });
  ok('no horizontal scrollbar at 1280 while claimed', usable.hscroll === 0, `${usable.hscroll}px`);
  ok('the hero headline is never a claim', usable.heroLegible);
  ok('every link stays clickable', usable.linksClickable);
  ok('text stays selectable', usable.selectable);
  ok('focus is where the visitor left it, not trapped', usable.focusTrap);
  ok('no console errors opening the arena', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---- 2. scrubbing: hold still, take it back
{
  const ctx = await fresh({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await press(page);
  await page.waitForTimeout(120);

  const before = await page.evaluate(CLAIM_COUNT);
  // park the pointer on the middle of a claim and hold it there
  const spot = await page.evaluate(() => {
    const c = document.querySelector('.cat-claimed');
    const r = c.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  });
  await page.mouse.move(spot.x, spot.y);
  await page.waitForTimeout(250);
  const ringMid = await page.evaluate(() => {
    const r = document.getElementById('cat-scrub');
    const fill = r?.querySelector('.scrub-fill');
    return {
      shown: r && !r.hidden,
      offset: fill ? parseFloat(getComputedStyle(fill).strokeDashoffset) : -1,
    };
  });
  ok('a ring appears where you are holding', ringMid.shown);
  ok(
    'the ring reports progress rather than sitting full',
    ringMid.offset > 0 && ringMid.offset < 106.81,
    `dashoffset ${ringMid.offset.toFixed(1)} of 106.81`,
  );

  await page.waitForTimeout(1500); // past SCRUB_MS 1400
  const after = await page.evaluate(CLAIM_COUNT);
  ok('holding still takes one back', after === before - 1, `${before} → ${after}`);

  const caption = await page.textContent('#cat-score .cat-caption');
  ok('the HUD says what you have reclaimed', /reclaimed/.test(caption), JSON.stringify(caption));

  // drifting resets the hold rather than banking it
  const spot2 = await page.evaluate(() => {
    const c = document.querySelector('.cat-claimed');
    const r = c.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  });
  const mid = await page.evaluate(CLAIM_COUNT);
  for (let i = 0; i < 14; i++) {
    await page.mouse.move(spot2.x + (i % 2 ? 14 : -14), spot2.y + (i % 3 ? 11 : -11));
    await page.waitForTimeout(120);
  }
  const drifted = await page.evaluate(CLAIM_COUNT);
  ok('drifting for longer than a scrub takes nothing', drifted === mid, `${mid} → ${drifted}`);
  await ctx.close();
}

// ---- 3. the restore: Esc puts the page back exactly
{
  const ctx = await fresh({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(600);

  const clean = await page.evaluate(SNAPSHOT);
  await press(page);
  await page.waitForTimeout(150);
  const fighting = await page.evaluate(SNAPSHOT);
  ok('the fight does change the page', fighting !== clean);

  // scrub one back first, so the restore has both kinds of element to put back
  const spot = await page.evaluate(() => {
    const c = document.querySelector('.cat-claimed');
    const r = c.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  });
  await page.mouse.move(spot.x, spot.y);
  await page.waitForTimeout(1600);

  await page.keyboard.press('Escape');
  await settled(page);
  const restored = await page.evaluate(SNAPSHOT);
  ok('Esc restores the DOM exactly as found', restored === clean);
  ok(
    'and drops the root class with it',
    !(await page.evaluate(() => document.documentElement.classList.contains('cat-arena-on'))),
  );
  ok(
    'the toggle un-presses itself',
    (await page.getAttribute('#cat-arena-toggle', 'aria-pressed')) === 'false',
  );
  const caption = await page.textContent('#cat-score .cat-caption');
  ok('the treat tally comes back', /treats/.test(caption), JSON.stringify(caption));
  ok('no ring left behind', await page.evaluate(() => document.getElementById('cat-scrub').hidden));

  // and the toggle still works afterwards
  await press(page);
  await page.waitForTimeout(120);
  ok('it can be switched on again', (await page.evaluate(CLAIM_COUNT)) > 0);
  await press(page);
  await settled(page);
  ok('and off again from the same button', (await page.evaluate(CLAIM_COUNT)) === 0);
  ok('off is a full restore too', (await page.evaluate(SNAPSHOT)) === clean);
  await ctx.close();
}

// ---- 4. nothing survives a page load, and nothing is stored
{
  const ctx = await fresh({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await press(page);
  await page.waitForTimeout(150);

  const stored = await page.evaluate(() => ({
    local: Object.keys(localStorage).filter((k) => /arena|cat/i.test(k)),
    session: Object.keys(sessionStorage).filter((k) => /arena|cat/i.test(k)),
  }));
  ok(
    'the game writes nothing to storage',
    stored.local.length === 0 && stored.session.length === 0,
    JSON.stringify(stored),
  );

  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(500);
  ok(
    'a refresh cannot land you mid-invasion',
    (await page.evaluate(CLAIM_COUNT)) === 0 &&
      (await page.getAttribute('#cat-arena-toggle', 'aria-pressed')) === 'false',
  );

  // client-side navigation: the toggle persists, so its listener has to as well
  await press(page);
  await page.waitForTimeout(150);
  await page.click('a[href="/about/"]');
  await page.waitForTimeout(900);
  ok(
    'navigating ends the fight rather than carrying a stale board',
    (await page.evaluate(CLAIM_COUNT)) === 0 &&
      (await page.getAttribute('#cat-arena-toggle', 'aria-pressed')) === 'false',
  );
  await press(page);
  await page.waitForTimeout(150);
  ok(
    'the toggle still works after a navigation',
    (await page.evaluate(CLAIM_COUNT)) > 0,
    'the persisted button keeps its listener',
  );
  await ctx.close();
}

// ---- 5. reduced motion: shown, explained, and inert
{
  const ctx = await fresh({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(600);

  const btn = page.locator('#cat-arena-toggle');
  ok('the invitation is still shown under reduced motion', await btn.isVisible());
  ok('and marked aria-disabled, not removed', (await btn.getAttribute('aria-disabled')) === 'true');
  const note = await page.textContent('#cat-arena-note');
  ok('it says why, in words', /motion/i.test(note), JSON.stringify(note.trim()));
  ok(
    'the note is what describes the button',
    (await btn.getAttribute('aria-describedby')) === 'cat-arena-note',
  );
  ok('it stays focusable so the reason is reachable', await btn.evaluate((b) => {
    b.focus();
    return document.activeElement === b;
  }));
  // Playwright refuses to click an aria-disabled button, which is its own small
  // vote of confidence — but the thing under test is our handler, so dispatch it.
  // Not `press()`: that one goes through `page.click`, and it would sit here for
  // Playwright's full actionability timeout waiting for a button that never enables.
  await page.evaluate(() => document.getElementById('cat-arena-toggle').click());
  await page.waitForTimeout(200);
  ok(
    'pressing it starts nothing',
    (await page.evaluate(CLAIM_COUNT)) === 0 &&
      !(await page.evaluate(() => document.documentElement.classList.contains('cat-arena-on'))),
  );
  await ctx.close();
}

// ---- 6. a touch screen: offered as of 1.2, where it used to be refused
{
  /*
   * This section used to assert the *refusal* — "but marked unavailable", "and says why" — which
   * was correct for eleven versions and is now exactly backwards. §5.2 rejected touch because a
   * press-and-hold has no aim and a finger covers what it holds, and 1.0's flee-and-hold
   * measurement implies a third objection neither the doc nor I had noticed: a mouse pays travel
   * time to reach safety and a finger teleports, so every hold would be free.
   *
   * All three are answered by scroll position being distance — the cat is `position: fixed` at
   * the bottom of the viewport and claims are not, so where you scroll a claim to *is* how far it
   * is from the cat. The full play-through lives in `touch-fight.mjs`; what belongs here is the
   * part this file has always owned: the toggle's semantics, and that a phone page is not damaged.
   */
  const ctx = await fresh({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const btn = page.locator('#cat-arena-toggle');
  ok('the toggle is shown on a phone', await btn.isVisible());
  ok('and is offered, not refused (1.2)', (await btn.getAttribute('aria-disabled')) === 'false');
  ok('so there is no reason-note to show', !(await page.locator('#cat-arena-note').isVisible()));
  const tap = await btn.evaluate((b) => b.getBoundingClientRect().height);
  ok('the target is tap-sized', tap >= 44, `${tap.toFixed(0)}px tall`);

  await btn.tap();
  await page.waitForFunction(() => !!document.querySelector('.cat-claimed'), undefined, { timeout: 9000 }).catch(() => {});
  ok('tapping it opens a fight', await page.evaluate(`document.documentElement.classList.contains('cat-arena-on')`));
  const hscroll = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  ok('no horizontal overflow at 390px, claims and all', hscroll === 0, `${hscroll}px`);
  // §11's zoom row is no-exceptions, and the obvious way to stop a hold being stolen by a scroll
  // (`touch-action: none`) would have broken it. `pinch-zoom` refuses panning only.
  const ta = await page.evaluate(() => {
    const c = document.querySelector('.cat-claimed');
    return c ? getComputedStyle(c).touchAction : '(no claim)';
  });
  ok('a claim refuses panning but never pinch-zoom (§11)', ta === 'pinch-zoom', JSON.stringify(ta));
  await btn.tap();
  await settled(page);
  ok('and the toggle ends it, with no Esc key on a phone', await page.evaluate(`!document.documentElement.classList.contains('cat-arena-on')`));
  await ctx.close();
}

// ---- 7. a narrow desktop window: claims must not widen the page
{
  const ctx = await fresh({ viewport: { width: 400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const before = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  await press(page);
  await page.waitForTimeout(200);
  const during = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  const claims = await page.evaluate(CLAIM_COUNT);
  ok(
    'tilting a full-width block never adds a horizontal scrollbar',
    during <= before,
    `${before} → ${during} with ${claims} claims`,
  );
  await ctx.close();
}

// ---- 8. contrast: a claim washes the block, and must not push text under AA
for (const theme of ['light', 'dark']) {
  const ctx = await fresh({ viewport: { width: 1280, height: 900 } });
  if (theme === 'dark') await ctx.addInitScript(() => localStorage.setItem('theme', 'dark'));
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await press(page);
  await page.waitForTimeout(200);

  const ratios = await page.evaluate(() => {
    // A claim washes the element's box with the accent at 12% via an inset
    // box-shadow, which paints above the background and below the text. So the
    // text colour does not move; the background it sits on does.
    const over = (fg, bg, a) => bg.map((c, i) => c * (1 - a) + fg[i] * a);
    const parse = (c) => (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const lum = ([r, g, b]) =>
      [r, g, b]
        .map((v) => v / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (a, b) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    /**
     * The colour actually painted behind this element. Walking up matters: an h2
     * has a transparent background, and reading that as a colour scores it against
     * black and reports a 1.37 ratio on a cream page — which was the first version
     * of this check measuring nothing.
     */
    const groundOf = (el) => {
      for (let n = el; n; n = n.parentElement) {
        const c = getComputedStyle(n).backgroundColor;
        const p = parse(c);
        if (p.length === 3 && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return p;
      }
      return [255, 255, 255];
    };
    // the wash colour, read from the token rather than hardcoded here
    const accent = parse(getComputedStyle(document.documentElement).getPropertyValue('--color-accent'))
      .length === 3
      ? parse(getComputedStyle(document.documentElement).getPropertyValue('--color-accent'))
      : (() => {
          // the token is a hex literal, so borrow the browser's own parser
          const probe = document.createElement('span');
          probe.style.color = 'var(--color-accent)';
          document.body.append(probe);
          const rgb = parse(getComputedStyle(probe).color);
          probe.remove();
          return rgb;
        })();
    const TINT = 0.07; // must match the box-shadow in CatArena.astro
    const out = [];
    for (const el of document.querySelectorAll('.cat-claimed')) {
      if (!el.textContent.trim()) continue;
      const cs = getComputedStyle(el);
      const opaque = !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor);
      const bgBefore = opaque ? parse(cs.backgroundColor) : groundOf(el.parentElement ?? el);
      out.push({
        tag: el.tagName + '.' + (el.className.split(' ')[0] || ''),
        before: ratio(parse(cs.color), bgBefore),
        after: ratio(parse(cs.color), over(accent, bgBefore, TINT)),
      });
    }
    return out;
  });
  const worst = ratios.reduce((a, r) => (r.after < a.after ? r : a), ratios[0]);
  ok(
    `${theme}: no claim pushes its own text under AA`,
    ratios.length > 0 && ratios.every((r) => r.after >= 4.5),
    `worst ${worst?.tag} ${worst?.before.toFixed(2)} → ${worst?.after.toFixed(2)} over ${ratios.length} claims`,
  );
  await ctx.close();
}

// ---- 8b. an entry page, where claimed elements carry inline styles of their own
{
  const ctx = await fresh({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/timeline/', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  /**
   * On this site the elements carrying inline styles (`.frame.blurup`, which holds
   * its LQIP there) always sit inside a `figure` or a card link, so `dropNested`
   * hands the claim to the wrapper and the inline style is never touched. That is
   * luck, not a guarantee — a future page could put a `.rail` or an `h2` with an
   * inline style at the top level. So stamp one on, and check the round-trip.
   */
  // Pick the victim by *watching a fight*, not by guessing the selector: the first
  // h2 or .rail on the page is usually nested inside a figure, so `dropNested`
  // hands the claim to the wrapper and a planted style there is never touched. One
  // round tells us which elements the board actually contains.
  await press(page);
  await page.waitForTimeout(160);
  await page.evaluate(() => {
    const c = document.querySelector('.cat-claimed:not([style*="background"])');
    if (c) c.dataset.plantHere = '1';
  });
  await press(page);
  await page.waitForTimeout(200);
  const planted = await page.evaluate(() => {
    const el = document.querySelector('[data-plant-here]');
    if (!el) return null;
    el.setAttribute('style', 'background-image:var(--lqip);outline-offset:2px');
    return el.getAttribute('style');
  });
  ok('planted an inline style on an element the cat actually claims', !!planted, String(planted));

  const clean = await page.evaluate(SNAPSHOT);
  let claimedPlanted = 0;
  for (let round = 0; round < 6; round++) {
    await press(page);
    await page.waitForTimeout(160);
    if (await page.evaluate(() => !!document.querySelector('[data-plant-here].cat-claimed'))) {
      claimedPlanted++;
    }
    await press(page);
    await settled(page);
    if ((await page.evaluate(SNAPSHOT)) !== clean) break;
  }
  ok(
    'six fights on a gallery page leave it byte-identical',
    (await page.evaluate(SNAPSHOT)) === clean,
  );
  ok(
    'and the planted inline style survived being claimed',
    claimedPlanted > 0 && (await page.evaluate(() => document.querySelector("[data-plant-here]").getAttribute('style'))) === planted,
    `claimed in ${claimedPlanted} of 6 rounds`,
  );
  ok('no errors on a page full of figures', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---- 8c. playing well is not the same as not playing (§11 vs §5.2)
{
  /*
   * The complement of the auto-truce below, and a real bug when this was written.
   *
   * `scrub.seen` — the idle clock — was refreshed only by `pointermove`. But the core verb of
   * this game is holding the pointer **still** (§5.2), and 1.0 measured flee-and-hold as the
   * counter the whole fight is built on: the better you play, the less you move. A player
   * pinned on one claim by a cat that keeps interrupting makes continuous progress, never
   * moves the mouse, and at `IDLE_TRUCE_MS` the game quietly ended itself under them.
   *
   * It survived four versions of browser testing because a truce and a win look identical from
   * outside — an empty board either way — and every harness had been asking "are the claims
   * gone" rather than "who won".
   *
   * **Siege, deliberately.** The scenario needs a claim that stays live under a stationary
   * cursor for longer than the truce window, and siege is the one stance that guarantees it:
   * it is pinned to the floor so it can never interrupt, and its regrow calls `takeGround()`,
   * which pops the *most recently freed* element — the one the parked cursor is sitting on. So
   * the hold completes, the board grows it back underneath, and the hold starts again. A first
   * attempt without pinning the stance drew a distant cat, the scrub completed once, and the
   * cursor then sat on a freed element doing nothing for 20s — which is a truce that is
   * entirely correct, and told me nothing about the bug.
   */
  const ctx = await fresh({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(600);

  let stance = '';
  let spot = null;
  for (let i = 0; i < 16 && !(stance === 'siege' && spot); i++) {
    await press(page);
    stance = await page.evaluate(`document.getElementById('site-cat')?.dataset.stance ?? ''`);
    spot = await page.evaluate(() => {
      const c = [...document.querySelectorAll('.cat-claimed')]
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), r };
        })
        .find((o) => o.r.top > 170 && o.r.bottom < innerHeight - 90);
      return c ? { x: c.x, y: c.y } : null;
    });
    if (stance === 'siege' && spot) break;
    await page.keyboard.press('Escape');
    await settled(page);
  }
  ok('rolled a siege fight with somewhere to hold', stance === 'siege' && !!spot, stance || '(none)');

  if (stance === 'siege' && spot) {
    // Exactly one pointer move, then nothing at all for longer than the idle truce.
    await page.mouse.move(spot.x, spot.y);
    await page.waitForTimeout(24_000);
    const after = await page.evaluate(() => ({
      armed: document.documentElement.classList.contains('cat-arena-on'),
      claims: document.querySelectorAll('.cat-claimed').length,
    }));
    ok(
      'a fight being played without mouse movement is not treated as abandoned',
      after.armed,
      `armed=${after.armed}, ${after.claims} claims after 24s on a single hold`,
    );
    await page.keyboard.press('Escape');
    await settled(page);
  }
  await ctx.close();
}

// ---- 9. auto-truce on a hidden tab
{
  const ctx = await fresh({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await press(page);
  await page.waitForTimeout(150);
  // Fake a long absence: the handler compares wall-clock stamps, so overriding
  // Date.now once is enough to test the rule without waiting ten seconds.
  await page.evaluate(async () => {
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    const real = Date.now;
    Date.now = () => real() + 20000;
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Date.now = real;
  });
  // The auto-truce goes out through the curtain like every other exit, so the page is
  // restored ~700ms after the rule fires rather than on the next tick.
  await settled(page);
  const ended = await page.evaluate(() => ({
    claims: document.querySelectorAll('.cat-claimed').length,
    pressed: document.getElementById('cat-arena-toggle').getAttribute('aria-pressed'),
  }));
  ok(
    'a long absence ends the fight by itself',
    ended.claims === 0,
    `${ended.claims} claims left`,
  );
  ok('and the button stops claiming to be on', ended.pressed === 'false');
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
