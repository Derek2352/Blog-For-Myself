/**
 * The ink curtain — step 6 of `docs/cat-boss-gdd.md` §12, specified in §14.
 *
 * **Nothing is loading.** The curtain is not covering a wait; it marks a state boundary.
 * The page does not change content when a fight opens, it changes *meaning* — the same h1
 * that was a headline a moment ago is territory — and a cut with no transition reads as a
 * rendering bug rather than a threshold crossed. The flood is what lets consent look like
 * an event.
 *
 * The hold is honest rather than padded: the arena query, the claim placement and the seed
 * roll genuinely happen inside it. On a fast machine that work takes a few milliseconds and
 * the floor keeps the curtain from flickering, but the floor is covering something real.
 *
 * Two halves, like `a11y-prefs.ts`: the beats are pure and tested, and the canvas driver
 * below them is browser-only. Nothing here is load-bearing — every failure path falls
 * through to the instant swap the arena has had since step 0 (§14.6).
 */
import {
  createField,
  injectStreak,
  reseedField,
  resetField,
  stepInk,
  type InkField,
} from './ink-field';
import { mulberry32, inkAfterDrying, valueNoise2 } from './ink';

/* ------------------------------------------------------------------ *
 * The beats (§14.3, §14.4) — pure
 * ------------------------------------------------------------------ */

/** `[PH 120]` ms before anything moves. Long enough to register, short enough not to lag. */
export const COMMIT_MS = 120;

/** `[PH 680]` ms of ink climbing. The eye needs about half a second to read a direction. */
export const FLOOD_MS = 680;

/** `[PH 250]` ms minimum under full ink, while the arena is actually built. */
export const HOLD_FLOOR_MS = 250;

/** `[PH 800]` ms of drying off. The slowest beat, because it is the one being read. */
export const REVEAL_MS = 800;

/**
 * `[PH 600]` ms to leave, and no hold — there is nothing to load on the way out, and a slow
 * exit reads as the site not letting you go. Pillar 2 is a promise about how fast Esc feels.
 */
export const REVERSE_MS = 600;

/**
 * `[PH 2000]` ms of total patience. Past this the animation is abandoned and the arena
 * simply swaps: a curtain that outstays the game is worse than no curtain (§14.6).
 */
export const WALL_MS = 2000;

/** `[PH 33]` ms a frame — 30fps. Short-lived, so it may run hotter than the hero wash's 10. */
export const FRAME_MS = 1000 / 30;

/** Reduced motion, or any fallback that still wants a beat: a dissolve, never a slow flood. */
export const DISSOLVE_MS = 120;

export type Beat = 'commit' | 'flood' | 'hold' | 'reveal' | 'done';

/** Total time the way in, ignoring any extra hold the real work asks for. */
export const FORWARD_MS = COMMIT_MS + FLOOD_MS + HOLD_FLOOR_MS + REVEAL_MS;

/**
 * Which beat `elapsed` lands in, going in.
 *
 * Driven by elapsed time rather than an accumulated counter, for the same reason the
 * pounce is (§5.3): a frame that takes half a second must not be able to skip a beat that
 * has real work inside it.
 */
export function beatAt(elapsed: number): Beat {
  if (elapsed < COMMIT_MS) return 'commit';
  if (elapsed < COMMIT_MS + FLOOD_MS) return 'flood';
  if (elapsed < COMMIT_MS + FLOOD_MS + HOLD_FLOOR_MS) return 'hold';
  if (elapsed < FORWARD_MS) return 'reveal';
  return 'done';
}

/**
 * How far the ink has climbed, 0..1 — the flood's *front*, not its opacity.
 *
 * §14.3 asks for ink that climbs from the bottom edge, and that cannot come out of the
 * simulation: diffusion needs hundreds of ticks to cross a plume, and the flood has about
 * twenty. So the clock drives the front and the ink supplies only its shape — which is the
 * right division anyway, because what makes it read as ink is the ragged edge, not the
 * speed of the physics.
 */
export function curtainRise(elapsed: number, dir: 'in' | 'out' = 'in'): number {
  const smooth = (t: number) => {
    const c = t < 0 ? 0 : t > 1 ? 1 : t;
    return c * c * (3 - 2 * c);
  };
  if (dir === 'out') return smooth(elapsed / (REVERSE_MS * 0.45));
  if (elapsed < COMMIT_MS) return 0;
  return smooth((elapsed - COMMIT_MS) / FLOOD_MS);
}

/**
 * How far through drying off, 0..1.
 *
 * The reveal is not a fade: the sheet thins from the inside the way the hero wash's ink
 * dries, so the page comes back *through* it. A modal fades; ink dries.
 */
