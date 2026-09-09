/**
 * gaze — does the cat actually look where you point, and does it stop when it should?
 *
 * §17. The cat has walked the bottom edge since 0.1 without ever acknowledging that anybody was
 * there; the gaze turns its head toward the pointer. Four things about it can go wrong quietly,
 * and this file exists for the second one.
 *
 *  1. It does nothing. Loud, and obvious the moment you look at the page.
 *  2. **It turns the wrong way when the cat faces left.** The flip is `scaleX(-1)` on the
 *     `.cat-flip` ancestor, so a rotation applied inside it is mirrored — and the sign has to be
 *     negated in the script to compensate. Get that wrong and the cat looks at your cursor's
 *     reflection, which is *invisible on a static screenshot* and only shows up if you watch it
 *     walk back the other way. That is the check this harness is really for.
 *  3. It freezes mid-glance when the pointer leaves, or when reduce-motion stops the loop.
 *  4. It stomps the blink. The eye, the head and the sprite already carry three `transform`
 *     animations, so the gaze uses the independent `rotate:`/`translate:` properties instead.
 *
 * **The measurement is the eye's screen offset from the skull's centre**, not the `rotate`
 * string and not the eye's offset within the cat's box. Two wrong versions came first and the
 * second is the instructive one.
 *
 * Reading `rotate` cannot answer "is it looking at the pointer" on a mirrored sprite: the same
 * value means opposite directions on the two facings, which is the entire thing being tested.
 *
 * So the first fix measured `eyeRect.x - rootRect.x` — the eye's position inside the cat's own
 * box, which is mirror-inclusive because the flip lives inside the root. It reported **10/10 and
 * a 40px swing** on the mirror check, against 2.4px on the un-mirrored one. That 40px was not
 * the gaze. The two samples were taken low on the screen, which is where the cat *chases*, so it
 * flipped back to facing right in between — and the "swing" was the head itself crossing the box
 * from the mirrored position (~7px) to the normal one (~41px). The check passed because
 * unrelated machinery supplied the evidence, which is the exact fault `card-mechanics` shipped a
 * version of and the GDD records: a green that cannot fail is worse than no check.
 *
 * `eyeCentreX - skullCentreX` fixes it properly. Both marks live *inside* the mirrored frame, so
 * their relative offset is what the reader sees on either facing, and it does not move when the
 * cat walks or flips. The samples are also taken **high** on the screen now — above
 * `withinNotice`, the bottom strip where a pointer provokes a chase — so the cat has something
 * to look at and no reason to turn round while being measured.
 *
 * **Verified against the bugs it exists for**, in two directions:
 *
 *  · With the mirror compensation removed (`m = 1` always), this file reports **12/13** and the
 *    one red is the mirror check — the eye reads -2.72px looking left and -2.96px looking right,
 *    i.e. it moves the *wrong way* by a quarter of a pixel. Nothing else notices. That is the
 *    shape of the fault: invisible on a screenshot, and caught by exactly one assertion.
 *  · With the gaze zeroed at its constants, **7/13** — the six checks that assert the feature
 *    does something all fail, and the ones that assert an *absence* (reduced motion, the
 *    grooming stand-down, the tap expiring) correctly stay green.
 *
 * A third reading came back false and is worth recording. Switching the feature off with an
 * early `return` and rebuilding with the output discarded reported 12/13 with the *previous*
 * run's failure text — the build had not taken and the preview was still serving the older
 * `dist`. Same instrument-lying pattern as the smooth-scroll sleep and the crosshair sample: the
 * number looked like an answer.
 */
import { launch, BASE, fresh, report } from './lib/fixture.mjs';

const { ok, note, fixture, done } = report();

/** Where the eye sits inside the cat's box, and what the head is wearing. */
const readGaze = (page) =>
  page.evaluate(() => {
    const root = document.getElementById('site-cat');
    if (!root) return null;
    const g = root.querySelector('.cat-gaze');
    // The pupil is what moves now: the eye was redrawn as a socket with a pupil inside it, so
    // the gaze translates the pupil rather than sliding the whole eye across the skull. The
    // skull carries a class for the same reason — it stopped being "the only other circle" when
    // it stopped being a circle.
    const eye = root.querySelector('.cat-pupil');
    const skull = root.querySelector('.cat-skull');
    if (!g || !eye || !skull) return null;
    const er = eye.getBoundingClientRect();
    const sr = skull.getBoundingClientRect();
    const cs = getComputedStyle(eye);
    return {
      // the visual answer, and the only one that survives the mirror: which side of the head's
      // centre the eye is on, in screen pixels
      eyeVsSkull: +(er.x + er.width / 2 - (sr.x + sr.width / 2)).toFixed(2),
      rotate: getComputedStyle(g).rotate,
      translate: cs.translate,
      blink: getComputedStyle(root.querySelector('.cat-eye')).animationName,
      faceLeft: root.classList.contains('face-left'),
      cls: root.className,
    };
  });

