/**
 * The ambient cat — the state machine, the walk, the treat hunt, and §17's gaze.
 *
 * ## Why this is a module
 *
 * This was 1,095 lines inside `SiteCat.astro`'s `<script>`. The Next build needs the identical
 * behaviour, and the alternative to extracting it was a second copy of the state machine that
 * `docs/cat-boss-gdd.md` specifies and that thirty-five harnesses measure. Two copies of that is
 * two cats: the harnesses would keep passing against whichever one they were pointed at, and the
 * other would drift unobserved. So the engine lives here and both components are markup plus a
 * lifecycle call — the same arrangement `ink-wash.ts` uses, for the same reason.
 *
 * The DOM contract is unchanged, deliberately: every id, class and `data-` attribute the harnesses
 * select on is exactly what it was. A migration that also renamed things could not tell you
 * whether the migration was correct.
 *
 * ## Lifecycle
 *
 * `initSiteCat(root)` is idempotent — it guards on `root.dataset.init`, because the cat element
 * outlives any single page. `siteCatPageChanged()` is the per-navigation half: the treat has to be
 * reconsidered for each page, and doing it through one exported call adds no listener per
 * navigation, which is how this codebase has leaked handlers before.
 */

import { motionReduced } from '@/lib/a11y-prefs';
import {
  resolveTreat,
  captionFor,
  tallyFor,
  levelFor,
  isComplete,
  isTopState,
  HUD_DWELL_MS,
  PERCH_STILL_MS,
  PERCH_SNAP_PX,
  PERCH_BREAK_PX,
  GAZE_YAW_DEG,
  GAZE_EYE_UNITS,
  GAZE_NOD_RATIO,
  GAZE_TAU_MS,
} from '@/lib/cat-game';

const CAT_W = 48;
const CAT_H = 30;

/**
 * Below this the room is too small for the edge repertoire.
 *
 * Climbing a side wall and slipping out of the room were written for a desktop,
 * where the margins are empty and the cat reaches an edge maybe once a minute.
 * On a 390px floor it reaches one every few seconds: measured over 150 seconds
 * on a phone, the cat spent 9% of the time flat against a wall, 7% partly
 * off-screen, and 17% within 8px of an edge. Same behaviour, a third of the
 * visit. Narrow screens get the floor only.
 */
const ROOMY_W = 720;

/**
 * Session progress. Module scope on purpose: Astro runs this script once per
 * document, so the tally survives moving between pages and dies on a refresh —
 * which is exactly the ask. Nothing is written to storage, so there is nothing
 * to clear and no state a returning visitor inherits.
 */
const game = {
  found: new Set<string>(),
  /** Slugs worth finding, read from the rendered tab bar rather than hardcoded. */
  tabs: [] as string[],
  level: 0,
  celebrated: false,
};

/**
 * The collection is whatever paws were rendered — which come from
 * getNavCategories(), the same source as the tab bar. Reading them here rather
 * than scraping the nav keeps one source of truth.
 */
function readTabs(): string[] {
  return [...document.querySelectorAll<HTMLElement>('#cat-score .cat-paw[data-slug]')]
    .map((p) => p.dataset.slug!)
    .filter(Boolean);
}

/**
 * Which tab this page belongs to, if any.
 *
 * Read from `data-cat-tab` on the body, which `PageWash` stamps from the page's
 * own category. This used to take the first path segment, so only the seven
 * category index pages hid anything — and those are pages a visitor passes
 * through on the way to an entry, not pages they stop on. Most visits never
 * triggered the game at all. An entry or a log now counts towards its section,
 * which is what "looked around the site" ought to mean.
 */
function currentTab(tabs: string[]): string | null {
  const tab = document.body.dataset.catTab ?? '';
  return tabs.includes(tab) ? tab : null;
}

interface CatState {
  x: number;
  dir: 1 | -1;
  speed: number;
  mode: 'walk' | 'idle' | 'away' | 'climb' | 'chase' | 'fetch';
  /** x of the treat the cat is heading for, in `fetch` mode. */
  treatX: number;
  until: number;
  climbY: number;
  climbSide: 1 | -1;
  climbPhase: 'up' | 'rest' | 'down';
  pounceCooldown: number;
}

