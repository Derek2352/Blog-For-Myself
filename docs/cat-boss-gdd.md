# GDD — "Whose Screen Is It" (cat boss fight)

**Version** 0.6 · steps 0–4 built — the loop closes. Steps 5–6 design only
**Status** hypothesis. Every number below is `[PH]` (placeholder) until playtested —
including the ones now running in a browser. Built is not playtested.

## Changelog

| Ver | Change |
|---|---|
| 0.1 | First draft. Core loop, mechanic specs, dialogue table, replayability. All values `[PH]`. |
| 0.2 | Added §13 arena toggle and §14 loading transition. **Revised §11**: the toggle overturns the reduced-motion decision — an explicit opt-in is a prompt, so hiding the game from those users was paternalistic. Added a photosensitivity requirement the full-screen transition makes load-bearing. **Revised §3**: long-press-to-start removed; the toggle is the only entry point, because an invisible gesture is not an opt-in. **Revised §12**: the toggle becomes step 0 with an instant swap, the transition moves to last. §6 diagram shows the toggle. |
| 0.3 | **Built steps 0 and 1** (§12) — the toggle and Claim + Scrub. Three revisions the build forced: **§5.1** — desaturate-and-tilt is invisible on a cream-and-ink page, so a claim is now a wash plus a dashed edge, with the wash contrast-capped at 7%; **§11** — "transform and filter only" restated as the principle it meant (nothing that affects layout or hides content), which admits `outline` and `box-shadow`, plus a new hscroll rule and a coarse-pointer gate; **§13.4** — the durable `localStorage` opt-out is **cut**, because it could not change any observable behaviour. §5.2 and §10 gain what building taught. |
| 0.4 | **Built step 2** (§12) — the pounce. One design bug and one correction: **§5.3** never said *when* the aim locks, and locking it at the end of the telegraph deletes the telegraph, so it now locks at the start and the prediction leads the whole commitment; **§10's** rationale for `RECOVER_MS` was wrong on its own terms, and what a dodge actually buys is relocation, not banked progress. **§0** corrected: the fight reuses the cat *element*, not SiteCat's state machine. **§7.4's** opening grace drops from 6s to 2.5s for the board that exists. New §10 rows for the numbers the pounce introduced. |
| 0.5 | **Built step 3** (§12) — treats, and with them the loop's missing half: an A/B on one claim shows a hold the cat would have taken completing once a treat is thrown, so **§12's "verify the safe window is a real decision" is answered**. One deviation: a throw during `recover` is *not* wasted (a treat is an object, not a spell), paired with one-treat-at-a-time so lures cannot be banked. One constraint found: most of a portfolio is a link and a link is not a throwing surface, so the arena now shows a crosshair and links keep their pointer (§6). One bug found by screenshot: SiteCat's `announce()` timer stomped the borrowed HUD line mid-fight. §7.4's "treats explained by the cat asking" is **unbuilt** and now flagged as the weakest seam. |
| 0.6 | **Built step 4** (§12) — territory, endings, dialogue: the loop has two ends and both were played to completion in the harness. Three corrections. **§4 was right and the build was wrong**: the arena is "viewport bounds + queried list" and I had queried the whole document, which dealt 24 claims on `/timeline/` (past §10's own ceiling) and a fight that ran 124s without finishing — the board now prefers what is on screen, with a floor and a cap (`MIN_BOARD`/`MAX_BOARD`). **A loss was unreachable**: a landed pounce only took back already-freed elements, so territory could never pass the opening 55%; it now takes fresh ground, preferring what it landed on. **§8's priority order was wrong**: bluffing above supporting had the cat gloating at a player with nothing left to try, so being kind now outranks it. Added one line to §8.2 to close §7.4's teaching gap. Deferred, with reasons: §6's separate truce label, and §7.1's "both paths → sits on the cursor". |

---

## 0. What already exists (design constraints, not wishes)

This is **not** a greenfield design. `src/components/SiteCat.astro` (1202 lines) and
`src/lib/cat-game.ts` already ship:

| Existing thing | Where | The fight reuses it as |
|---|---|---|
| Modes `walk / idle / away / climb / chase / fetch` | SiteCat.astro:504 | *Corrected in 0.4:* what the fight reuses is the **element**, not the state machine. The arena borrows `#site-cat` via a `cat:standdown` event and runs its own four-phase machine on it — SiteCat's modes are a floor-walker's, and the boss needs 2D. |
| `chase` — cat runs at the cursor when within 34px | :773–804 | *Corrected in 0.4:* not reused. Its 34px trigger is the scale reference for `POUNCE_RANGE`, and that is all. |
| `fetch` — cat abandons everything for a treat | :691, :746 | *Corrected in 0.5:* the **idea** is reused, the code is not. The arena runs its own `fetch`/`eat` phases on the borrowed element, and throws its own treat element so the page's hidden treat is never disturbed. What is genuinely reused is the art — the shapes in the shared `<defs>`. |
| `climb` — cat scales a side edge | :930–983 | Boss repositioning / phase transition |
| One treat per navigable tab, 7 tabs | cat-game.ts:24 | **Ammunition.** Explore the site → arm yourself |
| `TREATS = fish, yarn, bell, feather, biscuit`, hashed per slug | cat-game.ts:20–28 | **Loadout.** Which tabs you explored decides your kit |
| 7-rung affection ladder, ratio-derived | cat-game.ts:34–57 | Difficulty input and post-fight consequence |
| Collar SVG, appears only at completion | SiteCat.astro:46–56 | The *patient* path's reward — the fight must not duplicate it |
| Paw row + `tallyFor` caption | cat-game.ts:79 | Existing HUD. **Is** the ammo counter as of 0.5 — filled paw = treat in hand, restored verbatim on truce. |
| `transition:persist`, session-only state, nothing stored | cat-game.ts:6–7 | Session-only stakes. No permanent loss is possible. |
| `aria-hidden`, reduced-motion → sits still | SiteCat.astro header | Hard accessibility floor, see §11 |

**Nothing new is drawn.** No new SVG, no sprite sheet, no audio. The site has 24
entries still showing `COVER · PENDING`; taking on art debt for an easter egg
would be the wrong call.

---

## 1. Design pillars

1. **The page is the arena.** Every mechanic must touch real page furniture. If
   the fight could be lifted into an `<iframe>` unchanged, the design has failed.
2. **Opt-in, and reversible in one gesture.** This sits on a portfolio a recruiter
   may be reading. Esc ends it, instantly, with the DOM exactly as found.
3. **The cat is bluffing, not malevolent.** It is a shy ink silhouette that warms
   to you. The boss is a housecat doing a dragon impression, and the writing must
   never lose that.
4. **Accessible or absent.** Decorative today. Reduced motion gets a turn-based
   variant or no invitation at all — never a degraded action game.
5. **Spend nothing the site hasn't already earned.** Ammo comes from exploring
   the site. The fight is a *sink* for the existing treat economy, not a new one.

**Fun hypothesis** (the one thing that must feel good, or scrap it):
> Holding your cursor still on a claimed element while a cat visibly stalks
> toward it is tense, and throwing a treat to buy three seconds is a relief.

If that single interaction isn't fun with placeholder art and no scoring, no
amount of systems on top will save it.

---

## 2. Core loop

### Moment-to-moment (0–30s)
- **Action** — Player parks the cursor on a **claimed** element and holds. A ring
  fills. Element reverts to normal on completion.
- **Feedback** — Ring fill + the element's colour returning + the cat's ears
  flattening (existing `.cat-ear` nodes, rotated). At 70% the cat **telegraphs** a
  pounce: tail stiffens, `.cat-eye` widens.
- **Reward** — Territory bar moves toward the player. One element is *visibly*
  yours again — the feedback is the page healing.

### Session loop (90s–3 min — one fight)
- **Goal** — Drive territory from 100% cat to 0%.
- **Tension** — The cat pounces on the cursor and interrupts channels. You hold
  `N` treats and nothing else. Every throw is one you can't make later.
- **Resolution** — Win: cat routs, page restores, you get a **notch**. Lose (all
  treats spent + territory back to 100%): cat taunts, page restores anyway.
  Losing costs no exploration progress — see §7.

### Long-term (a visit, and return visits)
- **Two paths to the same cat.** Patience (find 7 treats → collar) and
  confrontation (win the fight → notch). They are *alternative* top rewards, not
  a ladder — a player who does both in one session gets the top state (§7.4).
- **Retention hook** — Deliberately weak. This is a portfolio. The hook is "tell
  a friend the cat fights back", not a daily streak. Explicitly **no** login,
  leaderboard, or daily reward: a résumé site with retention mechanics is a
  category error.

---

## 3. Core activity and player interactions

**Core activity**: *territorial scrubbing under threat.* You reclaim page regions
by dwelling on them; the cat interrupts by reaching your cursor; you buy time with
a finite resource.

### Player inputs — the complete set

| Input | Action | Why so few |
|---|---|---|
| Move pointer | Aim / flee | The cat's `chase` already keys off cursor proximity. Zero new plumbing. |
| Hold still on a claim | **Scrub** (channel) | The core verb. Holding *still* while being hunted is the whole tension. |
| Click / tap | **Throw treat** at cursor position | Sends the cat into existing `fetch`. One button, one resource. |
| `Esc` | Truce (abort, restore) | Pillar 2. Non-negotiable. |
| The arena toggle (§13) | Start / end the fight | The **only** entry point |

Three verbs. Everything else is emergent from their interaction. **No dash, no
attack button, no combo** — added complexity that adds no new decision.

*Changed in 0.2:* 0.1 started the fight on a long-press of the cat, reusing the
existing tap-to-scamper affordance. Removed. An invisible gesture is not an opt-in
(§13.1), and two entry points would mean two places that have to get consent right.
The tap keeps its old job — the cat scampers — and starting a fight now takes a
button that says what it does.

### The decision, stated plainly
At any moment: *scrub now and gamble the interrupt, or spend a treat to make the
next window safe?* That is the game. If playtesting shows players never throw
treats, the pounce is too weak. If they throw immediately every time, too strong.

---

## 4. Required game objects

```
Arena          viewport bounds + queried list of claimable elements
               (NOT authored — see §6.1)
Claim          { el, strength 0..1, decay }  — a real DOM node under cat control
CatBoss        existing mode machine + { pounce, recover, taunt, rout }
               + stance (§9.3), + aggression (rubber band, §7.3)
Scrubber       cursor as AoE: { radius, channelProgress, interrupted }
TreatProjectile existing treat SVG + { flightArc, landing, lureDuration }
Loadout        the treat *types* the player found → 5 distinct effects (§9.5)
TerritoryMeter single float 0..1, the win/lose axis
DialogueRibbon anchored above the cat, follows it, stage-gated (§6.3, §8)
```

### 4.1 Claimable elements — queried, never authored

The arena is built by querying what the page already has:

```
[data-ink-reserve], .panel, .frame, .card, .kicker, .rail, h1, h2, figure
```

Consequences, all good: **the board differs per route for free** (§9.1); a new
category page is a new arena with no code change (the same bargain `resolveTreat`
already makes); and it satisfies pillar 1 by construction.

Excluded from claiming: `body > header`, the tab bar, anything focusable, and
`.glass` — the hero pane stays legible so the page never becomes unreadable.

---

## 5. Mechanic specifications

### 5.1 Mechanic: Claim

**Purpose** Make "the cat took my screen" literal and visible.
**Player fantasy** Something is wrong with my page and I can fix it.
**Input** Fight start (initial pattern), and cat re-claims on a successful pounce.
**Output** Element gets `.cat-claimed`; CSS washes it, outlines it, and tilts it
`[PH 0.5deg]`. **Nothing that affects layout or hides content** — never `display`,
`visibility`, never a property that reflows, so nothing moves and nothing is hidden
from a screen-reader.

> **Built, 0.3 — and the look is not what this section specified.** 0.1 asked for
> *desaturated, tilted, paw watermark*. Two of the three do nothing on this site:
> the page is cream and near-black, so `saturate(0.35)` is invisible on it, and 0.5°
> of tilt is a rounding error. Screenshots of the first build show a page you cannot
> tell is invaded — which fails the fun hypothesis for a reason that has nothing to
> do with the mechanic, because there is nothing to scrub *toward*.
>
> What reads on a monochrome page is a **wash and an edge**: an inset `box-shadow`
> tint over the block (it paints above the background and below the text, so the
> words do not get harder to read) plus a 2px dashed `outline`. The wash landed at
> **7%**, not the 12% it read best at: 12% put `.rail` — small, mono,
> `--color-muted` — at 4.15:1 against its own tinted background, under AA. The edge
> does the shouting and the wash murmurs. The tilt stays as a garnish.
>
> The paw watermark is **not built**. A dot is not a paw, and a real one wants a
> shape this build has no business drawing before the mechanic has earned it.
>
> Also worth recording: `outline` and `box-shadow` were not on 0.1's allow-list, and
> they are fine — outlines and shadows are painted, never laid out, which is the
> guarantee "transform and filter only" was reaching for. The rule was written as a
> mechanism when it meant a principle; §11 now states the principle.
**Success condition** Page reads as invaded but every word is still selectable.
**Failure state** If a claim ever makes text fail AA contrast, the claim CSS is
wrong. Gate: reuse the measurement harness from `scratchpad/glass.mjs` — it
already samples true backdrops and computes WCAG ratios.
**Edge cases**
- Element removed mid-fight (client-side nav) → claim drops silently, territory
  recalculated against the *current* arena, never a stale denominator.
- Zero claimable elements (a sparse page) → refuse the fight, cat yawns. Better
  than an empty arena.
- Element larger than viewport → clamp the scrub target to the visible rect.
- Nested candidates (`figure` containing `.frame`) → **outermost only**. Transforms
  compound, so claiming both tilts the image twice, and scrubbing the inner one
  leaves it visibly still claimed by the outer. Found in the build; `dropNested`.
- **A landed pounce must be able to take ground the cat never held.** *(Found in 0.6.)*
  Built so it only took back elements from the freed pile, which reads correctly and made
  the game unloseable: a player who had freed nothing could not fall below the opening 55%,
  so territory never reached 100% and §2's losing condition could not fire. It now prefers
  the most recently freed element, then **the thing it landed on**, then the nearest
  unclaimed one. Landing on a paragraph and taking that paragraph is the most legible
  cause and effect available.
- An element with an inline `style` of its own → hold the attribute verbatim and
  hand it back on release. Undoing a claim property-by-property is not the same as
  restoring the attribute: touching an element's style re-serialises whatever was
  already inline, so it can come back visually identical and no longer be the page
  as found.
**Tuning levers** `MAX_TILT`, the wash percentage, `INITIAL_CLAIM_FRACTION`,
`MIN_CLAIM_AREA`, `RECLAIM_COUNT`
**Dependencies** Arena query, TerritoryMeter, InkWash (must not fight the ink wash
visually — the claim wash borrows `--color-accent`, which the ink never uses)

### 5.2 Mechanic: Scrub (the core verb)

**Purpose** The channel that creates tension.
**Player fantasy** Steady hands under pressure.
**Input** Pointer within `[PH 40px]` of a claimed element's centre, **moving less
than `[PH 6px]` per frame**, held.
**Output** `channelProgress += dt / SCRUB_MS`. At 1.0 the claim clears, territory
drops by `1 / arenaSize`.
**Success condition** `SCRUB_MS [PH 1400ms]` — long enough that a pounce can
plausibly arrive, short enough that a clean window always finishes it.
**Failure state** Interrupted by a pounce → progress resets to `[PH 0]`, not
partial. Partial retention would remove the reason to buy a safe window.
**Edge cases**
- Two claims overlapping under the cursor → scrub the one whose centre is nearer;
  never both, or clear-speed doubles in dense layouts.
- Player scrolls while channelling → treat as movement, interrupt. Scroll-scrubbing
  would let a player clear the board by flicking.
- Pointer leaves the window → pause, don't reset (they may be reaching for a
  treat click). Resets on `blur` after `[PH 2s]`.
