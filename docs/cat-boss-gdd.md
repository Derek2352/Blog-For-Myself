# GDD — "Whose Screen Is It" (cat boss fight)

**Version** 0.2 · design only, nothing implemented
**Status** hypothesis. Every number below is `[PH]` (placeholder) until playtested.

## Changelog

| Ver | Change |
|---|---|
| 0.1 | First draft. Core loop, mechanic specs, dialogue table, replayability. All values `[PH]`. |
| 0.2 | Added §13 arena toggle and §14 loading transition. **Revised §11**: the toggle overturns the reduced-motion decision — an explicit opt-in is a prompt, so hiding the game from those users was paternalistic. Added a photosensitivity requirement the full-screen transition makes load-bearing. **Revised §3**: long-press-to-start removed; the toggle is the only entry point, because an invisible gesture is not an opt-in. **Revised §12**: the toggle becomes step 0 with an instant swap, the transition moves to last. §6 diagram shows the toggle. |

---

## 0. What already exists (design constraints, not wishes)

This is **not** a greenfield design. `src/components/SiteCat.astro` (1202 lines) and
`src/lib/cat-game.ts` already ship:

| Existing thing | Where | The fight reuses it as |
|---|---|---|
| Modes `walk / idle / away / climb / chase / fetch` | SiteCat.astro:504 | Boss state machine base — `chase` **is** the pursuit mechanic |
| `chase` — cat runs at the cursor when within 34px | :773–804 | The threat. Already written. |
| `fetch` — cat abandons everything for a treat | :691, :746 | The player's defensive tool. Already written. |
| `climb` — cat scales a side edge | :930–983 | Boss repositioning / phase transition |
| One treat per navigable tab, 7 tabs | cat-game.ts:24 | **Ammunition.** Explore the site → arm yourself |
| `TREATS = fish, yarn, bell, feather, biscuit`, hashed per slug | cat-game.ts:20–28 | **Loadout.** Which tabs you explored decides your kit |
| 7-rung affection ladder, ratio-derived | cat-game.ts:34–57 | Difficulty input and post-fight consequence |
| Collar SVG, appears only at completion | SiteCat.astro:46–56 | The *patient* path's reward — the fight must not duplicate it |
| Paw row + `tallyFor` caption | cat-game.ts:79 | Existing HUD. Becomes the ammo counter. |
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
**Output** Element gets `data-cat-claimed`; CSS desaturates it, tilts it `[PH 0.6deg]`,
and stamps a paw watermark. **Transform and filter only** — never `display`,
`visibility` or layout, so nothing reflows and nothing is hidden from a
screen-reader.
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
**Tuning levers** `CLAIM_TILT`, `CLAIM_DESAT`, `INITIAL_CLAIM_FRACTION`, `RECLAIM_COUNT`
**Dependencies** Arena query, TerritoryMeter, InkWash (must not fight the ink wash
visually — claims are cool-grey, the ink is warm)

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
- Touch: no hover, so "hold still" is a press-and-hold. Same timer.
**Tuning levers** `SCRUB_MS`, `SCRUB_RADIUS`, `STILL_TOLERANCE`, `INTERRUPT_PENALTY`
**Dependencies** CatBoss.pounce, Claim

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
**Tuning levers** `TELEGRAPH_MS`, `LEAP_MS`, `RECOVER_MS`, `POUNCE_RANGE`, `AGGRESSION`
**Dependencies** Scrubber, Loadout (bell lengthens telegraph), rubber band (§7.3)

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
**Tuning levers** `lureDuration` per type, `THROW_ARC_MS`, treat count (= tabs explored)
**Dependencies** Loadout, existing `fetch` mode

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
- **Truce always visible**, bottom-right, low contrast. Pillar 2 must be legible
  as an affordance, not a hidden keystroke.
- **Ribbon follows the cat**, never centre-screen. Centre-screen dialogue would
  cover the portfolio, which is the actual product.

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
- [x] First beat unloseable: the opening `[PH 6s]` has aggression pinned to 0,
      cat only watches. Guaranteed first success.
- [x] Each mechanic in a safe context: pounce introduced only after one clear
      scrub; treats explained by the cat *asking* for one, not by a tooltip
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
| `RECOVER_MS` | 700 | Must exceed `SCRUB_MS/2` so a whiff is a real reward | <500: whiffing costs the cat nothing |
| `POUNCE_RANGE` | 90px | ~2.5× existing `chase` trigger (34px) | Too large: nowhere is safe |
| `INITIAL_CLAIM_FRACTION` | 0.55 | Invaded, not unusable | 1.0: page unreadable, breaks pillar 2 |
| `lureDuration` (fish) | 3.0s | Must exceed `SCRUB_MS` or treats are worthless | <1.4s: resource does nothing |
| `AGGRESSION` (bored) | 0.6 | Visible mercy without becoming a walkover | <0.4: cat stops being a threat |
| Fight length | 90–180s | One coffee. Longer and it competes with the portfolio | >4min: nobody finishes |

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
- **Claims are transform + filter only.** No layout, no `display`, no
  `visibility`. Text stays selectable and copyable throughout.
- **Contrast gate** — no claimed element may push text below WCAG AA. Verify with
  the existing backdrop-sampling harness, not by eye; sampling the composite
  gives false passes (it reads the glyphs — that mistake already cost a round on
  the glass panel).
- **Auto-truce** — if the tab is hidden `[PH 10s]`, or the pointer leaves for
  `[PH 20s]`, the fight ends itself and restores. Nobody returns to a page mid-
  invasion.

---

## 12. Build order (smallest testable increments)

0. **The toggle, with an instant swap** (§13). No transition, no fade — flip a
   class, arena on, Esc off. First because nothing below is reachable by a visitor
   without it, and because it is the only step that must ship *whatever* happens to
   the rest: a consent control for a feature that doesn't exist yet is a two-line
   no-op, while a feature that exists without one is a liability.
1. **Claim + Scrub only.** No cat, no treats. Is scrubbing a page satisfying at
   all? If not, stop here — that is the fun hypothesis failing cheaply.
2. Add **Pounce** with a fixed telegraph. Tune §10 rows 1–4 until the read feels
   fair. This is where the game is won or lost.
3. Add **Treats** as a single type. Verify the safe window is a real decision.
4. Add **Territory + endings + dialogue**. First full loop.
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

### 13.4 State and persistence — deliberately asymmetric

| State | Where it lives | Why |
|---|---|---|
| **off** | `localStorage`, durable | Opting out is a considered decision. It must survive a refresh, a route change, and a return visit next month. |
| **on** | session-only, matching the existing progress model (`cat-game.ts:6–7`) | Nobody should land on a portfolio mid-invasion because they said yes last week. Consent to be ambushed does not keep. |

Neither direction is a preference to be synced or a setting to be found in a
panel; both are one press away at all times. The asymmetry is the whole design:
**the escape is sticky and the invitation is not.**

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