export function initSiteCat(root: HTMLElement): void {
  if (root.dataset.init) return;
  root.dataset.init = '1';

  // Reduce motion — whether from the OS setting or the site's accessibility
  // toggle — parks the cat idle instead of letting it wander. Checked live
  // (see the observers at the end), so flipping the accessibility control
  // starts or stops the cat without a reload.
  const gazeEl = root.querySelector<SVGGElement>('.cat-gaze');
  const gazeEye = root.querySelector<SVGEllipseElement>('.cat-pupil');
  /** Where the gaze is *now*, in the same units as its targets, so it can be eased. */
  const gaze = { yaw: 0, ex: 0, ey: 0, t: performance.now() };

  /**
   * Poses that own the head already, and one that makes the gaze meaningless.
   *
   * `grooming` and `munching` animate `.cat-head` directly; `dozing` and `stretching` curl or
   * squash the whole sprite. Turning the head in the middle of any of those is two animations
   * arguing. `perched` is different — the cat is sitting *on* the cursor, so "look at the
   * pointer" resolves to "look at your own feet" and reads as a twitch. `climb` is the fourth
   * kind: `render` has already rotated the entire sprite 90° onto a wall, so the neck no
   * longer points where this maths thinks it does.
   */
  const GAZE_MUTE = ['grooming', 'munching', 'dozing', 'stretching', 'perched'];

  /**
   * Put the head straight, and remove the properties rather than zeroing them.
   *
   * `paintGaze` clears itself once it eases home, but it only runs while the rAF loop runs —
   * and the one case that matters most is the loop *stopping*: reduce-motion bails out of
   * `tick` at the top, so without this a cat caught mid-glance would keep a turned head for
   * the rest of the visit, which is precisely the "frozen frame" the reduced-motion promise
   * exists to rule out. `parkIdle` is the shared exit for both that path and `stop()`.
   */
  const clearGaze = () => {
    gaze.yaw = gaze.ex = gaze.ey = 0;
    gazeEl?.style.removeProperty('rotate');
    gazeEye?.style.removeProperty('translate');
  };

  const parkIdle = () => {
    /*
     * Through `unperch`, not by stripping the class: the perch is a *flag* as well as two
     * classes, and this used to clear only the classes. Reduce-motion turned on mid-perch
     * then stopped the loop with `perched` still true — so when it was turned back off, the
     * first `hunt` frame saw a stale `perched`, measured against `PERCH_BREAK_PX` instead of
     * `PERCH_SNAP_PX`, found itself already "close enough", and skipped `perch()` because
     * `!perched` was false. The cat then held the frame forever, 20px off the cursor, with
     * none of the curl-up it thinks it is wearing. The same desync `arena.want` was added for.
     */
    unperch(); // removes `perched` and `dozing`
    root.classList.remove('walking', 'chasing', 'pounce', 'startled');
    root.classList.add('idle');
    clearGaze();
  };
  let running = false;

  const s: CatState = {
    x: Math.min(140, document.documentElement.clientWidth * 0.2),
    dir: 1,
    speed: 42,
    mode: 'walk',
    until: performance.now() + 4000,
    climbY: 0,
    climbSide: 1,
    climbPhase: 'up',
    pounceCooldown: 0,
    treatX: -1,
  };
  const rand = (a: number, b: number) => a + Math.random() * (b - a);

  /**
   * `documentElement.clientWidth`, not `window.innerWidth`: innerWidth counts a
   * classic vertical scrollbar, but the cat is position: fixed and so lives in
   * the viewport *inside* it. Using innerWidth walked the cat's back half under
   * the scrollbar on any browser that doesn't use overlay scrollbars.
   */
  const viewportW = () => document.documentElement.clientWidth;

  /**
   * The back-to-top button parks in the bottom-right corner (right: 1rem, 2.6rem
   * square) on long pages and paints above the cat, so a cat that reached the
   * far right slid behind it — a 32x14px overlap. Treat that corner as
   * furniture: while the button is showing, the patrol stops short of it. The
   * button only appears after you scroll, which is why this only happened
   * sometimes.
   */
  const CORNER_GUARD = 68; // 1rem gap + 2.6rem button + a little air
  const cornerBusy = () => !!document.querySelector('.to-top.show');

  /** Is there room for the wall-climb and the off-screen exit? */
  const roomy = () => viewportW() >= ROOMY_W;
  /**
   * How far the patrol stops short of each wall. A cat pressed flat into the
   * corner of a phone reads as stuck rather than as a cat; on a wide screen a
   * token gap is enough, because the walls are nowhere near the reading.
   */
  const edgeInset = () => (roomy() ? 6 : 18);
  const minX = () => edgeInset();
  const maxX = () => viewportW() - CAT_W - edgeInset() - (cornerBusy() ? CORNER_GUARD : 0);

  /**
   * The visitor's pointer is, as far as the cat is concerned, a mouse.
   *
   * `hold` is how long this sighting stays interesting. A moving cursor
   * re-reports itself constantly, so it only needs a short window; a tap
   * reports once, and without a longer window the cat would give up crossing
   * the room before it arrived.
   */
  const prey = {
    x: -9999,
    y: -9999,
    t: 0,
    hold: 2500,
    /**
     * Where the pointer settled, and when — §7.1's top state needs "still", which `t`
     * cannot express because it is re-stamped by every move. Movement past
     * `PERCH_BREAK_PX` counts as going somewhere; anything less is a hand resting.
     */
    sx: -9999,
    sy: -9999,
    still: 0,
    /**
     * Is the pointer even in the window? A mouse that left stops reporting, so the last
     * sighting stays valid forever — and the cat would sit on a cursor that is not there.
     */
    here: false,
  };
  const sight = (x: number, y: number, hold = 2500) => {
    prey.x = x;
    prey.y = y;
    prey.hold = hold;
    prey.t = performance.now();
    prey.here = true;
    if (Math.hypot(x - prey.sx, y - prey.sy) > PERCH_BREAK_PX) {
      prey.sx = x;
      prey.sy = y;
      prey.still = prey.t;
    }
  };
  window.addEventListener('pointermove', (e) => sight(e.clientX, e.clientY), { passive: true });
  // Leaving the document is the one way a pointer stops existing without saying so.
  document.addEventListener('mouseleave', () => (prey.here = false));
  document.addEventListener('mouseenter', () => (prey.here = true));

  /**
   * How far up the page the cat bothers to notice you. The fonder it is the
   * higher it looks — which, along with how hard it then runs, is what the
   * treats actually buy. Both the cursor hunt and a tap-to-summon measure
   * against this, so what the cat responds to is one rule rather than two.
   */
  const withinNotice = (y: number) => y > window.innerHeight - (150 + game.level * 14);

  const setClasses = () => {
    // `walking` can never apply under reduced motion, whatever the state
    // machine thinks: collecting a treat calls through here, and without this
    // guard it re-attached the walk cycle to a cat that is supposed to be sat
    // still.
    root.classList.toggle(
      'walking',
      !motionReduced() &&
        (s.mode === 'walk' ||
          s.mode === 'away' ||
          s.mode === 'climb' ||
          s.mode === 'chase' ||
          s.mode === 'fetch'),
    );
    root.classList.toggle('chasing', s.mode === 'chase');
    root.classList.toggle('idle', s.mode === 'idle');
    root.classList.toggle('face-left', s.dir === -1);
    // affection tier as a class, so the CSS can widen the idle repertoire
    for (let i = 0; i <= 6; i++) root.classList.toggle(`lv${i}`, game.level >= i);
  };

  // ---------------------------------------------------------------------
  // The reward loop: one treat per tab, and a cat that warms to you.
  // ---------------------------------------------------------------------
  /*
   * These live outside the persisted cat, so hold them by id rather than by
   * reference. Both carry `transition:persist` now, but they did not at first —
   * and the router replaced them on every navigation while this closure kept
   * writing to the detached originals. The symptom was a cat that climbed to
   * the top affection tier with an empty paw row. Re-resolving when the cached
   * node is no longer in the document makes that unrepeatable.
   */
  let treatRef: HTMLElement | null = null;
  let scoreRef: HTMLElement | null = null;
  const live = (cached: HTMLElement | null, id: string): HTMLElement | null =>
    cached?.isConnected ? cached : document.getElementById(id);
  const treat = () => (treatRef = live(treatRef, 'cat-treat'));
  const scoreBox = () => (scoreRef = live(scoreRef, 'cat-score'));

  /**
   * Paint the paw row. Length follows the tab count, so it can't go stale.
   *
   * The line under the paws is the whole difference between a tally and seven
   * unexplained dots, so it is always populated: `2 / 7 treats` at rest, and the
   * level phrase for a few seconds after a find.
   */
  const renderScore = () => {
    const scoreEl = scoreBox();
    if (!scoreEl) return;
    const total = game.tabs.length;
    if (total === 0) {
      // nothing published to hunt for — no paws, so nothing to explain
      scoreEl.setAttribute('data-empty', '');
      return;
    }
    scoreEl.querySelectorAll<HTMLElement>('.cat-paw[data-slug]').forEach((paw) => {
      paw.classList.toggle('got', game.found.has(paw.dataset.slug!));
    });
    const caption = scoreEl.querySelector('.cat-caption')!;
    caption.textContent = scoreEl.classList.contains('announce')
      ? captionFor(game.found.size, total)
      : tallyFor(game.found.size, total);
    scoreEl.removeAttribute('data-empty');
  };

  /**
   * Raise the paw row for a dwell, then let it retire.
   *
   * Visibility is this function's business and *only* this function's: `speak` decides that
   * the row is on screen, `announce` below decides which caption it carries. They were one
   * concept while the row was permanent — see the `#cat-score` rules for why it no longer is.
   *
   * The timer re-reads `scoreBox()` rather than closing over the element. `#cat-hud` is
   * `transition:persist` chrome, but a persisted node is still replaceable, and a callback
   * holding a detached one would clear `.speaking` on a node nobody can see while the live
   * chip stayed up forever — the failure state being guarded is a readout that never retires.
   */
  let speakTimer: number | undefined;
  const speak = () => {
    const scoreEl = scoreBox();
    if (!scoreEl) return;
    scoreEl.classList.add('speaking');
    clearTimeout(speakTimer);
    speakTimer = window.setTimeout(() => {
      scoreBox()?.classList.remove('speaking');
    }, HUD_DWELL_MS);
  };

  /**
   * Say it once, on arrival: the tally, so the first thing a visitor sees of the row contains
   * the word that explains it. The row was made permanent to issue that invitation; the
   * invitation is the part worth keeping, and it is issued by showing up, not by staying.
   *
   * Once per session, not once per navigation — `#cat-hud` persists across page changes, so
   * this module does too, and a greeting on every click would be the same box interrupting
   * the same reader on every page of the site.
   */
  let greeted = false;
  const greet = () => {
    if (greeted) return;
    greeted = true;
    speak();
  };

  /** Swap the tally for the level phrase for a beat, then put it back. */
  let announceTimer: number | undefined;
  const announce = () => {
    const scoreEl = scoreBox();
    if (!scoreEl) return;
    scoreEl.classList.add('announce');
    speak();
    renderScore();
    clearTimeout(announceTimer);
    announceTimer = window.setTimeout(() => {
      scoreBox()?.classList.remove('announce');
      renderScore();
    }, HUD_DWELL_MS);
  };

  /**
   * The tab whose treat is currently out, so leaving can still credit it.
   * Crossing a wide floor at a trot takes a few seconds, and a visitor who
   * clicks on before the cat arrives was losing the find entirely — which made
   * the reward for looking round the site depend on how slowly you browse.
   * Visiting earns the treat; the cat fetching it is the flourish.
   */
  let pending: string | null = null;

  const hideTreat = () => {
    const treatEl = treat();
    treatEl?.setAttribute('hidden', '');
    treatEl?.classList.remove('show', 'taken');
    s.treatX = -1;
    pending = null;
    if (s.mode === 'fetch') {
      s.mode = 'walk';
      setClasses();
    }
  };

  /** Record a find: bump the level, repaint, and celebrate a full set once. */
  const collect = (slug: string) => {
    if (game.found.has(slug)) return;
    game.found.add(slug);
    game.level = levelFor(game.found.size, game.tabs.length);
    renderScore();
    const paw = scoreBox()?.querySelector(`.cat-paw[data-slug="${slug}"]`);
    paw?.classList.add('just-got');
    setTimeout(() => paw?.classList.remove('just-got'), 420);
    announce();
    setClasses();
    if (isComplete(game.found.size, game.tabs.length) && !game.celebrated) {
      game.celebrated = true;
      purr(2200); // it has decided you're worth keeping
      // and it says so: every paw answers at once, and the collar (lv6, set by
      // setClasses above) appears on the cat for the rest of the session.
      const scoreEl = scoreBox();
      scoreEl?.classList.add('complete');
      setTimeout(() => scoreEl?.classList.remove('complete'), 1400);
    }
  };

  /** Put this tab's treat somewhere reachable along the floor. */
  const spawnTreat = (slug: string) => {
    const treatEl = treat();
    if (!treatEl) return;
    const shape = resolveTreat(slug);
    treatEl.querySelector('use')?.setAttribute('href', `#treat-${shape}`);
    // borrow this tab's own wash hue, so the treat belongs to the page
    const hue = getComputedStyle(document.querySelector('.page-bg') ?? document.documentElement)
      .getPropertyValue('--hue')
      .trim();
    treatEl.style.color = hue ? `hsl(${hue} 55% 42%)` : '';
    /*
     * Place it within reach rather than anywhere on the floor. At walking pace
     * a treat on the far side of a wide window is a fifteen-second trundle —
     * long enough that the reward stops registering as one. Keep it inside a
     * little over half a screen of wherever the cat already is, still random
     * enough that it isn't always underfoot.
     */
    const lo = minX() + 54;
    const hi = Math.max(lo + 40, maxX() - 54);
    const reach = (hi - lo) * 0.42;
    const near = s.x + (Math.random() * 2 - 1) * reach;
    s.treatX = Math.min(hi, Math.max(lo, near));
    pending = slug;
    treatEl.style.transform = `translateX(${s.treatX}px)`;
    treatEl.removeAttribute('hidden');
    requestAnimationFrame(() => treatEl.classList.add('show'));
    // food beats everything short of a climb
    if (s.mode !== 'climb') {
      s.mode = 'fetch';
      s.speed = 186; // it can see food; a stroll across the room read as a stall
      setClasses();
    }
  };

  /** Petting: hold the pointer on the cat and it purrs. Mouse only — see below. */
  /** True while the pointer rests on the cat, so the hunt lets it be petted. */
  let petting = false;
  let purrTimer: number | undefined;
  const purr = (ms = 1100) => {
    root.classList.add('purring');
    clearTimeout(purrTimer);
    purrTimer = window.setTimeout(() => root.classList.remove('purring'), ms);
  };

  /**
   * §7.1's top state, arriving and leaving.
   *
   * The load-bearing line is `perched` turning hit-testing off. On a mouse `.cat-svg` is a
   * live target so the cat can be petted, and the touch path already turned that off with a
   * comment that describes this feature exactly: a 48x30 body at the bottom edge "swallows
   * taps meant for whatever link is under it — a dead zone that moves". A cat parked *under*
   * the cursor is that dead zone placed precisely where the reader is about to click, which
   * is what 0.6 meant by "worth building deliberately".
   *
   * So while perched it is scenery: the click goes through, `elementFromPoint` keeps
   * returning the page (which `CatArena`'s `claimUnder` depends on), and the cursor resting
   * on the cat cannot pin `petting` on forever — which would have quietly turned the one
   * interaction the cat already had into its permanent state.
   *
   * The purr therefore has to be fired from here rather than from `pointerenter`, which can
   * no longer arrive. Once, on arrival: `dozing` is lv6's own curl-up and carries the rest of
   * it, and a cat purring continuously for as long as you read is a busier animal than this.
   */
  let perched = false;
  const perch = (now: number) => {
    perched = true;
    s.mode = 'idle';
    s.until = now + 1e9; // held by owning the frame, not by a clock
    root.classList.add('perched', 'dozing');
    setClasses();
    purr();
  };
  const unperch = () => {
    perched = false;
    root.classList.remove('perched', 'dozing');
    s.until = 0; // let `chooseNext` pick something up straight away
  };

  /**
   * Hunt logic: if the pointer lingers near the floor, chase it; pounce on
   * arrival, then sit beside it until it moves again. Returns true while
   * the chase owns the cat this frame.
   */
  const hunt = (now: number, dt: number): boolean => {
    if (petting) return true; // being fussed over; hold still
    const preyFresh = now - prey.t < prey.hold;
    const preyLow = withinNotice(prey.y);
    const canHunt = s.mode === 'walk' || s.mode === 'idle' || s.mode === 'chase';

    /*
     * §7.1's top state: collar *and* notch in one session, and the cat comes and sits on
     * your cursor.
     *
     * Deliberately **not** gated on `preyFresh`. A sighting expires after `hold` because a
     * moving cursor re-reports itself constantly, so silence means it went away — but a
     * cursor that has stopped is exactly the case this reward is for, and it stops
     * reporting too. Stillness is tracked separately (`prey.still`) and `prey.here` covers
     * the one case where silence really does mean gone.
     */
    const wantsPerch =
      isTopState(game.level, root.classList.contains('notched')) &&
      !motionReduced() &&
      prey.here &&
      preyLow &&
      now - prey.still >= PERCH_STILL_MS;

    /*
     * Release whenever the perch is not going to be *held this frame* — which is not the
     * same as "the pointer moved".
     *
     * `canHunt` excludes `away`, `fetch` and `climb`, so a treat appearing, a scamper, or a
     * wall climb takes the cat out from under the cursor while `wantsPerch` is still
     * perfectly true. Checking only `wantsPerch` left `perched` set through all three: a cat
     * running across the screen, curled up and click-through.
     */
    if (perched && !(wantsPerch && canHunt)) unperch();

    if (wantsPerch && canHunt) {
      const target = Math.min(maxX(), Math.max(minX(), prey.x - CAT_W / 2));
      const dx = target - s.x;
      /*
       * Arrive within `PERCH_SNAP_PX`, then hold until `PERCH_BREAK_PX` — the same
       * hysteresis §7.3's tiers needed, for the same reason.
       *
       * Without it, drift too small to break the perch is still bigger than the snap, so the
       * cat re-enters `chase` *while wearing* `perched` — walking and curled up at once — and
       * re-purrs on every twitch of a resting hand. Anything past this really has moved: a
       * pointer move that large resets `prey.still` and un-perches on the line above.
       */
      if (Math.abs(dx) > (perched ? PERCH_BREAK_PX : PERCH_SNAP_PX)) {
        if (perched) unperch();
        // The last stretch, closing all the way instead of stopping at the chase's 26px —
        // which is the whole difference between this and the reward that already shipped.
        if (s.mode !== 'chase') {
          s.mode = 'chase';
          setClasses();
        }
        s.dir = dx > 0 ? 1 : -1;
        const sprint = Math.min(210, 62 + game.level * 6 + Math.abs(dx) * 0.35);
        s.x = Math.max(minX(), Math.min(maxX(), s.x + s.dir * sprint * dt));
        root.classList.toggle('face-left', s.dir === -1);
        return true;
      }
      if (!perched) perch(now);
      // Owning the frame is what holds the perch: the tick returns early on `true`, so
      // `chooseNext` never runs and `idleBusiness` never clears the curl-up.
      return true;
    }

    if (canHunt && preyFresh && preyLow) {
      const target = Math.min(maxX(), Math.max(minX(), prey.x - CAT_W / 2));
      const dx = target - s.x;
      if (s.mode !== 'chase' && Math.abs(dx) > 34) {
        s.mode = 'chase';
        setClasses();
      }
      if (s.mode === 'chase') {
        if (Math.abs(dx) <= 26) {
          if (now > s.pounceCooldown) {
            s.pounceCooldown = now + 2400;
            root.classList.add('pounce');
            setTimeout(() => root.classList.remove('pounce'), 470);
          }
          // caught it — sit proudly next to the prey
          s.mode = 'idle';
          s.until = now + 1500;
          setClasses();
          return false;
        }
        s.dir = dx > 0 ? 1 : -1;
        const sprint = Math.min(210, 62 + game.level * 6 + Math.abs(dx) * 0.35);
        s.x = Math.max(minX(), Math.min(maxX(), s.x + s.dir * sprint * dt));
        root.classList.toggle('face-left', s.dir === -1);
        return true;
      }
      return false;
    }

    if (s.mode === 'chase') {
      // the mouse got away — look around for a moment, then move on
      s.mode = 'idle';
      s.until = now + rand(1200, 2400);
      setClasses();
    }
    return false;
  };

  /**
   * Idle business, unlocked by affection. A wary cat just stands there; a fond
   * one washes a paw, stretches, and eventually curls up near you. One-shot
   * classes clear themselves; `dozing` persists while it stays idle.
   */
  const idleBusiness = () => {
    root.classList.remove('grooming', 'stretching', 'dozing');
    const lv = game.level;
    if (lv >= 6 && Math.random() < 0.55) {
      root.classList.add('dozing');
      return;
    }
    const tricks: string[] = [];
    if (lv >= 3) tricks.push('grooming');
    if (lv >= 4) tricks.push('stretching');
    if (!tricks.length || Math.random() < 0.45) return;
    const trick = tricks[Math.floor(Math.random() * tricks.length)]!;
    root.classList.add(trick);
    setTimeout(() => root.classList.remove(trick), 1600);
  };

  const chooseNext = (now: number) => {
    if (s.mode === 'walk') {
      s.mode = 'idle';
      s.until = now + rand(1600, 4200);
      idleBusiness();
    } else {
      root.classList.remove('grooming', 'stretching', 'dozing');
      s.mode = 'walk';
      s.speed = rand(34, 58);
      if (Math.random() < 0.45) s.dir = s.dir === 1 ? -1 : 1;
      s.until = now + rand(2600, 7000);
    }
    setClasses();
  };

  /* ---- §17 the gaze: the cat looks where you point ----

     Purpose: make the animal notice the reader. The cat has walked the bottom edge since
     0.1 and has never once acknowledged that anybody was there; a head that turns is the
     cheapest possible "I can see you", and it costs no new art and no new event listener.

     Inputs: `prey` — the pointer record the cat already keeps (`sight()` above), fed by the
     one `window` pointermove and, on touch, by the pointerdown path that logs a tap as a
     sighting held 5200ms because a tap reports once. So "look at where I touch" needed
     nothing built; it needed the gaze to read a record that was already there.

     Outputs: `rotate:` on `.cat-gaze` and `translate:` on `.cat-pupil` — the *independent*
     transform properties, never `transform:`. That is not stylistic. `cat-blink` on the eye,
     and `cat-groom` and `cat-munch` on the head, all animate `transform`, so writing
     `transform` here would fight three shipped animations and the cat would stop blinking
     the moment it looked at you. The independent properties compose with them instead.

     Both writes land inside `#site-cat`, which is already excluded from the harness fleet's
     page snapshot (`.cat-card-root, #site-cat, #cat-hud` in arena.mjs and arena4.mjs) — so a
     per-frame style write here cannot break pillar 2's byte-identical-page check, which is
     exactly what it would have done anywhere else on the page. */
  const paintGaze = () => {
    if (!gazeEl || !gazeEye) return;
    const now = performance.now();
    const dt = Math.min(120, now - gaze.t);
    gaze.t = now;

    let yaw = 0;
    let ex = 0;
    let ey = 0;

    const muted =
      motionReduced() ||
      s.mode === 'climb' ||
      GAZE_MUTE.some((c) => root.classList.contains(c));
    /*
     * `prey.here` is false once the pointer leaves the window, and a sighting older than
     * `prey.hold` is stale — which is what expires a touch. Both ease the head back to
     * neutral rather than leaving it turned: a cat frozen mid-glance at a cursor that is no
     * longer there is the failure state this whole block is arranged to avoid.
     */
    const fresh = prey.here && now - prey.t < prey.hold;
    if (!muted && fresh) {
      /*
       * The head's position on screen, from state rather than from a rect. `render` writes
       * `transform` on the same element, and reading a rect straight afterwards would force a
       * synchronous layout every frame for a number the state already knows.
       *
       * The head sits at (55, 13) of a 64x40 view box, so it is 55/64 across a 48px sprite
       * and 13/40 down a 30px one. When the cat faces left, `.cat-flip` mirrors the sprite
       * about its own centre, which puts the head at 1 - 55/64 instead — miss that and the
       * cat looks at your cursor's reflection.
       */
      const acrossFrac = s.dir === -1 ? 1 - 55 / 64 : 55 / 64;
      const headX = s.x + acrossFrac * CAT_W;
      const headY = window.innerHeight - CAT_H + (13 / 40) * CAT_H;

      /*
       * Saturating at half the viewport, in each axis, rather than at a pixel count. A fixed
       * reach would mean the gaze behaves differently on a phone and a monitor for no reason
       * a reader could name; half the viewport makes "the far edge of your screen" the point
       * of full deflection whatever that screen is.
       */
      const hx = Math.max(-1, Math.min(1, (prey.x - headX) / (window.innerWidth / 2)));
      const hy = Math.max(-1, Math.min(1, (prey.y - headY) / (window.innerHeight / 2)));

      /*
       * The mirror again, and this time for two properties. Inside a `scaleX(-1)` ancestor a
       * positive rotation turns the wrong way and a positive x-translation moves the wrong
       * way, so both horizontal terms are negated when the cat faces left. The vertical term
       * is untouched — a horizontal mirror does not care which way is up.
       */
      const m = s.dir === -1 ? -1 : 1;
      yaw = GAZE_YAW_DEG * hx * m;
      ex = GAZE_EYE_UNITS * hx * m;
      ey = GAZE_EYE_UNITS * GAZE_NOD_RATIO * hy;
    }

    // Exponential ease on a time constant, so the result is frame-rate independent: the same
    // glance takes the same 200ms whether the browser is managing 60fps or 30.
    const k = 1 - Math.exp(-dt / GAZE_TAU_MS);
    gaze.yaw += (yaw - gaze.yaw) * k;
    gaze.ex += (ex - gaze.ex) * k;
    gaze.ey += (ey - gaze.ey) * k;

    /*
     * Below a twentieth of a degree the head is home. Clearing the properties rather than
     * writing `rotate: 0.001deg` matters for the reduced-motion promise: what a stood-down
     * cat has is *no transform*, which is checkable, rather than an identity one that merely
     * computes to the same pixels.
     */
    if (Math.abs(gaze.yaw) < 0.05 && Math.abs(gaze.ex) < 0.01 && Math.abs(gaze.ey) < 0.01) {
      gaze.yaw = gaze.ex = gaze.ey = 0;
      if (gazeEl.style.rotate) gazeEl.style.rotate = '';
      if (gazeEye.style.translate) gazeEye.style.translate = '';
      return;
    }
    gazeEl.style.rotate = `${gaze.yaw.toFixed(2)}deg`;
    gazeEye.style.translate = `${gaze.ex.toFixed(2)}px ${gaze.ey.toFixed(2)}px`;
  };

  const render = () => {
    paintGaze();
    if (s.mode === 'climb') {
      // a short scramble up the side edge: rotate to vertical, feet on the wall
      const rot = s.climbSide === 1 ? -90 : 90;
      const cx = s.climbSide === 1 ? viewportW() - CAT_W / 2 - CAT_H / 2 : CAT_H / 2 - CAT_W / 2;
      /*
       * Rotating a 48x30 box a quarter turn about its own centre leaves the
       * visual bottom (CAT_W - CAT_H) / 2 below where the unrotated box sat —
       * which is the floor. Without this lift the cat starts every climb with
       * 9px of itself buried under the bottom of the window.
       */
      const sink = (CAT_W - CAT_H) / 2;
      root.style.transform = `translate(${cx}px, ${-s.climbY - sink}px) rotate(${rot}deg)`;
    } else {
      root.style.transform = `translateX(${s.x}px)`;
    }
  };

  let last = performance.now();
  const tick = (now: number) => {
    /*
     * `stop()` has to actually stop.
     *
     * This loop used to re-arm unconditionally at the bottom, so clearing
     * `running` did nothing and the only way out was the reduce-motion check
     * below — which meant `stop()` was half a function, and a frame already in
     * flight kept writing `transform` after it. Harmless while nothing else
     * wanted the element; not harmless once the arena borrows the cat, where a
     * single stray frame drops the boss back onto the floor mid-stalk.
     */
    if (!running) return;
    // Stop the moment reduce-motion turns on; the observers below restart the
    // loop if it is turned back off.
    if (motionReduced()) {
      running = false;
      parkIdle();
      return;
    }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    // Heading for a treat outranks chasing the cursor — the cat is food-first,
    // and otherwise a visitor moving the mouse could keep it from ever eating.
    if (s.mode === 'fetch' && s.treatX >= 0) {
      const dx = s.treatX - s.x;
      if (Math.abs(dx) <= 12) {
        root.classList.add('munching');
        const eaten = treat();
        eaten?.classList.add('taken');
        const slug = currentTab(game.tabs);
        setTimeout(() => {
          root.classList.remove('munching');
          eaten?.setAttribute('hidden', '');
          eaten?.classList.remove('show', 'taken');
        }, 900);
        if (slug) collect(slug);
        s.treatX = -1;
        s.mode = 'idle';
        s.until = now + 1400;
        setClasses();
      } else {
        s.dir = dx > 0 ? 1 : -1;
        s.x = Math.max(minX(), Math.min(maxX(), s.x + s.dir * s.speed * dt));
        root.classList.toggle('face-left', s.dir === -1);
      }
      render();
      requestAnimationFrame(tick);
      return;
    }

    if (hunt(now, dt)) {
      render();
      requestAnimationFrame(tick);
      return;
    }

    if (s.mode === 'walk' || s.mode === 'away') {
      s.x += s.dir * s.speed * dt;
      if (s.mode === 'walk') {
        if ((s.dir === 1 && s.x >= maxX() - 4) || (s.dir === -1 && s.x <= minX() + 4)) {
          const roll = Math.random();
          // In a small room the wall is the edge of someone's reading, so the
          // cat neither climbs it nor walks out through it: on a phone it stays
          // in the room and simply turns around. On a wide screen both are
          // exactly as they were.
          const climbs = roomy() && roll < 0.3;
          const leaves = roomy() && roll < 0.55;
          if (s.dir === 1 && cornerBusy()) {
            // Climbing this edge or slipping out through it would both take the
            // cat behind the back-to-top button. Just turn around.
            s.dir = -1;
          } else if (climbs) {
            // climb a little way up this edge
            s.mode = 'climb';
            s.climbSide = s.dir === 1 ? 1 : -1;
            s.climbPhase = 'up';
            s.climbY = 0;
            s.until = now + 12000;
            // face "up" the wall
            s.dir = s.climbSide === 1 ? -1 : 1;
          } else if (leaves) {
            // slip out of the room, come back from the other side
            s.mode = 'away';
            s.until = now + rand(2800, 7000);
          } else {
            s.dir = s.dir === 1 ? -1 : 1;
          }
          setClasses();
        }
        if (now > s.until) chooseNext(now);
      } else {
        // away: keep walking off-screen, then re-enter from the other side
        if (s.x > viewportW() + CAT_W || s.x < -CAT_W * 2) {
          if (now > s.until) {
            s.dir = s.dir === 1 ? -1 : 1;
            // Coming back in from the right would cross the button's corner, so
            // re-enter from the left instead while it's showing.
            if (s.dir === -1 && cornerBusy()) s.dir = 1;
            s.x = s.dir === 1 ? -CAT_W : viewportW();
            s.mode = 'walk';
            s.speed = rand(34, 58);
            s.until = now + rand(3000, 7000);
            setClasses();
          }
        }
      }
    } else if (s.mode === 'climb') {
      const climbSpeed = 30;
      if (s.climbPhase === 'up') {
        s.climbY += climbSpeed * dt;
        if (s.climbY >= rand(70, 120)) {
          s.climbPhase = 'rest';
          s.until = now + rand(1200, 2600);
          root.classList.remove('walking');
          root.classList.add('idle');
        }
      } else if (s.climbPhase === 'rest') {
        if (now > s.until) {
          s.climbPhase = 'down';
          s.dir = s.dir === 1 ? -1 : 1; // turn to head back down
          root.classList.add('walking');
          root.classList.remove('idle');
        }
      } else {
        s.climbY -= climbSpeed * dt;
        if (s.climbY <= 0) {
          s.climbY = 0;
          s.mode = 'walk';
          s.x = s.climbSide === 1 ? maxX() - 6 : minX() + 6;
          s.dir = s.climbSide === 1 ? -1 : 1; // walk back into the room
          s.until = now + rand(3000, 6500);
          setClasses();
        }
      }
    } else if (now > s.until) {
      chooseNext(now);
    }

    render();
    requestAnimationFrame(tick);
  };

  // startled hop, then it scampers off
  const scamper = () => {
    if (s.mode === 'climb') return;
    root.classList.add('startled');
    setTimeout(() => root.classList.remove('startled'), 380);
    s.mode = 'away';
    s.dir = s.x > viewportW() / 2 ? 1 : -1;
    s.speed = 150;
    s.until = performance.now() + rand(4000, 9000);
    setClasses();
  };

  /**
   * A boop. Touching the cat used to *always* send it running for up to nine
   * seconds, which made the one interaction a phone had into a punishment: the
   * only thing you could do to the cat was drive it away. Now it mostly startles
   * and stays — and purrs if it likes you — and only occasionally bolts, which
   * is what makes bolting read as a mood rather than a rule.
   */
  const boop = () => {
    if (s.mode === 'climb') return;
    if (Math.random() < 0.18) {
      scamper();
      return;
    }
    root.classList.add('startled');
    setTimeout(() => root.classList.remove('startled'), 380);
    s.mode = 'idle';
    s.until = performance.now() + 1400;
    setClasses();
    if (game.level >= 2) purr(900);
  };

  // Mouse: the cat is a real hit target, so clicking it boops the cat and
  // deliberately does not fall through to whatever is behind it.
  root.querySelector('.cat-svg')?.addEventListener('click', () => boop());

  /*
   * Petting, mouse version: rest the pointer on the cat for a beat and it purrs
   * instead of bolting. This one hangs off the cat element because a mouse has a
   * hover to hang it on. Touch gets the same thing from the hit-test further
   * down — the cat stays `pointer-events: none` there, so a hold still can't
   * swallow a tap meant for a link underneath.
   */
  let petTimer: number | undefined;
  const svg = root.querySelector('.cat-svg');
  svg?.addEventListener('pointerenter', (e) => {
    if ((e as PointerEvent).pointerType !== 'mouse') return;
    if (s.mode === 'climb') return;
    // It has to stop to be petted. Without this the cat kept walking out from
    // under the cursor, cancelled its own hold, and could never be petted at
    // all — `petting` also suspends the hunt, which would otherwise drag it off
    // after the very pointer resting on it.
    petting = true;
    s.mode = 'idle';
    s.until = performance.now() + 3000;
    setClasses();
    clearTimeout(petTimer);
    petTimer = window.setTimeout(() => {
      if (petting) purr();
    }, 600);
  });
  svg?.addEventListener('pointerleave', () => {
    petting = false;
    clearTimeout(petTimer);
  });

  /**
   * Touch play.
   *
   * The cat is `pointer-events: none` on touch so it can never swallow a tap
   * meant for a link, which left a phone with no way to play with it at all:
   * no cursor to chase, no hover to pet, and a tap that only made it flee.
   * Everything below is passive and hit-tested here, so nothing is consumed —
   * a link under your finger still gets its tap, the cat just reacts on the way
   * past.
   *
   * Two things you can do. Touch the cat: boop, and hold for a moment to pet it.
   * Tap the floor near it: it comes over and pounces, which is the same
   * chase-and-pounce a mouse gets, driven from one sighting instead of a stream
   * of them.
   */
  const INTERACTIVE = 'a, button, input, select, textarea, summary, label, [role="button"]';
  let touchPetTimer: number | undefined;
  const endTouchPet = () => {
    petting = false;
    clearTimeout(touchPetTimer);
  };

  window.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'mouse') return;
      if (s.mode === 'climb') return;
      const b = root.getBoundingClientRect();
      const onCat =
        e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom;

      if (onCat) {
        boop();
        // hold it and it settles into a purr instead
        petting = true;
        clearTimeout(touchPetTimer);
        touchPetTimer = window.setTimeout(() => {
          if (petting) {
            root.classList.remove('startled');
            purr(1400);
          }
        }, 450);
        return;
      }

      // A tap on a link is that link's tap, not an invitation to the cat.
      if ((e.target as Element | null)?.closest?.(INTERACTIVE)) return;
      // and only down here, where the cat lives — a tap at the top of a page
      // has nothing to do with it
      if (!withinNotice(e.clientY)) return;
      // One sighting has to last the whole crossing, so it is held far longer
      // than a cursor's would be.
      sight(e.clientX, e.clientY, 5200);
    },
    { passive: true },
  );
  window.addEventListener('pointerup', endTouchPet, { passive: true });
  window.addEventListener('pointercancel', endTouchPet, { passive: true });

  const start = () => {
    if (running || motionReduced()) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(tick);
  };
  const stop = () => {
    running = false;
    s.mode = 'idle';
    parkIdle();
  };

  // React live to reduce-motion changes from either source: the OS media
  // query, and the a11y toggle (which flips .a11y-motion on <html>).
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () =>
    motionReduced() ? stop() : start(),
  );
  new MutationObserver(() => (motionReduced() ? stop() : start())).observe(
    document.documentElement,
    { attributes: true, attributeFilter: ['class'] },
  );

  /**
   * Per-navigation work: refresh the tab list, repaint progress, and decide
   * whether this page is hiding a treat.
   */
  onPage = () => {
    game.tabs = readTabs();
    // A treat still on the floor of the page being left is credited now: you
    // were there, which is the thing being rewarded.
    if (pending) collect(pending);
    game.level = levelFor(game.found.size, game.tabs.length);
    renderScore();
    // After `renderScore`, so the row that rises is already painted with this page's tally
    // rather than flashing the previous one. No-op on every navigation after the first.
    greet();
    const tab = currentTab(game.tabs);
    if (!tab || game.found.has(tab)) {
      hideTreat();
      return;
    }
    if (motionReduced()) {
      // Nothing moves, so nothing can be fetched — arriving is enough. A
      // visitor who browses everything still earns the whole set.
      collect(tab);
      hideTreat();
      return;
    }
    spawnTreat(tab);
  };

  setClasses();
  if (motionReduced()) {
    // Park bottom-*left*. The right corner is where the back-to-top button
    // appears once you scroll, and a parked cat can't step out of its way —
    // it would simply end up sitting underneath it for the whole visit.
    s.x = minX() + 6;
    s.mode = 'idle'; // keep the state machine honest, or setClasses re-walks it
    render();
    parkIdle();
  } else {
    start();
  }
}

/**
 * Set once by initSiteCat and re-run on every navigation. Kept out here because
 * initSiteCat itself is guarded to run a single time (the cat element persists
 * across page swaps), while the treat has to be re-considered per page — and
 * doing it this way adds no listener per navigation, which is how this codebase
 * has leaked handlers before.
 */
let onPage: (() => void) | null = null;

/**
 * Tell the cat a new page has arrived.
 *
 * `initSiteCat` is guarded to run once (the element persists), while the treat has to be
 * re-considered per page. Astro called this from `astro:page-load`; React calls it from an effect
 * keyed on the pathname. Same function, same moment.
 */
export function siteCatPageChanged(): void {
  onPage?.();
}
