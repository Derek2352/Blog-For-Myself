/**
 * The cat, drawn once.
 *
 * **Why this file exists at all.** The silhouette was authored three times — `#site-cat`,
 * `CatCard`'s launcher icon, and `CatCard`'s boss (whose kittens are cloned from it) — as
 * byte-for-byte copies of the same path data. `CatCard.astro` said so out loud and treated the
 * duplication as the *fix* for an earlier divergence: its copy had once dropped the legs and the
 * head, so "the cat was a floating loaf", and the repair was to paste the real drawing back in.
 * That was the right call at the time and the wrong shape for it. Three copies agreeing today is
 * not a guarantee; it is a coincidence that has already failed once. The drawing is data, so it
 * lives in one place and the components interpolate it.
 *
 * Not a component, and deliberately not `<use>`. Each copy animates *different parts* under
 * different class names — `.cat-tail` here, `.cat-card-tail` there, `.cat-card-boss-tail` in the
 * third — and a `<use>` clone hands you a shadow subtree those rules cannot reach. Exported path
 * strings keep every existing selector working and still make divergence impossible.
 *
 * ---
 *
 * **The drawing.** A 64×40 view box, rendered at 48×30 CSS px, one flat `currentColor` fill, and
 * a single knocked-out eye. It stays an ink silhouette: `CatCard.astro` records an attempt to
 * make it friendlier with "a bigger dome and a two-eyed smile" and the verdict that it "made it
 * worse: that is a cartoon, and this site draws ink silhouettes". Nothing here adds an interior
 * mark. Every gain is in the *outline*, because the outline is all a silhouette has, and because
 * the sprite carries `drop-shadow(0 0 2.5px var(--color-ground))` — a paper halo that smears
 * fine interior detail but leaves a contour alone.
 *
 * What actually changed, against the drawing this replaces:
 *
 *  · **The body was a lozenge with a straight back.** It now has the four landmarks that make a
 *    quadruped read as a cat rather than as a loaf: a haunch that rises above the spine, a dip
 *    behind it, a shoulder that rises again, and a belly tucked up between the leg pairs. Judged
 *    at 48px on a bench (`scratchpad/art/rig.mjs`) against the old one, this is the single
 *    biggest gain and the only one that survives all the way down to 1×.
 *  · **The legs were four rounded rectangles.** They taper from hip to ankle and end in a paw.
 *    The taper is 3px to 2px at true size — small, and the difference between a leg and a bar.
 *    Checked mid-stride as well as standing, because `cat-step` swings them ±16° and a pose that
 *    only works standing still is no use on an animal that walks.
 *  · **The tail was a uniform 3.4-wide stroke.** It is a filled path that tapers to a point, and
 *    its base reaches far enough into the rump that the two masses merge instead of butting.
 *  · **The head was a circle.** It has a skull, a brow, a short muzzle and a chin, and its throat
 *    is buried inside the shoulder so no seam shows where the two overlap — the fault that made
 *    the first attempt look like a head stuck on a body.
 *
 * **And then the proportions were wrong, which took being told.** The first version that fixed
 * all of the above got the verdict *"shouldn't it look more like a cat instead of a Pokémon"* —
 * correct, and nameable: a big head, a big eye, wide-splayed ears, a deep chest and short legs
 * are chibi proportions, and four of those had crept in one improvement at a time. A cat in
 * profile has a **small** head (about a fifth of the body, not a third), a small eye, ears close
 * together, a shallow chest, and legs about half its standing height. Head shrunk, eye halved,
 * ears drawn in, chest raised, legs lengthened — and then the haunch and shoulder had to be put
 * *back*, because flattening the chest to fix the proportions had turned the torso into a
 * sausage. Each landmark is load-bearing for a different reason, which is why they were bought
 * back one at a time on the bench rather than tuned by feel.
 *  · **The eye was a 1.15r dot.** It is an almond with a pupil inside it, which is what lets the
 *    gaze (§17) be carried by the eye rather than only by the angle of the head.
 *
 * Coordinates are hand-tuned to each other. Moving one landmark without re-rendering the bench
 * is how a haunch ends up detached from a spine.
 */

