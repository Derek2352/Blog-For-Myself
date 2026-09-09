/**
 * The arena — the boss fight that opens inside the corner card.
 *
 * ## Why this is a module
 *
 * This was 1,920 lines inside `CatCard.astro`'s `<script>`: the board, the boss, the kitten squad,
 * the invisible hand, the throw, the ribbon, the sound cues, and the whole of what
 * `docs/cat-boss-gdd.md` specifies. Twenty-odd harnesses measure it. A second copy for the Next
 * build would have meant two arenas, and the harnesses would have kept passing against whichever
 * one they were pointed at while the other drifted unobserved.
 *
 * So the engine lives here and each framework contributes markup plus one lifecycle call — the
 * arrangement `ink-wash.ts` and `site-cat.ts` already use.
 *
 * The DOM contract is untouched on purpose. Every id, class and `data-` attribute is exactly what
 * it was, because a migration that also renamed its selectors cannot tell you whether the
 * migration was correct.
 *
 * ## Lifecycle
 *
 * `initCatCard()` queries the card's DOM, wires it, and returns a disposer. Astro calls it once on
 * first load — the card persists across navigation, so its disposer never runs — and React calls
 * it from an effect, returning the disposer as the cleanup.
 *
 * The original had exactly one piece of teardown: an interval cancelled from `astro:page-load`.
 * That is now the first entry in `disposers`, which is where it belonged.
 */

import { motionReduced } from '@/lib/a11y-prefs';
import { primeSfx, playCue, setSfxEnabled, sfxEnabled } from '@/lib/cat-sfx';
import { tallyFor, resolveTreat } from '@/lib/cat-game';
import {
  INITIAL_CLAIM_FRACTION,
  IDLE_TRUCE_MS,
  AIM_LEAD_MS,
  LEAP_MS,
  OPENING_GRACE_MS,
  OPENING_LINE_MS,
  RECLAIM_ON_HIT,
  THROW_ARC_MS,
  LURE_MS,
  FETCH_SPEED,
  FETCH_REACH,
  STANCES,
  pickStance,
  treatSpec,
  type Stance,
  nextRung,
  ammoCap,
  mood as moodFor,
  aggression,
  telegraphScale,
  swatLands,
  SWAT_STUN_MS,
  SWAT_RADIUS,
  sweepPartner,
  SIEGE_SWEEP_EVERY,
  AMBUSH_PIN_MS,
  AMBUSH_PIN_PX,
  TRICKSTER_DOUBLE,
  patienceFor,
  talkGap,
  GROOM_EVERY_MS,
  GROOM_MS,
  type Mood,
  claimTilt,
  scrubProgress,
  stillEnough,
  isTap,
  arenaCaption,
  territory,
  isWon,
  isLost,
  LINE_MS,
  WIN_BEAT_MS,
  ROUND_BEAT_MS,
  LOSE_BEAT_MS,
  pickLine,
  lineText,
  type FightState,
  nextPhase,
  canPounce,
  provoked,
  predict,
  leapPos,
  pounceHit,
  type Phase,
  HIDDEN_TRUCE_MS,
  pickClaims,
} from '@/lib/arena';
import {
  KITTEN_FLINCH_MS,
  KITTEN_WORK_MS,
  ARRIVE_PX,
  WATCH_TRUCE_MS,
  canFinish,
  shouldFlee,
  kittensFor,
  pickWork,
  roundOutcome,
  roundRegrowMs,
  roundAggro,
  readBestRound,
  writeBestRound,
  type Candidate,
} from '@/lib/squad';
// §16's invisible hand — the swipe geometry, pure and unit-tested in tests/hand.test.ts.
import {
  IMPULSE_MS,
  swipeSpeed,
  isSwipe,
  segmentHit,
  veer,
  impulseAt,
  swipeReady,
  contactFor,
  GRAZE_MS,
  HEADING_MIN_SPEED,
  HEADING_TAU_MS,
  SHOVE_FOOTING,
  SWIPE_MIN_SPEED,
  SWIPE_TRY_FRACTION,
} from '@/lib/hand';
import {
  CARD_SCALE,
  CARD_STALK_SPEED,
  CARD_KITTEN_SPEED,
  CARD_POUNCE_RANGE,
  CARD_HIT_RADIUS,
  CARD_PREDICT_CAP,
  CARD_DESPERATE_SPEED,
  CARD_SAFE_FLEE_PX,
  CARD_LEAP_HEIGHT,
} from '@/lib/card';

/**
 * Wire the card, and hand back the way to unwire it.
 *
 * Everything below used to run at module scope, correct while an Astro module script ran exactly
 * once per session. Making the lifetime explicit is what lets the same code serve a component that
 * mounts and unmounts.
 */