/** Park the pointer and let the ease settle — `GAZE_TAU_MS` is 200ms, so 5τ is home. */
const point = async (page, x, y) => {
  await page.mouse.move(x, y);
  await page.waitForTimeout(1000);
  return readGaze(page);
};

const browser = await launch();

/* ------------------------------------------------------------------ *
 * 1. it looks toward the pointer, on both facings
 * ------------------------------------------------------------------ */
{
  const ctx = await fresh(browser, { viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  const left = await point(page, 40, 300);
  const right = await point(page, 1240, 300);
  ok(
    'the eye moves toward the pointer',
    left && right && right.eyeVsSkull > left.eyeVsSkull + 0.3,
    `eye ${left?.eyeVsSkull}px from the head's centre looking left, ${right?.eyeVsSkull}px looking right`,
  );
  ok(
    'and the head turns with it',
    left && right && parseFloat(right.rotate) > parseFloat(left.rotate),
    `${left?.rotate} → ${right?.rotate}`,
  );
  ok(
    'both of those were measured on one facing, so they mean what they say',
    left?.faceLeft === false && right?.faceLeft === false,
    `faceLeft=${left?.faceLeft}/${right?.faceLeft}`,
  );

  /*
   * Now the mirror, which is what this file is for.
   *
   * Flipping the cat needs a chase: `hunt` sets `s.dir` from the sign of `prey.x - s.x`, but
   * only once the pointer is low enough to be noticed (`withinNotice` — the bottom ~150px at
   * level 0). So park low and far left to turn it round…
   */
  await page.mouse.move(30, 870);
  await page
    .waitForFunction(
      () => document.getElementById('site-cat')?.classList.contains('face-left') === true,
      null,
      { timeout: 15000, polling: 100 },
    )
    .catch(() => {});
  const mLeft = await readGaze(page);
  ok('the cat can be turned round, so the mirror can be tested at all', !!mLeft?.faceLeft,
     `faceLeft=${mLeft?.faceLeft}`);

  /*
   * …then look right *high up*. Above the notice strip the pointer is not chaseable, so the cat
   * keeps facing left while the gaze swings the other way — which is the only configuration in
   * which the sign of the mirror compensation is actually observable.
   */
  const mRight = await point(page, 1250, 220);
  ok(
    'it still stays facing left while being measured',
    mRight?.faceLeft === true,
    `faceLeft=${mRight?.faceLeft}`,
  );
  ok(
    'the mirror does not invert the gaze — facing left, it still looks toward the pointer',
    mLeft && mRight && mRight.eyeVsSkull > mLeft.eyeVsSkull + 0.3,
    `mirrored: eye ${mLeft?.eyeVsSkull}px looking left, ${mRight?.eyeVsSkull}px looking right`,
  );
  note(`raw rotate on the mirrored sprite: ${mLeft?.rotate} → ${mRight?.rotate}`);
  await ctx.close();
}

/* ------------------------------------------------------------------ *
 * 2. it stops, rather than freezing
 * ------------------------------------------------------------------ */
{
  const ctx = await fresh(browser, { viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await point(page, 1240, 300);
  const turned = await readGaze(page);
  await page.evaluate(() => document.dispatchEvent(new MouseEvent('mouseleave')));
  await page.waitForTimeout(1400);
  const gone = await readGaze(page);
  ok(
    'the head eases home when the pointer leaves the window',
    turned?.rotate !== 'none' && gone?.rotate === 'none' && gone?.translate === 'none',
    `${turned?.rotate} → ${gone?.rotate}, translate ${gone?.translate}`,
  );

  /*
   * The blink is the compose check. `cat-blink` animates `transform` on the eye and the gaze
   * writes `translate`, so both must survive together — if the gaze ever moves to `transform`
   * the cat stops blinking the moment it looks at you, which nobody would notice for months.
   */
  await page.mouse.move(1240, 300);
  await page.waitForFunction(
    () => {
      const root = document.getElementById('site-cat');
      // The offset lives on the pupil now, not on the eye — the eye is the socket it moves in.
      const pupil = root?.querySelector('.cat-pupil');
      return (
        !!root?.classList.contains('idle') &&
        !!pupil &&
        getComputedStyle(pupil).translate !== 'none'
      );
    },
    null,
    { timeout: 15000, polling: 150 },
  ).catch(() => {});
  const both = await readGaze(page);
  ok(
    'the cat still blinks while its eye is offset',
    both?.blink === 'cat-blink' && both?.translate !== 'none',
    `animation=${both?.blink}, translate=${both?.translate}`,
  );

  // A pose that owns the head already must win.
  await page.evaluate(() => document.getElementById('site-cat')?.classList.add('grooming'));
  await page.waitForTimeout(1400);
  const groom = await readGaze(page);
  ok(
    'and the gaze stands down while the cat grooms',
    groom?.rotate === 'none',
    `rotate=${groom?.rotate}`,
  );
  await ctx.close();
}

/* ------------------------------------------------------------------ *
 * 3. touch — "look at where I touch"
 * ------------------------------------------------------------------ */
{
  const ctx = await fresh(browser, { phone: true });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  /*
   * A tap in the cat's own strip — and the point is *computed*, not guessed.
   *
   * `SiteCat`'s touch path only logs a sighting if the tap clears two guards: it must miss
   * anything matching `INTERACTIVE`, and it must land inside `withinNotice` — the bottom
   * `150 + level * 14` px. The first version of this tapped a hard-coded (360, 700) on an 844px
   * viewport, which is **six pixels** inside that boundary and can land on a link depending on
   * where the page has settled. It passed, then failed on a later run. A fixture that is one
   * layout change away from silently not happening is not a fixture.
   */
  const spot = await page.evaluate(() => {
    // The whole strip, not one line of it. At 390px the hero's cover is a full-width `<a>`, so a
    // single row across the bottom can be entirely link — which is what the one-row version
    // found, and correctly refused to pretend otherwise.
    const h = window.innerHeight;
    const INTERACTIVE = 'a[href], button, input, select, textarea, summary, label';
    for (let y = h - 16; y > h - 140; y -= 12) {
      for (let x = 24; x < window.innerWidth - 24; x += 28) {
        const el = document.elementFromPoint(x, y);
        if (el && !el.closest(INTERACTIVE)) return { x, y };
      }
    }
    return null;
  });
  fixture('a patch of floor to tap that is not a link', spot, spot ? `(${spot.x}, ${spot.y})` : '');
  if (spot) {
    await page.touchscreen.tap(spot.x, spot.y);
    await page.waitForTimeout(900);
    const tapped = await readGaze(page);
    ok('a tap is looked at', tapped?.rotate !== 'none', `rotate=${tapped?.rotate}`);
  }
  await page.waitForTimeout(6000);
  const expired = await readGaze(page);
  ok(
    'and the tap is let go of when the sighting goes stale',
    expired?.rotate === 'none',
    `after the 5200ms hold: rotate=${expired?.rotate}`,
  );
  await ctx.close();
}

/* ------------------------------------------------------------------ *
 * 4. reduced motion — nothing at all, not a frozen glance
 * ------------------------------------------------------------------ */
for (const how of ['os', 'toggle']) {
  const ctx = await fresh(browser, {
    viewport: { width: 1280, height: 900 },
    ...(how === 'os' ? { reducedMotion: 'reduce' } : {}),
  });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  if (how === 'toggle') {
    await page.evaluate(() => document.documentElement.classList.add('a11y-motion'));
  }
  await page.waitForTimeout(1000);
  let worst = 'none';
  for (const x of [40, 1240, 640]) {
    await page.mouse.move(x, 300);
    await page.waitForTimeout(400);
    const r = await readGaze(page);
    if (r && r.rotate !== 'none') worst = r.rotate;
  }
  ok(
    `no gaze at all under reduced motion (${how === 'os' ? 'the media query' : 'the a11y toggle'})`,
    worst === 'none',
    `worst rotate seen: ${worst}`,
  );
  await ctx.close();
}

await browser.close();
if (!done()) process.exit(1);