/** The tail. Tapered, and based far enough inside the rump that the masses merge. */
export const CAT_TAIL_D =
  'M15.4 24.2 C10.3 22.6 6.6 17.6 8.2 11.8 C9.0 9.2 10.6 6.9 12.0 5.7 ' +
  'C12.9 4.9 14.0 5.6 13.6 6.7 C13.0 8.2 11.7 9.9 11.1 12.0 ' +
  'C9.7 16.4 12.1 20.0 15.6 21.6 C16.9 22.2 16.8 24.4 15.4 24.2 Z';

/** Haunch, dip, shoulder, tucked belly — in that order, going clockwise from the rump. */
export const CAT_BODY_D =
  'M13.6 20.4 C12.9 15.0 15.6 12.6 20.0 12.5 C24.2 12.4 27.4 13.8 31.2 14.8 ' +
  'C35.8 16.0 40.4 14.0 45.0 13.5 C49.4 13.1 52.6 14.6 53.8 17.4 ' +
  'C54.6 19.3 54.5 21.6 53.4 23.2 C52.6 24.4 51.0 24.6 49.8 24.0 ' +
  'C44.8 22.2 39.2 22.8 34.4 23.3 C28.4 23.9 23.0 24.9 18.6 24.8 ' +
  'C15.7 24.7 14.0 23.1 13.6 20.4 Z';

/**
 * The skull, with the throat deliberately short.
 *
 * The jaw ends at about (52.6, 18.5) — *inside* the body's shoulder, which rises to meet it. That
 * overlap is the whole trick: two shapes of the same colour merge invisibly, and the earlier
 * version's head looked bolted on only because its throat line protruded past the chest.
 */
export const CAT_HEAD_D =
  'M50.0 12.4 C50.2 9.2 52.0 7.1 54.6 7.0 C57.2 6.8 59.4 7.9 60.6 9.5 ' +
  'C61.2 10.3 61.6 11.2 61.7 12.0 C61.8 12.6 61.3 12.9 60.7 12.8 ' +
  'C60.9 13.4 60.6 14.1 59.8 14.7 C58.2 16.0 55.6 16.9 53.2 16.8 ' +
  'C51.2 16.7 50.0 15.0 50.0 12.8 Z';

/**
 * Two ears, pulled apart on purpose.
 *
 * The first redraw tucked the far ear close behind the near one, which is what a real profile
 * does — and lost the silhouette. **One ear is a fox; two is a cat**, and at 48px the pair of
 * triangles is doing more recognition work than the muzzle ever will. So the far ear keeps its
 * height and its gap even though a photographer would not see it that way.
 *
 * Each is its own element because `.cat-ear` is rotated independently (the flick, and the arena's
 * pounce wind-up), hinged at `center bottom` of its own `fill-box` — so the base has to be the
 * bottom of the path's bounding box, which it is.
 */
export const CAT_EAR_FAR_D =
  'M50.6 10.6 C50.3 6.8 50.7 3.8 51.5 2.8 C52.1 2.1 52.8 2.5 53.4 3.5 ' +
  'C54.3 5.0 55.1 6.6 55.5 7.7 Z';
export const CAT_EAR_NEAR_D =
  'M56.4 7.6 C57.5 5.4 58.7 3.4 59.5 2.7 C60.2 2.1 60.9 2.5 61.0 3.6 ' +
  'C61.3 5.5 61.3 7.9 61.1 9.8 Z';

/**
 * A leg, tapered, with a paw.
 *
 * `lean` shifts the foot relative to the hip, so the hind pair can stand under the haunch and the
 * fore pair under the chest without four identical posts. The bounding box's top edge stays the
 * hip, because `.cat-leg` swings from `center top` and a hinge in the middle of a leg is a knee.
 *
 * @param x    hip's left edge, in view-box units
 * @param lean how far the foot sits forward (+) or back (−) of the hip
 */