export function curtainDry(elapsed: number, dir: 'in' | 'out' = 'in'): number {
  const smooth = (t: number) => {
    const c = t < 0 ? 0 : t > 1 ? 1 : t;
    return c * c * (3 - 2 * c);
  };
  if (dir === 'out') {
    const up = REVERSE_MS * 0.45;
    return elapsed <= up ? 0 : smooth((elapsed - up) / (REVERSE_MS - up));
  }
  const dryFrom = COMMIT_MS + FLOOD_MS + HOLD_FLOOR_MS;
  return elapsed <= dryFrom ? 0 : smooth((elapsed - dryFrom) / REVEAL_MS);
}

/**
 * How much of the screen the ink is taking, 0..1 — the product of the two above.
 *
 * This is the number §11's photosensitivity rule is about: it must rise once and fall once,
 * with no flicker in between, and it must never *snap*. The tests hold that shape.
 *
 * It is the **envelope**, not a per-pixel alpha: `paint` puts the rise into the position of
 * the front and the drying into a threshold, so a pixel deep inside the flood is opaque long
 * before this reads 1. What the two share is monotonicity, which is the whole of the rule —
 * and `scratchpad/arena6.mjs` measures the painted result on a real page rather than
 * trusting the arithmetic here to stand in for it.
 */
export function curtainAlpha(elapsed: number, dir: 'in' | 'out' = 'in'): number {
  return curtainRise(elapsed, dir) * (1 - curtainDry(elapsed, dir));
}

/**
 * Where along the bottom edge the flood is poured from, and how hard.
 *
 * A fan rather than a line: `injectStreak` throws lobed, pooled marks (it is the same call
 * the hero wash uses for a ladle of ink), so a row of them reads as ink rising rather than
 * as a rectangle growing. Deterministic from the seed, so a curtain can be replayed.
 */