export function initCatCard(): () => void {
  const disposers: (() => void)[] = [];

  const root = document.querySelector<HTMLElement>('.cat-card-root');
  const toggle = document.querySelector<HTMLButtonElement>('#cat-card-toggle');
  const panel = document.querySelector<HTMLElement>('#cat-card-panel');
  const board = document.querySelector<HTMLElement>('[data-board]');
  const bossEl = document.querySelector<HTMLElement>('[data-boss]');
  const squadEl = document.querySelector<HTMLElement>('[data-squad]');
  const treatEl = document.querySelector<HTMLElement>('[data-treat]');
  const ribbonEl = document.querySelector<HTMLElement>('[data-ribbon]');
  const soundBtn = document.querySelector<HTMLButtonElement>('#cat-card-sound');
  const modeBtn = document.querySelector<HTMLButtonElement>('#cat-card-mode');
  const closeBtn = document.querySelector<HTMLButtonElement>('#cat-card-close');
  const ammoEl = document.querySelector<HTMLElement>('[data-ammo]');
  const badgeEl = document.querySelector<HTMLElement>('[data-badge]');
  const roundEl = document.querySelector<HTMLElement>('[data-round]');
  const captionEl = document.querySelector<HTMLElement>('[data-caption]');
  const territoryFill = document.querySelector<HTMLElement>('[data-territory]');
  const poolRaw = root?.dataset.pool ?? '[]';

  // Mirrored literals — the fleet's convention: one copy, drift shows as a failing check.
  const BOARD_MIN = 10; // §2.2: 10–12 tiles per round
  const BOARD_MAX = 12;

  if (root && toggle && panel && board && bossEl && squadEl && treatEl && ribbonEl) {
    // Non-null aliases: TS cannot narrow the outer consts inside nested closures.
    const rootEl = root;
    const toggleEl = toggle;
    const panelEl = panel;
    const boardEl = board;
    const bossNode = bossEl;
    const squadNode = squadEl;
    const treatNode = treatEl;
    const ribbonNode = ribbonEl;
    const POOL: { label: string; hue: number }[] = JSON.parse(poolRaw);
    let open = false;

    /* ---------------------------------------------------------------- *
     * Which game this is (§15, 2.0). Owned here — the page chips are gone
     * in the card model (§2.2: the HUD controls moved into the card).
     * ---------------------------------------------------------------- */
    // `hand` is §16's prototype and is **not** on the mode chip: three modes on a portfolio is too
    // much game, and the point of building it is to look at it beside commander mode before
    // choosing. Reachable with `?cat=hand` (or `localStorage.cat-mode = 'hand'`) so the two shipped
    // modes, and the twelve harnesses that assert on them, are untouched.
    /*
     * Which game this is. **Two modes, and the default is the hand** (§16).
     *
     * 2.6 retired a third value and a whole verb. `hand` was a prototype behind `?cat=hand`, built to
     * be judged beside `commander` and never judged; `commander` gave the visitor two optional clicks,
     * one of which — point at a claim, send a kitten — is the one §16 exists to replace. The decision
     * was that **the swipe is how a visitor intervenes while the kittens and the cat run themselves**,
     * which is §16's founding argument ("one job instead of two") rather than a new idea.
     *
     * The default is named `hand` rather than keeping `commander` with different behaviour. A mode
     * called commander that you cannot command with is precisely the lying-name fault 2.5.2 spent a
     * commit removing from three comments; the fleet's setup calls are cheaper to update than the
     * confusion would be to live with.
     */
    let mode: 'hand' | 'manual' = 'hand';
    /**
     * §16's verb: the squad is autonomous and the player's way in is shoving the cat.
     *
     * Named `swiping`, not `handing`, deliberately — `stepHold(hand, …)` and `dropHold(hand)` already
     * use `hand` as the parameter for *whoever is holding a tile*, which is a kitten as often as it is
     * the player. A `handing()` beside those would read as though it were about them.
     *
     * Identical to `autonomous()` today, and kept separate on purpose: one asks *who does the work*
     * and the other asks *what the player's verb is*, and a future mode could answer them differently.
     */
    const swiping = () => mode !== 'manual';
    /** Both modes where the *kittens* do the holding — everything except manual. */
    const autonomous = () => mode !== 'manual';

    /* ---------------------------------------------------------------- *
     * State — the same shape as CatArena's, on tile elements.
     * ---------------------------------------------------------------- */
    const arena = {
      on: false,
      claimed: [] as HTMLElement[],
      freed: [] as HTMLElement[],
      order: [] as HTMLElement[],
      total: 0,
      seed: 0,
      openedAt: 0,
      treat: null as null | {
        x: number;
        y: number;
        fx: number;
        fy: number;
        at: number;
        landed: boolean;
        kind: string;
      },
      ammoWas: [] as boolean[],
      rung: 0,
      caption: '',
      spent: 0,
      interrupts: 0,
      movedAt: 0,
      lastLine: '' as string,
      spokeAt: 0,
      lineTimer: 0,
      beatTimer: 0,
      ending: null as null | 'win' | 'lose',
      round: 1,
      roundAt: 0,
      best: 0,
      raf: 0,
    };

    /** The boss, in board coordinates. */
    const boss = {
      x: 0,
      y: 0,
      phase: 'stalk' as Phase,
      since: 0,
      ax: 0,
      ay: 0,
      bx: 0,
      by: 0,
      facing: 1 as 1 | -1,
      last: 0,
      stance: 'ambush' as Stance,
      feint: false,
      telegraphMul: 1,
      slowUntil: 0,
      slowMul: 1,
      anchorX: 0,
      anchorY: 0,
      anchorPx: 0,
      anchorUntil: 0,
      lastStand: false,
      regrowAt: 0,
      regrows: 0,
      immuneMs: 0,
      lureMs: 0,
      mood: 'even' as Mood,
      groomedAt: 0,
      groomUntil: 0,
      /* §16's shove. A decaying velocity in card px/s, added to the stalk step — the first thing
       * in this game that *displaces* the cat rather than re-timing or leashing it. `shoveAt` is
       * when it landed, so `impulseAt` can decay it; `swipedAt` gates the cooldown. */
      shoveX: 0,
      shoveY: 0,
      shoveAt: 0,
      swipedAt: 0,
      /* The heading it was knocked off, unit length. The walk blends back to the live quarry
       * direction from this as the impulse decays — without it the homing correction erases the
       * shove as fast as it lands, which is measured in `stepBoss`'s comment. */
      shoveHx: 0,
      shoveHy: 0,
      /* When the last *graze* was shown. Separate from `swipedAt` on purpose — see `trySwipe`. */
      grazedAt: 0,
      /* The cat's own velocity, smoothed over `HEADING_TAU_MS` — **the axis the gesture is measured
       * against**, and the only one the player can see. Written once per frame in `tick`, from the
       * distance actually travelled, so clamps and leaps are in it. */
      vx: 0,
      vy: 0,
    };

    /** The pointer (manual mode) or the nearest kitten (commander), in board coords. */
    const scrub = {
      x: -1,
      y: -1,
      ax: -1,
      ay: -1,
      vx: 0,
      vy: 0,
      at: 0,
      since: 0,
      seen: 0,
      inside: false,
      target: null as HTMLElement | null,
    };
    let quarry: typeof scrub | Kitten = scrub;

    const touch = { at: 0, onClaim: false };

    interface Kitten {
      el: HTMLElement;
      x: number;
      y: number;
      ax: number;
      ay: number;
      vx: number;
      vy: number;
      at: number;
      since: number;
      inside: boolean;
      target: HTMLElement | null;
      seek: HTMLElement | null;
      flinchUntil: number;
      facing: number;
    }
    const squad: Kitten[] = [];

    /* ---------------------------------------------------------------- *
     * Coordinates — everything is relative to the board element (§2.2).
     * ---------------------------------------------------------------- */

    /** Client point → board coordinates. */
    function boardCoords(cx: number, cy: number): { x: number; y: number } {
      const r = boardEl.getBoundingClientRect();
      return { x: cx - r.left, y: cy - r.top };
    }

    /** Put the boss's centre at a board point. */
    function placeBoss(cx: number, cy: number): void {
      boss.x = cx;
      boss.y = cy;
      const w = bossNode.offsetWidth;
      const h = bossNode.offsetHeight;
      bossNode.style.transform = `translate(${cx - w / 2}px, ${cy - h / 2}px)`;
    }

    /**
     * Keep the whole sprite on the board, not just its centre.
     *
     * The stalk step used to clamp with the literals `12` and `8` — the *old* 24×15 sprite's
     * half-width and half-height. 2.3 drew the cat at 28×18 and the numbers stayed behind, so
     * the box overhung the board by 2px at the left and right edges and `arena2`'s "the boss
     * never leaves the board" (which allows 1px) went red at every corner. Derived from the
     * sprite's own size, it cannot drift again the next time the drawing changes.
     */
    function onBoard(nx: number, ny: number): { x: number; y: number } {
      const { w, h } = boardBounds();
      const halfW = bossNode.offsetWidth / 2;
      const halfH = bossNode.offsetHeight / 2;
      return {
        x: Math.max(halfW, Math.min(w - halfW, nx)),
        y: Math.max(halfH, Math.min(h - halfH, ny)),
      };
    }

    /**
     * §16 — the invisible hand. One pointer segment, tested against the cat.
     *
     * Everything that decides *whether* and *how hard* lives in `src/lib/hand.ts` and is unit tested;
     * this function is only the plumbing: read the segment, ask, apply, announce.
     *
     * **The cat's heading is its own velocity** (`boss.vx/vy`, smoothed over `HEADING_TAU_MS` in
     * `tick`). It used to be the direction to its quarry, and this comment used to claim both at once —
     * "its own velocity this frame, taken as the direction to its quarry" — which is two different
     * lines described as though they were one. The quarry line is the one the cat is *steering* by; the
     * velocity is the one a player can *see*. Asking someone to swipe across a line drawn nowhere is
     * what made §16's dead zone unenterable, measured at ~15 flicks per deliberate graze. It is not
     * `boss.facing` either, which is only ±1 and would make every vertical swipe read as fully "across"
     * a cat walking straight up the board.
     */
    function trySwipe(fromX: number, fromY: number, toX: number, toY: number, dtMs: number, t: number): void {
      if (!swipeReady(t - boss.swipedAt)) return;
      const dx = toX - fromX;
      const dy = toY - fromY;

      /*
       * **Did it cross the cat** is asked first, and the order is the point.
       *
       * The speed test came first and returned silently, so a segment that crossed the cat too slowly
       * was indistinguishable from one that never went near it — the same two-failures-one-face fault
       * 2.5.1 fixed for angle, one level down. Only a segment that actually touched the animal can earn
       * a tell, so the touch has to be established before the speed is judged.
       */
      if (!segmentHit(fromX, fromY, toX, toY, boss.x, boss.y)) return;

      const speed = swipeSpeed(dx, dy, dtMs);
      if (!isSwipe(speed)) {
        // Fast enough to be an attempt, too slow to be a swipe: say so. Below the try band it is a
        // drift, and a game that answers drifting is noise rather than feedback.
        if (speed >= SWIPE_MIN_SPEED * SWIPE_TRY_FRACTION) showGraze(t);
        return;
      }

      // The axis, from the cat's own travel. Below `HEADING_MIN_SPEED` it is standing, and a standing
      // cat has no "across" — `veer` answers a zero heading with a full shove in the swipe's own
      // direction, which is what shoving a stationary animal should do.
      const moving = Math.hypot(boss.vx, boss.vy) >= HEADING_MIN_SPEED;
      const hx = moving ? boss.vx : 0;
      const hy = moving ? boss.vy : 0;
      const v = veer(hx, hy, dx, dy);
      /*
       * A dead zone, not an exact-zero test — and a dead zone the player can see.
       *
       * The guard read `if (v.x === 0 && v.y === 0) return`, an equality test on a floating-point
       * rejection and therefore never true in practice. `scratchpad/hand.mjs` §1 caught it: a flick
       * dispatched exactly down the cat's heading still registered, because the dot product came back
       * as 1 − 1e-16 and the "no purchase" case became a shove of 1e-14 px/s — with the recoil flash
       * and the sound of a real one.
       *
       * `SHOVE_MIN` makes the along-the-path case a real dead zone, `SHOVE_MIN_DEG` (20°) either side
       * of the cat's line. It was 8.6° until a half-circle sweep proved that unreachable — a zone
       * narrower than its own axis's drift is one nobody can enter.
       *
       * And a silent return left **two different failures wearing the same face**: a flick that missed
       * the cat entirely and a flick that crossed it lengthways both did nothing, and the player cannot
       * learn which half of the gesture to fix from an outcome that never varies. The second is the one
       * worth telling them about — the aim was right and only the angle was wrong.
       */
      if (contactFor(v.x, v.y) === 'graze') {
        showGraze(t);
        return;
      }

      boss.shoveX = v.x;
      boss.shoveY = v.y;
      boss.shoveAt = t;
      boss.swipedAt = t;
      // The line it was travelling when it was hit, kept so `stepBoss` can carry it on that line while
      // the impulse lasts instead of correcting straight back onto the quarry. The same heading the
      // gesture was measured against, because "the line it was knocked off" and "the line you aimed
      // across" are the same line — they were two different ones until 2.5.2, for no reason.
      const hl = Math.hypot(hx, hy);
      boss.shoveHx = hl ? hx / hl : 0;
      boss.shoveHy = hl ? hy / hl : 0;
      // Reuse the swat's vocabulary rather than inventing a second one: the player has hit the cat,
      // and 2.5 just gave that class a recoil and a sound.
      bossNode.classList.add('boss-swatted');
      playCue('swat');
      window.setTimeout(() => bossNode.classList.remove('boss-swatted'), IMPULSE_MS);
    }

    /**
     * The graze tell: *you touched me and got no purchase*.
     *
     * One function for both ways of earning it — too slow, or too far along the cat's line — because it
     * says the same thing to the player either way, and which remedy to try is something they will
     * work through anyway. What they cannot recover from is an outcome that never varies.
     *
     * The cat flicks its tail forward over its back and does not move. Deliberately the opposite half
     * of the swat's vocabulary — no accent, no body travel, and **no cue**, because this is feedback
     * about aim that a learning player triggers constantly, and a sound on a mistake you are about to
     * repeat is how a mechanic becomes irritating. `cat-sfx.ts` keeps one cue per visual event; it does
     * not owe every visual event a cue.
     *
     * Its own throttle, not `SWIPE_COOLDOWN_MS`: sharing would mean brushing the cat lengthways locked
     * you out of a real shove for half a second, punishing the miss twice.
     */
    function showGraze(t: number): void {
      if (t - boss.grazedAt < GRAZE_MS) return;
      boss.grazedAt = t;
      bossNode.classList.add('boss-grazed');
      window.setTimeout(() => bossNode.classList.remove('boss-grazed'), GRAZE_MS);
    }

    function bossPhase(phase: Phase, now: number): void {
      boss.phase = phase;
      boss.since = now;
      if (phase === 'telegraph') playCue('telegraph');
      bossNode.dataset.phase = phase;
      bossNode.dataset.feint = boss.feint ? '1' : '';
    }

    function faceToward(dx: number): void {
      const face = dx < 0 ? -1 : 1;
      if (face === boss.facing) return;
      boss.facing = face as 1 | -1;
      bossNode.dataset.facing = String(face);
    }

    /** Where a tile is, in board coordinates. */
    function tileCentre(node: HTMLElement): { x: number; y: number } {
      const r = node.getBoundingClientRect();
      const b = boardEl.getBoundingClientRect();
      return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2 };
    }

    /** The board as the policy sees it: every claimed tile with a board position. */
    function boardCandidates(): Candidate[] {
      const out: Candidate[] = [];
      for (const node of arena.claimed) {
        if (!node.isConnected) continue;
        const c = tileCentre(node);
        out.push({ index: arena.order.indexOf(node), x: c.x, y: c.y });
      }
      return out;
    }

    /* ---------------------------------------------------------------- *
     * Claims on tiles — painted only, never laid out (§5.1).
     * ---------------------------------------------------------------- */

    function claim(node: HTMLElement, index: number, seed: number): void {
      node.style.setProperty('--tile-tilt', `${claimTilt(index, seed).toFixed(3)}deg`);
      node.dataset.state = 'claimed';
    }

    function free(node: HTMLElement, celebrate: boolean): void {
      node.style.removeProperty('--tile-tilt');
      node.style.removeProperty('--scrub');
      if (!celebrate) {
        node.dataset.state = 'unclaimed';
        return;
      }
      node.dataset.state = 'freed';
      window.setTimeout(() => {
        if (node.dataset.state === 'freed') node.dataset.state = 'unclaimed';
      }, 460);
    }

    function clearWash(node: HTMLElement): void {
      node.style.removeProperty('--scrub');
      // A dropped hold is not a freed claim: the tile returns to *claimed*, not
      // unclaimed. Leaving it as `scrubbing` (a 2.2 port bug the arena3 A/B caught:
      // after a pounced hold the tile read `scrubbing` forever, so a second hold on
      // the same claim found no `claimed` tile at that point) wedged the state.
      if (node.dataset.state === 'scrubbing') node.dataset.state = 'claimed';
    }

    /* ---------------------------------------------------------------- *
     * The HUD line and ammo — borrowed from the page's paw row.
     * ---------------------------------------------------------------- */

    function caption(text: string): void {
      arena.caption = text;
      if (captionEl && captionEl.textContent !== text) captionEl.textContent = text;
    }
    const holdCaption = () => {
      if (arena.caption) caption(arena.caption);
    };

    /** Ammunition: the filled paws in the page HUD (the site-wide treat economy). */
    function ammo(): HTMLElement[] {
      return [...document.querySelectorAll<HTMLElement>('#cat-score .cat-paw.got')];
    }

    function syncAmmo(): void {
      const paws = [...document.querySelectorAll<HTMLElement>('#cat-score .cat-paw[data-slug]')];
      const found = paws.filter((p) => p.classList.contains('got')).length;
      // Deliberately *not* `tallyFor()`, which the page's paw row already uses. On desktop both
      // are on screen at once, and two corners reading "0 / 7 treats" look like one number
      // drawn twice. Same count, different sentence: the row is what you have collected, this
      // is what you can throw in this fight.
      if (ammoEl) ammoEl.textContent = `${found} / ${paws.length || 7} to throw`;
      // The collapsed icon's badge and "come play" cue follow the same number: a visitor
      // with treats found has something to spend, which is the tap-to-play invitation (§2.2).
      // The cue fires only while the card is closed — an open card is already the game.
      if (badgeEl) {
        if (found > 0) {
          badgeEl.hidden = false;
          badgeEl.textContent = String(found);
          if (!open) toggleEl.dataset.cue = '1';
        } else {
          badgeEl.hidden = true;
          delete toggleEl.dataset.cue;
        }
      }
    }

    /* ---------------------------------------------------------------- *
     * Territory — the strip at the top of the card.
     * ---------------------------------------------------------------- */

    function paintTerritory(): void {
      const mine = 1 - territory(arena.claimed.length, arena.order.length);
      if (territoryFill) territoryFill.style.setProperty('--territory', String(mine));
      // The boss grows with its share, like the page game's `--boss-scale`.
      //
      // `1 + share * 0.35`, not 2.2's `1.2 + share * 0.6`. That range was never seen by anyone:
      // the property was set here every frame and **no CSS rule read it**, so the cat has never
      // once grown. Wiring it up meant choosing the range for the first time rather than
      // preserving a behaviour, and 1.2–1.8 on the card's 28×18 sprite is a 34–50px cat on a
      // 318px board — a caricature. 1.0–1.35 reads as "it is winning" without taking the board.
      const share = territory(arena.claimed.length, arena.order.length);
      bossNode.style.setProperty('--boss-scale', String(1 + share * 0.35));
    }

    function hideTerritory(): void {
      if (territoryFill) territoryFill.style.removeProperty('--territory');
      bossNode.style.removeProperty('--boss-scale');
    }

    /* ---------------------------------------------------------------- *
     * Dialogue — a ribbon inside the card.
     * ---------------------------------------------------------------- */

    function say(id: string, ms = LINE_MS): void {
      arena.lastLine = id;
      arena.spokeAt = performance.now();
      ribbonNode.textContent = lineText(id);
      ribbonNode.hidden = false;
      const w = ribbonNode.offsetWidth;
      const h = ribbonNode.offsetHeight;
      const x = boss.x - w / 2;
      // `boss.y` is the cat's **centre** (see `place`, which translates by `cy - h / 2`), and
      // this used to subtract the boss's full height from it as if it were the top — so the
      // bubble was placed *on* the cat rather than above it (measured: ribbon bottom 11px inside
      // the sprite). Clearing the cat's own half-height puts it above, measured at an 11px gap.
      const y = boss.y - bossNode.offsetHeight / 2 - h - 6;
      const bw = boardEl.offsetWidth;
      const left = Math.max(4, Math.min(bw - w - 4, x));
      ribbonNode.style.transform = `translate(${left}px, ${Math.max(4, y)}px)`;
      // The tail points at whoever is speaking. It sits at a fixed 12px in CSS, which is only
      // right when the bubble happens to be centred on the cat — and it is not, whenever the
      // clamp above pushes it off a board edge.
      ribbonNode.style.setProperty(
        '--tail-x',
        `${Math.max(9, Math.min(w - 15, boss.x - left - 3))}px`,
      );
      requestAnimationFrame(() => {
        ribbonNode.hidden = false;
        ribbonNode.classList.add('show');
      });
      clearTimeout(arena.lineTimer);
      arena.lineTimer = window.setTimeout(() => {
        ribbonNode.classList.remove('show');
        setTimeout(() => {
          if (!ribbonNode.classList.contains('show')) ribbonNode.hidden = true;
        }, 220);
      }, ms);
    }

    function hushRibbon(): void {
      clearTimeout(arena.lineTimer);
      ribbonNode.classList.remove('show');
      ribbonNode.hidden = true;
      ribbonNode.removeAttribute('style');
      ribbonNode.textContent = '';
    }

    /** A snapshot of how the fight is going, for the dialogue table and the mood. */
    function fightState(now: number, ending?: FightState['ending'], consume = false): FightState {
      return {
        territory: territory(arena.claimed.length, arena.order.length),
        ammo: ammo().length,
        spent: arena.spent,
        freed: arena.freed.length,
        interrupts: arena.interrupts,
        idleMs: scrub.seen ? now - scrub.seen : 0,
        staleMs: now - arena.movedAt,
        collared: !!document.querySelector('#site-cat.lv6'),
        mood: boss.mood,
        rung: arena.rung,
        found: arena.ammoWas.filter(Boolean).length,
        manual: mode === 'manual',
        mode,
        lastStand: (() => {
          const raised = boss.lastStand;
          if (consume) boss.lastStand = false;
          return raised;
        })(),
        ending,
      };
    }

    /* ---------------------------------------------------------------- *
     * The hold — the core verb, ported (§5.2)
     * ---------------------------------------------------------------- */

    function showScrub(node: HTMLElement, progress: number): void {
      node.style.setProperty('--scrub', String(progress));
      node.dataset.state = 'scrubbing';
    }

    function hideRing(): void {
      if (scrub.target) clearWash(scrub.target);
    }

    function dropHold(hand: { target: HTMLElement | null }): void {
      if (hand.target) clearWash(hand.target);
      hand.target = null;
    }

    function stepHold(
      hand: { x: number; y: number; ax: number; ay: number; since: number; target: HTMLElement | null },
      target: HTMLElement | null,
      now: number,
      opts: { drift: boolean; over?: number },
    ): number {
      if (!target || target !== hand.target) {
        if (hand.target) clearWash(hand.target);
        hand.target = target;
        hand.since = now;
        hand.ax = hand.x;
        hand.ay = hand.y;
        if (!target) hideRing();
        return 0;
      }
      if (opts.drift && !stillEnough(hand.x - hand.ax, hand.y - hand.ay)) {
        hand.since = now;
        hand.ax = hand.x;
        hand.ay = hand.y;
      }
      const progress = scrubProgress(now - hand.since, opts.over);
      showScrub(target, progress);
      if (progress < 1) return progress;

      // reclaimed
      arena.claimed = arena.claimed.filter((n) => n !== target);
      arena.freed.push(target);
      arena.interrupts = 0;
      arena.movedAt = now;
      playCue('reclaim');
      clearWash(target);
      free(target, true);
      caption(arenaCaption(arena.claimed.length, arena.total));
      paintTerritory();
      hand.target = null;
      hand.since = now;
      hideRing();
      if (isWon(arena.claimed.length, arena.order.length)) {
        if (autonomous()) clearRound(now);
        else finish('win', now);
      }
      return 0;
    }

    /** One frame of the visitor scrubbing (manual mode). */
    function stepScrub(now: number): number {
      if (arena.ending || autonomous()) {
        dropHold(scrub);
        hideRing();
        return 0;
      }
      // Only a *claimed* tile is a scrub target. The page game's `claimUnder` required
      // `.cat-claimed` and membership in `arena.claimed`; the card's first `tileUnder`
      // port returned any tile, so a hold kept "scrubbing" a tile the moment it was
      // freed — progress that changed nothing, kept the boss camping the pointer, and
      // read to the fleet as "held but not taken" (arena8/top-state flee loops).
      const under = scrub.inside && scrub.x >= 0 ? tileUnder(scrub.x, scrub.y) : null;
      const target = under && arena.claimed.includes(under) ? under : null;
      if (target && target === scrub.target) {
        scrub.seen = now;
        touch.onClaim = true;
      }
      return stepHold(scrub, target, now, { drift: true });
    }

    /** Which tile is under a board point. */
    function tileUnder(x: number, y: number): HTMLElement | null {
      for (const node of arena.order) {
        if (!node.isConnected) continue;
        const r = node.getBoundingClientRect();
        const b = boardEl.getBoundingClientRect();
        const rx = r.left - b.left;
        const ry = r.top - b.top;
        if (x >= rx && x <= rx + r.width && y >= ry && y <= ry + r.height) return node;
      }
      return null;
    }

    /* ---------------------------------------------------------------- *
     * The squad (§15) — kittens, which do the holding in commander mode
     * ---------------------------------------------------------------- */

    function makeKitten(now: number): Kitten | null {
      const node = document.createElement('div');
      node.className = 'cat-card-kit';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      // Its own viewBox: the kitten is taller than it is long, where the boss is the reverse.
      // That difference in *footprint* is half of what makes the two readable side by side.
      svg.setAttribute('viewBox', '0 0 44 36');
      /*
       * A kitten, not a small cat — and this is the one place §0 is deliberately amended.
       *
       * Until 2.3.1 the squad was `#site-cat`'s drawing at 16×10 beside the boss's 28×18: the
       * same figure at two sizes. Two *opposed* sides then differ only by how big they are,
       * which at 16px on a board of eleven labelled tiles is not a signal anyone can read at a
       * glance — and knowing whose sprite is whose is a functional requirement of a game where
       * you order one of them around. "Nothing new is drawn" exists to stop art accreting, not
       * to make the two sides indistinguishable, so this draws the second character properly
       * and the amendment is argued in §0.
       *
       * The figure is juvenile by the usual tells, chosen because they survive being 16px wide:
       * an oversized head, a short body, and a **tail carried straight up** — a vertical stroke
       * the boss's low back-sweeping tail never makes. No eye: at this size the knockout is
       * sub-pixel and only greys the head, and its absence is one more quiet difference.
       */
      svg.innerHTML = `
        <path d="M11.5 22 C9.8 15 10.2 7.5 11.8 3.2" fill="none" stroke="currentColor" stroke-width="3.1" stroke-linecap="round"/>
        <rect x="14" y="23" width="3.2" height="9" rx="1.6"/>
        <rect x="18.6" y="23" width="3.2" height="9" rx="1.6"/>
        <rect x="25.5" y="23" width="3.2" height="9" rx="1.6"/>
        <rect x="30" y="23" width="3.2" height="9" rx="1.6"/>
        <path d="M12.8 25.5 C9.6 24.6 9.6 18.6 13.8 16.4 C15.6 15.7 17.4 15.5 19.2 15.5 L27.5 15.5 C31.8 16.1 33.6 18.3 33.6 20.9 L33.6 23.6 C33.6 25 32.8 25.5 31.3 25.5 Z"/>
        <path d="M25 7 L26 0.6 L30.8 4.2 Z"/>
        <path d="M34 4.2 L38.8 0.6 L39.8 7.6 Z"/>
        <circle cx="32.6" cy="11.6" r="9"/>
      `;
      node.appendChild(svg);
      squadNode.appendChild(node);
      return {
        el: node,
        x: boss.x,
        y: boss.y,
        ax: 0,
        ay: 0,
        vx: 0,
        vy: 0,
        at: now,
        since: now,
        inside: true,
        target: null,
        seek: null,
        flinchUntil: 0,
        facing: 1,
      };
    }

    function placeKitten(k: Kitten): void {
      k.el.style.transform = `translate(${Math.round(k.x)}px, ${Math.round(k.y)}px)`;
      k.el.dataset.facing = String(k.facing);
      k.el.dataset.hit = now < k.flinchUntil ? '1' : '';
      const seek = k.seek ? arena.order.indexOf(k.seek) : -1;
      const hold = k.target ? arena.order.indexOf(k.target) : -1;
      k.el.dataset.seek = String(seek);
      k.el.dataset.hold = String(hold);
    }
    // placeKitten reads `now` — the page version didn't; keep a frame stamp here.
    let now = 0;

    function dealSquad(t: number): void {
      disbandSquad();
      const want = kittensFor(arena.round);
      for (let i = 0; i < want; i++) {
        const k = makeKitten(t);
        if (!k) break;
        k.x += i * 14;
        k.y += i * 8;
        squad.push(k);
        placeKitten(k);
      }
    }

    function disbandSquad(): void {
      for (const k of squad) {
        if (k.target) clearWash(k.target);
        k.el.remove();
      }
      squad.length = 0;
    }

    /** Which kitten the boss hunts: the nearest. */
    function nearestKitten(): Kitten | null {
      let best: Kitten | null = null;
      let bestD = Infinity;
      for (const k of squad) {
        const d = Math.hypot(k.x - boss.x, k.y - boss.y);
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      }
      return best;
    }

    /*
     * `order()` lived here — §15's verb, which picked the nearest free kitten with `assignOrder` and
     * sent it to a clicked tile. Retired in 2.6 along with `Kitten.ordered` and the `'order'` cue when
     * the swipe became the way a visitor intervenes.
     *
     * Kept as a note because the deletion is the point: `pickWork` was always doing the interesting
     * half of this, comparing two clocks per claim and walking away from work it could not finish, and
     * an order was a way to *overrule* that. What the squad does now is entirely its own.
     */

    function stepSquad(t: number, dt: number): void {
      if (!autonomous() || arena.ending) return;
      const at = { x: boss.x, y: boss.y };
      const candidates = boardCandidates();
      const taken = squad.map((k) => (k.seek ? arena.order.indexOf(k.seek) : -1));
      const scale = {
        pounceRange: CARD_POUNCE_RANGE,
        stalkSpeed: CARD_DESPERATE_SPEED,
        kittenSpeed: CARD_KITTEN_SPEED,
      };

      for (const k of squad) {
        k.el.dataset.hit = t < k.flinchUntil ? '1' : '';
        if (k.seek && (!k.seek.isConnected || !arena.claimed.includes(k.seek))) k.seek = null;
        const slot = squad.indexOf(k);
        const seekIndex = k.seek ? arena.order.indexOf(k.seek) : -1;
        // §16: a kitten abandons a hold the cat has walked onto. Until now `k.target === k.seek`
        // made an *already-started* hold unconditionally worth keeping, so a kitten held until it
        // was pounced (`KITTEN_FLINCH_MS` is cosmetic and does not interrupt work). In a game whose
        // only verb is shoving the cat, that meant the shove never reached the squad — push the cat
        // onto a worker and nothing visibly happened. `shouldFlee` needs *both* proximity and a
        // genuinely doomed hold, so kittens still commit to work they can win.
        const fleeing =
          k.seek !== null &&
          candidates.some((c) => c.index === seekIndex && shouldFlee(k, c, at, { ...scale, safePx: CARD_SAFE_FLEE_PX }));
        // `k.ordered ||` led this test until 2.6: §15 promised a bad order was honoured, so an ordered
        // kitten kept its errand whatever `pickWork` thought. With no orders to honour, the squad's own
        // judgement is the only judgement, and the term goes rather than sitting here always false.
        const stillWorth =
          k.seek !== null &&
          !fleeing &&
          (k.target === k.seek ||
            candidates.some((c) => c.index === seekIndex && canFinish(k, c, at, scale)));
        if (!stillWorth) {
          const mine = pickWork(
            { x: k.x, y: k.y, target: seekIndex >= 0 ? seekIndex : null },
            candidates,
            at,
            taken.filter((t) => t >= 0),
            scale,
          );
          const chosen = mine >= 0 ? (arena.order[mine] ?? null) : null;
          if (chosen !== k.seek) {
            const worth = candidates.some((c) => c.index === mine && canFinish(k, c, at, scale));
            if (!k.seek || worth) {
              dropHold(k);
              k.seek = chosen;
              taken[slot] = mine;
            }
          }
        }
        if (!k.seek) {
          k.el.classList.remove('walking');
          stepHold(k, null, t, { drift: false, over: KITTEN_WORK_MS });
          placeKitten(k);
          continue;
        }

        const to = tileCentre(k.seek);
        const dx = to.x - k.x;
        const dy = to.y - k.y;
        const away = Math.hypot(dx, dy);
        const holding = k.target === k.seek;
        if (!holding && away > ARRIVE_PX * CARD_SCALE) {
          const step = Math.min(away, CARD_KITTEN_SPEED * dt);
          k.x += (dx / away) * step;
          k.y += (dy / away) * step;
          k.vx = (dx / away) * CARD_KITTEN_SPEED;
          k.vy = (dy / away) * CARD_KITTEN_SPEED;
          k.at = t;
          if (Math.abs(dx) > 2) k.facing = dx < 0 ? -1 : 1;
          k.el.classList.add('walking');
          stepHold(k, null, t, { drift: false, over: KITTEN_WORK_MS });
          placeKitten(k);
          continue;
        }

        k.vx = 0;
        k.vy = 0;
        k.el.classList.remove('walking');
        stepHold(k, k.seek, t, { drift: false, over: KITTEN_WORK_MS });
        placeKitten(k);
      }
    }

    /* ---------------------------------------------------------------- *
     * Treats (§5.4) — exploration, spent
     * ---------------------------------------------------------------- */

    function throwTreat(x: number, y: number): void {
      if (!arena.on || arena.ending || arena.treat) return;
      const paws = ammo();
      const paw = paws[paws.length - 1];
      if (!paw) return;
      const kind = resolveTreat(paw.dataset.slug ?? '');
      paw.classList.remove('got');
      // thrown from the ammo chip, which is where the paws live
      const from = ammoEl?.getBoundingClientRect();
      const b = boardEl.getBoundingClientRect();
      const fx = from ? from.left - b.left + from.width / 2 : b.width / 2;
      const fy = from ? from.top - b.top + from.height / 2 : b.height - 10;
      arena.treat = { x, y, fx, fy, at: performance.now(), landed: false, kind };
      arena.spent++;
      treatNode.querySelector('use')?.setAttribute('href', `#treat-${kind}`);
      treatNode.classList.remove('eaten');
      treatNode.removeAttribute('hidden');
      placeTreat(fx, fy);
      syncAmmo();
    }

    function placeTreat(x: number, y: number): void {
      const w = treatNode.offsetWidth;
      const h = treatNode.offsetHeight;
      treatNode.style.transform = `translate(${x - w / 2}px, ${y - h / 2}px)`;
    }

    function stepTreat(t: number): void {
      const tr = arena.treat;
      if (!tr || tr.landed) return;
      const k = (t - tr.at) / THROW_ARC_MS;
      if (k >= 1) {
        tr.landed = true;
        placeTreat(tr.x, tr.y);
        const dist = Math.hypot(tr.x - boss.x, tr.y - boss.y);
        if (swatLands(boss.phase, dist, SWAT_RADIUS * CARD_SCALE)) {
          boss.since += SWAT_STUN_MS;
          bossNode.classList.add('boss-swatted');
          // The cue was defined in cat-sfx.ts and never played, and `.boss-swatted` was set
          // and never styled — so the *only* player action that touches the cat's body landed
          // with no picture and no sound. A hit the player cannot perceive is not a mechanic.
          playCue('swat');
          window.setTimeout(() => bossNode.classList.remove('boss-swatted'), SWAT_STUN_MS);
        }
        return;
      }
      placeTreat(tr.fx + (tr.x - tr.fx) * k, tr.fy + (tr.y - tr.fy) * k);
    }

    function finishEating(t: number): void {
      treatNode.setAttribute('hidden', '');
      treatNode.classList.remove('eaten');
      arena.treat = null;
      bossPhase('stalk', t);
    }

    function clearTreat(): void {
      treatNode.setAttribute('hidden', '');
      treatNode.classList.remove('eaten');
      arena.treat = null;
    }

    /* ---------------------------------------------------------------- *
     * Mood and talk
     * ---------------------------------------------------------------- */

    function stepMood(t: number): void {
      const next = moodFor(fightState(t), boss.mood);
      if (next === boss.mood) return;
      boss.mood = next;
      if (next === 'desperate') {
        boss.lastStand = true;
        playCue('laststand');
      } else {
        boss.lastStand = false;
      }
      bossNode.dataset.mood = next;
    }

    function stepTalk(t: number): void {
      const gap = arena.lastLine
        ? LINE_MS + talkGap(aggression(boss.mood))
        : OPENING_LINE_MS;
      if (t - arena.spokeAt < gap) return;
      const id = pickLine(fightState(t, undefined, true), arena.lastLine);
      if (id) say(id);
    }

    /* ---------------------------------------------------------------- *
     * The boss (§5.3) — stalk, telegraph, leap, recover
     * ---------------------------------------------------------------- */

    /** The board's safe area, so the boss never walks off the card. */
    function boardBounds(): { w: number; h: number } {
      return { w: boardEl.offsetWidth, h: boardEl.offsetHeight };
    }

    function stepBoss(t: number, dt: number, progress: number): void {
      const spec = STANCES[boss.stance];
      const aggro = aggression(boss.mood) * roundAggro(arena.round);
      const scale =
        boss.phase === 'telegraph'
          ? spec.telegraph * boss.telegraphMul * telegraphScale(aggro)
          : boss.phase === 'recover'
            ? spec.recover
            : boss.phase === 'eat'
              ? boss.lureMs / LURE_MS
              : 1;
      const advance = nextPhase(boss.phase, t - boss.since, scale);
      if (advance === 'leap') {
        boss.telegraphMul = 1;
        if (boss.feint) {
          boss.feint = false;
          if (Math.random() < TRICKSTER_DOUBLE && !arena.ending && arena.claimed.length > 0 && quarry.inside) {
            const moving = t - quarry.at < 90;
            const aim = predict(
              quarry.x,
              quarry.y,
              moving ? quarry.vx : 0,
              moving ? quarry.vy : 0,
              AIM_LEAD_MS,
              CARD_PREDICT_CAP,
            );
            boss.ax = boss.x;
            boss.ay = boss.y;
            boss.bx = aim.x;
            boss.by = aim.y;
            bossPhase('telegraph', t);
            return;
          }
          bossPhase('stalk', t);
          return;
        }
        bossPhase('leap', t);
      } else if (advance === 'recover') {
        bossPhase('recover', t);
        land(t);
      } else if (advance === 'stalk' && boss.phase === 'eat') {
        finishEating(t);
      } else if (advance) {
        bossPhase(advance, t);
      }

      if (boss.phase === 'leap') {
        const p = leapPos(boss.ax, boss.ay, boss.bx, boss.by, (t - boss.since) / LEAP_MS, CARD_LEAP_HEIGHT);
        placeBoss(p.x, p.y);
        return;
      }

      if (boss.phase === 'fetch') {
        const tr = arena.treat;
        if (!tr) {
          bossPhase('stalk', t);
          return;
        }
        const tx = tr.x - boss.x;
        const ty = tr.y - boss.y;
        const away = Math.hypot(tx, ty);
        if (away <= FETCH_REACH * CARD_SCALE) {
          const specT = treatSpec(tr.kind);
          boss.lureMs = specT.lureMs;
          boss.immuneMs = specT.immuneMs;
          boss.anchorX = tr.x;
          boss.anchorY = tr.y;
          boss.anchorPx = specT.anchorPx * CARD_SCALE;
          boss.anchorUntil = specT.anchorMs ? t + specT.lureMs + specT.anchorMs : 0;
          boss.telegraphMul = specT.telegraphMul;
          boss.slowMul = specT.slowMul;
          boss.slowUntil = specT.slowMs ? t + specT.lureMs + specT.slowMs : 0;
          treatNode.classList.add('eaten');
          bossPhase('eat', t);
          return;
        }
        // Deliberately *not* `onBoard()`. A treat can land in the board's padding, closer to an
        // edge than the sprite's half-width; clamping the walk there stops the cat a few pixels
        // short of the treat, `away` never closes, and it never reaches `eat` — measured as
        // arena5 timing out for 20s waiting on a phase that could no longer arrive. Fetching to
        // the very edge, sprite overhanging slightly, is the correct behaviour.
        const step = Math.min(away, FETCH_SPEED * CARD_SCALE * dt);
        placeBoss(boss.x + (tx / away) * step, boss.y + (ty / away) * step);
        faceToward(tx);
        return;
      }

      if (boss.phase === 'eat' && boss.immuneMs < boss.lureMs && t - boss.since >= boss.immuneMs) {
        finishEating(t);
      }

      if (boss.phase !== 'stalk') return;

      if (arena.treat?.landed) {
        bossPhase('fetch', t);
        return;
      }

      if (boss.mood === 'bored' && t >= boss.groomUntil && t - boss.groomedAt > GROOM_EVERY_MS) {
        boss.groomedAt = t;
        boss.groomUntil = t + GROOM_MS;
      }
      if (t < boss.groomUntil) {
        // Expose the grooming beat the way phase and mood are exposed — the page game
        // carried a `.grooming` class and §7.3's harness reads it as the bored tell; the
        // card's boss is data-driven, so the same signal is `dataset.groom`.
        if (bossNode.dataset.groom !== '1') bossNode.dataset.groom = '1';
        if (boss.mood !== 'bored') boss.groomUntil = 0;
        else return;
      } else if (bossNode.dataset.groom) {
        bossNode.dataset.groom = '';
      }

      /*
       * The regrow clock ticks before the stalk guard, deliberately. In the page game this block
       * sat after the `quarry.inside` early-return, where it did not matter — the arena *was* the
       * page, so a pointer was effectively always "inside". On the card the board is a few hundred
       * pixels and the pointer is off it as often as on, so gating the clock behind the guard
       * froze regrow whenever the visitor's cursor left the board: a watched fight never grew back
       * and a player who stepped away got a free pause on the one pressure that reaches a distant
       * hand (2.2 port bug — §9.3's "the walls come in" is a clock, not a stance the pointer has
       * to be inside to hear). Stalking still needs the pointer on the board; the clock does not.
       */
      if (
        spec.regrowMs > 0 &&
        !arena.ending &&
        t > boss.regrowAt &&
        arena.claimed.length < arena.order.length
      ) {
        let took = 0;
        const back = takeGround();
        if (back) {
          took = 1;
          claim(back, arena.order.indexOf(back), arena.seed);
          arena.claimed.push(back);
          arena.total = Math.max(arena.total, arena.claimed.length);
          boss.regrows++;
          if (spec.pin && boss.regrows % SIEGE_SWEEP_EVERY === 0) {
            const held = arena.claimed.map((n) => arena.order.indexOf(n)).filter((i) => i >= 0);
            const partner = sweepPartner(arena.order.indexOf(back), held, arena.order.length);
            const alsoTake = partner >= 0 ? arena.order[partner] : undefined;
            if (alsoTake?.isConnected && !arena.claimed.includes(alsoTake)) {
              const wasFreed = arena.freed.indexOf(alsoTake);
              if (wasFreed >= 0) arena.freed.splice(wasFreed, 1);
              claim(alsoTake, partner, arena.seed);
              arena.claimed.push(alsoTake);
              arena.total = Math.max(arena.total, arena.claimed.length);
              took = 2;
            }
          }
          arena.movedAt = t;
          caption(arenaCaption(arena.claimed.length, arena.total));
          paintTerritory();
          if (!checkRound() && isLost(arena.claimed.length, arena.order.length, ammo().length))
            finish('lose', t);
        }
        boss.regrowAt = t + roundRegrowMs(spec.regrowMs, boss.mood, took, arena.round);
      }

      if (!quarry.inside || quarry.x < 0) return;
      const dx = quarry.x - boss.x;
      const dy = quarry.y - boss.y;
      const dist = Math.hypot(dx, dy);

      if (
        canPounce(boss.phase) &&
        !arena.ending &&
        t - arena.openedAt > OPENING_GRACE_MS &&
        provoked(dist, progress, patienceFor(spec.patience, aggro), CARD_POUNCE_RANGE) &&
        arena.claimed.length > 0
      ) {
        const moving = t - quarry.at < 90;
        const aim = predict(
          quarry.x,
          quarry.y,
          moving ? quarry.vx : 0,
          moving ? quarry.vy : 0,
          AIM_LEAD_MS,
          CARD_PREDICT_CAP,
        );
        boss.ax = boss.x;
        boss.ay = boss.y;
        boss.bx = aim.x;
        boss.by = aim.y;
        boss.feint = Math.random() < spec.feint;
        bossPhase('telegraph', t);
        return;
      }

      if (dist > 1) {
        const slowed = t < boss.slowUntil ? boss.slowMul : 1;
        /*
         * §16's shove: three terms, and two of them exist because the walk is **homing**.
         *
         * `dx/dist` is recomputed toward the quarry every frame, so a lateral offset is never a state the
         * cat carries — it is an error the cat corrects, at roughly `step · δ / dist` per frame, which
         * grows as the cat closes on what it is chasing. `tests/hand.test.ts` integrates this branch with
         * the real constants: a bare sideways impulse lands 25.7px of its nominal 25.2 at 140px from the
         * quarry and only 15.8px at 10px from it. So the erosion is real, worst exactly when a player
         * would most want to shove, and **not** the difference between a mechanic and no mechanic — an
         * earlier version of this comment said it was, on the strength of in-situ figures a 20fps
         * harness could not actually resolve. The simulation is what settled it.
         *
         * The two remedies close most of that gap and both come from the same reading of the gesture:
         *
         * - **A shoved cat stops looking where it is going.** While the impulse lasts, the walk follows
         *   the heading the cat had *when it was hit*, blending back to the live quarry direction as the
         *   impulse decays. `shoveLeft` is both the strength of the push and the blend, because they are
         *   one event — no second constant, nothing to keep in sync.
         * - **`SHOVE_FOOTING`**: a gust does not add sideways speed to something with perfect traction, it
         *   takes the traction away. A third of its stride at the peak, so the cat still visibly tries to
         *   get where it was going rather than freezing.
         *
         * Together they take the worst case from 15.8px to 23.0px and leave the best case unchanged, which
         * is the right shape: the mechanic stops depending on where the cat happens to be standing.
         *
         * Raising `IMPULSE_SPEED` was the alternative and is the wrong lever — a bigger shove buys a
         * proportionally bigger correction, so it costs legibility everywhere to fix one case.
         */
        /*
         * `boss.shoveAt > 0` is a guard on the sentinel, not a redundancy. `shoveAt` starts at `0`
         * meaning "never shoved", and `impulseAt(t - 0)` is `impulseAt(t)` — which is only `0` because
         * `t` is time since navigation start and is normally far past `IMPULSE_MS`. Inside the first
         * 420ms of a page's life it would return a *live* impulse, and the cat would walk at
         * `SHOVE_FOOTING` speed while being shoved by a stale direction, in every mode including the two
         * shipped ones. A sentinel that happens to be safe because of how big a clock usually is, is
         * the same bug as a magic number.
         */
        const shoveLeft = boss.shoveAt > 0 ? impulseAt(t - boss.shoveAt) : 0;
        const footing = 1 - shoveLeft * (1 - SHOVE_FOOTING);
        const step = Math.min(dist, CARD_STALK_SPEED * spec.stalk * slowed * aggro * footing * dt);
        // Aim: the live quarry direction, blended with the heading it was knocked off.
        let hx = dx / dist;
        let hy = dy / dist;
        if (shoveLeft > 0 && (boss.shoveHx || boss.shoveHy)) {
          hx = hx * (1 - shoveLeft) + boss.shoveHx * shoveLeft;
          hy = hy * (1 - shoveLeft) + boss.shoveHy * shoveLeft;
          const hl = Math.hypot(hx, hy) || 1;
          hx /= hl;
          hy /= hl;
        }
        let nx = boss.x + hx * step;
        let ny = boss.y + hy * step;
        if (shoveLeft > 0) {
          nx += boss.shoveX * shoveLeft * dt;
          ny += boss.shoveY * shoveLeft * dt;
        }
        if (t < boss.anchorUntil && boss.anchorPx > 0) {
          const ax = nx - boss.anchorX;
          const ay = ny - boss.anchorY;
          const away = Math.hypot(ax, ay);
          if (away > boss.anchorPx) {
            nx = boss.anchorX + (ax / away) * boss.anchorPx;
            ny = boss.anchorY + (ay / away) * boss.anchorPx;
          }
        }
        if (spec.pin) ny = boss.y;
        const on = onBoard(nx, ny);
        placeBoss(on.x, on.y);
        faceToward(dx);
      }
    }

    /** Touchdown — hit or miss against where the cat aimed. */
    function land(t: number): void {
      placeBoss(boss.bx, boss.by);
      playCue('land');
      const caught = quarry.inside && pounceHit(boss.bx, boss.by, quarry.x, quarry.y, CARD_HIT_RADIUS);
      if (!caught) return;

      dropHold(quarry);
      quarry.since = t;
      hideRing();
      arena.interrupts++;
      if (autonomous()) {
        const hit = squad.find((k) => k === quarry);
        if (hit) hit.flinchUntil = t + KITTEN_FLINCH_MS;
      }
      for (let i = 0; i < (autonomous() ? 0 : RECLAIM_ON_HIT); i++) {
        const back = takeGround();
        if (!back) break;
        claim(back, arena.order.indexOf(back), arena.seed);
        arena.claimed.push(back);
        arena.total = Math.max(arena.total, arena.claimed.length);
      }
      if (boss.stance === 'ambush') {
        boss.anchorX = boss.bx;
        boss.anchorY = boss.by;
        boss.anchorPx = AMBUSH_PIN_PX * CARD_SCALE;
        boss.anchorUntil = t + AMBUSH_PIN_MS;
      }
      arena.movedAt = t;
      caption(arenaCaption(arena.claimed.length, arena.total));
      paintTerritory();
      if (!checkRound() && isLost(arena.claimed.length, arena.order.length, ammo().length))
        finish('lose', t);
    }

    /** What a landed pounce takes: most recently freed, else nearest to the landing. */
    function takeGround(): HTMLElement | null {
      while (arena.freed.length) {
        const back = arena.freed.pop();
        if (back?.isConnected && !arena.claimed.includes(back)) return back;
      }
      const free = arena.order.filter((n) => n.isConnected && !arena.claimed.includes(n));
      if (!free.length) return null;
      const landed = tileUnder(boss.bx, boss.by);
      if (landed && free.includes(landed)) return landed;
      let best = free[0]!;
      let bestD = Infinity;
      for (const n of free) {
        const c = tileCentre(n);
        const d = Math.hypot(c.x - boss.bx, c.y - boss.by);
        if (d < bestD) {
          bestD = d;
          best = n;
        }
      }
      return best;
    }

    /* ---------------------------------------------------------------- *
     * Endings and rounds (§7, §15)
     * ---------------------------------------------------------------- */

    function finish(ending: 'win' | 'lose', t: number): void {
      if (arena.ending) return;
      arena.ending = ending;
      playCue(ending === 'win' ? 'win' : 'lose');
      const line = pickLine(fightState(t, ending), undefined);
      if (line) say(line, ending === 'win' ? WIN_BEAT_MS : LOSE_BEAT_MS);
      arena.rung = nextRung(arena.rung, ending, arena.ammoWas.filter(Boolean).length);

      if (ending === 'win') {
        // §7.1's notch: the confrontation path's proof, on the ambient cat, session-only.
        // The card's boss is its own sprite; the *notch* belongs to the site's cat, which
        // is the animal a visitor meets in the corner — same promise the page game kept.
        document.querySelector('#site-cat')?.classList.add('notched');
        const parting = takeGround();
        if (parting) {
          claim(parting, arena.order.indexOf(parting), arena.seed);
          arena.claimed.push(parting);
          paintTerritory();
        }
      }
      clearTimeout(arena.beatTimer);
      arena.beatTimer = window.setTimeout(() => {
        endFight();
        setOpen(false);
      }, ending === 'win' ? WIN_BEAT_MS : LOSE_BEAT_MS);
    }

    function clearRound(t: number): void {
      const cleared = arena.round;
      const seconds = ((t - arena.roundAt) / 1000).toFixed(0);
      arena.round = cleared + 1;
      const record = writeBestRound(arena.round);
      arena.best = Math.max(arena.best, arena.round);
      playCue('win');
      caption(record ? `round ${cleared} cleared in ${seconds}s — best yet` : `round ${cleared} cleared in ${seconds}s`);
      say(record ? 'round-record' : 'round-clear', ROUND_BEAT_MS);
      clearTimeout(arena.beatTimer);
      arena.beatTimer = window.setTimeout(() => {
        if (!arena.on || !autonomous()) return;
        const then = performance.now();
        if (!dealBoard(then)) {
          endQuietly();
          return;
        }
        rollStance(arena.seed);
        dealSquad(then);
      }, ROUND_BEAT_MS);
    }

    function restartRound(): void {
      playCue('lose');
      caption('the page is theirs — going again');
      say('round-again', ROUND_BEAT_MS);
      clearTimeout(arena.beatTimer);
      arena.beatTimer = window.setTimeout(() => {
        if (!arena.on || !autonomous()) return;
        const then = performance.now();
        if (!dealBoard(then)) {
          endQuietly();
          return;
        }
        rollStance(arena.seed);
        dealSquad(then);
      }, ROUND_BEAT_MS);
    }

    function checkRound(): boolean {
      if (!autonomous() || arena.ending) return false;
      const outcome = roundOutcome(arena.claimed.length, arena.order.length);
      if (outcome === 'restart') {
        restartRound();
        return true;
      }
      return false;
    }

    function rollStance(seed: number): void {
      const t = performance.now();
      boss.stance = pickStance(seed);
      boss.feint = false;
      boss.telegraphMul = 1;
      boss.slowUntil = 0;
      boss.slowMul = 1;
      boss.anchorUntil = 0;
      boss.anchorPx = 0;
      boss.lureMs = LURE_MS;
      boss.immuneMs = LURE_MS;
      boss.regrowAt = t + roundRegrowMs(STANCES[boss.stance].regrowMs, 'even', 1, arena.round);
      boss.regrows = 0;
      boss.lastStand = false;
      boss.mood = 'even';
      boss.groomedAt = t;
      bossNode.dataset.mood = 'even';
      bossNode.dataset.stance = boss.stance;
      bossPhase('stalk', t);
    }

    /* ---------------------------------------------------------------- *
     * Open / close — the card's expand and collapse
     * ---------------------------------------------------------------- */

    /** Deal a board of tiles from the pool. */
    function dealBoard(t: number): boolean {
      for (const node of arena.claimed) free(node, false);
      arena.claimed = [];
      arena.freed = [];
      arena.order = [];
      boardEl.querySelectorAll<HTMLElement>('.cat-tile').forEach((n) => n.remove());
      if (!POOL.length) return false;
      const count = Math.min(POOL.length, BOARD_MIN + Math.floor(Math.random() * (BOARD_MAX - BOARD_MIN + 1)));
      const pool = [...POOL].sort(() => Math.random() - 0.5).slice(0, count);
      const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
      const picked = pickClaims(pool.length, INITIAL_CLAIM_FRACTION, seed);
      pool.forEach((t) => {
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'cat-tile';
        tile.textContent = t.label;
        tile.dataset.state = 'unclaimed';
        // Its category's own wash hue — the same number that tints that section's page.
        tile.style.setProperty('--tile-hue', String(t.hue));
        boardEl.appendChild(tile);
        arena.order.push(tile);
      });
      arena.seed = seed;
      arena.claimed = picked.map((i) => arena.order[i]!);
      arena.total = arena.claimed.length;
      arena.claimed.forEach((node) => claim(node, arena.order.indexOf(node), seed));
      caption(arenaCaption(arena.claimed.length, arena.total));
      arena.movedAt = t;
      arena.interrupts = 0;
      arena.ending = null;
      arena.roundAt = t;
      paintTerritory();
      if (roundEl) roundEl.textContent = `round ${arena.round}`;
      return true;
    }

    function startFight(t: number): void {
      arena.round = 1;
      arena.best = readBestRound();
      // §9.4's ladder is *module* state, not fight state: it is initialised at 0 when the
      // script loads, moved by `finish` via `nextRung`, and only ever reset by a refresh
      // (the rung's whole lifetime, §7.2). Resetting it here — as a 2.2 port briefly did —
      // made every reopen a rung-0 fight, which is not a ladder at all.
      if (!dealBoard(t)) return;
      arena.on = true;
      arena.openedAt = t;
      // Expose the open time so the fleet can measure the opening grace against the game's
      // own clock, not against a `performance.now()` it reads a beat after the click (§2.2:
      // arena2's grace check under-measured by the harness's own ~200ms of setup and flaked).
      bossNode.dataset.openedAt = String(t);
      arena.spokeAt = t;
      arena.spent = 0;
      arena.lastLine = '';
      scrub.seen = t;
      dropHold(scrub);
      const paws = [...document.querySelectorAll<HTMLElement>('#cat-score .cat-paw[data-slug]')];
      arena.ammoWas = paws.map((p) => p.classList.contains('got'));
      withholdForRung(paws);
      // Spawn on the floor, centre — `h - 8` hard-coded the old sprite's half-height here too.
      const { w, h } = boardBounds();
      const spawn = onBoard(w / 2, h);
      placeBoss(spawn.x, spawn.y);
      boss.facing = 1;
      boss.last = t;
      // A spawn is a teleport, not travel: the axis starts empty rather than pointing at wherever the
      // last fight left the cat. Same reason `mood` and `groom` are cleared on close.
      boss.vx = 0;
      boss.vy = 0;
      boss.swipedAt = 0;
      boss.grazedAt = 0;
      rollStance(arena.seed);
      if (autonomous()) dealSquad(t);
      syncAmmo();
      now = t;
      arena.raf = requestAnimationFrame(tick);
    }

    // The collapsed badge/cue needs the count on load, before any fight opens.
    syncAmmo();

    // ...and again whenever the paw row changes. This call alone was not enough: the paws are
    // SiteCat's, marked `got` by its own script, and nothing orders the two components'
    // `astro:page-load` handlers. A returning visitor with treats got badge=0 and no cue —
    // the cue being the one thing that says the card is worth opening. Watching the row costs
    // one observer and removes the ordering question entirely. `syncAmmo` only reads paws and
    // writes the badge and footer, so this cannot feed itself.
    const scoreRow = document.querySelector('#cat-score');
    if (scoreRow) {
      new MutationObserver(syncAmmo).observe(scoreRow, {
        subtree: true,
        attributes: true,
        attributeFilter: ['class'],
      });
    }

    function withholdForRung(paws: HTMLElement[]): void {
      const filled = paws.filter((p) => p.classList.contains('got'));
      const keep = ammoCap(filled.length, arena.rung);
      for (const paw of filled.slice(keep)) {
        paw.classList.remove('got');
        paw.classList.add('withheld');
      }
    }

    function restoreAmmo(): void {
      const paws = [...document.querySelectorAll<HTMLElement>('#cat-score .cat-paw[data-slug]')];
      paws.forEach((paw, i) => {
        const found = paw.classList.contains('got');
        paw.classList.toggle('got', found || (arena.ammoWas[i] ?? false));
        paw.classList.remove('withheld');
      });
      arena.ammoWas = [];
      syncAmmo();
    }

    function restoreCaption(): void {
      const paws = [...document.querySelectorAll<HTMLElement>('#cat-score .cat-paw[data-slug]')];
      if (!paws.length) return;
      caption(tallyFor(paws.filter((p) => p.classList.contains('got')).length, paws.length));
    }

    function endFight(): void {
      cancelAnimationFrame(arena.raf);
      arena.raf = 0;
      disbandSquad();
      for (const node of arena.claimed) free(node, false);
      arena.claimed = [];
      arena.freed = [];
      arena.order = [];
      arena.total = 0;
      arena.on = false;
      clearTimeout(arena.beatTimer);
      arena.beatTimer = 0;
      hushRibbon();
      clearTreat();
      hideTerritory();
      arena.caption = '';
      if (captionEl) captionEl.textContent = '';
      restoreAmmo();
      restoreCaption();
      // The boss element persists across close (transition:persist), so a fight's
      // *state* must not: mood and the grooming tell are fight-scoped, and leaving them
      // on the collapsed icon would leak a tier into the next fight — and into the
      // harness that reads them off the element (§7.3, arena7).
      boss.mood = 'even';
      bossNode.dataset.mood = 'even';
      bossNode.dataset.groom = '';
    }

    function endQuietly(): void {
      hushRibbon();
      endFight();
    }

    function truce(): void {
      if (!arena.on) return;
      if (arena.ending) {
        endFight();
        return;
      }
      const kind = boss.phase === 'recover' ? 'truce-recover' : 'truce';
      const line = pickLine(fightState(performance.now(), kind), undefined);
      if (line) say(line, LINE_MS);
      endFight();
    }

    /* ---------------------------------------------------------------- *
     * The loop
     * ---------------------------------------------------------------- */

    function tick(t: number): void {
      if (!arena.on) return;
      arena.raf = requestAnimationFrame(tick);

      const patience = autonomous() ? WATCH_TRUCE_MS : IDLE_TRUCE_MS;
      if (scrub.seen && t - scrub.seen > patience) {
        endQuietly();
        setOpen(false);
        return;
      }

      const dt = Math.min(0.05, (t - boss.last) / 1000);
      boss.last = t;
      now = t;

      stepTreat(t);
      stepMood(t);
      stepSquad(t, dt);
      const worked = stepScrub(t);
      quarry = autonomous() ? (nearestKitten() ?? scrub) : scrub;
      const wasX = boss.x;
      const wasY = boss.y;
      stepBoss(t, dt, autonomous() ? scrubProgress(t - quarry.since) * (quarry.target ? 1 : 0) : worked);
      /*
       * §16's axis: the cat's own velocity, smoothed.
       *
       * Measured **around** `stepBoss` rather than inside its stalk branch, from the distance actually
       * travelled — so the clamp at the board edge is in it, and so is a leap. That is right rather
       * than merely convenient: a leaping cat is genuinely travelling that way, and swiping across a
       * leap should read as across it.
       *
       * An exponential moving average framed on `dt`, not a fixed per-frame alpha. A per-frame constant
       * would make the smoothing depend on the frame rate — the cat's axis would settle faster on a
       * desktop than on a phone — which is the same bug class the `dt` cap above exists to prevent.
       * `dt` can be exactly 0 when two ticks land in the same millisecond, and this is the first place
       * in the loop that would divide by it.
       */
      if (dt > 0) {
        const k = 1 - Math.exp(-dt / (HEADING_TAU_MS / 1000));
        boss.vx += ((boss.x - wasX) / dt - boss.vx) * k;
        boss.vy += ((boss.y - wasY) / dt - boss.vy) * k;
      }
      /*
       * A caption restatement of §16's verb lived here, added in 2.5.2 on the stated premise that
       * "§16 has no chip, so the caption is the only thing that names the verb". 2.6 made that false:
       * the cat teaches it out loud now (`teach-swipe` in §8's table), gated to the same cold opening.
       *
       * Two teachers is worse than either. Rendered, the ribbon said *"swipe across me. i dare you."*
       * and the caption said "SWIPE ACROSS THE CAT TO SHOVE IT OFF COURSE" thirty pixels below it, in
       * a different type style — the same fault as 2.2.1's `treats: 0 / 7 treats`, which was one number
       * drawn twice in two corners. The caption is the score line again, and the cat does the talking.
       */
      holdCaption();
      if (!arena.ending) stepTalk(t);
    }

    /* ---------------------------------------------------------------- *
     * Card open / close
     * ---------------------------------------------------------------- */

    function setOpen(next: boolean): void {
      open = next;
      // `data-open` is the card's only open-state marker, and it stays on the card's own
      // root. A `cat-card-open` class on `<html>` was tried here and `arena.mjs` rejected it
      // on the spot: pillar 2 says the card never writes to the page, and `<html>` is the
      // page. SiteCat reads this attribute through `:has()` instead — CSS matching, no DOM.
      rootEl.dataset.open = next ? '1' : '';
      toggleEl.setAttribute('aria-expanded', next ? 'true' : 'false');
      // `preventScroll` on both. The card is fixed, so focus should never scroll the page —
      // this is the guard that keeps it true if that ever changes. (A `card-check` failure
      // looked like exactly this bug and turned out to be the harness reading a baseline
      // mid-smooth-scroll; the flag is kept on its own merits, not on that measurement.)
      if (next) {
        // The cue's invitation is answered; the game is where treats are spent now.
        delete toggleEl.dataset.cue;
        panelEl.hidden = false;
        const t = performance.now();
        startFight(t);
        closeBtn?.focus({ preventScroll: true });
      } else {
        if (arena.on) endFight();
        panelEl.hidden = true;
        toggleEl.focus({ preventScroll: true });
        syncAmmo();
      }
    }

    /* ---------------------------------------------------------------- *
     * Header controls
     * ---------------------------------------------------------------- */

    // Sound — owned here, session-only like every other fight setting (§13.4).
    // 2.1's decision carries: sound is on by default, so this is a mute, and a
    // refresh comes back with sound on.
    const syncSound = () =>
      soundBtn?.setAttribute('aria-pressed', sfxEnabled() ? 'true' : 'false');
    soundBtn?.addEventListener('click', () => {
      setSfxEnabled(!sfxEnabled());
      syncSound();
    });
    syncSound();

    /**
     * Mode — owned here too. Pressed means manual (§15); the switch takes effect on the next round,
     * never mid-fight.
     *
     * Two things beyond the aria state, both of which §16 needed and neither of which was §16's own
     * idea:
     *
     * 1. **The mode is written down.** `aria-pressed` can only say manual-or-not, so with three
     *    modes there was no way for anything outside this closure — a harness, a stylesheet, a
     *    person reading the DOM — to tell which game is running. `data-mode` on the panel is that
     *    observable. On the panel and not on `<html>`: pillar 2 is about the card never writing to
     *    the *page*, and this is the card's own element, the same one that already carries `hidden`.
     * 2. **The chip cannot lie**, which in 2.5.1 meant hiding it. `hand` was then a third mode the
     *    two-state switch could not describe: it read "play it yourself" un-pressed — which states
     *    commander — and pressing it set `mode = 'manual'`, quietly destroying the prototype with no
     *    way back but a reload. 2.6 removed the third mode instead of the control. There are two
     *    games again, the chip names one of them, and it is always visible.
     */
    const syncMode = () => {
      panelEl.dataset.mode = mode;
      modeBtn?.setAttribute('aria-pressed', mode === 'manual' ? 'true' : 'false');
    };
    modeBtn?.addEventListener('click', () => {
      mode = mode === 'manual' ? 'hand' : 'manual';
      syncMode();
      if (arena.on) {
        // §15: mode takes effect on the next round — say what it will do.
        caption(autonomous() ? 'next round: kittens play' : 'next round: you play');
      }
    });
    syncMode();

    /* ---------------------------------------------------------------- *
     * Events, scoped to the card (§2.2 — nothing window-wide)
     * ---------------------------------------------------------------- */

    // Presence: any pointer over the card, any key, any scroll.
    boardEl.addEventListener('pointermove', (e) => {
      const c = boardCoords(e.clientX, e.clientY);
      const t = performance.now();
      const dt = (t - scrub.at) / 1000;
      if (scrub.at && dt > 0.004 && dt < 0.12) {
        // Both ends of the delta in *board* coordinates. This read `e.clientX - scrub.x`, which
        // subtracted a board-relative position from a viewport-relative one: the difference carried
        // the board's own left/top offset as a constant, so at dt≈0.016 a stationary pointer
        // "moved" tens of thousands of px/s, always in +x/+y. `CARD_PREDICT_CAP` clamped it, which
        // is why nothing ever looked broken — the leap simply always over-led down and to the
        // right, in the one mode (§3 manual) where the aim is supposed to read your movement.
        scrub.vx = (c.x - scrub.x) / dt;
        scrub.vy = (c.y - scrub.y) / dt;
      } else {
        scrub.vx = 0;
        scrub.vy = 0;
      }
      // §16: the shove. Measured on the segment the pointer just travelled, before `scrub.x/y`
      // are overwritten — the previous position is the only place the segment's start exists.
      if (swiping() && arena.on && !arena.ending) trySwipe(scrub.x, scrub.y, c.x, c.y, t - scrub.at, t);
      scrub.at = t;
      scrub.x = c.x;
      scrub.y = c.y;
      scrub.inside = true;
      scrub.seen = t;
    });

    boardEl.addEventListener(
      'pointerdown',
      (e) => {
        if (!arena.on) return;
        if (e.pointerType === 'mouse') {
          touch.at = 0;
          return;
        }
        const c = boardCoords(e.clientX, e.clientY);
        const t = performance.now();
        scrub.x = scrub.ax = c.x;
        scrub.y = scrub.ay = c.y;
        scrub.vx = scrub.vy = 0;
        scrub.at = t;
        scrub.since = t;
        scrub.seen = t;
        scrub.inside = true;
        dropHold(scrub);
        touch.at = t;
        touch.onClaim = false;
      },
      { passive: true },
    );

    const liftFinger = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      scrub.x = scrub.y = -1;
      scrub.ax = scrub.ay = -1;
      dropHold(scrub);
      scrub.inside = false;
      hideRing();
    };
    boardEl.addEventListener('pointerup', liftFinger, { passive: true });
    boardEl.addEventListener('pointercancel', liftFinger, { passive: true });

    // Click on the board: in commander mode, a claimed tile is an order; anything
    // A click throws a treat, wherever it lands.
    boardEl.addEventListener('click', (e) => {
      if (!arena.on) return;
      const c = boardCoords(e.clientX, e.clientY);
      if (touch.at && !isTap(performance.now() - touch.at)) return;
      // Every click is a throw now, in both modes. §15's "point at a claim to send somebody" is gone
      // with the ordering it drove — the tile under the pointer no longer changes what a click means,
      // which is one fewer thing a visitor has to know before the game answers them.
      throwTreat(c.x, c.y);
      touch.at = 0;
    });

    // The pointer leaving the card is not the same as holding still. The board is the
    // only game surface, so *any* leave of it ends the hold — relatedTarget is non-null
    // when the pointer glides onto the page behind the card, and that is still a leave
    // (measured: a pointer that left for the page kept scrubbing the last tile, because
    // board pointermove stopped updating `scrub.x/y` and `inside` never cleared). A hold
    // that survives the pointer leaving is a hold the player cannot end.
    boardEl.addEventListener('pointerout', (e) => {
      const rt = (e as PointerEvent).relatedTarget as Node | null;
      if (!rt || !boardEl.contains(rt)) {
        scrub.inside = false;
        scrub.x = scrub.y = -1;
        scrub.ax = scrub.ay = -1;
        scrub.vx = scrub.vy = 0;
        dropHold(scrub);
        hideRing();
      }
    });
    boardEl.addEventListener('pointerover', () => (scrub.inside = true));

    // Esc closes the card (the card's own truce), and any key is presence.
    document.addEventListener('keydown', (e) => {
      scrub.seen = performance.now();
      if (e.key === 'Escape' && open) {
        e.stopPropagation();
        if (arena.on) truce();
        setOpen(false);
      }
    });

    window.addEventListener('scroll', () => (scrub.seen = performance.now()), { passive: true });

    // Tab hidden long enough ends it.
    let hiddenAt = 0;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        return;
      }
      if (arena.on && hiddenAt && Date.now() - hiddenAt > HIDDEN_TRUCE_MS) endQuietly();
    });

    // Reduced motion flips mid-visit: end a running fight.
    const reconsider = () => {
      if (arena.on && motionReduced()) endQuietly();
    };
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', reconsider);

    // Open / close wiring.
    toggleEl.addEventListener('click', () => {
      primeSfx();
      setOpen(!open);
    });
    closeBtn?.addEventListener('click', () => {
      if (arena.on) truce();
      setOpen(false);
    });

    // Keep the ammo display honest (a find can land mid-fight via navigation).
    const syncAmmoTimer = window.setInterval(syncAmmo, 1000);
    disposers.push(() => clearInterval(syncAmmoTimer));
  }

  return () => {
    for (const d of disposers) d();
  };
}