export const catLegD = (x: number, lean: number): string => {
  const w = 3.2;
  const b = x + lean;
  const f = (n: number) => n.toFixed(1);
  return (
    `M${f(x)} 22.4 L${f(x + w)} 22.4 L${f(b + w - 0.5)} 35.6 ` +
    `C${f(b + w - 0.5)} 36.6 ${f(b + w + 0.3)} 37.1 ${f(b + w + 0.3)} 37.8 ` +
    `C${f(b + w + 0.3)} 38.4 ${f(b + w - 0.45)} 38.7 ${f(b + 1.45)} 38.7 ` +
    `C${f(b + 0.45)} 38.7 ${f(b - 0.3)} 38.4 ${f(b - 0.3)} 37.8 ` +
    `C${f(b - 0.3)} 37.1 ${f(b + 0.5)} 36.6 ${f(b + 0.5)} 35.6 Z`
  );
};

/**
 * The four legs, hip-x and lean, near pair last so it draws over the far pair.
 *
 * `a` and `b` are the two alternating walk phases (`cat-step` runs them half a cycle apart), and
 * they are deliberately *diagonal* — a hind leg and the opposite fore leg share a phase, which is
 * how a cat actually walks and costs nothing to arrange here.
 */
export const CAT_LEGS: readonly { x: number; lean: number; phase: 'a' | 'b' }[] = [
  { x: 17.2, lean: 1.0, phase: 'a' },
  { x: 23.4, lean: 0.5, phase: 'b' },
  { x: 38.6, lean: -0.3, phase: 'a' },
  { x: 44.6, lean: -0.8, phase: 'b' },
];

/**
 * The eye: an almond, and a pupil that can move inside it.
 *
 * The pupil is what §17's gaze translates, and the almond is what bounds it — `GAZE_EYE_UNITS` is
 * derived from these two radii rather than from the skull, which is a tighter and more honest
 * bound than the one it replaces.
 *
 * A vertical-ish pupil (`ry` > `rx`) reads as a cat rather than as a dot, and costs nothing.
 */
export const CAT_EYE = { cx: 56.8, cy: 11.4, rx: 1.15, ry: 0.95 } as const;
export const CAT_PUPIL = { rx: 0.5, ry: 0.72 } as const;

/**
 * The collar (§7.1's patience reward) — seated by measurement, after three tries by eye.
 *
 * The three that failed, because each one taught the next: the original arc sat at x 47.5–49.5,
 * behind the jaw and inside the body, where nothing showed. The first re-seat overcorrected and
 * hung it under the jaw, where it read as a tongue — the head is drawn *over* it, so the only part
 * left was the inch escaping below the chin. The second crossed the throat correctly and still put
 * its upper cap out in open paper behind the skull's back edge at x 50.
 *
 * `scratchpad/marks.mjs` found the third fault and named the cause. A stroke's *outline* is what
 * has to be contained — caps included, and a round cap is half a stroke-width past its path — and
 * the throat is a corridor barely two units wide between the skull's back edge and the jaw. So the
 * endpoints came out of a search over 730 seatings that stay inside skull ∪ shoulder at every angle
 * the head can turn, not out of another guess: the longest one, at the widest stroke that fits.
 *
 * The bow is the point. A straight line across a neck is a strap; a line that bellies forward
 * follows the throat, which is what a collar does.
 */
export const CAT_COLLAR_D = 'M52.1 12.4 Q52.55 14.2 52.3 16.0';

/**
 * The notch (§7.1's confrontation reward) — a mark *on* the near ear, not a bite out of it.
 *
 * Pulled inboard three times, and the third time with a ruler. Seated by eye off the old drawing it
 * ran to x 62.4 with a 2.2 round cap, so half the stroke hung past the ear's outer edge and the
 * reward read as a flag stuck to the cat's head. The correction moved it inboard — and escaped the
 * *inner* edge instead, by the same half cap, into the gap between the ears. Both times the mark
 * was measured as a path when what shows is an outline.
 *
 * It also outgrew its host without moving: the Pokémon fix drew the ears closer and smaller, and a
 * mark that had been a nick on the old ear was 70% of the width of the new one. `marks.mjs` checks
 * that ratio now, because a mark and its host drifting apart is invisible in a diff and obvious at
 * 8×.
 */
export const CAT_NOTCH_D = 'M58.9 5.8 L59.9 6.3';