export function pourPoints(gw: number, gh: number, seed: number, count = 7) {
  const rand = mulberry32(seed >>> 0);
  const out: { x: number; y: number; r: number; angle: number }[] = [];
  for (let i = 0; i < count; i++) {
    // spread across the width, jittered so the spacing is not a comb
    const t = (i + 0.5) / count;
    out.push({
      x: gw * (t + (rand() - 0.5) * 0.12),
      // just below the edge, so the marks arrive *from* off-screen
      y: gh + gh * 0.06 * rand(),
      r: gh * (0.34 + rand() * 0.22),
      // upward, fanned
      angle: -Math.PI / 2 + (rand() - 0.5) * 0.9,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * The driver. Browser-only from here down.
 * ------------------------------------------------------------------ */

/**
 * `[PH 5]` px per cell — coarser than the wash's 4, because this is a curtain, not a painting.
 *
 * Started at 8 and came down. The flood is fine at 8: the front is noise-driven and the
 * interior tone varies gently. The *reveal* is not, because drying amplifies the field's
 * differences, and at 8px the thing being amplified is the bilinear lattice — the sheet dried
 * into a regular mesh, which reads as a dither pattern rather than as paper.
 */
export const CELL = 5;

interface Run {
  raf: number;
  timer: number;
  cancelled: boolean;
  /** Held so `stop()` can clear the canvas: a cancelled run must never freeze ink on screen. */
  clear: () => void;
}

let field: InkField | null = null;
let live: Run | null = null;

/**
 * Run the curtain one way.
 *
 * `onCovered` is called once, during the hold, with the screen opaque — that is where the
 * arena gets built. It is called **exactly once** whatever happens afterwards, including
 * every failure path, because the transition is decoration and the state change is not.
 *
 * Returns a function that reverses from wherever it has got to (§14.6): an interruption
 * that has to wait for an animation to finish is not an interruption.
 */
export function runCurtain(
  canvas: HTMLCanvasElement,
  dir: 'in' | 'out',
  onCovered: () => void,
): () => void {
  stop();
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) {
    // §14.6: no context, no curtain, but the arena still opens.
    onCovered();
    return () => {};
  }

  const w = document.documentElement.clientWidth;
  const h = document.documentElement.clientHeight;
  const gw = Math.max(8, Math.ceil(w / CELL));
  const gh = Math.max(8, Math.ceil(h / CELL));

  /*
   * The output canvas is sized in **grid** pixels, not device pixels, and stretched to the
   * viewport by CSS. This is the hero wash's trick and the curtain needed it badly: painting
   * per device pixel meant a 1.15M-iteration loop with two bilinear samples each, every
   * frame, and measured at **13fps with 261ms gaps** — a flood that jumps half the screen in
   * one frame, which is precisely the snap §14.4 forbids. At grid resolution the same loop is
   * 46k iterations with direct array reads, and the browser's own bilinear upscale supplies
   * the softness the bilinear sampling was being asked for.
   */
  canvas.width = gw;
  canvas.height = gh;
  canvas.hidden = false;

  const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
  if (!field || field.gw !== gw || field.gh !== gh) field = createField(gw, gh, seed);
  else {
    resetField(field);
    reseedField(field, seed);
  }
  for (const p of pourPoints(gw, gh, seed)) {
    injectStreak(field, p.x, p.y, p.r, p.angle, 2.1, 1, 1, seed);
  }

  const rgb = curtainColour(canvas);
  const img = ctx.createImageData(gw, gh);
  const wipe = () => {
    canvas.hidden = true;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
  const run: Run = { raf: 0, timer: 0, cancelled: false, clear: wipe };
  live = run;

  const started = performance.now();
  let covered = false;
  let ticked = started;
  const total = dir === 'in' ? FORWARD_MS : REVERSE_MS;

  const finish = () => {
    if (!covered) {
      covered = true;
      onCovered();
    }
    wipe();
    if (live === run) live = null;
  };

  const frame = (now: number) => {
    if (run.cancelled) return;
    const elapsed = now - started;

    // §14.6: past the wall clock the animation is abandoned rather than indulged.
    if (elapsed > WALL_MS) {
      finish();
      return;
    }

    // Step the simulation at its own rate, so a slow device drops ink frames rather than
    // stretching the transition — the clock above is what the visitor is actually promised.
    if (now - ticked >= FRAME_MS) {
      ticked = now;
      stepInk(field!, 1);
    }

    const rise = curtainRise(elapsed, dir);
    const dry = curtainDry(elapsed, dir);
    paint(ctx, img, field!, gw, gh, rgb, rise, dry, seed);

    if (!covered && rise >= 0.995) {
      covered = true;
      onCovered();
    }

    if (elapsed >= total) {
      finish();
      return;
    }
    run.raf = requestAnimationFrame(frame);
  };
  run.raf = requestAnimationFrame(frame);

  return () => {
    if (run.cancelled) return;
    run.cancelled = true;
    cancelAnimationFrame(run.raf);
    clearTimeout(run.timer);
    if (live === run) live = null;
    // The state change is not optional, so an abort still delivers it.
    if (!covered) {
      covered = true;
      onCovered();
    }
    wipe();
  };
}

/**
 * Tear down anything still running, and clear the canvas with it.
 *
 * Cancelling the frame loop alone would leave whatever alpha the last frame painted sitting
 * over the page — a frozen ink sheet, which is worse than either state it was between.
 */
export function stop(): void {
  if (!live) return;
  cancelAnimationFrame(live.raf);
  clearTimeout(live.timer);
  live.cancelled = true;
  live.clear();
  live = null;
}

/**
 * The colour the screen floods toward — **always downward in luminance** (§14.4).
 *
 * In light mode that is the ink. In dark mode it is emphatically *not*: the ink there is a
 * pale pink, and a full-screen pale sheet over a dark page is a flashbang and a §11
 * violation. The stylesheet supplies `--curtain-ink` per theme; this only reads it.
 */
function curtainColour(canvas: HTMLElement): [number, number, number] {
  const raw = getComputedStyle(canvas).getPropertyValue('--curtain-ink').trim();
  const m = raw.match(/-?[\d.]+/g);
  if (m && m.length >= 3) return [Number(m[0]), Number(m[1]), Number(m[2])];
  if (/^#[0-9a-f]{6}$/i.test(raw)) {
    return [
      parseInt(raw.slice(1, 3), 16),
      parseInt(raw.slice(3, 5), 16),
      parseInt(raw.slice(5, 7), 16),
    ];
  }
  return [42, 36, 30]; // the light theme's ink, as a last resort
}

/**
 * One frame of curtain.
 *
 * Two jobs, and it took two wrong turns to see that they are different — and that they want
 * different channels:
 *
 * - **The shape of the front** is geometry, and it lives in the **alpha**. It comes from
 *   `valueNoise2` — the same value noise the wash's paper and pours are built from — sampled
 *   per column and drifting as the flood rises. The first version tried to take the front's
 *   raggedness from the ink field itself, which sounds more honest and produced a
 *   linear-gradient wipe: the field is *empty* above the pours, so there was nothing up there
 *   to be ragged with, and the only thing left was the ramp. A gradient sweeping up the page
 *   reads as a loading bar.
 * - **The texture inside it** is the field's, and it lives in the **colour**. That split is
 *   not stylistic: alpha is what "the screen is covered" means, and §14.3 puts the arena's
 *   construction behind full cover, so nothing that is merely decorative is allowed to make
 *   the sheet see-through. Mottling the ink's own darkness by a few percent is visible on an
 *   opaque sheet and cannot break the guarantee.
 *
 * The field is read raw here rather than through `coverage`, and that is the second wrong
 * turn worth recording. `COVERAGE_FULL` is 0.055 — it is calibrated for a wash where a
 * *hint* of pigment should already show. Measured against this flood, **83% of cells are
 * past it**, so `coverage` came back as 1 across almost the whole grid and the "texture"
 * was a constant. The raw load has the range the picture needed all along (p10 0, p50 1.19,
 * p90 1.91), so it is tone-mapped with a curve that does not saturate.
 *
 * `inkAfterDrying` then thins the sheet during the reveal — the same call the hero wash
 * uses — so the page returns through drying ink rather than through a dissolve.
 *
 * One cell per pixel: the canvas is the grid, and CSS stretches it over the viewport. So
 * there is no sampling here at all, and the `ImageData` is allocated once per curtain rather
 * than once per frame.
 */
function paint(
  ctx: CanvasRenderingContext2D,
  img: ImageData,
  f: InkField,
  gw: number,
  gh: number,
  rgb: [number, number, number],
  rise: number,
  dry: number,
  seed: number,
): void {
  const px = img.data;
  px.fill(0);
  const [r, g, b] = rgb;
  /** How deep the ragged band at the top of the flood is, in grid rows. */
  const edge = gh * 0.26;
  /*
   * The front travels from `gh + edge` (the whole band below the bottom edge, so nothing
   * shows) to `-edge` (the whole band above the top, so the cover is total) — the band's own
   * depth included at both ends. Getting that wrong is not subtle: an earlier version only
   * offset the top, so the flood was solid a fifth of the way before the beat was over.
   */
  const front = gh + edge - rise * (gh + 2 * edge);

  // Per-column front offsets, computed once: three octaves of the ink's own noise, drifting
  // upward with the flood so the edge crawls rather than sliding as a rigid shape. Three and
  // not two because the finest one is the only thing at the scale a bleeding edge actually
  // has, and the first attempt buried it under a ramp four times its wavelength.
  const cols = new Float32Array(gw);
  for (let x = 0; x < gw; x++) {
    const n =
      valueNoise2(x * 0.05, rise * 3.1, seed) * 0.58 +
      valueNoise2(x * 0.13, rise * 5.3, seed + 77) * 0.28 +
      valueNoise2(x * 0.34, rise * 8.7, seed + 151) * 0.14;
    cols[x] = front - edge * n;
  }

  /** How soft the boundary is, in grid rows. Ink on damp paper bleeds; it does not gradient. */
  const bleed = edge * 0.09;

  for (let y = 0, i = 0, c = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++, i += 4, c++) {
      let a = (y - cols[x]!) / bleed;
      if (a <= 0) continue;
      if (a > 1) a = 1;
      const load = f.dep[c]! + f.wet[c]! * 0.9;
      // 0 → 0, 1.2 → 0.52, 3 → 0.73: range where the load actually lives, no ceiling.
      const ink = load / (load + 1.1);
      if (dry > 0) {
        /*
         * The reveal is where the texture is allowed back into the alpha, and it has to be:
         * `inkAfterDrying` is a *threshold*, so it returns 1 for a cell at 1 whatever the
         * presence, and a perfectly uniform sheet would sit at full opacity and then vanish
         * on one frame — the snap §14.4 exists to forbid. Thinning toward the field's own
         * load first gives the threshold something to bite on, and the page comes back
         * through the sheet's light patches the way ink leaves paper thin-parts-first.
         *
         * Ramped in by `dry` rather than switched on, so the moment drying starts is not a
         * step: at dry = 0 this is exactly 1.
         */
        a *= 1 - dry * (0.65 - 0.65 * ink);
        a = inkAfterDrying(a, 1 - dry);
      }
      if (a <= 0.004) continue;
      // Heavier ink sits darker. Bare paper under the sheet lifts it, never past the point
      // where it stops reading as the same ink.
      const tone = 1.34 - 0.48 * ink;
      px[i] = Math.min(255, Math.round(r * tone));
      px[i + 1] = Math.min(255, Math.round(g * tone));
      px[i + 2] = Math.min(255, Math.round(b * tone));
      px[i + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
}