- Touch: **not offered.** 0.1 said "no hover, so hold-still is a press-and-hold,
  same timer", which sounds equivalent and isn't: a press-and-hold has no *aim*, so
  the tension of keeping a cursor somewhere while something walks at it has nothing
  left in it. Worse, a finger covers the thing it is holding. The build gates the
  toggle behind `(hover: hover) and (pointer: fine)` and says so in the widget —
  the same "not yet, and here's why" treatment reduced motion gets, rather than a
  button that starts a game you cannot play.
**Tuning levers** `SCRUB_MS`, `STILL_PX`, `INTERRUPT_PENALTY`
**Dependencies** CatBoss.pounce, Claim

> **Built, 0.3.** Hold-still-to-reclaim works, with a 40px ring at the cursor
> filling as the hold completes. Two notes from building it: the still-tolerance
> must be a *distance* (`hypot`), because per-axis tolerance lets a diagonal drift
> through at 1.4×; and the hold anchor has to follow the pointer on a reset, or a
> slow drift keeps failing against a stale origin and the mechanic feels broken
> rather than demanding.
>
> **The hypothesis itself is still untested.** It is built and it functions; whether
> it is *fun* is a question a playtest answers, not a harness.
>
> **What step 2 did to it (0.4):** a pounce the cat commits to always beats the hold
> it interrupts (§5.3), so holding still under threat is never the winning move —
> fleeing and holding elsewhere is. The tension the hypothesis names is real but it
> currently resolves one way, which is exactly the gap treats exist to fill (§5.4,
> step 3). If it still isn't fun *after* treats, the hypothesis is wrong.
>
> **What step 3 did to it (0.5):** the gap is closed — a thrown treat turns a hold the
> cat would have taken into one that completes (§5.4's A/B). So the hypothesis now has
> all three of its parts in place and is finally *askable*: hold under threat, throw to
> buy a window, choose where. Everything left in §12 is texture on top of that. If it
> is not fun now, no amount of stances, dialogue or endings will make it so.

### 5.3 Mechanic: Pounce

**Purpose** The threat that makes holding still a decision.
**Player fantasy** Being hunted by something small and smug.
**Input** Cat within `[PH 90px]` of the cursor **and** player is channelling
above `[PH 0.35]` progress. Cat prefers interrupting a nearly-finished scrub —
that is what makes it feel like it's *reading* you.
**Output** 3 phases: **telegraph** `[PH 420ms]` (tail stiff, eye wide, ears back)
→ **leap** `[PH 260ms]` (ballistic arc to the cursor's *predicted* position) →
**recover** `[PH 700ms]` (cat is helpless — the player's free window).
**Success condition** The telegraph is long enough to dodge if you're watching,
short enough to punish inattention. A missed pounce must feel like *your* read,
not a dice roll.
**Failure state** If pounce lands during telegraph (bug) it's unreactable. Assert:
leap cannot begin before telegraph elapses, even at low frame rates — clamp `dt`,
the ink wash already does this at `Math.min(250, now - lastTick)`.
**Edge cases**
- Cursor leaves the viewport mid-leap → cat lands where it aimed, whiffs, recovers.
  Never follow the pointer out of frame.
- Two pounces queued → impossible by construction; single state machine.
- Cat in `fetch` (treat in flight) → **cannot pounce**. This is the treat's whole
  value; if `fetch` can be cancelled, the resource is worthless.
- Reduced motion → no leap; see §11.
**Tuning levers** `TELEGRAPH_MS`, `LEAP_MS`, `RECOVER_MS`, `POUNCE_RANGE`, `STALK_SPEED`,
`AIM_LEAD_MS`, `AGGRESSION`
**Dependencies** Scrubber, Loadout (bell lengthens telegraph), rubber band (§7.3)

> **Built, 0.4 — and the first version had no telegraph at all.**
>
> This section says the leap goes to "the cursor's *predicted* position", and says
> nothing about **when the cat stops being able to change its mind.** Built the
> obvious way — aim at the end of the wind-up, so the prediction is as fresh as
> possible — and the telegraph quietly ceased to exist: a cat that re-aims until the
> instant it jumps cannot be dodged during its wind-up, because moving just moves the
> target. The only real dodge window was the 260ms flight, which is human reaction
> time with nothing left over.
>
> The harness caught it as a 0px miss on a check called *"the cat lands where it
> aimed, not where you went"*. Same test, opposite meaning: the failure was the
> mechanic, not the assertion.
>
> **The aim locks when the telegraph begins.** The wind-up is then exactly what it
> looks like — 420ms of "I have decided where you are" — and the prediction has to
> lead the whole 680ms of commitment, which means a player fleeing in a straight line
> gets read and cut off while changing direction beats it. That is the difference
> between a cat and a homing missile, and it is a better mechanic than the one
> specified.
>
> **Consequence worth stating plainly:** provoked at `POUNCE_THRESHOLD` and landing
> 680ms later, a pounce touches down at ~84% of the hold. So **a pounce always beats
> a scrub it commits to.** Ground can only be taken where the cat is not, which makes
> step 2's loop *keep it away, then work in the gap* — and makes treats (step 3) the
> answer to "I want this block and the cat is standing on it" rather than a
> nice-to-have. The design predicted this; the build makes it concrete.
>
> Also built: the cat cannot be booped while it is a boss (`pointer-events: none` on
> its body), which is characterisation and also load-bearing — a cat parked on the
> cursor is what `elementFromPoint` returns, so without it scrubbing became
> impossible at exactly the moment the game got interesting.

### 5.4 Mechanic: Throw treat

**Purpose** Convert exploration into tactical relief. The sink for the existing
economy.
**Player fantasy** Bribery. Correctly identifying that this is a cat.
**Input** Click/tap. Consumes 1 treat from the found set.
**Output** Treat arcs to the pointer, lands, cat enters existing `fetch`, ignores
the player for `lureDuration` (by type, §9.5). Cat cannot pounce while fetching.
**Success condition** A thrown treat reliably buys one complete scrub. If
`lureDuration < SCRUB_MS` the resource does nothing.
**Failure state** Zero treats and territory rising = the losing spiral. That is
intended, and it must be *visible* — the paw row empties, so the player can see
the loss coming rather than being surprised by it.
**Edge cases**
- Throw with 0 treats → cat looks at you. No penalty, no error state. Silence is
  the feedback.
- Throw during cat's `recover` → wasted; warn by dimming the cursor during
  recover, since the cat is already harmless.
- Throw onto a claimed element → treat lands, cat fetches, *and* the claim is
  unaffected. No accidental double-duty.
**Tuning levers** `LURE_MS` per type, `THROW_ARC_MS`, `FETCH_SPEED`, treat count (= tabs
explored)
**Dependencies** Loadout, the boss's own `fetch`/`eat` phases (*not* SiteCat's `fetch`
— see §0's 0.4 correction)

> **Built, 0.5 — and it answers §12's question, measured.**
>
> The A/B the harness runs: same claim, same cursor position, cat next to you. Hold it
> with nothing thrown → **24 → 24 claims** and a pounce lands. Hold it having thrown one
> treat across the room → **24 → 23**, and the cat never even winds up. One treat is the
> difference between a hold that cannot win and one that does, which is the safe window
> being a real decision rather than a stated intention.
>
> **Deviation: a throw during `recover` is not wasted.** This section says wasted, and
> suggests dimming the cursor to warn. Built the other way, because a treat is an object
> and not a spell: it lands, it waits, and the cat fetches it when it can. That deletes
> a special case *and* a piece of warning UI, and turns "badly timed" into "you lost the
> overlap" instead of "you lost the resource". The rule that keeps it honest — **one
> treat on the board at a time** — is what stops lures being banked, and a second throw
> costs nothing rather than being swallowed.
>
> **Found while building: most of a portfolio is a link, and a link is not a throwing
> surface.** §11 promises every link keeps working, so a click on one navigates — which
> ends the fight. "Click anywhere to throw" was never available; the first version of the
> harness clicked on cards and silently threw nothing. The fix is an affordance, not a
> rule change: while a fight is on the page shows a **crosshair**, and links keep
> `cursor: pointer` from the UA stylesheet for free. Crosshair throws, pointer navigates.
> Recorded because it is a real constraint on the mechanic — the cat's safest ground is
> a dense grid of cards, which is emergent and pillar 1 all over.
>
> **Cold start has no ammo, by design.** Pillar 5 means the fight is a sink for the
> existing economy, so a visitor who opens it from a fresh homepage has nothing to throw
> and the cat simply looks at them. The tab bar is the tutorial. Worth watching in a
> playtest: it is the one place where "correct" and "obvious" may not be the same thing.
>
> **Bug, caught by a screenshot rather than a test.** SiteCat's `announce()` puts the
> level phrase in the HUD line and sets a 3.2s timer to restore the tally. That timer
> knows nothing about the fight, so it fired mid-fight and left the caption reading
> "3 / 7 treats" next to a paw row showing 2 — the row is ammo during a fight, so the
> two were contradicting each other in the same chip. The arena now re-asserts its line
> once a frame, which is self-healing against anything else that writes there.

---

## 6. UI layout

Vertical territory, because the cat already owns the bottom of the page:

```
┌──────────────────────────────────────────────────────────┐
│ ███████████░░░░░░░░░░░░░░  TERRITORY  (top edge, 3px)    │ ← you push down
│                                                          │
│   [ claimed h1 — desaturated, tilted, paw watermark ]    │
│                                                          │
│   ┌ .glass — NEVER claimable, stays legible ┐            │
│   │  Hi — I'm Derek.                        │            │
│   └─────────────────────────────────────────┘            │
│                                                          │
│        ( ) ← scrub ring at cursor                        │
│                                                          │
│              ╭─ "You can stop any time." ─╮              │ ← ribbon, follows cat
│                        /\_/\                             │
│ ┌──────────────┐       ( •.• )  ← boss                   │
│ │ ●●●○○○○ 4    │                              [Esc: truce]│
│ │ [ arena ▣ on ]│                                         │
│ └──────────────┘                                          │
└──────────────────────────────────────────────────────────┘
   ↑ existing paw widget: ammo row + the §13 toggle beneath it
```

**Decisions and why:**
- **Territory on the top edge**, 3px, no numbers. The cat pushes up from the
  bottom, you push down from the top; the bar's direction *is* the fiction. A
  numeric percentage would invite optimisation of a thing that should be felt.
- **Ammo = the existing paw row.** It already reads as a count and already sits
  bottom-left. Filled paw = treat in hand. Nothing new drawn, and the widget
  finally has a second job.
- **No health bar for the cat.** Territory is the only axis. Two bars would imply
  two failure states; there is one.
- ~~**Truce always visible**, bottom-right, low contrast.~~ **Superseded by §13** (0.2)
  and formally dropped in 0.6: the toggle in the cat's own widget is already the
  always-visible way out, and a second control in the opposite corner would be a widget
  for a rule that is already stated. Pillar 2 is satisfied by the switch that started it.
- **Ribbon follows the cat**, never centre-screen. Centre-screen dialogue would
  cover the portfolio, which is the actual product.
- **The cursor is the only other UI**, added in 0.5: crosshair while a fight is on,
  and links keep their pointer for free. It is what tells you where a treat can go and
  where a click will instead take you off the page. A HUD element saying the same thing
  would be a fourth widget for a rule the cursor already states.

---

## 7. Progression, stakes, and the long-term goal

### 7.1 Long-term player goal
**The cat's respect, on the record.** The affection ladder already ends at
"yours" with a collar. The fight adds a *parallel* proof: a **notch** in the ear
(one new 6-point SVG path on the existing `.cat-ear`, and nothing else).

- Patient path → **collar** (find 7 treats)
- Confrontation path → **notch** (win a fight)
- Both in one session → the cat sits *on* the cursor when idle. The top state,
  reachable only by playing both ways.

> **Built, 0.6 — the notch, not the top state.**
>
> Winning adds `.notched` to the cat for the rest of the session, exactly as the collar
> uses `lv6`. It is drawn as a **mark on the ear rather than a wedge bitten out of it**: the
> ear renders about 4×5px, so a missing wedge that small is either invisible or — if filled
> with the ground colour to fake a cut — plainly wrong the moment the cat walks across a
> photograph. A coloured nick is legible at that size and speaks the language the collar
> already established.
>
> **"Both paths → sits on the cursor" is deferred.** It is the one reward that changes
> *ambient browsing* rather than the fight, on a portfolio somebody may be reading, and it
> is not part of what §12 step 4 asks for. Worth building, worth building deliberately.

### 7.2 What losing costs
**Nothing permanent, by design.** Progress is session-only already
(`cat-game.ts:6`). Losing spends the treats you threw and nothing else — the
found-set is untouched, so exploration is never punished. The cost of losing is
that the cat *says something about it* (§8), which is the real sting and costs
the player nothing.

I considered staking affection on the fight (loss aversion is a strong hook). I
am **rejecting it**: on a portfolio, punishing a visitor for touching an easter
egg is a bad trade for a designer's engagement metric.

### 7.3 Difficulty: rubber band as characterisation
Aggression scales with how the player is doing, and it is *expressed as
behaviour*, not hidden numbers:

| Player state | Aggression | How it reads |
|---|---|---|
| Territory > 70% cat, 0 treats | `[PH 0.6]` | Cat gets bored, grooms itself. "Supporting" dialogue fires. |
| Even fight | `[PH 1.0]` | Baseline |
| Territory < 20% cat | `[PH 1.4]` | Desperate, faster telegraph, more taunting |

A losing player sees a cat easing off and reads it as *the cat pitying them* —
which is in character, funnier, and does the same job as an invisible fudge.

### 7.4 Onboarding checklist
- [x] Core verb (scrub) available within 30s — it is the *first* thing, no unlocks
- [x] First beat unloseable: the opening `[PH 2500ms]` has aggression pinned to 0,
      cat only watches. Guaranteed first success. *(0.1 said 6s. Built at 2.5s: on
      the 8-claim board the query actually yields, 6s of grace is about four free
      scrubs — half the fight. 2.5s covers the first one, which is what this line
      was after.)*
- [ ] Each mechanic in a safe context: pounce introduced only after one clear
      scrub; treats explained by the cat *asking* for one, not by a tooltip.
      *(0.5: the pounce half holds — the opening grace guarantees one clean scrub. The
      treat half is **not built**, because the cat cannot ask for anything until §8's
      dialogue exists in step 4. Right now the only thing teaching the throw is the
      crosshair cursor, which says where you *can* throw and nothing about why. This is
      the weakest seam in the build and the first thing a playtest will find.)*
- [x] One mechanic found by exploration: nothing says the cat can't pounce during
      `fetch`. Players discover the safe window themselves — the best moment
      available, so it must not be spoiled by UI
- [x] Ends on a hook: on a win, the cat re-claims **one** element and walks off.
      Unfinished business, no modal, no "play again?" button

---

## 8. Cat dialogue

Rules: **never more than 7 words**; lower-case, no exclamation marks (this cat
does not shout); the ribbon is `aria-hidden` like the rest of the cat, so nothing
here may carry information the player needs.

### 8.1 Bluffing — opening and while winning

| Stage | Line |
|---|---|
| Fight start | `this is my page now.` |
| Start (alt) | `you were done reading anyway.` |
| First claim planted | `i have been very patient.` |
| Territory 90% cat | `i could do this all day.` |
| Territory 75% cat | `you are making this loud.` |
| After a successful pounce | `mine. still mine.` |
| Player misses a scrub twice | `try holding stiller. or don't.` |
| Player has 0 treats | `oh. you brought nothing.` |
| Territory back to 100% (won a round) | `as it was. as it should be.` |

### 8.2 Supporting — when the player is losing

Fires when aggression drops to the bored tier. The cat is being kind and will not
admit it.

> **Built, 0.6, and the priority order needed inverting.** §8.1 and §8.2 describe the *same
> state from two sides*: at 80% territory the cat is winning and the player is losing, and
> both tables have a line for it. Ordered bluffing-first, the tests caught the cat saying
> *"you are making this loud"* to somebody who was out of treats and out of ideas. So
> **being kind outranks gloating whenever the player has no way forward** — pillar 3 says
> this cat is bluffing rather than malevolent, and priority order is where that claim is
> either true or decoration.
>
> These triggers were also written against "aggression drops to the bored tier", which does
> not exist until step 5. The conditions underneath it — empty-handed, stuck, nothing
> changing — *are* the bored tier, so they fire on those directly.
>
> One line added, `you could just bribe me.`, for the gap §7.4 flagged: it fires when you
> have a treat, have not thrown one, and are losing. Until 0.6 nothing in the build taught
> the throw at all.

| Trigger | Line |
|---|---|
| 0 treats, territory > 70% cat | `i'll wait. go find a fish.` |
| Player idle > 8s | `you can stop any time.` |
| Third interrupt in a row | `that one was mine. mostly.` |
| Player throws their last treat | `spending everything. bold.` |
| Territory unchanged for 20s | `we could both sit down.` |

### 8.3 Rattled — while losing

| Stage | Line |
|---|---|
| Territory 50% | `that one didn't count.` |
| Territory 35% | `i am letting you have it.` |
| Territory 20% | `this was my spot first.` |
| Territory 10% | `fine. fine.` |
| Last claim being scrubbed | `wait —` |

### 8.4 Endings

| Ending | Line |
|---|---|
| Player wins | `keep it. it's drafty anyway.` |
| Player wins with 0 treats spent | `you didn't even bribe me.` |
| Cat wins | `you may read on. quietly.` |
| Truce (Esc) | `sensible.` |
| Truce during cat's recovery | `...that was cowardly. respect.` |
| Win, having already earned the collar | `both, then. show-off.` |

---

## 9. Structural replayability

Not "add more content" — five ways the *system* produces a different fight.

### 9.1 The arena is whatever page you're on
Claimables are queried (§4.1), so `/timeline` (dense, many `.panel`) plays nothing
like `/` (sparse, two big figures). Dense boards = short scrubs, many of them;
sparse boards = long defensible holds. **Cost: zero.** Every category page the
author publishes is a new board.

### 9.2 Daily seed
Opening claim pattern and stance seeded from `YYYY-MM-DD` via the existing
`hash()` in `src/lib/wash.ts`. Everyone gets the same fight today and a different
one tomorrow — shareable ("did you get the siege cat?") with no server, no
account, no storage. Reuses machinery the ink wash already relies on.

### 9.3 Stances — the cat picks one per fight
Same verbs, different counter-play. This is where the fight gets legs.

| Stance | Behaviour | Counter |
|---|---|---|
| **Ambush** | Hides behind claimed elements, short telegraph, long recovery | Scrub next to it — punish the whiff |
| **Siege** | Never leaves the bottom edge; claims *regrow* over time | Clear top-down, accept the churn |
| **Trickster** | Fakes telegraphs `[PH 30%]` of the time | Learn the tell; feather treats to force commitment |
| **Sleepy** (rare) | Barely fights; a joke fight | Nothing. It's a gift. |

### 9.4 Handicap ladder
On a win the cat offers a rematch at `treats - 1`. Self-selected difficulty
ratchet, no menus, and it converts the win into a decision rather than an
endpoint. Bottoms out at zero treats — a pure-skill fight for whoever wants it.

### 9.5 Loadout from the treats you actually found
`resolveTreat(slug)` already hashes a treat *type* per tab. So **which pages you
explored determines your kit** — replayability sourced from existing content, at
no authoring cost:

| Treat | Effect | `lureDuration` |
|---|---|---|
| fish | Plain, long lure | `[PH 3.0s]` |
| bell | Cat is startled: next telegraph doubled | `[PH 1.8s]` |
| yarn | Tangles: cat's next return walk is slowed | `[PH 2.2s]` |
| feather | Cat plays with it *where it lands* — a movable no-go zone | `[PH 2.6s]` |
| biscuit | Slow to eat: shortest interrupt immunity but cat stays put longest | `[PH 4.0s]` |

Two players who explored different halves of the site bring different tools to
the same board. **Design risk:** if one treat is strictly best, players will
tab-hunt for it and the site's exploration incentive inverts. Balance target: no
treat's win-rate contribution exceeds any other's by more than `[PH 10%]`.

---

## 10. Tuning table — all placeholders, with rationale

| Var | `[PH]` | Rationale | "Broken" looks like |
|---|---|---|---|
| `SCRUB_MS` | 1400 | Long enough for a pounce to plausibly arrive | <900: pounce irrelevant. >2200: tedium |
| `TELEGRAPH_MS` | 420 | Human reaction ~250ms + read time | <300: unreactable. >600: trivially dodged |
| `LEAP_MS` | 260 | Fast enough to feel like a pounce | >400: reads as a stroll |
| `RECOVER_MS` | 700 | ~~Must exceed `SCRUB_MS/2` so a whiff is a real reward~~ — **wrong, corrected in 0.4.** At 700 against a 1400ms scrub it is *exactly* half, so it fails its own stated test; and dodging means moving, which resets the hold anyway, so this number never buys progress. What a dodge buys is **relocation**: the cat lands where you were and walks back. The property that must hold is narrower — a whiff costs the cat more than the attack gained it (`> TELEGRAPH_MS + LEAP_MS`) | <680: pouncing becomes free, so the cat should never stop |
| `POUNCE_RANGE` | 90px | ~2.5× existing `chase` trigger (34px) | Too large: nowhere is safe |
| `INITIAL_CLAIM_FRACTION` | 0.55 | Invaded, not unusable | 1.0: page unreadable, breaks pillar 2 |
| `lureDuration` (fish) | 3.0s | Must exceed `SCRUB_MS` or treats are worthless | <1.4s: resource does nothing |
| `AGGRESSION` (bored) | 0.6 | Visible mercy without becoming a walkover | <0.4: cat stops being a threat |
| Fight length | 90–180s | One coffee. Longer and it competes with the portfolio | >4min: nobody finishes |

Added in 0.3, from building steps 0 and 1. Still `[PH]` — built and measured is not
the same as playtested:

| Var | `[PH]` | Rationale | "Broken" looks like |
|---|---|---|---|
| `STILL_PX` | 6 | A hand on a trackpad is never perfectly still, and a mouse jitters a pixel or two. Must be a *distance*, not per-axis, or a diagonal drift passes at 1.4× | 0: the mechanic reads as broken rather than demanding. >12: drifting across a block still clears it |
| `MAX_TILT` | 0.5° | A nudge, not a glitch — and the ceiling is structural: a rotated full-width block is wider than the page | >2°: horizontal scrollbar on a phone |
| Claim wash | 7% accent | The most that keeps `.rail` (mono, `--color-muted`) over AA on its own tinted background. 12% read better and measured 4.15:1 | 0%: invisible on a monochrome page. >10%: fails the §11 contrast gate |
| Claim outline | 2px dashed, 62% accent | Carries the read that the wash can't afford to. Painted, so it costs no layout | 1px at 55%: too quiet to find claims by |
| `MIN_CLAIM_AREA` | 900px² | A `.rail` line is ~2000px² and reads fine; below this are sprite stubs and empty spans | Too low: claims land on 9px dots and the game looks broken |
| Board size | 8 claims on the homepage | What the §4.1 query yields at 0.55 after excluding protected furniture and de-nesting | <4: the fight is over before it starts. >20: the page is unreadable, breaking pillar 2 |
| `MIN_BOARD` / `MAX_BOARD` | 14 / 20 | *Added 0.6.* The board prefers what is on screen (§4), extends below the fold only when the screen cannot hold a game, and is capped at the row above's ceiling. Screen-only deals ~8 candidates at 1280×900 → four claims → a nine-second fight | Uncapped: `/timeline/` deals 24 claims and a fight runs past two minutes. Screen-only: the fight is over before it starts |
| `LINE_MS` / `LINE_GAP_MS` | 2600 / 1200 | A line up long enough to read twice, and silence long enough that each one is an event | No gap: the cat narrates and the ribbon becomes a log |
| `WIN_BEAT_MS` / `LOSE_BEAT_MS` | 2200 / 1600 | Long enough for the parting line and §7.4's one re-claim; the loss is shorter because nobody wants to sit in it | >4000: the page feels held hostage after the game is decided |

Added in 0.4, from building the pounce:

| Var | `[PH]` | Rationale | "Broken" looks like |
|---|---|---|---|
| `AIM_LEAD_MS` | `TELEGRAPH_MS + LEAP_MS` (680) | The aim locks when the wind-up starts, so the lead has to cover the whole commitment. This is the number that makes the telegraph a warning rather than a delay | Locking at the *end* instead: the telegraph stops being dodgeable and the game is 260ms of reaction time (this is what shipped first) |
| `STALK_SPEED` | 170px/s | Slower than a hand, deliberately: fleeing must work, since "move the pointer" is one of only three inputs. The site cat walks at 42px/s and would never arrive | >400: nowhere is far enough, and the fight becomes a tie for the mouse. <80: the cat is scenery |
| `HIT_RADIUS` | 46px | Dodging it means covering 46px inside 680ms — ~68px/s, far under a flick and far over the 6px a hold allows | Too large: dodging needs a sprint. Too small: the cat can never catch anyone |
| `OPENING_GRACE_MS` | 2500 | Covers the first scrub, per §7.4's "guaranteed first success", on the board that actually exists | 6000 (0.1's number): four free scrubs, half the fight |
| Landing point | ~84% of the hold | Where a pounce provoked at 0.35 touches down. Late enough to read as deliberate, and short of the 0.9 that would feel like robbery | ≥1.0: the cat can never interrupt anything, so the threat is theatre |

Added in 0.5, from building the treat:

| Var | `[PH]` | Rationale | "Broken" looks like |
|---|---|---|---|
| `LURE_MS` | 3000 | Head-down time once the cat arrives. §5.4's success condition is the floor: below `SCRUB_MS` the resource does not do the one thing it exists for. The cat is also out of the fight for the walk over, which is the player's to place | ≤1400: a treat buys nothing and the economy is decoration. >6000: one treat ends the fight |
| `THROW_ARC_MS` | 320 | Long enough to read as thrown, short enough not to be a cutscene | >600: every throw is a pause |
| `FETCH_SPEED` | 186px/s | Lifted from SiteCat's own fetch speed, where the comment reads "it can see food". Faster than `STALK_SPEED` 170 on purpose: it hurries for food and takes its time with you | ≤`STALK_SPEED`: the contrast disappears and so does the characterisation |
| `FETCH_REACH` | 14px | How close it has to get before eating starts | Too large: it eats from across the room |
| `RECLAIM_ON_HIT` | 1 | A landed pounce takes back the most recent thing you earned — legible as cause and effect where a random element is not | >1: one mistake undoes a minute of play |

Build these as a spreadsheet with formulas before writing the code, per §Balance
Process — `SCRUB_MS`, `RECOVER_MS` and `lureDuration` are *coupled*, and hardcoding
them independently is how this gets unbalanced.

---

## 11. Accessibility and exit conditions (hard requirements)

- **`prefers-reduced-motion`** — **the toggle is shown; the fight is not offered
  beyond it.** *(Revised in 0.2. The 0.1 rule was "no invitation is shown at
  all".)* Once there is an explicit opt-in (§13), withholding it stops being
  protection and becomes a decision made on someone's behalf about what they may
  consent to. So: the button is visible and operable, the transition degrades to a
  cross-dissolve (§14.5), and the cat still sits still. The fight *itself* remains
  gated — pressing the toggle under reduced motion starts nothing until a
  motion-safe variant exists, and until then the button says so in words rather
  than being absent. A half-speed action game is still worse than none.
- **The fight is `aria-hidden`**, as the cat already is. It carries no information
  and announces nothing. A screen-reader user's page is unchanged. **One
  exception: the toggle** (§13) — a control cannot be both hidden and usable, and
  the one thing in this system that changes the page's behaviour is the one thing
  that must be announced.
- **Photosensitivity — WCAG 2.3.1.** A 240px cat could not trigger this; a
  full-screen curtain can. Hard limits on §14: **at most one luminance reversal
  per direction**, no flash at or above 3Hz, and no large-area flash — which is
  why the dark theme floods toward a deepened ground instead of the pale ink
  colour (§14.4). This is a *no-exceptions* row: if a beat cannot be built inside
  it, the beat is cut, not the requirement.
- **Keyboard** — Esc ends it. The fight never traps focus, never adds a focus
  trap, and never claims a focusable element (§4.1).
- **A claim may not affect layout or hide anything.** *(Restated in 0.3. The 0.1
  rule said "transform and filter only", which named a mechanism when it meant a
  principle — and the mechanism turned out to be invisible on this page, see §5.1.)*
  `transform`, `filter`, `outline` and `box-shadow` all qualify: they are painted,
  never laid out. `display`, `visibility`, and anything that reflows do not. Text
  stays selectable and copyable throughout, and the tab order never changes.
- **The page's own scroll extent is not the game's to change.** A rotated
  full-width block is wider than the page, so claims are tilt-capped *and* the root
  is `overflow-x: clip` while a fight runs (`clip`, not `hidden`, so no scroll
  container appears and the sticky header still works). An easter egg does not get
  to hand a phone a horizontal scrollbar.
- **`(hover: hover) and (pointer: fine)`** — the core verb is holding a cursor
  still on a thing, so on a touch screen the toggle says "needs a mouse or
  trackpad" instead of starting something unplayable (§5.2).
- **Contrast gate** — no claimed element may push text below WCAG AA. Verify with
  the existing backdrop-sampling harness, not by eye; sampling the composite
  gives false passes (it reads the glyphs — that mistake already cost a round on
  the glass panel).
- **Auto-truce** — if the tab is hidden `[PH 10s]`, or the pointer leaves for
  `[PH 20s]`, the fight ends itself and restores. Nobody returns to a page mid-
  invasion.

---

## 12. Build order (smallest testable increments)

0. ✅ **The toggle, with an instant swap** (§13) — *built in 0.3.* No transition, no
   fade: flip a class, arena on, Esc off. First because nothing below is reachable
   by a visitor without it, and because it is the only step that must ship
   *whatever* happens to the rest: a consent control for a feature that doesn't
   exist yet is a two-line no-op, while a feature that exists without one is a
   liability. `src/components/CatArena.astro`, button in `SiteCat.astro`'s HUD.
1. ✅ **Claim + Scrub only** — *built in 0.3.* No cat, no treats, no territory bar,
   no dialogue. Is scrubbing a page satisfying at all? **That question is still
   open**: the mechanic works, and whether it is fun needs a person, not a harness.
   Rules live in `src/lib/arena.ts` (DOM-free, 45 tests); the DOM work is in
   `CatArena.astro`.
2. ✅ **Pounce with a fixed telegraph** — *built in 0.4.* The cat leaves the footer,
   stalks the cursor, and interrupts a hold it has decided is worth interrupting.
   Rows 1–4 of §10 are tuned to the point of being *coherent*; whether the read
   feels fair still needs a person. Two bugs found here, both recorded: the aim was
   locked at the wrong end of the telegraph (§5.3), and `SiteCat`'s `stop()` never
   actually stopped its loop — it re-armed unconditionally, so the only thing that
   ever halted the cat was the reduce-motion check. Harmless until something else
   wanted the element; a single stray frame drops a stalking boss back on the floor.
3. ✅ **Treats, as a single type** — *built in 0.5.* Click a non-link surface to spend a
   found treat; the cat abandons everything for it and cannot pounce while it eats. The
   safe window is verified as a real decision by an A/B on one claim (§5.4). Shapes
   already differ per treat while behaviour does not, which is the seam step 5 needs.
4. ✅ **Territory + endings + dialogue** — *built in 0.6.* A 3px bar on the top edge with
   no numbers, a win (page cleared → the cat takes one thing back and leaves, and wears a
   notch for the session) and a loss (every claim taken *and* no treats left → it lets you
   read on), and a ribbon that speaks §8's script. **Both endings were played to completion
   in a browser**, which is the only way to know a loop is closed: a loss in ~10s of
   standing still, a win in ~17s of scripted play.
5. Add **stances**, then **loadout**. Replayability last — it is worthless before
   the loop is fun.
6. **The ink transition** (§14), replacing step 0's instant swap.

**On that ordering.** The request named the toggle and the transition together,
and this splits them to opposite ends of the build. Deliberately: the toggle is a
*correctness* requirement and the transition is *presentation*, and a curtain over
a loop that isn't fun yet only makes the un-fun slower to reach. Step 0's instant
swap is also the permanent fallback path (§14.6), so building it first means the
degraded route is the one with the most mileage on it rather than the one nobody
ever exercises.

Ship gate for each step: the existing 20-check ink harness, `npm test`, and the
contrast gate above must all stay green. The fight lives on the same page as the
ink wash and the glass pane; it does not get to break them.

**Step 4 ship gate, actual:** 324 unit tests, and a 36-check harness
(`scratchpad/arena4.mjs`) that **plays both endings to completion** — a loss in ~10s of
standing still empty-handed, a win in ~17s of scripted play. That is the only way to know a
loop is closed; asserting that the ending *code* runs would have missed both of the bugs
this step had. It also checks the bar's geometry and that it carries no numbers, that the
ribbon obeys §8's rules in the rendered DOM (word count, case, no repeats, silence between
lines) and sits above the cat rather than over the page, that the notch appears and is
drawn, and that both endings restore the page byte-for-byte.

Two harness lessons, both about checks that passed for the wrong reason. The ribbon-position
check read a *hidden* element's rect, got 0,0, and concluded it was not in the middle of the
page. And the restore check reported "differs" with no detail, which sent me to write two
separate diagnostic scripts before I made it name the first difference — at which point it
turned out to be the site's own scroll-reveal classes, since the win fight scrolls and the
baseline had not.

**Step 3 ship gate, actual:** 298 unit tests, a 30-check browser harness
(`scratchpad/arena3.mjs`) whose centre is the A/B above, plus every earlier harness still
green (58/58, 27/27, ink 20/20, cycle). It earns its ammo the way a visitor does — by
clicking through tabs, never `page.goto`, because a full document load resets the cat's
session state and the found set with it.

**Step 2 ship gate, actual:** 292 unit tests, the steps 0–1 harness still 58/58, ink
20/20, cycle green, build warning-free, plus a 27-check browser harness
(`scratchpad/arena2.mjs`) built around a `MutationObserver` that timestamps every
phase change — because every claim in §5.3 is about *time*, and an end-state
assertion cannot tell a 420ms warning from a 40ms one. It measures the warning, the
flight, the recovery window, the opening grace, that a hit resets the hold and takes
ground back, that a dodge takes nothing, that a pointer leaving the window is always
a whiff, and that the cat never leaves the viewport or widens the page.

**Steps 0–1 ship gate, actual:** 268 unit tests, ink harness 20/20 twice, cycle
check green, build warning-free, and a 58-check browser harness
(`scratchpad/arena.mjs`) covering the toggle's semantics, the claim exclusions, both
themes' contrast, hscroll at three widths, the reduced-motion and touch paths, the
auto-truce, and — the one that matters most — a byte-for-byte DOM snapshot before and
after six fights, since a claim is a change to somebody else's element.

One thing the harness could not catch, worth writing down: a stale comment left the
`outline` declarations outside a CSS comment for one build, and the contrast check
*modelled* the wash rather than reading the rendered pixels, so it passed a build
whose claims had no visible edge at all. The screenshot caught it. A measurement that
models the CSS cannot notice the CSS being dropped.

---

## 13. The arena toggle

### 13.1 Purpose

**One visible control that turns the arena on and off, and tells the truth about
which state you are in.** Pillar 2 says the fight is opt-in and reversible in one
gesture. Until 0.2 the only entry was long-pressing the cat (§3) and the only exit
was Esc — both invisible. A hidden switch is not an opt-in; it is a trap that
happens to have a way out.

The player-facing job: *nobody should ever be in this game without having said so,
and nobody should ever wonder how to stop.*

### 13.2 Placement — and two rejected homes

Attached to the existing paw widget, bottom-left, directly under the ammo row
(`tallyFor`, `cat-game.ts:79`). The widget is already the cat's own piece of
furniture, already sits where the cat lives, and already reads as "this belongs to
the animal, not to the portfolio".

| Rejected | Why not |
|---|---|
| Site header / tab bar | It would advertise a game, site-wide, to a recruiter reading a CV. The easter egg stops being an easter egg the moment it is in the nav. |
| `A11yControls` panel | Filing a game under accessibility settings misfiles it for exactly the people who most need that panel to be short and predictable. Reduced motion is not a game preference. |

### 13.3 Form

A real `<button>` with `aria-pressed`. Not a link, not a `div`, not a keyboard
handler on the cat — the browser's own control gives focus, `Enter`/`Space`, and
state announcement for free.

- **The label does not change with state.** `aria-pressed` carries the state; a
  button that flips *both* its label and its pressed state announces the opposite
  of what it means ("take the screen back, pressed") and is a well-known
  antipattern. Candidate copy, to be tested rather than assumed: **"Cat takes the
  screen"**, with the pressed state drawn as a filled pill.
- This is chrome, so the §8 dialogue rules (7 words, lower-case, no exclamation
  marks) **do not apply**. The cat may bluff; the switch may not. It is the one
  place in the feature that speaks in the site's voice instead of the cat's.
- Reuses `.tap-safe` (`global.css`) for the 44px coarse-pointer target — it sits
  near the viewport corner on a phone, which is the worst place to be 20px tall.
- Visible focus ring, inherited from the site's existing focus style. Not
  overridden.

### 13.4 State and persistence — nothing is stored

*Revised in 0.3. 0.2 specified a durable `localStorage` "off" beside a session-only
"on". Building it showed the stored entry could not change any observable
behaviour.*

| State | Where it lives | Why |
|---|---|---|
| **on** | in memory, session only, matching the existing progress model (`cat-game.ts:6–7`) | Nobody should land on a portfolio mid-invasion because they said yes last week. Consent to be ambushed does not keep. |
| **off** | nowhere — it is the state every page load already starts in | *Because* "on" is session-only, off is the default after a refresh, a return visit, or a shared link. A stored "off" could only ever agree with the default. |

The asymmetry 0.2 was reaching for is real and survives: **the escape is sticky and
the invitation is not.** What was wrong was the mechanism. A flag that can only ever
confirm the default is not a safeguard, it is reassuring dead code — and cutting it
means the cat's game writes nothing, anywhere, which is a stronger promise than the
one it replaces.

Neither direction is a preference to be synced or a setting to be found in a
panel; both are one press away at all times.

### 13.5 Inputs and outputs

| | |
|---|---|
| **Input** | Click / tap / `Enter` / `Space` on the button |
| **Output, off → on** | Latch, then §14's transition, then the arena is live |
| **Output, on → off** | Identical to Esc truce: one code path, DOM restored exactly as found, reverse transition |
| **Success** | The visitor can find the switch without being told, and pressing it does exactly what its label said |
| **Failure** | Any state where the button's rendering and the arena's actual state disagree — this is the bug class to hunt, not a balance question |

### 13.6 Edge cases

- **Pressed during a transition.** Latch the request and resolve it once the
  transition settles. Never queue two: a third press collapses into the latch, so
  a mashed button cannot produce a stack of floods.
- **Pressed mid-fight.** Exactly Esc (§3). One code path — a second "stop the
  game" implementation is a second thing that can fail to restore the DOM.
- **Auto-truce fires** (tab hidden, pointer gone — §11). It flips the button back
  to **off**, visibly. The alternative — arena silently dead, button still
  pressed — is the §13.5 failure state.
- **Route change with the arena on.** The cat already survives via
  `transition:persist`; the arena must **re-query** the new page's furniture
  (§4.1), because the old page's claim list now points at detached nodes.
- **Reduced motion.** Button shown and operable (§11). Pressing it does not start
  a fight there is no motion-safe variant of — it says so, in words, in the widget.
  Absent-and-silent was the 0.1 behaviour and it was worse.
- **A pointer that cannot hold still on a thing** (touch, §5.2). Same treatment as
  reduced motion, different sentence: shown, `aria-disabled`, and the reason in the
  widget. Both are "not yet", and neither is "not for you". Implemented as one code
  path returning *why*, so a third reason cannot arrive and get its own handling.
- **No JS.** The button is rendered *by* the cat script, so it cannot appear as a
  dead control on a page where nothing can respond to it.
- **Print.** Hidden, along with the rest of the cat.

### 13.7 Tuning

**None.** A consent control has no tunable parameters — there is no version of
this that is balanced by making it slightly harder to find.

---

## 14. The loading transition

### 14.1 Purpose — a loading screen with nothing to load

Nothing downloads when the arena opens. The curtain is not covering a wait; it is
marking a **state boundary**. The page does not change *content*, it changes
*meaning* — the same h1 that was a headline a moment ago is now territory — and a
cut with no transition reads as a rendering bug rather than a threshold crossed.
The flood is what lets consent look like an event.

The minimum hold is honest rather than padded. Real work happens inside it: the
arena DOM query (§4.1), initial claim placement, the composition seed roll, and
picking the opening line. On a fast machine that work finishes in a few
milliseconds, and the floor keeps the curtain from flickering — but the floor is
covering something real, which is the difference between a beat and a fake
progress bar.

### 14.2 Made of ink, reusing what exists

The curtain is the site's own ink, not a new visual language: `src/lib/ink-field.ts`
is pure and seeded, so it can take a **second consumer** with no new art and no new
dependency. §0's "nothing new is drawn" still holds.

| Reused | From | As |
|---|---|---|
| `injectStreak`, `reseedField`, `stepInk` | `ink-field.ts` | The flood itself |
| `fiveTones`, `sampleSmooth`, `coverage` | `ink-field.ts` | Render path, unchanged |
| `inkAfterDrying` | `ink.ts` | The reveal — the curtain *dries*, it does not fade |
| `mulberry32` | `ink.ts` | A per-entry seed, so no two floods match |

**Not** `InkWash.astro`. That canvas is `z-index: -1` and hero-scoped by design;
the curtain is `position: fixed` and on top. A separate short-lived canvas that
frees itself on settle.

Two hard constraints this reuse imposes:

- **The curtain must not touch the hero's field instance.** 222 tests pin the hero
  composition to `INK_SEED = 20260802`; a shared mutable field would make the
  homepage's artwork depend on whether someone opened a game.
- **The hero wash pauses while the arena is on.** It is scenery, and its 10fps ×
  12-tick loop is a real frame cost the game needs back. Resume on truce.

### 14.3 Beats — forward (off → on)

| Beat | `[PH]` | What the player sees | What actually happens |
|---|---|---|---|
| **Commit** | 0–120ms | Cursor becomes the paw | Latch. Point of no return, made visible before anything moves |
| **Flood** | 120–800ms | Ink climbs from the bottom edge and takes the screen | `injectStreak` fanned along the bottom — **the cat's own edge**, so the invasion comes from where the animal already lives |
| **Hold** | ≥250ms floor | Full ink, faint motion | Arena query, claim placement, seed roll, opening line chosen |
| **Reveal** | 800–1600ms | The ink dries off and the page is *the same page*, now claimed | `inkAfterDrying` over the same field |
| **Handoff** | 1600ms | Territory bar slides in from the top edge; the cat speaks | Game loop takes over input |

Direction is meaning: ink rises from the cat's edge on the way in, and the
territory bar arrives from the *opposite* edge (§6) on handoff, so the fiction's
two poles are established before the first mechanic fires.

### 14.4 Beats — reverse (on → off), and theme

Reverse is `[PH 600ms]`, **no hold**: there is nothing to load on the way out, and
a slow exit reads as the site not letting you leave. Pillar 2 is a promise about
how fast Esc feels.

**Dark theme floods toward a deepened ground, not the pale ink colour.** In light
mode the ink is dark on cream and the flood darkens the screen; naively reusing the
same alpha in dark mode paints a near-white sheet over a dark page, which is a
flashbang and a §11 violation. The curtain's target is *further from* the page's
text colour and *toward* its ground in both themes — one luminance reversal at
most, per direction.

### 14.5 Reduced motion

A `[PH 120ms]` cross-dissolve, or an instant swap. **Never a half-speed flood** —
slowing a full-screen wipe makes it worse, not gentler. The Hold's real work still
happens; it just happens behind a dissolve instead of behind ink.

### 14.6 Failure states — the transition is never load-bearing

| Failure | Behaviour |
|---|---|
| No canvas / 2D context | Instant swap. Arena still starts. |
| `ink-field` fails to load | Instant swap. Arena still starts. |
| Flood exceeds `[PH 2s]` wall-clock | Abandon the animation, swap, start. A curtain that outstays the game's patience is worse than no curtain. |
| Esc / toggle during Flood | **Reverse from where it is.** It does not complete first. An interruption that has to wait for the animation is not an interruption. |
| Tab hidden mid-transition | Settle immediately to the destination state, no animation on return. |

### 14.7 What it must not do

- **No `display: none`, ever.** The reveal has to show the same page in the same
  place, or the transition becomes a page load and the illusion — *your* page,
  invaded — dies.
- **Scroll position preserved in both directions**, to the pixel.
- **No focus stealing** and no focus trap, in or out. Focus returns to the toggle
  on exit, because that is where the player's attention already is.
- **`pointer-events` off on the curtain** during Flood and Reveal, so a click
  aimed at the page during the transition is swallowed rather than landing on a
  half-claimed arena.

### 14.8 Tuning

| Var | `[PH]` | Rationale | "Broken" looks like |
|---|---|---|---|
| `COMMIT_MS` | 120 | Long enough to register the paw, short enough not to feel like lag | >250: the button feels broken |
| `FLOOD_MS` | 680 | Must read as deliberate; the eye needs ~0.5s to see a direction | <350: a cut with extra steps. >1200: the visitor waits |
| `HOLD_FLOOR_MS` | 250 | Covers real work and prevents a flicker on fast hardware | 0: flashes on a fast machine. >600: reads as a slow site |
| `REVEAL_MS` | 800 | Drying is the slowest beat because it is the one being *read* | <400: the reveal is a cut, and the claims are missed |
| `REVERSE_MS` | 600 | Exit must feel faster than entry, and be **shorter** than forward total | ≥ forward: Esc feels reluctant |
| `WALL_MS` | 2000 | Total budget before abandoning to a swap | >3000: nobody waits that long for an easter egg |
| Curtain fps | 30 | The hero wash runs 10fps × 12 ticks because it runs for *seconds*; the curtain is short-lived and may run hotter | <20: the flood stutters, and a stuttering full-screen wipe reads as a crash |

Coupled, and must be tuned as a set, not row by row: `FLOOD_MS + HOLD_FLOOR_MS +
REVEAL_MS` must stay under `WALL_MS`, and `REVERSE_MS` must stay under their sum.
A spreadsheet with those two formulas before any code.

### 14.9 Dependencies

`ink-field.ts` (unchanged — it is already pure), `ink.ts` `inkAfterDrying`,
the §13 toggle (there is no other entry point), and §6's territory bar for the
handoff beat. It depends on **no** mechanic in §5, which is why it can be built
last (§12).
