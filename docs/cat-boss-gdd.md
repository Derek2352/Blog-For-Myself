# GDD — "Whose Screen Is It" (cat boss fight)

**Version** 2.0 · **the kittens fight, and you can just read.** Five versions of
playtesting returned one sentence — *"she doesn't know what she's doing"* — and 1.3
answered it with legibility, 1.4 with depth, and both missed the point. The fight was
never unclear; it was **a game with three verbs on a CV site**. §5.2's core verb is
holding a pointer perfectly still for 1400ms, §3's decision is a resource trade, and
1.0 measured that winning means standing 423px from the cat. That is homework, and the
correct amount of homework on somebody's résumé is none.

So the verb changed hands. **Commander mode** (§15) gives the hold to a *kitten* and the
visitor two optional clicks: point at a claim to send somebody, or throw a treat to pull
the cat away. Touch nothing and the round still resolves — that is the promise, and it is
the first check in `scratchpad/commander.mjs`. Rounds are endless, clearing one adds a
kitten and tightens the cat's clock, a board the cat fills simply starts again (**there is
no losing**), and one integer survives the tab closing: the deepest round reached.
Everything §5–§9 measured is intact underneath, because the boss, the board, the stances,
the moods, the dialogue and the endings are 1.4's — 1.4's whole fight is still here, behind
a HUD chip that says *play it yourself*, and still measured by fourteen browser harnesses.

The mode was built by measuring and being wrong in public: a kitten slower than the cat
could never finish a hold, a policy inherited from 1.0 marched it across the document,
"take the soonest" left it restarting the same doomed hold forever, and a landed pounce
that took ground made the whole thing unwinnable. Every one of those is a `[PH]` with the
arithmetic that corrected it in §15.5. Next: the tester.

**Status** hypothesis. Every number below is `[PH]` until playtested —
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
| 0.7 | **Built step 5** (§12) — stances and loadout. §9.5's biscuit line ("shortest interrupt immunity but cat stays put longest") turns out to be **two clocks, not a contradiction**, and the anchor that implements it serves the feather too. Two stance numbers were set by a test rather than by taste: a whiff must cost the cat more than the attack gained it, which forced trickster's recovery to 1.2× and sleepy's to 1.55×. One real bug, found by a harness that could not find anywhere to click: `PROTECTED` matched `<main tabindex="-1">` and the click handler used it, so **no click inside the page content ever threw a treat while the crosshair said it would** — a lying affordance, now split into `PROTECTED` (never claim) and `INTERACTIVE` (never intercept). One balance finding recorded below: **no stance's pounce can take the page from a stationary player.** §9.4's handicap ladder is still unbuilt. |
| 0.8 | **Built step 6** (§12) — the ink curtain, and with it the build is complete through §12. The largest finding is that presentation had a **correctness** consequence §13.5 predicted and §14 never mentioned: a ~1.9s transition creates a window where the visitor's intent and the arena's state disagree, and every branch in the component read the state, so a second press mid-flood opened two boards and stranded the first one's styling on a page that promises to be handed back byte-identical. Intent is now its own thing (§13.5). Three visual corrections, all from measurement rather than looking: **the ink field cannot supply the flood's front** (it is empty above the pours, so what came out was a linear-gradient wipe — a loading bar, which is the one thing §14.1 says this is not); **`coverage` is the wrong curve here** (`COVERAGE_FULL` is 0.055 and 83% of the flood's cells are past it, so the "texture" was a constant); and **alpha carries cover while colour carries texture**, except during the reveal, where the texture has to be ramped back into alpha or `inkAfterDrying` — a threshold — leaves a uniform sheet at full opacity until it vanishes on one frame. Two things §14.3 asked for were wrong at the scale they exist at: a 3px bar cannot slide, and the handoff has to be *aimed* into the reveal rather than fired at the hold. One performance finding: painting per device pixel ran at **13fps**; sizing the canvas in grid cells and letting CSS stretch it — `InkWash.astro`'s own trick — took it to 34fps, faster than this machine's idle baseline for the page. §14.7's "focus returns to the toggle" is **cut**: nothing takes focus, so nothing needs to restore it, and a `.focus()` on exit would have created the problem it was written to solve. |
| 0.9 | **Built step 7** — §7.3's rubber band, the first of the things earlier steps deferred, and chosen because 0.7's balance finding names it: the cat has no answer to a stationary player once it is behind, so the endgame was free. Three tiers rather than a curve, because a drift cannot be read and an unreadable scaling is the invisible fudge §7.3 exists to replace. **The load-bearing decision is what aggression does *not* touch:** scaling recovery alongside the telegraph is the symmetric-looking choice and it breaks §10's whiff invariant — at 1.4, siege comes up **60ms short** while trickster and sleepy scrape through on 10ms and 35ms, and repairing that means retuning three of four stances to accommodate a §7.3 feature. Clamping the telegraph scale to 1 leaves 140ms at the worst point in the whole space, and is the more faithful reading anyway: a bored cat's tell is that it *does less*, not that it does the same thing slowly. **One number was wrong for a reason worth keeping:** the hysteresis band started at 0.08, which is **1.2 claims** on a real board — narrower than a single trade, so the tier strobed `even→bored→even→bored→even` in the browser. A band has to be measured in the units of the signal it damps; it is now ≥2 claims on `MIN_BOARD`, with a test tying the two together. §8.2's supporting lines now gate on the bored tier instead of proxying it, closing a comment in `arena.ts` that had said "does not exist until step 5" since step 5 shipped. §7.4's treat-teaching bullet is **ticked** — `support-bribe` landed in 0.6 and the checklist was never updated, so the doc had been calling its own weakest seam unbuilt for three versions. Grooming reuses SiteCat's existing `.grooming`, so §0's "nothing new is drawn" still holds. §9.4's handicap ladder and §7.1's top state remain deferred. |
| 1.0 | **Built §9.4's handicap ladder** — the last unbuilt section, and **the build order is complete**. Its own stated blocker was the wrong diagnosis: "it needs an ending that asks a question" describes a prompt, and §7.4 ships "no modal, no 'play again?' button" as a deliberate decision. The question was already on screen — **§13's toggle is the only way in and never goes away**, so a rematch does not need a new control, it needs the next press to *mean* something different. A win raises a rung, a loss lowers it (§7.2: nobody gets stranded), the ceiling is your own found-set, and pressing the toggle again is the acceptance. The handicap is revealed as the fight opens: a withheld paw in the HUD, given its own hollow state because unfilled already means two things and a third meaning wearing the same face would make the HUD lie. Withheld deterministically from the right, which takes a *specific* treat — so the ladder narrows §9.5's kit as well as thinning it. **One real bug, and only a browser could have found it:** winning without spending is the commonest way a good player wins, and `win-clean` sat directly above the offer in §8.4's priority — so the rematch was never offered to the visitor most likely to want it. Every line was reachable and every gate correct in isolation; it took a real fight to show which branch good play lands on. The clean line now carries the question. **And 0.9's stalemate finding is retracted:** a treatless fight is winnable, **won in 37s with every claim worked from 482px out** against a 423px safe distance — 0.9's harness had simply been fighting at 76–300px, inside the cat's reach. `LADDER_FLOOR` stays at 0 and §9.4's bottom rung means what it says. What survives is narrower and still useful: holding still *near the cat* gains nothing, so §5.2's fleeing is the counter the fight is actually built on. |
| 1.1 | **Built §7.1's top state** — collar *and* notch in one session, and the cat comes and sits on your cursor. With it, **every numbered section in the GDD is built.** 0.6 deferred this as "worth building deliberately" because it is the one reward that changes ambient browsing rather than the fight, and the deliberate part turned out to be a single CSS line. On a mouse `.cat-svg` is a live hit target so the cat can be petted; the touch path had already turned that off with a comment describing this feature exactly — a 48×30 body at the bottom edge *"swallows taps meant for whatever link is under it — a dead zone that moves"*. Parked under the cursor, that dead zone sits precisely where a click is about to land. So a perched cat is scenery: **measured, a link under it is still the click target and clicking it navigates**, `elementFromPoint` still returns the page (which `claimUnder` depends on), and the cursor resting on the cat can no longer pin `petting` on forever. Most of the behaviour already existed — `hunt()` has chased and sat *beside* the pointer for versions — so this closes all the way instead of stopping 26px short, holds while the pointer is still instead of drifting off after 1.5s, and needed a second timestamp because `prey.t` is re-stamped by every move and so can say "recently seen" but never "has stopped". Arrive at 4px, hold until 22px: the same hysteresis §7.3's tiers needed, or drift too small to break the perch still exceeds the snap and the cat walks while curled up. No new art — `.perched` carries pointer-events and nothing else, and the pose is lv6's existing `.dozing`.<br><br>**Then a full review pass, which found seven real bugs — five of them older than this version.** (1) **The idle truce was ending fights that were being played well.** §11 says a fight ends when "the pointer leaves for 20s", and that was implemented as "the pointer stops moving" — the opposite thing, because §5.2's core verb is holding the pointer *still* and 1.0 measured flee-and-hold as the counter the fight is built on. Hold one claim against a cat that keeps interrupting and the game quietly quit under you. It hid for four versions because **a truce and a win look identical from outside** — empty board, restored page — and every harness asked "are the claims gone" rather than "who won". (2) **The ending beat's timer was never cancelled**, so closing a fight during the beat and starting another could have the old timer shut the new one down. (3) **A fight could cost you a find** (§7.2): the paw row's restore *toggled* to its snapshot instead of only filling from it, so a treat credited on arrival — which happens before the fight's own page-load handler — was taken straight back off. (4) **The ribbon could speak invisibly**: a line arriving inside the previous one's 220ms fade could be hidden by the outgoing timer, and §8's no-repeats rule then suppressed the retry. (5) Releasing the perch keyed on the pointer having moved rather than on the perch being held, so a scamper, a treat or a wall climb left the cat running across the screen curled up and click-through. (6) Parking the cat cleared the perch's *classes* but not its *flag* — the `arena.want` desync again, one file over: reduce-motion off-and-on left the cat frozen a few pixels from the cursor with none of the pose it thought it was wearing. (7) And §7.4’s ending promises the cat takes **one** element and leaves — but the beat only silenced the *dialogue*, so inside it the cat could pounce again, a siege board went on regrowing, a click still spent a paw, and the one re-claimed element could be scrubbed back off under the line announcing it. Nothing new starts once the fight is decided now; a pounce already in flight still lands, because it was committed before the ending. Two of the seven are the same shape as bugs this document already records, which is the argument for the review pass rather than against it.<br><br>**And five harness faults came out with them**, every one of which had been accusing the code. §12 step 3's A/B never moved the cursor off the claim between its arms, so arm A's hold quietly completed during arm B's setup and arm B was then measured on ground already won — a game bug's exact symptom, about one run in five. The ribbon-placement check waited twelve seconds inside one `evaluate` without touching the mouse, and a parked cursor gives the cat almost nothing to say, so the window could pass in silence and the check failed on the game working correctly. `arena8`'s rung-lifetime section fought on `/timeline/` — the page section 1 of the same file had already written down as the one where this harness's flight cannot resolve — and its two §7.2 checks sat inside `if (won.won)`, so they were silently *skipped* rather than failed. §12 step 4’s closing check had been right by luck for five versions: it asks whether SiteCat has the cat back and measures displacement, but the win loop leaves the pointer resting low on the page and an ambient cat’s answer to that is to come and sit *beside* it — so standing still was the correct behaviour and the check was sampling it. And two harnesses reported a **legitimate loss** as a broken feature, which is how §9.4's floor note above got measured: every treatless run with zero stalls won, every run with one stall lost, and that is `isLost` doing exactly what §2 specifies. A retry — which is what §9.4 says a rematch *is* — was the honest fix, not a wider timeout. |
| 1.2 | **Touch mode — §5.2's refusal, overturned rather than worked around.** The build has said "needs a mouse or trackpad" since 0.3, and §5.2 gave two specific reasons rather than waving at "no hover": a press-and-hold has **no aim**, and **a finger covers what it holds**. Both are correct. Reading them against 1.0's flee-and-hold measurement turns up a **third and fatal one that neither 0.1 nor I had noticed**: the fight's counter is holding further away than `SAFE_FLEE_PX` (≈423px), a mouse pays **travel time** to get there, and a finger teleports — so a naive port is not a weaker fight, it is a fight with **no decisions at all**. The two stated objections describe a worse game; the third describes no game.<br><br>**One measured fact answers all three.** The cat is `position: fixed` at the bottom of the viewport and claims are in document flow, so **scroll position *is* distance**: scrolling moves the claim relative to the cat without the cat moving. Measured at 390×844 across three pages, a claim scrolled high sits **683–687px from the cat (safe, 15 of 15)**, centred **413–420px (0 of 16)**, low **161–178px (0 of 16)** — the 423px threshold falling *between* the top band and the middle one, with nothing tuned to put it there. So aim is back, fleeing costs a flick, and §5.2's oldest edge case — "a scroll while channelling is movement, interrupt" — turns out to be the rule that prices it. The same clause written to stop scroll-scrubbing is what makes touch mode a game.<br><br>**Occlusion is answered by moving the feedback, not the finger:** the 40px ring sits exactly where a fingertip is, so on a coarse pointer progress goes *into the claim*, §5.1's wash deepening 7% → 26% so a filling claim arrives at the tint `cat-freed`'s drain begins from. No new art (§0). **Long-press and scroll are suppressed on claimed elements only, only while claimed** — and `touch-action: pinch-zoom`, **not** `none`, because `none` refuses a pinch that begins on a claim and §11 makes zoom a no-exceptions row. None of the three properties affects layout, which is what §11 was restated in 0.3 to admit; the page still restores byte-identically after a touch fight.<br><br>**The code was smaller than the design.** `scrub.x/y` was fed only by `pointermove`, and the one thing a finger does that a cursor cannot is arrive and then emit nothing — so a finger held perfectly still fired `pointerdown`, no `pointermove`, and no hold could register. Everything else was already portable because `stepScrub` polls position per frame instead of reacting to events, and `pointerout` with a null `relatedTarget` turns out to fire on finger *lift*, so §5.3's whiff-on-leaving rule transferred for free. Three genuinely new rules, and they are one discovery: **on touch a hold ends in gestures a dwell never did.** A cursor resting on a link does nothing; a finger resting on one is a click, a text selection, a context menu *and* a drag — and §5.1 deliberately allows a claim *inside* a link, so on a portfolio the core verb landed on link after link. `isTap` decides whether a lift throws. `isWorking` swallows the click that ends a hold on a claim, and reads a flag recorded *during* the hold because a completed hold frees the element, so “is there a claim here” is already false by the time the click arrives — which is why the first attempt still navigated away. And `dragstart` is refused on claims, because a long press on a link is the native link-drag gesture: it fires `pointercancel` and released the hold a few hundred ms in, surfacing as `8 → 8 claims` from a hold that plainly should have taken one. Each needed a browser to find and none of them exists on a mouse.<br><br>**No difficulty lever was added.** Step 0 was run to decide whether a phone fight needed one and the answer was no, so none shipped — the plan reserved the right to a coarse `MIN_BOARD` or an aggression factor, and both would have been magic numbers. One thing is recorded rather than fixed: Chromium applies *touch adjustment* on mobile, snapping a tap that lands near a clickable target onto it, so throwing is fuzzier on a phone than the crosshair makes it on a desktop. Nothing can be done about that from here — but it makes §7.4’s `support-bribe` the only teaching for §5.4 that survives losing the cursor. |
| 1.3 | **The fight can be learned cold — the playtest finding, fixed.** The review that closed 1.2 measured what 1.2's checklist had assumed: on the homepage a cold visitor did nothing for the whole opening grace, ~61% of fights had no clock to feel (ambush/trickster/sleepy sat at `regrowMs: 0`), the cat's mood tier and stance were invisible (the boss looked exactly like the ambient cat), and there was no audio. Four fixes, one per pillar of the finding. **Legibility** — a teach line ("hold still on it. it comes back.") opens the fight inside the opening grace (measured at 1412–1648ms in the harness, inside `OPENING_GRACE_MS` 2500), gated to the cold case (no frees, no spends); a dead-band filler ends the silent-fight defect where a fight opened with no line at all (territory 0.5–0.75, previously `pickLine` returned null); support-idle re-gated to fights with actual history so it can't swallow the teach line. **Tempo** — every stance now has a clock; §9.3's derivation is 4000→6000→8000→12000→15000ms, each step a measured response to the arena8 harness (at 8000 the harness reclaimed ~6s/claim against an 8s regrow — a dead-even treadmill; 15000 is the slowest clock that still counts as a clock per §9.3's own "beyond 15000 it is decoration" line). **Presence** — §7.3's tiers and the stances now *show*: mood colour/scale/posture and stance tell classes on the boss, `--boss-scale` wired to territory, cleaned up on fight end. **Sound** — §11's opt-in row is answered with a WebAudio synth (`src/lib/cat-sfx.ts`, no assets, §0's art constraint overturned for audio only): telegraph, landing, reclaim, win/lose cues, all silent until the HUD's sound toggle is pressed, with `aria-pressed` on the button. **Ship gate** — `scratchpad/first-run.mjs`: a cold visitor does nothing → the cat must teach the verb inside the opening grace; then playing only what it was taught must win a treatless fight. The gate is green: 4 consecutive full passes (wins at 21–40s, 5–7 reclaims), 414/414 tests, `astro check` clean, build clean. Two measurement notes the harness left behind: the fight rolls a random stance each rematch so the gate needs §9.4's rematch budget (~25–50% per-fight win rate converts with the 6-try loop), and the harness's own scroll path taught a §11 bug — `mouse.wheel` does not refresh `scrub.seen`, so a harness wheeling for 20s triggered the idle truce mid-fight; fixed in the harness by scrolling via `scrollIntoView`. Board tightened to 10–14 (§10) and hysteresis widened to keep bands ≥2 claims on it. Next: a person — the gate proves winnability, not fun. |
| 1.4 | **More fight: the last stand, a signature move per stance, and a counter.** Asked for after 1.3 ("even more battle with the cat mechanics/elements") and built as three additions on machinery that already existed. **§7.3's desperate tier is finally the whole tier, and a 0.9 decision is retracted to get there.** 0.9 delivered "faster telegraph" exactly as the table says, but 1.0 then measured that the fight's counter is *fleeing* — so the tier escalated the one threat a good player has opted out of, while the regrow clock, the only pressure that reaches a distant player, stayed fixed. The fight was calmest precisely where it should tighten, which is where the tester's "the pace is slow" is loudest. A cornered cat now keeps `LAST_STAND_REGROW` of its clock (**measured: 4975ms against siege's 9000ms**), the tier's entry raises a line and a two-note rising sting, and 0.9's objection is answered rather than ignored — the mood and the stance stay separate factors, so the last stand cannot quietly retune §9.3. **§9.3 gets one identity move each** ("same verbs, different counter-play", which was still four sets of coefficients): siege sweeps **two adjacent** claims on a beat, a landed ambush pounce **pins** the cat over what it took for 2600ms within 90px (reusing the treat leash), and the trickster's feint can now be followed straight away by a real telegraph. **§5.4 gains a second target rather than a fourth verb** — a treat landing within 64px of a cat in `recover` stuns it, which is the trade §3 demands of any addition: spend the treat to make your next window safe, or spend it to punish a whiff you read. The window is a *consequence*, not a constant: `RECOVER_MS − THROW_ARC_MS` = **380ms**, and nothing teaches it (§7.4 now has a *second* mechanic found by exploration, and it is the same knowledge §5.3 already gave the player, used the other way round).<br><br>**One balance finding, caught by measurement and fixed by arithmetic.** The sweep first took two claims for free, which raised siege's rate to 1.5 claims per 9000ms — and flee-and-scrub then **plateaued at six claims for ten straight exchanges**, 0.167 claims/s of regrow against 0.164 of reclaiming: a fight that could be neither won nor lost, which is worse than either. `regrowInterval` now charges **one interval per claim taken**, so a sweep of two waits twice and the long-run rate is identical to 1.3's whatever the cadence (**9000ms vs 9001ms per claim, measured**). §9.4's floor is therefore safe by construction, and `SIEGE_SWEEP_EVERY` tunes feel only. **And a finding about siege that nine versions of harness had hidden: it has to be played as siege.** `arena8` forces an ambush, so every browser measurement had fought a cat that *leaps*, and flee-and-hold is the leaper's counter; against a floor-bound cat it is four of every six seconds spent luring something that cannot come. Played as its own table describes, the same fight is **7 reclaims and a win in 21–23s**.<br><br>**Four harness faults, and the first had been true since 0.4:** every `waitForFunction` bound in the fleet was fiction — 22 call sites passed `{ timeout: N }` in Playwright's *arg* position, so a wait asking for 4000ms took **30104ms**, and 20 of those seconds belong to §11's idle truce. A siege roll therefore ended `arena8` section 1 with "0 reclaimed, 0 left", which reads exactly like a broken game: **a truce, a loss and a win look identical from outside**, the same blind spot that hid 1.1's truce bug. A watched fight with empty paws *loses itself* (§2 working correctly: a loss is a full board **and** no ammo). A regrow rate averaged across the harness's own play reported 18333ms for a 9000ms clock, because the gaps that spanned the holding included it. And "claims went up" is a proxy for "the cat hit me" that **1.3's own feature invalidated** — every stance has a clock now, so a regrow forged the pin's trigger and a working 90px leash was reported as 388px. <br><br>**Then a review pass over 1.4's own code, which found three bugs no harness had caught — all three about *when* rather than *what*.** (1) A trickster feint that re-commits was not gated on the ending, so a bluff could turn into a fresh telegraph inside the beat that says the cat takes one thing and leaves; 1.1 fixed exactly this for the pounce and the distinction is that a feint is the cat *declining* to jump, so re-committing is starting something new rather than finishing something started. (2) The last stand's event was cleared by whichever code read the fight state first — and the mood pass reads it every frame while the dialogue returns early during §8's talk gap, so the mood ate the event and threw it away: the climax line could only ever be said if the tier was entered inside a ~16ms window. Only the dialogue spends it now, and the event is dropped if the cat stops being cornered before it is said. (3) The swat's stun was written as a new *length* for the recovery, but the FSM scales `RECOVER_MS` by the stance's `recover` — so it silently restarted the stance clock and one treat bought 580ms against siege and 895ms against ambush. It is additive now, which is what `SWAT_STUN_MS`'s own derivation had said all along; **the bug was found by reading the code against its own constant's documentation**, which is a review technique worth naming. **Ship gate:** 435 unit tests, a new 22-check `scratchpad/battle.mjs` measuring each addition on machine state, every earlier harness, `astro check` clean, warning-free build. Still not playtested by a person — the tester who could not read 1.2 is the gate that matters. |
| 2.0 | **Commander mode — the input model changes hands, and §3 is retracted to do it.** Asked for after 1.4: an idle/auto game, "more hassle free like the T-Rex endless runner". The finding it answers is five versions old and always the same sentence — *"she doesn't know what she's doing"* — and 1.3's legibility pass and 1.4's depth pass were both answers to the wrong question. The fight is not unclear; it is a game with three verbs on a CV site, where the right amount of homework is none. **So the verb changes hands rather than shape:** a *kitten* performs §5.2's hold, the boss hunts **kittens** and never the cursor, and the visitor gets two optional clicks — point at a claim to send somebody, click open page to throw (§5.4, unchanged). Touch nothing and the round still resolves; that sentence is `commander.mjs` check 1. Rounds are endless and **there is no losing** — a board the cat fills starts the same round again, no penalty and no record touched (§15.2) — while clearing one adds a kitten and tightens the clock (`ROUND_REGROW_STEP`, plus a capped nudge to §7.3's aggression). One integer persists, `cat-best-round`, which **amends §7.2/§13.4's "nothing is stored"** on a boundary that is the whole argument: not fight state, unspendable, monotonic, and the one thing an endless mode needs to mean anything past one afternoon. 1.4's fight ships intact behind a HUD chip (§13.8's precedent, a third control), and §9.4's ladder is scoped to it.<br><br>**The design was wrong four times and each one was measured.** (1) A kitten at 190px/s — capped *below* the cat's desperate speed so "a cornered cat can run one down" — can never complete a hold in contact: the cat's cycle with no walk to make is 1380ms against a 1400ms hold, and a frame trace showed 0.75 progress, landed on, 0.38, landed on, indefinitely. It is 250px/s now, and the cat's threat is ground it guards rather than an animal it deletes. (2) 1.0's flee-and-hold policy, applied literally, sent it to `y: 1303` on a 900px viewport — a cursor teleports and legs do not — so the policy is now two clocks compared (`workTimeMs` vs `threatTimeMs`), which *generalises* 1.0's 423px rather than replacing it. (3) Its fallback "take the soonest" priced an interruptible hold as though it would complete, so it stood under the cat restarting the same hold; it takes the best ratio now, which means walking away. (4) A landed pounce that took ground made the mode unwinnable — one kitten, seventy-two seconds, three claims to five and back — because ground taken by pounces is a second source of board growth that the floor cannot price; a hit costs tempo only. Plus two smaller ones: a kitten's arrival had to be made *sticky* (a tilted element's bounding box drifting a pixel flipped walk/hold on alternate frames and restarted the hold forever), and a kitten works in `KITTEN_WORK_MS` 1000ms rather than `SCRUB_MS`, because 0.7's "the player wins every subsequent exchange" quietly depends on the player *fleeing* and a kitten on the last claim has nowhere to go.<br><br>**One unit test caught what no browser could:** `MIN_REGROW_MS` was charged per *interval* rather than per *claim*, so §9.3's sweep could take two claims on one floor — half the promised bound, failing only at deep rounds where nobody would have looked. **And one fix was made at the wrong layer and retracted:** shrinking commander mode's board to four claims cured the marching and bought a worse bug (trivially fillable, and rounds over in three seconds — a run reached round 14 in 72s), so the board is §4.1's again and the cause was fixed instead. **Ship gate:** 467 unit tests, a new 23-check `scratchpad/commander.mjs` (zero-input clear, the cat landing 11px from a kitten and 687px from the parked cursor, a hit taking 0 claims of 3 landings, the squad capped, the record surviving a reload while nothing else does, and a round played with storage denied), `astro check` clean, warning-free build, and the fourteen manual-mode harnesses green after each learned to declare its mode in one line. Still not playtested by a person — which, five versions in, is the only gate that has ever mattered.<br><br>**Three things the new gate found *after* the 2.0 commit, all recorded in §12.** (1) A real pillar-2 violation in shipped code: `dealBoard` replaced `arena.claimed` without handing the old board back, so a claim taken during the 1500ms round beat kept a half-full `--scrub` that `claim()` would later snapshot as its original style — the hazard `open()` has guarded since 0.3, arriving at a new boundary of the same shape. (2) `Kitten.ordered`, deleted as dead state when nothing could overrule an errand, restored once §15.4's re-pick rule could: §15.3 promises a bad order is honoured. (3) A harness fault masquerading as a product one — the order check picked the usable claim furthest from the squad, which on some boards is a claim inside a link, so the click navigated and the fight ended exactly as §11 promises. It aims where an order can land now, and §15.3 says out loud that part of the board is unorderable.<br><br>**Then the rule was made a mechanism, because writing it down had demonstrably not been enough** (§12.1, the harness charter). All fourteen harnesses moved into `scratchpad/` — twelve had existed only in a session's `/tmp`, importing Playwright by absolute path into a container that gets reclaimed, while this document cited them as committed — and onto one shared strategy in `scratchpad/lib/fixture.mjs` (`deal()`, the `wants.*` predicates, one context factory instead of eleven, one re-roller instead of four with three different budgets). `tests/harness-hygiene.test.ts` now fails the build on the four shapes that cost 2.0 an afternoon each. The audit it forced found the fault in **twenty-seven places**, two of them in already-committed harnesses; the consolidation then broke three things by assuming the copies agreed, which is the honest headline — **the differences between copies of a helper are usually load-bearing**. Gate: 473 unit tests, the fleet green twice on one build. |

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

**Nothing new is drawn.** No new SVG, no sprite sheet. The site has 24
entries still showing `COVER · PENDING`; taking on art debt for an easter egg
would be the wrong call.
> **Revised in 1.3 — audio is the exception, and it was the finding.** §1.3's
> playtest review flagged the fight as silent, and the fix is `src/lib/cat-sfx.ts`,
> a pure WebAudio synth (oscillators, envelopes, noise) that draws nothing and
> ships no asset. The constraint was about art debt; a generated sound has none.
> §11 records the opt-in rule: the page is silent until the HUD's sound toggle is
> pressed.

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

> **2.0 has a second hypothesis, and it is a different bet.** The one above is
> manual mode's and it is still the right test for that mode. Commander mode's is:
>
> > *Watching a kitten patiently take your page back from a cat that keeps knocking
> > it over is pleasant, and pointing at the paragraph you want next is satisfying.*
>
> Note what changed: **tension became patience**. The first hypothesis needs the
> player to feel hunted; the second needs them to feel *fond* of something
> competent working on their behalf. If that is not true with placeholder art —
> if watching is merely boring — then no amount of escalation curve saves it, and
> the honest response is to keep manual mode and delete §15 rather than tune it.
> Five versions of evidence say the first hypothesis is not landing with the one
> tester this site has; none of that is evidence for the second.
>
> **And one pillar is bent, so it should be said out loud.** Pillar 5 asks that the
> fight spend nothing the site has not already earned, and the *throw* still obeys
> it exactly. But a **kitten** is a resource that arrives from *playing* — one per
> cleared round — rather than from exploring, which is the first thing in this
> design to come from anywhere but the treat economy. The defence is that a kitten
> is not spent, cannot be banked, and vanishes with the fight (§7.2); the cost is
> that "explore the site" is no longer the only way to get stronger. That is a real
> departure from the pillar rather than a reading of it, and if it ever needs
> settling, the pillar wins and the squad becomes something the found-set deals.

---

## 2. Core loop

> **2.0 — the loop below is manual mode's.** Commander mode's is one paragraph and §15 has
> the detail: *a kitten works a claim, the cat hunts the kitten, the board comes back, the
> round is banked and the next one is harder.* The differences that matter to this section
> are that the **session loop has no end** (rounds are endless, and a board the cat fills
> starts the same round again rather than losing it) and that the **moment-to-moment has no
> input in it** — a visitor who never clicks sees the same loop a visitor who commands does,
> only slower. The long-term paragraph below survives untouched, including its refusal of
> retention mechanics: one integer is stored (the deepest round reached) and there is still
> no login, no leaderboard and no daily anything.

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

> **Retracted and rewritten in 2.0, and this section is the one the whole document was
> proudest of.** Everything below still describes the game exactly — as **manual mode**,
> which still ships and is still measured by fourteen browser harnesses. What changed is
> which game a visitor meets first, and the reason is the plainest finding in five
> versions of playtesting: *"she doesn't know what she's doing."* Twice, from the same
> tester, after 1.3 spent a version on legibility and 1.4 spent one on depth.
>
> The three verbs are not the problem. The problem is that they are **three verbs on a
> CV site**. §5.2's core verb is holding a pointer perfectly still for 1400ms, the
> decision below is a resource trade, and 1.0 measured that winning means holding 423px
> from the cat — positioning, timing and economy, before anything good happens. For the
> person this site exists to impress, the correct amount of homework is none.
>
> So the verb changed **hands**, not shape. §15's commander mode gives the hold to a
> kitten and the visitor two optional orders; the boss, the board, the stances, the moods,
> the dialogue and the endings are the ones written here, untouched. Read §15 for the game
> that opens by default, and read this for the one behind the chip that says *play it
> yourself*.

**Core activity**: *territorial scrubbing under threat.* You reclaim page regions
by dwelling on them; the cat interrupts by reaching your cursor; you buy time with
a finite resource.

### Player inputs — the complete set

| Input | Action | Why so few |
|---|---|---|
| Move pointer · **scroll, on touch** | Aim / flee | The cat's `chase` already keys off cursor proximity. Zero new plumbing. On a phone the cat is `fixed` and claims are not, so scroll position *is* distance (§5.2, 1.2). |
| Hold still on a claim · **hold a finger on it** | **Scrub** (channel) | The core verb. Holding *still* while being hunted is the whole tension. |
| Click · **brief tap** | **Throw treat** at cursor position | Sends the cat into existing `fetch`. One button, one resource. On touch, `isTap` separates it from a hold — same gesture otherwise. |
| `Esc` | Truce (abort, restore) | Pillar 2. Non-negotiable. **No Esc on a phone**, so the toggle carries pillar 2 there alone — which is why §13 makes it permanent. |
| The arena toggle (§13) | Start / end the fight | The **only** entry point |

Three verbs. Everything else is emergent from their interaction. **No dash, no
attack button, no combo** — added complexity that adds no new decision.

> **2.0's table, for comparison, is two clicks and no verbs at all** (§15): point at a
> claim to send a kitten, click open page to throw. Both optional; the round resolves if
> the visitor never touches anything. That is not a simplification of the table above so
> much as a different answer to the same question — *what is the fewest inputs that still
> contain a decision?* — asked about somebody who did not come here to play a game.
>
> The rule this section states survived being rewritten, which is the best thing that can
> be said for it: an input has to add a decision. §15 has exactly one ("that claim, or
> leave them to it") and adds nothing else.

*Changed in 0.2:* 0.1 started the fight on a long-press of the cat, reusing the
existing tap-to-scamper affordance. Removed. An invisible gesture is not an opt-in
(§13.1), and two entry points would mean two places that have to get consent right.
The tap keeps its old job — the cat scampers — and starting a fight now takes a
button that says what it does.

### The decision, stated plainly
At any moment: *scrub now and gamble the interrupt, or spend a treat to make the
next window safe?* That is the game. If playtesting shows players never throw
treats, the pounce is too weak. If they throw immediately every time, too strong.

> **Revised in 1.3 — the treatless fight now has the decision too.** The pounce
> alone could not price treats: against a still player the cat recovers slower
> than the hold completes (§9.3's finding), so with zero treats the only lever
> was siege's regrow — and 1.2 shipped with ambush/trickster/sleepy at
> `regrowMs: 0`, meaning ~61% of fights had no clock at all. Every stance now has
> one (§9.3), so the treatless fight is a real decision again: *work near and
> risk the pounce, or work far and lose ground.* The numbers were derived, not
> invented — 4000→6000→8000→12000→15000ms, each a measured response to the
> arena8 harness (see §9.3).

> **Extended in 1.4 — the throw now has two targets, and this section is the test it
> had to pass.** The decision above was "scrub now, or spend a treat to make the next
> window safe". It is now "scrub now, spend a treat to make the next window safe, **or**
> spend it to punish the whiff you just read" (§5.4's counter). No new input: the same
> click, the same resource, aimed at the cat instead of away from it. It earns its place
> by the standard this section sets — an addition that adds a *decision* rather than a
> button — and the two intentions compete, because there is only ever one treat to spend.
>
> The paragraph above is also its own balance rule, and 1.4 keeps both halves: if players
> never throw, the pounce is too weak; if they throw immediately every time, too strong.
> The counter is deliberately gated to a 380ms window so that "throw at the cat" cannot
> become the default answer to everything.

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

> **Still the core verb in 2.0 — a kitten performs it now (§15).** Nothing measured in
> this section changed hands with it: `SCRUB_MS`, the stillness tolerance, the interrupt
> rule, the wash that shows progress and 1.2's whole touch derivation all describe what a
> *worker* does, and commander mode simply asks a different worker. `stepHold` in
> `CatArena.astro` is this section, extracted, with the pointer and each kitten as callers.
>
> Two things differ, and both are forced rather than chosen:
>
> - **The drift rule does not apply to a kitten.** For a pointer, movement is *intent* —
>   you moved off, so the hold restarts. A kitten's coordinates move whenever the *page*
>   does, because claims are in document flow and a kitten is fixed to the viewport like
>   the cat, so applying it would mean **scrolling cancelled the squad's progress**. In a
>   mode whose promise is that you can read while it plays, reading cannot be a penalty.
> - **A kitten's hold is `KITTEN_WORK_MS` (1000ms), not `SCRUB_MS`.** Not impatience: the
>   cat's pounce cycle with no walk to make is 1380ms for siege, so a 1400ms hold *loses*
>   that race, and a player only wins it by fleeing (0.7's finding, whose walk-back term a
>   camped kitten does not get). Measured before it was understood: a round parked on its
>   last claim for forty seconds. See §15.

**Purpose** The channel that creates tension.
**Player fantasy** Steady hands under pressure.
**Input** Pointer within `[PH 40px]` of a claimed element's centre, **moving less
than `[PH 6px]` per frame**, held. *(1.2: or a finger held on it — same tolerance,
same clock. What differs is not the input but where the distance comes from; see the
touch note below.)*
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
- ~~Touch: **not offered.**~~ 0.1 said "no hover, so hold-still is a press-and-hold,
  same timer", which sounds equivalent and isn't: a press-and-hold has no *aim*, so
  the tension of keeping a cursor somewhere while something walks at it has nothing
  left in it. Worse, a finger covers the thing it is holding. The build gates the
  toggle behind `(hover: hover) and (pointer: fine)` and says so in the widget —
  the same "not yet, and here's why" treatment reduced motion gets, rather than a
  button that starts a game you cannot play.

  > **Built, 1.2 — and both objections above were right, which is why the answer is not
  > an input adapter.**
  >
  > There is also a **third objection neither 0.1 nor I had noticed, and it is the fatal
  > one.** 1.0 measured the fight's counter as flee-and-hold: `SAFE_FLEE_PX` ≈ 423px, past
  > which the cat provably cannot arrive before a hold completes. A mouse pays **travel
  > time** to reach that distance. A finger teleports. So a naive port is not a fight with
  > weaker tension — it is a fight with **no decisions at all**, because every hold is free.
  > The two stated objections describe a worse game; this one describes no game.
  >
  > **What answers all three is one fact about a phone, measured rather than invented.** The
  > cat is `position: fixed` at the bottom of the viewport. Claims are in document flow. So
  > **scroll position *is* distance** — scrolling moves the claim relative to the cat without
  > the cat moving. At 390×844, measured across `/`, `/timeline/` and `/experience/`:
  >
  > | claim scrolled to | distance from the cat | safe past 423px? |
  > |---|---|---|
  > | high (150px down the screen) | 683–687px | **15 of 15** |
  > | centred | 413–420px | 0 of 16 |
  > | low | 161–178px | 0 of 16 |
  >
  > The threshold falls *between* the top band and the middle one, and I tuned nothing to
  > put it there — it is 423px meeting an 844px viewport. So **aim is back** (which claim you
  > work, and how high you put it), it **costs a gesture** (a flick), and §5.2 has said since
  > 0.1 that a scroll mid-hold interrupts it. The rule that made scroll-scrubbing illegal is
  > the same rule that now prices fleeing.
  >
  > **Occlusion is answered by moving the feedback, not the finger.** The 40px ring is drawn
  > at the contact point, which is the one place a fingertip is guaranteed to hide, so on a
  > coarse pointer the progress goes *into the claim*: §5.1's own wash deepens from 7% toward
  > the 26% that `cat-freed`'s drain begins at, so a filling claim visibly arrives at the tint
  > its release starts from. No new art (§0), and the claim was already the thing being
  > watched.
  >
  > **One structural change in the code, and it was smaller than the design.** `scrub.x/y` was
  > fed only by `pointermove`, and the one thing a finger does that a cursor cannot is arrive
  > somewhere and then emit nothing at all — so a finger held perfectly still fired
  > `pointerdown` and no `pointermove`, and no hold could ever register. Everything else was
  > already portable, because `stepScrub` polls the position every frame instead of reacting to
  > events. `pointerout` with a null `relatedTarget` even turns out to fire on finger *lift*, so
  > §5.3's "a cursor that leaves mid-leap is a whiff" transferred for free.
  >
  > **And three new rules, all of them the same discovery: on touch, a hold ends in gestures a
  > dwell never did.** A mouse cursor resting on a link does nothing. A finger resting on one is
  > a click, a text selection, a context menu and a drag — and §5.1 deliberately allows a claim
  > *inside* a link ("a `.frame` inside a card link is fair game"), so on a portfolio the core
  > verb landed on link after link.
  >
  > - **`isTap` (§10)** — `click` fires when a hold ends as well as when a tap does, so scrubbing
  >   spent a paw on release every single time. Duration decides.
  > - **`isWorking` (§10)** — the click that ends a hold on a claim is swallowed, so working on
  >   something is not pressing it. It reads a flag recorded *during* the hold, because a hold
  >   that completes frees the element and "is there a claim here" is false by the time the click
  >   arrives — which is how the first attempt still navigated away. A *tap* on the same link
  >   still navigates, because §11 promises the page keeps working.
  > - **`dragstart` refused on claims** — a long press on a link is the native link-drag gesture,
  >   which fires `pointercancel` and released the hold a few hundred ms in. It surfaced as
  >   `8 → 8 claims` from a hold that plainly should have taken one. Refused with a listener
  >   rather than `-webkit-user-drag`, because the drag source is the *link* and the claim is its
  >   descendant, so the CSS would have to go on somebody else's element.
  >
  > **One thing the browser does that cannot be fixed from here, only known:** Chromium applies
  > *touch adjustment* on mobile, snapping a tap that lands near a clickable target onto it. So
  > "tap open ground to throw" is fuzzier on a phone than the crosshair makes it on a desktop, and
  > a tap aimed between two cards may navigate. Nothing to do about it — but it is a reason §7.4's
  > `support-bribe` line matters more on touch, since it is the only teaching that survives the
  > loss of the cursor.
**Tuning levers** `SCRUB_MS`, `STILL_PX`, `INTERRUPT_PENALTY`, `TAP_MS` (touch only)
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
>
> **1.4 — the recovery window is now punishable, and this section is why it can be.**
> §5.4's counter lets a treat landing on a recovering cat stun it, and everything that
> makes that fair was already written here: the aim locks at the *start* of the
> wind-up, so the commitment is legible; a whiff costs the cat more than the attack
> gained it (§9.3's invariant), so a recovery is a real interval and not a frame; and
> the tell the player has been reading since 0.4 is the same tell that says "now".
> Nothing about the pounce changed — the counter is a *use* of it. Note the sequencing
> the two mechanics create together: the aim locks 680ms before the landing and the
> treat flies for 320ms, so the player who reads the wind-up correctly can already be
> throwing at ground the cat has not reached yet. The cat's own commitment is what
> makes it catchable.

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
>
> **1.4 — the counter: a second *target* for this throw, and the recover deviation above
> is now load-bearing.** A treat that lands **within `SWAT_RADIUS` of a cat that is in
> `recover`** swats it: `SWAT_STUN_MS` is **added** to the recovery it interrupted, and the cat
> cannot telegraph out of a recovery it has not finished. Added rather than *set* — the build got
> that wrong once and §10's row now says why, because "set the recovery to 900ms" hands the price
> of a §5.4 mechanic to whatever §9.3 chose for that stance's `recover` multiplier.
>
> This is not a fourth verb, and §3 is the section that has to be satisfied rather than
> worked around. §3 is proud of three inputs and rejects any addition that adds no
> decision — but this adds one exactly where §3 asks for it: spend the treat to make your
> **next** window safe (the lure, since 0.5) or spend it to **punish a whiff you just
> read**. Same input, same resource, two intentions, and they compete for one treat.
>
> **Two guards, both quoted from this document.** It works *only* in the recovery window,
> so it is a read rather than a button; and it costs a treat, so "throw at the cat every
> time" is not dominant — spending it on a punish is spending it *instead of* a safe hold.
>
> **The window is real, and it is `RECOVER_MS − THROW_ARC_MS` = 380ms.** The swat resolves
> on the treat's **landing**, not on the click, which is what makes it a skill window
> rather than a spell: the treat is in the air for 320ms, so you are aiming at where the
> cat will still be, during a recovery you had to see coming. Measured in the browser
> (`scratchpad/battle.mjs`): a throw at a recovering cat swats and the next telegraph is
> held off; the same throw at the same distance while the cat is *stalking* does nothing
> but lure — the control check reads the phase log and sees `eat`, which is 0.5's
> deviation doing its job.
>
> **Nothing teaches it.** §7.4 wants one mechanic found by exploration, and the tell §5.3
> already trained the player to read is the same tell that marks the punishable moment —
> so the knowledge the game has already given them is what unlocks it. The teach line
> still teaches only the scrub.

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
> ~~**"Both paths → sits on the cursor" is deferred.**~~ It is the one reward that changes
> *ambient browsing* rather than the fight, on a portfolio somebody may be reading, and it
> is not part of what §12 step 4 asks for. Worth building, worth building deliberately.

> **Built, 1.1 — the top state, and "deliberately" turned out to mean one CSS line.**
>
> Most of it already existed. `hunt()` has chased the pointer since long before the fight did:
> it closes on a cursor resting in the notice band, pounces, and "sits proudly next to the
> prey". The top state is that behaviour changed in three places — it closes **all the way**
> instead of stopping 26px short, it **holds** while the pointer is still instead of drifting
> off after 1.5s, and while perched it **stops being a hit target**.
>
> **That last one is the whole of what 0.6 was worried about.** On a mouse `.cat-svg` is
> `pointer-events: auto` so the cat can be petted. The touch path had already turned that off,
> in a comment that describes this feature exactly: a 48×30 body at the bottom edge *"swallows
> taps meant for whatever link is under it — a dead zone that moves"*. A cat parked **under the
> cursor** is that dead zone placed precisely where a click is about to land. So while perched
> it is scenery: the click goes through, `elementFromPoint` keeps returning the page — which
> `CatArena`'s `claimUnder` depends on — and the cursor resting on the cat can no longer pin
> `petting` on permanently, which would have quietly turned the cat's one interaction into its
> default state. **Measured: a link under a perched cat is still the click target, and clicking
> it navigates.** The reward costs the reader nothing, which is the only version of it worth
> shipping on a portfolio.
>
> **"When idle" means the *pointer* is idle.** A cat sitting on a moving cursor is chasing, not
> sitting. That needed a second timestamp — `prey.t` is re-stamped by every move, so it can say
> "recently seen" but never "has stopped" — and it is deliberately **not** gated on the
> sighting being fresh: a sighting expires after 2.5s because a moving cursor re-reports
> itself, and a cursor that has stopped is exactly the case this reward exists for. What
> replaces freshness is `prey.here`, because leaving the window is the one way a pointer stops
> existing without saying so.
>
> **Arrive at 4px, hold until 22px** — the same hysteresis §7.3's tiers needed, for the same
> reason. Without it, drift too small to break the perch is still larger than the snap, so the
> cat re-enters `chase` *while wearing* `perched`: walking and curled up at once, re-purring on
> every tremor of a hand resting on a mouse.
>
> **No new art (§0).** `.perched` carries pointer-events and nothing else. The look is
> `.dozing` — lv6's own curl-up, already written as "it has decided you're furniture,
> affectionately", which is precisely the pose this wants — plus one purr on arrival, fired
> from the perch because `pointerenter` can no longer reach it.
>
> **Reuses `withinNotice`.** The cat is bottom-anchored and moves in x only, so it can only sit
> *on* a cursor that is already low. The code commits to "one rule rather than two" for what
> the cat responds to, and this did not get to be the exception.
>
> **Two bugs of its own, both about letting go rather than sitting down**, and both found in
> the review pass rather than while building. Releasing keyed on *the pointer having moved*,
> which is not the same as *the perch not being held this frame*: a treat appearing, a scamper
> or a wall climb takes the cat out from under the cursor while the pointer has not moved at
> all, and the cat ran across the screen curled up and click-through. And the perch is a flag
> as well as two classes, but parking the cat cleared only the classes — so reduce-motion
> switched on mid-perch and off again left a stale flag, and the next frame measured against
> the 22px hold radius instead of the 4px snap, found itself already close enough, and skipped
> the arrival that would have set the pose. The cat then held the frame indefinitely, a few
> pixels off the cursor, wearing none of what it thought it was wearing.
>
> That second one is §13.5's `want`-versus-`on` desync in a different file, and the fix is the
> same shape: `unperch()` is the only thing that owns the perch, and everything that ends one
> goes through it. **The reward is three states and a hysteresis band, and every bug in it was
> in a transition rather than in a state** — which is the argument for writing the release
> conditions down as carefully as the arrival ones, and this section originally did not.

### 7.2 What losing costs
**Nothing permanent, by design.** Progress is session-only already
(`cat-game.ts:6`). Losing spends the treats you threw and nothing else — the
found-set is untouched, so exploration is never punished. The cost of losing is
that the cat *says something about it* (§8), which is the real sting and costs
the player nothing.

> **In commander mode there is no losing at all (§15).** A board the cat fills starts the
> same round again: no penalty, no rung, no record touched. This section's principle is
> taken further rather than contradicted — and the one thing 2.0 stores (the deepest round
> reached) is monotonic for exactly this reason. A bad afternoon cannot take anything away
> from a visitor. See §13.4's amendment for what is and is not remembered.

I considered staking affection on the fight (loss aversion is a strong hook). I
am **rejecting it**: on a portfolio, punishing a visitor for touching an easter
egg is a bad trade for a designer's engagement metric.

> **Corrected in 1.1 — a fight could cost you a find, and not by losing one.**
>
> The paw row is snapshotted when a fight opens and restored when it closes, so treats thrown
> are spent inside the fight only. The restore *toggled* every paw back to its snapshot value,
> which quietly made it a rollback as well as a restore. Leave a page with its treat still on
> the floor and it is credited on arrival at the next one ("you were there, which is the thing
> being rewarded") — and `SiteCat` is mounted before `CatArena`, so that credit lands *first*
> and the fight's restore then took it straight back off. The row lit a new paw, played the
> level-up, and un-lit it a moment later, leaving the HUD and `game.found` disagreeing until
> the next navigation re-synced them.
>
> The snapshot now restores and never rolls back: a paw filled during the fight keeps its fill.
> This section says losing must not cost you exploration. It meant the fight.
>
> The caption restore *two functions away* had already worked this out — it recomputes from the
> row rather than caching a string, and says why: *"SiteCat owns that state and may well have
> changed it while the fight was on (arriving on a new tab credits a treat)"*. The same file
> knew the case existed and the function next door did not honour it, which is the ordinary way
> this kind of bug happens.

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

> **Built, 0.9 — step 7.** Three tiers, not a curve: a continuous ramp would be
> smoother and would be exactly the invisible fudge this section exists to replace,
> because you cannot read a drift. Each tier has a tell — the bored cat **stops
> chasing you and washes** (SiteCat's existing `.grooming`, §0's "nothing new is
> drawn"), ambles rather than stalks, and waits until you have nearly finished
> before it can be bothered; the desperate cat winds up faster, commits as soon as
> you have started, hurries, and talks more often.
>
> **What aggression scales, and the one thing it must not.** Telegraph (downward
> only), stalk speed, pounce threshold, talk cadence. **Not recovery** — and that
> is the load-bearing decision, made against §10's invariant rather than by feel.
> Scaling recovery by the same factor is the obvious symmetric choice and it breaks
> "a whiff must cost the cat more than the attack gained it": at 1.4, ambush keeps
> 231ms of margin, **siege comes up 60ms short**, and trickster and sleepy scrape
> through on 10ms and 35ms — thin enough to be noise. Repairing that means raising
> three of four stances' recovery, i.e. retuning §9.3 to accommodate a §7.3
> feature. Clamping the telegraph scale to 1 costs nothing and leaves 140ms at the
> worst point in the whole space. It is also the more faithful reading of this
> table, which names "faster telegraph" for the desperate tier and nothing at all
> for the bored one: **a bored cat's tell is that it does less, not that it does
> the same thing slowly.**
>
> **The direction of the pressure, stated plainly**, because 0.7's note left it
> ambiguous ("where a losing player would otherwise be squeezed"). The mercy goes
> to the player who is behind. The *pressure* goes to the player who is ahead —
> when the cat is losing it gets desperate, so the endgame 0.7 found was free
> costs something again.
>
> **The hysteresis band had to be measured against the board, not chosen.** First
> attempt was 0.62/0.70 — 0.08 wide, which on a 15-claim board is **1.2 claims**,
> narrower than a single trade. The browser harness recorded
> `even→bored→even→bored→even` across four exchanges. A band has to be wider than
> the step size of the signal it damps, so it is now at least two claims on the
> smallest board `boardSlice` deals (0.15, with a test tying it to `MIN_BOARD`).
> Which is the right answer in fiction too: mercy that evaporates the instant you
> take one thing back was never mercy.
>
> ~~**Deliberately not scaled:** siege's `regrowMs`. It is board-level rather than
> behaviour, and this section is explicitly about what you can read off the animal.~~
>
> **1.4 — that decision is retracted, and it was the missing half of this tier.**
> 0.9 delivered the desperate tier as "faster telegraph", which is exactly what the
> table above says. But 1.0 then measured the fight's real counter and it is
> **fleeing**: hold further away than `SAFE_FLEE_PX` and the pounce provably cannot
> reach you. So the tier's one escalation escalated the threat a good player has
> already opted out of, while the regrow clock — the only pressure that reaches a
> *distant* player — stayed fixed at whatever the stance set. The fight was calmest
> exactly where it should tighten, and the tester's "the pace is slow" is loudest at
> the end, when the cat is cornered and out of ideas.
>
> So a cornered cat keeps `LAST_STAND_REGROW` of its regrow interval: **the walls
> close faster instead**, which is the one form of pressure that does not care where
> you stand. Measured in the browser at siege's 9000ms clock: **4975ms per claim
> once cornered against 9000ms even** (design says ×0.55, arithmetic says 4950).
>
> The 0.9 objection is answered rather than ignored. It is still readable off the
> animal — the tier already carries 1.3's colour, scale and posture; entering it now
> also raises a line ("the walls come in now") and a two-note rising sting, so the
> player *hears* the fight change gear at the moment the clock does. And it is still
> the mood, not the stance, doing the scaling: `regrowInterval` keeps the stance's
> identity (siege's 9000 vs a leaper's 15000) and the mood's urgency as separate
> factors, so the last stand cannot quietly retune §9.3 — the same separation 0.9
> protected when it clamped `telegraphScale`.
>
> **What bounds it:** §9.4's floor. Too small and a treatless fight stops being
> winnable; too near 1 and the tier is decorative again, which is the state this
> fixes. 0.55 is 8250ms at a leaper's clock, against a player who reclaims about
> one claim per 2s of holding plus travel — felt and out-run, which is the intent.
>
> **The last stand is an *event*, not a state, in the dialogue table** — and that
> distinction was forced by arithmetic. A climax line gated on "desperate **and**
> territory ≤ 20%" shadowed `rattled-20` completely, because the tier *enters* at
> 0.2; narrowing the band was not available either, since territory steps by
> `1/board` and any band under ~0.07 is **narrower than one claim** — the same trap
> 0.9's hysteresis fell into, in the same units. So the line fires on the
> *transition* into the tier, once, via a consumed flag.
>
> **1.3 — the tiers now show on the cat itself, because the playtest could not
> read them off the fight.** The finding was that the boss was indistinguishable
> from the ambient cat: mood changed numbers, and numbers are invisible. Each
> tier now carries a body tell — colour, scale and posture on `#site-cat`
> (`--boss-scale` wired to territory, washed up on the win and cleared on fight
> end) — and each stance carries a stance tell class (ambush's hunkered wind-up,
> siege's planted stance, trickster's shoulder-drop tell, sleepy's droop), all
> painted, none affecting layout (§11). The cat reads as *in a fight*, and its
> current mood/stance reads at a glance. This is the **Presence** half of the
> 1.3 fix; the sound half is §11.

### 7.4 Onboarding checklist
- [x] Core verb (scrub) available within 30s — it is the *first* thing, no unlocks
- [x] First beat unloseable: the opening `[PH 2500ms]` has aggression pinned to 0,
      cat only watches. Guaranteed first success. *(0.1 said 6s. Built at 2.5s: on
      the 8-claim board the query actually yields, 6s of grace is about four free
      scrubs — half the fight. 2.5s covers the first one, which is what this line
      was after.)*
      > **Corrected in 1.3 — the grace guaranteed a success, but nothing said what
      > to do.** The 1.2 playtest found the visitor did nothing for the whole
      > grace and the fight never started: `OPENING_GRACE_MS` only paused the cat,
      > it did not teach the verb. The teach line ("hold still on it. it comes
      > back.") now opens the fight at `OPENING_LINE_MS` 1600, inside the grace,
      > gated to the cold case (zero frees, zero spends) so it cannot be
      > misread as commentary on play. The harness measures it: the first words
      > are the teach line at 1412–1648ms, before the grace ends.
- [x] Each mechanic in a safe context: pounce introduced only after one clear
      scrub; treats explained by the cat *asking* for one, not by a tooltip.
      *(0.5: the pounce half holds — the opening grace guarantees one clean scrub. The
      treat half was **not built**, because the cat cannot ask for anything until §8's
      dialogue exists in step 4.)*
      *(**Ticked in 0.9**, and it should have been ticked in 0.6 — `support-bribe`
      ("you could just bribe me.") landed with the dialogue in step 4 and this line
      was never updated, so the doc has been calling its own weakest seam unbuilt for
      three versions. Step 7 gave it the right neighbours: §8.2's other supporting
      lines now gate on the bored tier, and this one deliberately does not, because it
      fires while you still have a treat in hand — the one case §7.3 refuses to call
      bored. Being pitied while you still have options reads as condescension; being
      asked for a bribe reads as an opening.)*
- [x] One mechanic found by exploration: nothing says the cat can't pounce during
      `fetch`. Players discover the safe window themselves — the best moment
      available, so it must not be spoiled by UI
      *(**A second one in 1.4, and it is the same knowledge used the other way
      round.** §5.4's counter — a treat landing on a cat in `recover` stuns it —
      is taught by nothing. The tell §5.3 already trained the player to read is
      exactly the tell that marks the punishable moment, so the discovery is not
      new information but a new *use* for information the game already handed
      over. That is why it does not need a line: the teach line still teaches
      only the scrub, and a player who never throws still wins (`first-run.mjs`
      is the check on that). The rule "must not be spoiled by UI" applies
      unchanged — there is no crosshair change, no dimming, no hint.)*
- [x] Ends on a hook: on a win, the cat re-claims **one** element and walks off.
      Unfinished business, no modal, no "play again?" button
      *(**Still true in 1.0**, and §9.4's ladder was built around it rather than through it.
      §9.4 asked for "an ending that asks a question", which is a prompt by another name and
      would have contradicted this line — so instead the question is asked by the toggle that
      is already there. The cat names its terms and leaves; the next press is the answer.
      Nothing was added to the ending except a sentence.)*

      > **Corrected in 1.1 — "one element" was one element plus whatever else happened.**
      >
      > The ending is a *beat*, not a stop: the loop keeps running for `WIN_BEAT_MS` so the
      > re-claim can be seen and the line can be read. Only the dialogue was silenced for it,
      > and everything else carried on — the cat could wind up and pounce again inside its own
      > exit and take a second and a third element, a siege board went on regrowing underneath
      > the parting line, a click still threw a treat and spent a paw on a decided fight, and
      > the player could scrub the one re-claimed element straight back off, leaving the cat
      > gloating about something no longer on screen. On a loss the cat kept hunting somebody
      > who had already lost.
      >
      > Nothing new starts once the fight is decided: no new pounce, no regrow, no throw, no
      > scrub progress. **A pounce already in flight still lands** — it was committed before the
      > ending, and freezing a cat mid-air to enforce a rule about *starting* things would be a
      > worse lie than the one being fixed. What makes this a bug rather than a tuning question
      > is that the number in this line is the whole gesture: "one" is what makes it unfinished
      > business instead of a fanfare, and it was only ever one by luck of timing.

---

## 8. Cat dialogue

Rules: **never more than 7 words**; lower-case, no exclamation marks (this cat
does not shout); the ribbon is `aria-hidden` like the rest of the cat, so nothing
here may carry information the player needs. Never the same line twice running,
which is the rule the correction below has to be read against.

> **Corrected in 1.1 — the ribbon could speak invisibly.**
>
> A line goes up, and `LINE_MS` later it fades: the `show` class comes off and a second timer
> hides the node 220ms after, guarded on `show` still being absent so a newer line is not
> hidden under one. But a new line un-hides the node and then waits a frame to add `show`, and
> a hide timer landing in that one-frame gap saw no `show`, hid the node, and the line played
> out its full two and a half seconds to nobody — while still counting as *said*, so the
> no-repeats rule above suppressed the same line when the cat next reached for it. The node is
> now un-hidden inside the frame as well as above it, so the order stops mattering.
>
> Worth naming because of where it landed: a cat with little to say — a parked cursor, a
> stalemate — often has exactly one line for the situation, and this ate precisely those.

### 8.1 Bluffing — opening and while winning

| Stage | Line |
|---|---|
| Fight start | `this is my page now.` |
| **Fight start, cold visitor (1.3 — the teach line)** | `hold still on it. it comes back.` |
| Start (alt) | `you were done reading anyway.` |
| First claim planted | `i have been very patient.` |
| Territory 90% cat | `i could do this all day.` |
| Territory 75% cat | `you are making this loud.` |
| After a successful pounce | `mine. still mine.` |
| Player misses a scrub twice | `try holding stiller. or don't.` |
| Player has 0 treats | `oh. you brought nothing.` |
| Territory back to 100% (won a round) | `as it was. as it should be.` |
| **Dead band — territory 50–75% cat (1.3)** | `fine. we can share.` (filler, so a fight never opens silent) |

> **1.3 — the fight had no first words, and the playtest could not start it.**
> The cold-visitor finding was two defects in one: `pickLine` returned null in
> the dead band (territory between the bluff lines and the rattled ones), so a
> fight could open with *no line at all*, and the fight-start lines were
> territory-flavoured ("this is my page now.") rather than instructive. The
> teach line is gated to the cold case (zero frees, zero spends) so it only ever
> says the verb to someone who has not done it yet; support-idle is re-gated to
> fights with history (`freed > 0 || spent > 0`) so it cannot swallow it; and the
> dead-band filler ends the silent-fight defect. All still ≤7 words, lower-case,
> no exclamation marks.

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

> **1.4 adds one line here, and it had to be an *event* to be allowed in at all.**
> "the walls come in now." marks §7.3's last stand — the moment the cornered cat's
> regrow clock speeds up. Written first as a *state* ("desperate **and** territory
> ≤ 20%") it shadowed `rattled-20` completely, because the tier is *entered* at 0.2
> and then lasts: every rattled line below it became unreachable in real play while
> remaining reachable in the abstract state space a test sweep explores. Narrowing
> the band was not available either — territory steps by `1/board`, so any band
> under ~0.07 is **narrower than one claim**, which is 0.9's hysteresis arithmetic
> in the same units. So the line fires on the *transition* into the tier, once.
>
> That distinction has a cost the build had to pay properly. An event needs a
> handover, and the first handover was "cleared by whoever reads the fight state
> first" — but the mood pass reads it every frame while the dialogue returns early
> during §8's talk gap, so the mood ate the event and dropped it, and the loudest
> line in the game could only be said if the tier happened to be entered inside one
> of the ~16ms windows where the cat was already free to speak. **Only the dialogue
> spends it now**, so the line arrives late rather than never, and it is dropped if
> the cat stops being cornered before it is said — a line about the walls closing
> has no business arriving after they have opened again. The sound sting still marks
> the exact moment, because it fires where the clock actually changes.

### 8.4 Endings

| Ending | Line |
|---|---|
| Player wins | `keep it. it's drafty anyway.` |
| Player wins with 0 treats spent | `you didn't even bribe me.` |
| Cat wins | `you may read on. quietly.` |
| Truce (Esc) | `sensible.` |
| Truce during cat's recovery | `...that was cowardly. respect.` |
| Win, having already earned the collar | `both, then. show-off.` |

**Added in 1.0 for §9.4's ladder.** These are not decoration on the feature — with no modal
and no button, *they are the feature's whole voice*: the offer of a harder rematch is a
sentence, and the acceptance is pressing the toggle again.

| Ending | Line |
|---|---|
| Win, and a rung left to climb | `again? i keep one back.` |
| Win with every treat withheld | `i kept everything. you still won.` |
| Loss on a raised rung | `take one back. go on.` |
| A handicapped fight *opening* | `you asked for this one.` |

Priority is load-bearing rather than tidy, and the order is: floor, collar, clean, offer,
generic. A rung line placed under the generic `win` would never be reached — the trap
`support-last` fell into in 0.9. The offer fires while `rung < found`, evaluated *before*
`finish` moves the ladder, so the cat is naming terms it has not yet imposed; move the rung
first and a win at the top would announce a paw it had already taken.

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

> **Built, 0.7.** Rolled per fight from the board's own seed, so a fight is reproducible.
> Every stance is multipliers on the numbers §5 already had, plus two switches (siege's floor
> pin and its regrow clock) — a stance with its own mechanic would be a different game rather
> than a different opponent, and the test asserts the shape of the table to keep it that way.
>
> **Two numbers were set by an invariant, not by taste.** A whiff has to cost the cat more
> than the attack gained it (`RECOVER × recover > TELEGRAPH × telegraph + LEAP`), or a stance
> has no reason ever to stop pouncing. Trickster's longer wind-up broke it at recover 1.0, and
> sleepy's broke it badly — so 1.2× and 1.55×. The sleepiest cat would otherwise have been the
> one that pounced most often.
>
> **The finding worth keeping: no stance's pounce can take the page from a stationary player.**
> A landed pounce resets your hold, but the cat must then recover before it can commit again —
> 700ms baseline, longer for every stance because of the invariant above. By the time it is
> ready your hold has already completed, so after the first hit the player wins every
> subsequent exchange. Ambush is the *worst* at this, since its 1.45× recovery is precisely the
> "punish the whiff" counter this section promises. What can take a page is **siege's
> regrowing board**, which does not care what you are doing.
>
> That is not obviously wrong — a player who holds still is playing the counter correctly — but
> it means the pounce is pressure, not a win condition, and §7.3's unbuilt rubber band is where
> a losing player would otherwise be squeezed. Worth a playtest before deciding it is a feature.
>
> **0.9: built, and that last sentence was ambiguous about which way the squeeze runs.** §7.3
> gives *mercy* to the player who is behind. The pressure goes to the player who is **ahead**:
> the cat that has been pushed under 20% gets desperate, winds up faster and commits earlier,
> so the free endgame described above now costs something. Measured at the same constant
> provocation, the bored cat's commitment rate falls to zero while the desperate cat's rises.
> Still worth a playtest — what a harness cannot tell me is whether the mercy *reads* as mercy.
>
> Trickster has a second-order cost nobody designed: a bluff spends the cat's time and takes
> nothing, so against a still player it *loses* ground faster than it gains. Stances differ in
> how much of their aggression converts, not only in how they feel.
>
> **1.3 — every stance has a clock now, and the numbers are derived, not chosen.**
> The playtest finding was that ~61% of fights had no clock: only siege regrew,
> so the treatless fight's decision (§3) simply did not exist against ambush,
> trickster or sleepy. The derivation was a measurement loop against the arena8
> harness: at **4000ms** the board grew 6→10 claims and the fight was unwinnable;
> **6000ms** hovered at the boundary (some wins, all siege); **8000ms** put the
> mobile stances *below* the floor — the harness reclaims at ~6s/claim once
> travel and dodging count, so an 8s regrow nets out at zero and the fight truces
> without a win; **12000ms** still treadmilled when pounces landed; **15000ms** is
> where a treatless fight clears (harness wins at 21–40s, and the gate passes 4/4).
> 15000 is deliberately the slowest clock that still counts as one — §10's own
> rule says beyond 15000 the stance has no teeth. Ambush and trickster are 15000,
> siege keeps 9000 (it is the stance *built* around the board, so it keeps the
> fastest clock), sleepy stays 0 ("a gift with a clock is not a gift" — §9.3's
> own counter-play table says sleepy is a joke fight, and the joke is that there
> is no clock).
>
> **1.3 — the stances now show, not just differ.** The other half of the
> presence fix (§7.3): stance tell classes on the boss so a fight's stance is
> readable at a glance, and the trickster's feint has the tell §9.3 always
> promised ("a bluff gathers without dropping its shoulders").
>
> **1.4 — one signature move each, so the stances differ in what they *do* and not
> only in what they are multiplied by.** Every stance was still the same cat with
> different coefficients, and this table's own promise is "same verbs, different
> counter-play". Three moves, each built on machinery that already existed:
>
> - **Siege — the sweep ("the walls close").** Every `SIEGE_SWEEP_EVERY`-th regrow
>   takes **two** claims instead of one, and they are **adjacent in document
>   order**, so it reads as a wall moving rather than as the clock ticking twice.
>   Siege's whole premise is that the board fights for it, and until now that was
>   one clock and nothing else — the most distinctive stance had the least
>   distinctive moment.
> - **Ambush — the pin.** A *landed* pounce anchors the cat on the spot for
>   `AMBUSH_PIN_MS` within `AMBUSH_PIN_PX`, reusing the leash a thrown treat
>   already uses. Ambush is the one that actually hunts you, and a hit paid it
>   exactly what a siege clock tick pays — one element — despite costing it a read,
>   a commitment and a whiff risk. Now it *stands over what it took*: re-scrubbing
>   that claim means waiting the pin out or spending a treat to lure it off, which
>   turns a hit from a subtraction into a problem the player has verbs for. Ambush
>   only: siege is already pinned, sleepy is a gift, and a second signature would
>   blur the trickster's.
> - **Trickster — the double tell.** A feint is sometimes followed immediately by a
>   real telegraph (`TRICKSTER_DOUBLE`), so its tell is the one you cannot fully
>   trust. Reuses `boss.feint`; nothing new drawn. It needs no new visual either,
>   and that is a happy accident of how the tell was already built: the feint's
>   class going false **is** the shoulders dropping, so a re-commit is a visible
>   state change arriving exactly when the real wind-up starts, and `boss.since`
>   resets so the player still gets a full telegraph to read. What is taken away is
>   the safety of having read the *first* one.
>
>   **And it repairs the second-order cost recorded above, which is worth naming
>   because that cost was never intentional.** 0.9 noticed that a bluff spends the
>   cat's time and takes nothing, so against a still player the trickster *loses*
>   ground faster than it gains — the stance whose gimmick is deception was the
>   weakest one for having it. A third of its feints now convert into real attacks,
>   so the gimmick costs it less. This does make trickster stronger than in 1.3, on
>   purpose, and `arena5` caught the size of it from the side: with more of its
>   wind-ups converting, the board fills faster, and a harness that never frees
>   anything now reaches §2's loss inside its own observation window. Once that was
>   fixed (treats in hand, never thrown), the rate measures where it should:
>   **11 feints in 33 wind-ups — 33% against the spec's 30%** — with three of them
>   going straight back into a real telegraph, which is the double tell showing up
>   in a phase log for the first time.
>
> **The sweep's bill, which is the load-bearing part.** The first version simply
> took two on the beat and left the clock alone. Measured in a browser, that raised
> siege's rate to 1.5 claims per 9000ms against flee-and-scrub's 0.164 claims/s —
> and the fight **plateaued at six claims for ten straight exchanges**, neither won
> nor lost, which is worse than either. So `regrowInterval` now charges the cat
> **one interval per claim it takes**: a sweep of two waits twice. The long-run rate
> is then identical to 1.3's whatever the cadence — 3 claims per 3 intervals — so
> the sweep buys *texture* (a squeeze, then a lull) and provably not difficulty, and
> §9.4's floor is safe by construction rather than by hoping. Measured after the
> fix: **9001ms per claim on the sweep against 9000ms on a single tick.**
> `SIEGE_SWEEP_EVERY` therefore tunes feel only, which is the whole reason it can be
> tuned by feel.
>
> **And a finding about siege that nine versions of harness missed: it has to be
> played as siege.** `arena8`'s floor section forces an **ambush**, so every
> browser measurement of the fight has been against a cat that *leaps* — and the
> flee-and-hold counter 1.0 discovered is the counter to a leaper. Against siege,
> luring is 4 of every 6 seconds spent waiting for a cat that physically cannot
> come. Played that way it plateaus; played the way its own premise implies (take
> whatever is furthest from the floor it is stuck on, hold, repeat) the same fight
> is **7 reclaims and a win in 23s**. That is this table's promise coming true —
> the stances demand different play, and a harness that plays them all the same way
> is measuring its own strategy. `scratchpad/battle.mjs` now measures siege as
> siege.

### 9.4 Handicap ladder

> **Manual mode only, as of 2.0.** A rung is a stake, and a commander has nothing to stake:
> §15's rounds are its difficulty curve, and its escalation is the clock and the cat's
> temper rather than treats withheld. The floor this section fought for is not abandoned —
> it is restated for a squad in §15.5 (`MIN_REGROW_MS`, charged per claim) and it is still
> the bound every escalation number is checked against.
~~**Unbuilt as of 0.7**, and the only piece of §9 that is. It needs an ending that asks a
question, and every ending currently restores the page and gets out of the way.~~

On a win the cat offers a rematch at `treats - 1`. Self-selected difficulty
ratchet, no menus, and it converts the win into a decision rather than an
endpoint. Bottoms out at zero treats — a pure-skill fight for whoever wants it.

> **Built, 1.0 — and the blocker was not the one this section named.**
>
> "It needs an ending that asks a question" was the wrong diagnosis, and following it would
> have broken something better. §7.4 ships the opposite as a deliberate decision: *"ends on a
> hook — no modal, no 'play again?' button"*. An ending that asks a question is a prompt, and a
> prompt is the one shape this ending is not allowed to take.
>
> The question was already on screen. **§13's toggle is the only way into a fight and it never
> goes away**, so a rematch does not need to be offered by a new control — it needs the next
> press to *mean* something different. The ladder is therefore a piece of session state that a
> win raises and a loss lowers; the cat names its terms on the way out; pressing the toggle
> again is the acceptance. No modal, no timer, no new control, and §7.4's ending is untouched:
> the cat still takes one thing back and walks off.
>
> **A loss eases the rung back down.** A pure ratchet reads as a truer difficulty setting and
> can strand somebody on a rung they beat once by luck, which is precisely what §7.2 forbids.
> The selection stays the player's — the rung only ever *rises* by winning, and nothing makes
> you press the button again.
>
> **The ceiling is your own exploration.** `nextRung` clamps to the treats you have actually
> found, so a visitor who found two can never be handicapped three. Without it the ladder
> would punish the behaviour §9.5 rewards.
>
> **The handicap is revealed as the fight opens**, not before the press: a withheld paw appears
> in the HUD and the cat says what it has done. The note under the toggle stays strictly for
> "why you cannot play". No §13.5 conflict — that failure state is about the button and the
> arena disagreeing on *on/off*, which is all the button ever claims.
>
> **The withheld paw needs its own face.** An unfilled paw already means two things — "not
> found" outside a fight, "spent" inside one — and a third meaning wearing the same face would
> make the HUD lie about the one number the visitor is being asked to plan around. Hollow: the
> accent says *yours*, the missing fill says *not in hand*. Same 9px shape, no new art (§0).
>
> **Withheld from the right, deterministically**, which has a consequence worth being
> deliberate about: it takes a *specific treat*, not a count. A rung-2 fight is missing two
> particular tools from §9.5's loadout, and which ones is a fact about where you have been. The
> same found-set always yields the same handicapped fight — the bargain §9.2's seed makes for
> the board.
>
> **One line became unreachable and had to be rescued.** With the offer sitting above it, every
> win path was caught by floor, collar, clean or again, and `win`'s "keep it. it's drafty
> anyway." could never fire. Gating `win-clean` on `found > 0` reopens the one case that
> belongs to it — a visitor who found no treats and was never offered anything to hold back —
> and fixes a pre-existing slip on the way: crediting somebody with not bribing the cat when
> they had nothing to bribe it with is a small dishonesty, and §8's tone rules exist to catch
> exactly that.
>
> **Measured in 1.1 — the floor has no margin, and that is `isLost` working as §2 writes it.**
> Across every treatless fight the harnesses have played, the pattern is exact: **runs with
> zero stalled exchanges won; the runs with one stall lost.** `isLost` is territory at 100%
> *and* nothing left to throw, and §2's reasoning for the second half is that ammo is what lets
> you dig out of a bad position — so at the bottom rung there is no second half, and one
> seven-second exchange where the board offers nowhere far enough to hold is the whole fight.
> 1.0's "a treatless win is *fast*" and this are the same fact seen from two sides.
>
> Recorded rather than changed. It costs nothing permanent (§7.2), the rung is already at the
> floor so a loss moves nothing, and pressing the toggle is the rematch. But it is the sharpest
> difficulty edge in the build and it is invisible in the design — nothing on screen says that
> your last treat was also your margin — so it belongs near the top of what a playtester is
> asked to react to. **Two harnesses reported it as a broken feature before it was understood
> as a property**, which is the usual sign that the feedback is missing rather than the number.
>
> **1.3 — the harness gate needed the rematch budget the ladder already was.** The
> cold-visitor gate (`scratchpad/first-run.mjs`) plays treatless fights and must win
> one. The measurement: each fight rolls a stance and a seed, and per-fight win
> rate lands at roughly a quarter to a half depending on the stance (pinned siege
> converts fastest — a claim scrolled high stays beyond the cat's reach; mobile
> stances chase the cursor, so the harness lures between holds). A single fight
> passes ~25–50% of the time; the gate tries up to six and passes 4/4 runs. This
> is §9.4's rematch in action rather than a widening of the timeout: the stall
> loss the floor is known for (§1.1's "one stall loses") is exactly what the next
> press answers. Recorded here so nobody reads the gate's loop as a hack — it is
> the ladder's own recovery, applied to the measure of the ladder.

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

> **Built, 0.7 — and the biscuit's line resolved into two clocks.** "Shortest interrupt
> immunity but cat stays put longest" reads as a contradiction only while `lureDuration` is one
> number. It is two: **immunity** (how long it cannot pounce) and **occupancy** (how long it
> stays at the treat). The biscuit's immunity ends first and an **anchor** holds it in place for
> the rest — and that anchor is the same mechanism as the feather's "plays with it where it
> lands", so two treats share one piece of machinery rather than each getting a special case.
>
> Built with the shapes already differing (that shipped in 0.5) and now the behaviour too. The
> balance risk this section names is a test: for every treat there must be another that beats
> it on some axis, so none is strictly best and nobody has a reason to tab-hunt.

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
| `AGGRO_BORED` | 0.6 | Visible mercy without becoming a walkover | <0.4: cat stops being a threat |
| `AGGRO_DESPERATE` | 1.4 | The endgame has to cost something — 0.7 found the cat has no answer to a still player once it is behind | 1.0: nothing changes when the cat is losing, which is where the fight goes slack |
| `AGGRO_PATIENCE` | 0.75 | ±0.3 on the pounce threshold across the tier range: enough that a bored cat visibly stops taking the openings an even one took | 0: the tiers differ only in wind-up, and willingness is the readable half |
| `MAX_THRESHOLD` | 0.9 | Ceiling on stance + mood patience combined. `provoked` caps progress at 1, so 1.0 does not make the pounce rare — it deletes it, which a bored sleepy cat hits exactly | 1.0: the mechanic switches itself off for one stance/tier pair, silently |
| Hysteresis band | 0.72/0.51, 0.20/0.42 | Must be wider than one claim on the smallest board (`MIN_BOARD` 10 → 0.10–0.15 territory), or it is a rounding difference rather than damping. 1.3 retuned the bands when the board shrank 14→10: `BORED_LEAVE` 0.52→0.51 and `DESPERATE_LEAVE` 0.35→0.42 keep both bands ≥2 claims / ~0.20 wide on the ten-claim board (0.72−0.51 = 0.21 ≈ 2.1 claims; 0.42−0.20 = 0.22) | 0.08: measured as 1.2 claims on a real board, and the tier strobed on alternate trades. Bands <2 claims on `MIN_BOARD`: the mood flickers mid-exchange |
| `GROOM_EVERY_MS` | 5200 | ~3× the 1.5s wash, so the beats read as an animal losing interest | <3000: constant washing, which reads as a stuck loop |
| `LADDER_FLOOR` | 0 | §9.4's bottom rung: every treat withheld, "a pure-skill fight for whoever wants it". A constant rather than a literal because whether that fight is *winnable* is measured, not assumed — see §12's step 8 note | >0: the hardest fight still hands you a tool, and the top of the ladder is not a skill test. Or 0 while a treatless fight cannot actually be won, which is worse: a rung reachable only by winning your way to a wall |
| `PERCH_STILL_MS` | 620 | §7.1's top state waits for the *pointer* to stop. Long enough that crossing the cat's strip on the way somewhere else never summons it; short enough that stopping to read feels answered | <300: the cat lunges at a cursor merely passing through. >1500: it never seems to notice you stopped |
| `PERCH_SNAP_PX` | 4 | *On* the cursor rather than beside it — the chase that already ships stops at 26 and calls that "beside" | ≥26: the top state is the old reward held longer, not a new one |
| `PERCH_BREAK_PX` | 22 | Movement that ends the perch, and the hold radius once perched. Above a resting hand's jitter, well under a deliberate move | ≤`PERCH_SNAP_PX`: the cat re-closes a gap it is sitting in, walking and curled up at once. >60: it clings while you are trying to work |
| Fight length | 90–180s | One coffee. Longer and it competes with the portfolio | >4min: nobody finishes |

Added in 0.3, from building steps 0 and 1. Still `[PH]` — built and measured is not
the same as playtested:

| Var | `[PH]` | Rationale | "Broken" looks like |
|---|---|---|---|
| `STILL_PX` | 6 | A hand on a trackpad is never perfectly still, and a mouse jitters a pixel or two. Must be a *distance*, not per-axis, or a diagonal drift passes at 1.4× | 0: the mechanic reads as broken rather than demanding. >12: drifting across a block still clears it |
| `TAP_MS` | 260 | Touch has one gesture for §3's two verbs, because `click` fires when a *hold* ends as well as when a tap does. Above a real tap (~80–150ms), far below `SCRUB_MS`. Splits both `isTap` (does this throw?) and `isWorking` (is this click swallowed?) | ≥`SCRUB_MS/3`: a deliberate hold reads as a tap and spends a treat. <150: a slow thumb can no longer throw at all |
| `MAX_TILT` | 0.5° | A nudge, not a glitch — and the ceiling is structural: a rotated full-width block is wider than the page | >2°: horizontal scrollbar on a phone |
| Claim wash | 7% accent | The most that keeps `.rail` (mono, `--color-muted`) over AA on its own tinted background. 12% read better and measured 4.15:1 | 0%: invisible on a monochrome page. >10%: fails the §11 contrast gate |
| Claim outline | 2px dashed, 62% accent | Carries the read that the wash can't afford to. Painted, so it costs no layout | 1px at 55%: too quiet to find claims by |
| `MIN_CLAIM_AREA` | 900px² | A `.rail` line is ~2000px² and reads fine; below this are sprite stubs and empty spans | Too low: claims land on 9px dots and the game looks broken |
| Board size | 8 claims on the homepage | What the §4.1 query yields at 0.55 after excluding protected furniture and de-nesting | <4: the fight is over before it starts. >20: the page is unreadable, breaking pillar 2 |
| `MIN_BOARD` / `MAX_BOARD` | 10 / 14 | *Added 0.6, tightened 1.3.* The board prefers what is on screen (§4), extends below the fold only when the screen cannot hold a game, and is capped at the row above's ceiling. 1.3 shrank the caps 14/20 → 10/14: the playtest review found the board dealt ~8 candidates at 1280×900, so 55% claimed ≈ four claims — a nine-second fight — and the regrow clock 1.3 added needs the board small enough that a treatless clear is a real, finite race (see §9.3's derivation) | Uncapped: `/timeline/` deals 24 claims and a fight runs past two minutes. Too small: the fight is over before it starts |
| `LINE_MS` / `LINE_GAP_MS` | 2600 / 1200 | A line up long enough to read twice, and silence long enough that each one is an event | No gap: the cat narrates and the ribbon becomes a log |
| `WIN_BEAT_MS` / `LOSE_BEAT_MS` | 2200 / 1600 | Long enough for the parting line and §7.4's one re-claim; the loss is shorter because nobody wants to sit in it | >4000: the page feels held hostage after the game is decided |

Added in 0.4, from building the pounce:

| Var | `[PH]` | Rationale | "Broken" looks like |
|---|---|---|---|
| `AIM_LEAD_MS` | `TELEGRAPH_MS + LEAP_MS` (680) | The aim locks when the wind-up starts, so the lead has to cover the whole commitment. This is the number that makes the telegraph a warning rather than a delay | Locking at the *end* instead: the telegraph stops being dodgeable and the game is 260ms of reaction time (this is what shipped first) |
| `STALK_SPEED` | 170px/s | Slower than a hand, deliberately: fleeing must work, since "move the pointer" is one of only three inputs. The site cat walks at 42px/s and would never arrive | >400: nowhere is far enough, and the fight becomes a tie for the mouse. <80: the cat is scenery |
| `HIT_RADIUS` | 46px | Dodging it means covering 46px inside 680ms — ~68px/s, far under a flick and far over the 6px a hold allows | Too large: dodging needs a sprint. Too small: the cat can never catch anyone |
| `OPENING_GRACE_MS` | 2500 | Covers the first scrub, per §7.4's "guaranteed first success", on the board that actually exists | 6000 (0.1's number): four free scrubs, half the fight |
| `OPENING_LINE_MS` | 1600 | *Added 1.3.* When the teach line opens the fight — inside the grace (so the cat is still harmless) but soon enough that a cold visitor who does nothing still hears the verb before the grace ends. Measured: the harness sees the line at 1412–1648ms, always inside 2500 | ≥`OPENING_GRACE_MS`: the line arrives after the cat is live, and the grace was wasted. Too small: no time to read it |
| Landing point | ~84% of the hold | Where a pounce provoked at 0.35 touches down. Late enough to read as deliberate, and short of the 0.9 that would feel like robbery | ≥1.0: the cat can never interrupt anything, so the threat is theatre |

Added in 0.7, from building stances and the loadout:

| Var | `[PH]` | Rationale | "Broken" looks like |
|---|---|---|---|
| `SLEEPY_CHANCE` | 0.08 | A joke fight is a good memory and a bad expectation: common enough to be told about, not common enough to be what the game is | >0.2: the game's mode is "nothing happens" |
| Stance `telegraph` | 0.78–1.6 | Ambush is hard to read, sleepy is a stroll. Floored so no stance drops the wind-up under human reaction time | <300ms absolute: unreactable, so the stance turns the game off rather than changing it |
| Stance `recover` | 1.0–1.55 | Set by the whiff invariant, not by feel — see §9.3 | Below the invariant: pouncing is free and the cat should never stop |
| `feint` (trickster) | 0.3 | A tell you can learn needs to be the exception | ≥0.5: a coin toss, and there is nothing to learn |
| `regrowMs` (siege) | 9000 | The only pressure that does not care what the player is doing, and the only reliable way to lose | <5000: unwinnable churn. >15000: the stance has no teeth at all |
| `regrowMs` (ambush, trickster) | 15000 | *Added 1.3.* Every stance gets a clock (the playtest found ~61% of fights had none). Derived by measurement, not chosen: 4000 → board grew and the treatless fight was unwinnable; 6000 → boundary; 8000 → dead-even treadmill against the harness's ~6s/claim reclaim rate (net zero, truce); 12000 → still treadmilled under pounces; 15000 → treatless fights clear (harness wins 21–40s). 15000 is the slowest clock that still counts — this row's own rule says beyond it the stance has no teeth. Siege keeps 9000 because it is the stance *built* around the board | <8000: mobile stances join the unwinnable-churn set. >15000: the clock is decoration and the stance has no teeth |
| `regrowMs` (sleepy) | 0 | The gift stays a gift — a clock would make the joke fight a let-down | >0: sleepy is no longer the joke |
| Treat `immuneMs` | 1600–3000 | Every treat must cover one full scrub or it is not a resource | <`SCRUB_MS`: the treat buys nothing |
| Treat `lureMs` | 1800–4000 | Occupancy, which is a different clock from immunity — see §9.5 | All equal: the loadout is five skins on one treat |

Added in 0.5, from building the treat:

| Var | `[PH]` | Rationale | "Broken" looks like |
|---|---|---|---|
| `LURE_MS` | 3000 | Head-down time once the cat arrives. §5.4's success condition is the floor: below `SCRUB_MS` the resource does not do the one thing it exists for. The cat is also out of the fight for the walk over, which is the player's to place | ≤1400: a treat buys nothing and the economy is decoration. >6000: one treat ends the fight |
| `THROW_ARC_MS` | 320 | Long enough to read as thrown, short enough not to be a cutscene | >600: every throw is a pause |
| `FETCH_SPEED` | 186px/s | Lifted from SiteCat's own fetch speed, where the comment reads "it can see food". Faster than `STALK_SPEED` 170 on purpose: it hurries for food and takes its time with you | ≤`STALK_SPEED`: the contrast disappears and so does the characterisation |
| `FETCH_REACH` | 14px | How close it has to get before eating starts | Too large: it eats from across the room |
| `RECLAIM_ON_HIT` | 1 | A landed pounce takes back the most recent thing you earned — legible as cause and effect where a random element is not | >1: one mistake undoes a minute of play |

Added in 1.4, from the last stand, the signature moves and the counter:

| Var | `[PH]` | Rationale | "Broken" looks like |
|---|---|---|---|
| `LAST_STAND_REGROW` | 0.55 | How much of its regrow clock a cornered cat keeps (§7.3). The tier's *other* half: 0.9 gave it a faster wind-up, and 1.0 then measured that the counter is fleeing — so the only pressure that reaches a distant player is the clock. Bounded by §9.4's floor above and "no felt climax" below; 8250ms at a leaper's 15000 against a player reclaiming ~1 claim per 2s of hold plus travel. Measured in the browser at 4975ms against siege's 9000 | ≤0.3: the endgame is a treadmill and the treatless floor fails. ≥0.85: the tier is decorative again, which is the state this fixes |
| `SIEGE_SWEEP_EVERY` | 2 | Siege takes **two** adjacent claims every this-many-th regrow (§9.3) — a beat that can be anticipated rather than a faster clock in a costume. Tunable purely by feel *because* it cannot change difficulty: `regrowInterval` charges one interval per claim, so every cadence bills out to the same rate (9001ms vs 9000ms per claim, measured) | 1: it is just `regrowMs` halved, with extra code. Very large: the signature never shows up in a 90–180s fight |
| Sweep bill | 1 interval per claim | The invariant that keeps §9.3's moment out of §9.4's floor. Not a lever — a rule. Derived after the free version plateaued a fleeing player at six claims for ten exchanges (0.167 claims/s of regrow against 0.164 of reclaiming) | Free sweeps: the board out-paces the player at exactly the rate that makes a fight neither winnable nor losable |
| `AMBUSH_PIN_MS` / `AMBUSH_PIN_PX` | 2600 / 90 | A landed pounce holds the cat on the spot it took, reusing the treat leash (§9.3). Long enough that re-scrubbing *that* claim is a decision (≈2× `SCRUB_MS`); `PX` = `POUNCE_RANGE`, so the pinned cat threatens exactly the ground it is standing over and no more. Measured: 90px during the window, 523px after | Much longer: a hit removes a claim from the game rather than costing you tempo. `PX` ≫ `POUNCE_RANGE`: the pin is a leash in name only |
| `SWAT_RADIUS` | 64px | How near a landing treat has to be to count as a counter (§5.4). Under `HIT_RADIUS` 46 + a treat's own body, so it reads as *hitting the cat* rather than landing nearby | ≫`POUNCE_RANGE`: any throw in the neighbourhood counters, and the read stops mattering |
| `SWAT_STUN_MS` | 900 | Time **added** to the recovery a swat interrupts — not the recovery's new length, and the difference is a bug this version made and fixed. The FSM measures recovery as `RECOVER_MS × spec.recover`, so "set the recovery to 900" restarts the stance's own clock and one treat then buys 580ms against siege and 895ms against ambush: a §9.3 multiplier leaking into a §5.4 price. Additive is uniform in the quantity the player feels — *how much longer than it would have been* — and cannot shorten a recovery by construction. 700 + 900 = 1600ms of stillness against a 1400ms hold: enough to finish a claim already part-way through, not enough to start and finish a fresh one | ≤`RECOVER_MS`: the counter does nothing at all. >2000: one treat removes the cat from the fight, and the lure was already that. Stated as a *length* rather than an addition: the price of the counter silently becomes whatever §9.3 set `recover` to |
| Counter window | `RECOVER_MS − THROW_ARC_MS` = 380ms | Not a constant — a *consequence*, and the reason the counter is a skill. The swat resolves on landing and the treat flies for 320ms, so the player must read the whiff and commit inside 380ms | ≤0 (`THROW_ARC_MS ≥ RECOVER_MS`): the window closes before the treat lands and the mechanic is unreachable |
| `TRICKSTER_DOUBLE` | 0.35 | How often a feint is followed straight away by a real telegraph (§9.3), making the trickster's tell the one you cannot fully trust. Under the 0.5 that would make its tell a coin toss, and above the 0.2 that would never be met in one fight | ≥0.5: the tell carries no information and §9.3's "learn the tell" counter is gone |

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
- **Commander mode is more motion, and it is still gated the same way (2.0).** Up to four
  kittens walking over somebody's writing is the most this site has ever animated, so it is
  worth being explicit that nothing about §11 was relaxed to allow it: the squad lives in an
  `aria-hidden` container with `pointer-events: none`, `prefers-reduced-motion` still refuses
  to open the arena at all (there is no still version of this either), and the mode **never
  self-starts** — §13's toggle is the only way in, exactly as before. "Hassle-free" was the
  brief, and it must not become "motion nobody asked for". `KITTEN_CAP` is a §11 number as
  much as a balance one.
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
- ~~**`(hover: hover) and (pointer: fine)`**~~ — the core verb is holding a cursor
  still on a thing, so on a touch screen the toggle says "needs a mouse or
  trackpad" instead of starting something unplayable (§5.2).
  > **Overturned in 1.2, the way 0.2 overturned the reduced-motion row above — and for the
  > same reason.** That row was reversed once there was an explicit opt-in, because withholding
  > the game then stopped being protection and became a decision made on someone's behalf. This
  > one held longer and more honestly: the fight really was unplayable on a phone, and §5.2 said
  > why in two specific objections rather than waving at "no hover".
  >
  > What changed is not the gate, it is that the objections were answered — see §5.2's 1.2 note.
  > Scroll position turns out to be distance on a phone, which restores aim and gives fleeing a
  > price; the progress moved off the fingertip into the claim; and `isTap` split the one gesture
  > into the two verbs §3 needs. **Nothing here was relaxed to fit.** The three touch properties
  > that make a held finger possible are on claimed elements only, only while claimed, and none
  > of them affects layout — which is what this section's "transform and filter only" was
  > restated in 0.3 to admit.
  >
  > The zoom row below is why `touch-action` is **`pinch-zoom`** and not `none`. `none` is the
  > obvious way to stop a scroll stealing a hold and it would have refused a pinch that began on
  > a claim, which this document calls a no-exceptions row. `pinch-zoom` refuses panning only.
  >
  > What *is* still gated: reduced motion, unchanged.
  > **Known limitation, carried from 1.1 — the gate cannot see a keyboard-only visitor.**
  > Someone navigating by keyboard can press the toggle and open a fight they cannot play: there
  > is no scrub without a pointer, and nothing in CSS or JS distinguishes "has a pointer" from
  > "is using one". Removing the coarse-pointer gate in 1.2 neither helped nor hurt this — a
  > keyboard user on a desktop always satisfied it — but it does leave them the only visitor the
  > toggle offers something it cannot deliver.
  >
  > **And touch mode does not supply the answer, though it looks as if it should.** The touch
  > verb is "hold a finger on a thing", and a keyboard's equivalent would be "hold a key on a
  > *focused* thing" — but §5.1 excludes everything tabbable from being claimable in the first
  > place, precisely so the fight never touches what you can reach by keyboard. The two rules
  > are consistent and they close the door: a keyboard verb needs a way to address a claim, and
  > this design deliberately gives claims no address.
  >
  > What holds it together meanwhile is that Esc always ends it, the arena traps no focus, and
  > the whole thing is `aria-hidden` — so the worst case is a page that looks briefly odd and
  > closes on one key. A real keyboard verb is a feature, not a fix, and is not being invented
  > at the end of an unrelated one.
- **Contrast gate** — no claimed element may push text below WCAG AA. Verify with
  the existing backdrop-sampling harness, not by eye; sampling the composite
  gives false passes (it reads the glyphs — that mistake already cost a round on
  the glass panel).
- **Sound — none until opted in, and the opt-in is a second control in the HUD.**
  *Added 1.3.* The playtest finding included "no audio", and the fix is a pure
  WebAudio synth (`src/lib/cat-sfx.ts`, §0: draws nothing, ships no asset). Four
  cues, all with visual counterparts (nothing audible may exist without a visual
  — §11's row above): the telegraph's wind-up, the pounce's landing, a completed
  reclaim, and the win/lose endings. The page stays silent until the sound toggle
  in the cat-arena chip is pressed (`aria-pressed`, like §13's toggle; the state
  is session-only like everything else here). **The stop-and-report rule that was
  carried into the build: if the sound could not be kept silent until opted in,
  the audio would ship without visuals and the audio half would be dropped. It
  stayed silent — the toggle gates the audio context's first resume — so both
  halves ship.**
  > **1.4 adds two cues, and both obey the same rule.** §5.4's counter connecting
  > gets a thud with a bright tick over it — the thump borrows the landing's
  > vocabulary and the tick is the only rising note in the set that the player
  > causes to happen *to the cat*. §7.3's last stand beginning gets two low notes
  > rising, the only ascending figure the cat plays about itself, pitched under
  > everything else so it reads as a threat and not a fanfare: it is the audible
  > half of "the walls come in now", and it fires at the moment the regrow clock
  > actually changes gear. Both have visuals (the swat's squash, the tier's own
  > 1.3 body tell), so nothing audible exists without something to see.
- **Auto-truce** — if the tab is hidden `[PH 10s]`, or the pointer leaves for
  `[PH 20s]`, the fight ends itself and restores. Nobody returns to a page mid-
  invasion.
  > **Corrected in 1.1 — "the pointer leaves" was implemented as "the pointer stops moving",
  > and those are opposites here.** The clock was refreshed only by `pointermove`, and the core
  > verb of this game is holding the pointer **still** (§5.2) — 1.0 measured flee-and-hold as
  > the counter the whole fight is built on, so *the better you play, the less you move*. A
  > player pinned on one claim by a cat that keeps interrupting makes continuous progress,
  > never touches the mouse, and at twenty seconds the game quietly ended itself under them.
  > The rule is now "no evidence of play": a live scrub refreshes the clock, an abandoned
  > cursor does not, and the hidden-tab truce still covers walking away.
  >
  > It survived four versions of browser testing for a reason worth keeping: **a truce and a
  > win look identical from outside.** Both leave an empty board and a restored page, and every
  > harness had been asking "are the claims gone" rather than "who won". It surfaced only when
  > §7.1's harness needed a *notch* — the first check that cared about the difference.

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
5. ✅ **Stances, then loadout** — *built in 0.7.* The cat rolls one of four opponents per
   fight from the board's own seed, and the five treat shapes stop being interchangeable.
   Replayability last, as planned: it is worthless before the loop is fun, and it is the first
   step whose value a harness genuinely cannot judge.
6. ✅ **The ink transition** (§14), replacing step 0's instant swap — *built in 0.8.* Ink
   floods up from the cat's own edge, the arena is built behind full cover, and the sheet
   *dries* off the page rather than fading. `src/lib/curtain.ts` splits pure beats from the
   canvas driver the way `a11y-prefs.ts` does. The thing worth recording is that presentation
   turned out to have a *correctness* consequence nobody had written down: putting a
   ~1.9-second gap between the press and the state change created a window in which the
   visitor's intent and the arena's state disagree, and everything in the component branched
   on the state. See §13.5.

7. ✅ **The rubber band** (§7.3) — *built in 0.9.* Not in the original list: §12 ended at the
   transition, and what remained were the things individual steps had deferred. This one is
   first among them because 0.7's balance finding points at it by name — the cat has no
   answer to a stationary player once it is behind, so the endgame was free. Aggression is
   the counter-pressure, and it arrives as behaviour you can read rather than as a number:
   the bored cat stops chasing you and washes, the desperate one winds up faster and crowds
   you. Rules in `src/lib/arena.ts`, four seams in `CatArena.astro`, no new art.

8. ✅ **The handicap ladder** (§9.4) — *built in 1.0.* A win raises a rung, a loss lowers it, and
   a raised rung withholds treats from the paw row. No modal and no new control: **§13's toggle
   is the offer**, and pressing it again is the acceptance. The section's own stated blocker —
   "it needs an ending that asks a question" — turned out to be the wrong diagnosis, and
   following it would have contradicted §7.4's built ending.

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

**Step 5 ship gate, actual:** 343 unit tests and a 21-check harness
(`scratchpad/arena5.mjs`), plus every earlier harness — but the interesting number is that
**four of the five browser harnesses had to change**, and not because anything regressed.
Stances made "the cat will pounce" conditional: a siege cat cannot leave the floor, a sleepy
one will not commit until a hold has already finished, and a trickster bluffs a third of its
wind-ups. Checks written against the baseline opponent waited forever for a landing that was
never coming. Each of them now pins the stance it needs and says why — which is the honest
shape of testing a game with variance in it, and a decent argument that the variance is real.

Three of those changes were harnesses that had been passing for the wrong reason: one waited
on `phases.some(recover)` and so matched a pounce from *earlier* in the recording, one snapshot
was taken 200ms after a toggle that step 4 gave a 2.2-second ending beat, and one re-rolled the
fight — and therefore the stance — in the middle of measuring a stance.

**Step 6 ship gate, actual:** 364 unit tests, a 46-check browser harness
(`scratchpad/arena6.mjs`), all five earlier harnesses, the ink harness, the cycle check
and a warning-free build.

Step 5 broke four harnesses by adding variance; step 6 broke **all five** by adding
*latency*. Every one of them clicked the toggle and then waited 120–200ms, which was ample
against an instant swap and is now a race they always lose — the first symptom was
`getBoundingClientRect` on a null `.cat-claimed`. They now wait on the observable (claims
present, or claims gone) instead of on a stopwatch, which is both correct and usually
shorter. That is the recurring lesson of this build order in its clearest form: **a fixed
delay is an assumption about the implementation, wearing the costume of a test.**

Two notes on measuring this step, since almost everything about it is a number that had to
be taken off a real page:

- Three checks failed for reasons that had nothing to do with the code. A luminance baseline
  read from `document.body` came back `rgba(0,0,0,0)`, so "does the screen only darken" was
  comparing dark ink against a page it believed was black. A scroll baseline read on a timer
  caught the site's own smooth-scroll mid-flight and reported the *arena* moving the page. A
  per-frame cap on the flood's speed turned out to measure this machine's frame rate, and
  satisfying it would have meant slowing the animation. A wrong baseline does not fail
  loudly; it answers a different question and accuses the code under test.
- And two failures were caused by the measuring apparatus itself: a bulk edit that inserted a
  `press()` helper also rewrote the `page.click` *inside* that helper, so it called itself
  forever — and the hung process then sat spinning on the CPU while the next run went by,
  producing three timing failures in a harness that was fine.

**Step 7 ship gate, actual:** 382 unit tests and a 25-check harness
(`scratchpad/arena7.mjs`), plus every earlier harness, the ink harness, the cycle check and a
warning-free build.

The measurements that matter, since §7.3 is a claim about *behaviour* and the whole risk is
asserting a scalar instead. Under a fixed provocation — the cursor parked on a claim and
jiggled ±8px every 520ms, which holds scrub progress just past `POUNCE_THRESHOLD` forever, so
the cat is offered the identical opening over and over:

| | Even | Bored | Desperate | Predicted |
|---|---|---|---|---|
| Takes a small opening | 0.46/s | **0.00/s** | — | — |
| Decides, into a hold | **514ms** | — | **97ms** | 490 / 70 |
| Fastest wind-up | **333ms** | — | **250ms** | 328 / 234 |
| Grooming beats | 0 | 5 in 21s | 0 | — |

Same player, three different cats, and the two timing rows land within a frame or two of what
the arithmetic says they should — 514ms across twelve probes spanning 513–515, and 97ms across
two. That tightness is the point: both are clock-driven, so a spread would mean something was
wrong. One desperate run recorded wind-ups of 484/251/250, the 484 being a bell-doubled one —
precisely the confound the "fastest, not mean" choice exists to survive.

Four things went wrong in the measuring, and all four are worth writing down because three of
them were the harness mis-describing a healthy build:

- **I walked straight back into 0.7's own lesson.** A run that happened to deal **siege**
  measured 0.00 commitments per second at *every* tier — it has `pin: true` and never leaps —
  so the comparison was between two zeroes and reported a failure. Stances make "the cat will
  pounce" conditional; a new harness needs the stance pinned just as the old ones do.
- **A tier is a set of intervals, not a marker.** Taking the baseline as "open → the last
  bored marker" put an *earlier* bored stretch inside the even window, and duly reported a
  grooming beat during even play. Now the statistics are taken over a union of intervals.
- **Throwing treats poisons a mean.** The climb to the desperate tier has to spend treats, and
  a bell doubles the next wind-up (§9.5) — so a mean over three telegraphs said the desperate
  cat was 5ms faster. The statistic aggression is actually about is the *floor*, and the
  confound only ever lengthens, so the fastest wind-up is both the right measure and immune.
- **The cursor is an input.** Left parked on a claim while the harness scrolled and counted
  between actions, it kept accruing progress and fed the cat free pounces: one run reclaimed
  **twelve** claims and finished on the same eight it started with.
- **The commitment *rate* cannot show "comes at you more often", and that follows from this
  step's own central decision.** The cat's cycle is telegraph + leap + **recovery**, and
  recovery is the part aggression deliberately does not scale — so at ambush the cycle is
  ~1.6s even against ~1.5s desperate, a 6% difference that two runs resolved the wrong way.
  What the patience change moves is *how early in your hold it decides*, which has no recovery
  in it at all, and it measures 514ms into a hold when even against 97ms when desperate. The
  claim was reworded from "more often" to "sooner", because that is what is true.
- **Measuring that took three attempts, and each failure was a different thing leaking in.**
  Parking the cursor somewhere neutral first measured the cat *walking back* (1016ms at both
  tiers, in multiples of ~508ms). Parking it on the claim and waiting for "near and stalking"
  never fired, because a still player is already past the threshold by the time the cat
  arrives, so that window does not exist. What works is a lure on a *non-claim* point nearby:
  progress cannot accrue, so the cat settles into a stable stalk, and then moving onto the
  claim starts a hold with the animal already in range.
- **And the probe changes the thing it measures.** Every landed pounce takes ground back, so
  six probes at the desperate tier walked the cat up past `DESPERATE_LEAVE` and four of them
  were really timing an even cat — a clean 514ms hiding among the 97s. Each measurement is now
  tagged with the tier it was taken in. The rubber band undoing the measurement is, of course,
  the feature working.

**One consequence of §13.5 worth flagging for anything that reads the toggle.**
`aria-pressed` now follows *intent*, so it flips the instant the press lands and a transition
runs afterwards. It is therefore no longer a signal that the fight is over — `arena4.mjs` had
two loops breaking on it, which now exit while the exit curtain is still up, and the snapshot
that followed caught `cat-arena-on` still on `<html>`. "The fight has ended" is the claims
being gone, not the button having conceded.

And one finding that is about the game rather than the harness, arrived at by accident.
**Holding still, alone, does not win — it stalemates.** A player scrubbing perfectly and never
spending anything reclaims ground at exactly the rate a landed pounce takes it back, and the
board sits near its opening ratio indefinitely; the desperate tier only became reachable once
the harness started throwing treats when the cat closed in. That is §5.4's "the safe window is
a real decision" arriving from the opposite direction, and it sharpens 0.7's finding: the
stationary player wins every *exchange* and still cannot win the *fight* without spending the
resource exploration gave them.

> **Retracted in 1.0. That was the harness, not the game.**
>
> Building §9.4's floor required settling it properly, and holding still alone wins fine — a
> treatless fight, against a leaping stance, **won in 37s with 7 reclaims and one stall**. The
> difference is *where* you hold still. 0.9's harness worked whatever claim was nearest and
> spent its between-move time with the cursor sitting on the board; it was fighting at
> 76–300px, inside `POUNCE_RANGE` plus the cat's reach. Lure the cat to one edge and hold at
> the other and it cannot arrive before a 1400ms scrub completes — **every claim in the winning
> run was worked from 482px out, against a 423px safe distance.**
>
> What survives of the original claim is much narrower and still worth knowing: a player who
> holds still *near the cat* gains nothing, so §5.2's fleeing is not flavour, it is the counter
> the fight is actually built on. Treats buy you the right to ignore that — which is a fair
> description of what a resource should do, and leaves §5.4 intact.
>
> Recorded at length because it is the second time this build has mistaken a harness's rhythm
> for a property of the game, and both times the wrong version was the more interesting story.

**2.0 ship gate, actual:** 467 unit tests (31 of them new, in `tests/squad.test.ts`), a new
23-check `scratchpad/commander.mjs`, the fourteen manual-mode harnesses green, `astro check` clean
and a warning-free build. No new build step: 2.0 is a §15 bolted onto a complete §12 rather than a
step in it.

**The interesting checks are the ones that read a number nobody had thought to read.** The cat's
landing point, measured against both candidates: **11px from a kitten, 687px from the parked
cursor** — which is "the boss hunts the squad" as a fact rather than an intention. The claim count
across four landings: **0 rises**, which is a hit costing tempo and not ground. And a reload that
keeps `cat-best-round` while the fight, the found-set, the round attribute and the squad all go —
§7.2's promise and §13.4's amendment in one assertion, because the boundary *is* the argument.

**Five lessons, and four of them are about being wrong in a way arithmetic could have predicted.**

**A strategy is not portable between different bodies.** 1.0's flee-and-hold is the correct way for
a *hand* to play this fight, and applying it to a kitten sent the animal to `y: 1303` on a 900px
viewport. A cursor teleports, so distance from the cat is free; legs are not free. The policy is two
clocks compared now, and the pleasing part is that it *reduces* to 1.0's 423px when the walk is
zero — the old finding was a special case of the right rule all along.

**"Soonest" is not "best" when the thing you are pricing can be interrupted.** The fallback took the
claim that would finish first, which valued a hold that would be broken every single time above one
across the room that would actually complete. This is a modelling error rather than a tuning error,
and no amount of adjusting the numbers would have found it — a frame-by-frame trace did, in about a
minute, after two rounds of theorising did not.

**An unpriced source of pressure will break a bound that was proved without it.** `squad.ts` proves
the squad out-reclaims the board by comparing two rates, and the board's rate in that proof is the
regrow clock. Ground taken by *pounces* is a second source, and with it the measured fight sat at
three-to-five claims for seventy-two seconds while the arithmetic insisted the squad was ahead. A
proof is only about the terms it contains.

**A symptom fixed at the wrong layer buys a worse bug.** Shrinking the board to four claims cured
the marching and produced boards that were trivially fillable and over in three seconds — a run hit
round 14 in 72 seconds. Retracted, cause fixed instead, and the retraction is left in `squad.ts`
where the constant used to be.

**An invariant that used to be free stopped being free, and the oldest harness in the fleet caught
it.** A progress mark belongs to whoever is holding, so letting go has to remove it. Until 2.0 that
needed no thought: there was one mark, `hideRing` cleared it, and every abandon path happened to
call `hideRing`. With a mark *per worker* that stops following, and the one place that nulls the
pointer's hold without going through the ring — the `pointerout` handler, on a finger lift — left a
claim wearing a half-full `--scrub`. `touch-fight` reported it in the words the check was written in
five versions ago: *"no `--scrub` is left on the page after the finger lifts — 1 elements"*. That
mark would have been snapshotted by `claim()` as the element's original style and restored on the way
out, which is **pillar 2 failing by omission** — the same shape as 1.4's siege-sweep bug, from the
opposite direction. There is now exactly one way to let go of a claim (`dropHold`), so no caller has
to remember. Worth stating generally: **when you add a second actor to a system, every invariant that
was maintained by coincidence needs to be re-derived on purpose.**

**A pillar-2 violation, in shipped code, found by the new gate after the commit.** `commander.mjs`
reported `--claim-tilt: -0.098deg` left on an `h2` after a three-round run. The cause is a hazard
`open()` has guarded since 0.3 — its comment says replacing `arena.claimed` wholesale strands
whatever was in it, which is why it calls `close()` first — arriving somewhere new. `dealBoard` deals
a round's board by replacing those arrays, and §15 deliberately does *not* set `arena.ending` for a
round beat, because the fight is not over. So the regrow keeps running through the 1500ms breath, the
cat takes a claim or two, and the array tracking them is thrown away a moment later. On a *restart*
it is worse: the board is full by definition. `dealBoard` hands the old board back first now. The
lesson is not "remember to free": it is that **a guard written for one boundary does not cover a new
boundary of the same shape**, and the comment explaining the first one is the best place to look when
the second appears.

**And a flag deleted as dead state became load-bearing two hours later.** `Kitten.ordered` did
nothing when it was written — nothing re-picked for a kitten that already had an errand, so an order
stuck by construction — and deleting it was right at the time. Then §15.4's re-pick rule arrived
(abandon an errand that cannot be finished, or the fallback marches across the document) and it began
quietly overruling **orders**, which §15.3 promises are honoured even when they are bad. The flag is
back, and now it has exactly one job — the thing re-pick refuses to touch. **State that is dead today
is dead against today's rules**, and a rule added later does not know what an earlier deletion
assumed.

**The red that sent me looking, though, was not that** — and how I mis-assigned it is the more useful
half. `commander.mjs` reported *"nobody arrived in 8s"* on the order check; I found the `ordered`
hole while reading the code, fixed it, and had a plausible story. The check stayed red. Instrumenting
it took one script and ended the argument in two frames: `claims=0 round=undefined` immediately after
the click, which is not a lost order but **a new document.** The harness picks the usable claim
furthest from every kitten, and on that board it was a card's `<figure>` — a claim inside a link. The
click did exactly what 1.2's `INTERACTIVE` split promises, the browser navigated, and the fight ended.
The board is rolled per fight, so this failed only on the boards whose furthest claim was a link: an
intermittent red, from a harness aiming at the one part of the board the mechanic deliberately does
not own. Two lessons, both already on this list and both ignored in the moment: **a plausible bug
found by reading is not the bug measured by the failure**, and a harness must aim where the mechanic
applies, because otherwise it faithfully measures a *different* guarantee — here §11's — and reports
it under the wrong name. The fix is four lines in the pick and a paragraph in §15.3 saying out loud
that some of the board is unorderable.

**Then the same shape a third time, in the oldest place it could hide: a *precondition* asserted
instead of retried.** `touch-fight` needs a claim that sits inside a link — §5.1 permits it and the
check exists because a long press on a link is four native gestures at once. On this sweep it reported
*"none on this board"* and skipped five checks with it, on a build that had not touched touch mode.
`pickClaims` seeds from the clock, so which elements a fight claims is a property of the **deal**, and
a deal is not a build. It deals again now, up to six times, and reports which deal offered the case
(it took two). Generally: **a harness may assert on what the build does and never on what a random
roll happened to hand it** — the three faults 2.0 found in one afternoon are all that sentence, from
three directions, and the tell is always the same, a red whose detail line describes the *fixture*
rather than the behaviour.

**And then the rule was made a mechanism, because writing it here was demonstrably not enough.** All
three of those faults were already understood, already recorded on this list, and already fixed
elsewhere in the fleet — `pickSpot` re-dealt six times, `forceStance` re-rolled a hundred and twenty
fights, `arena.mjs` re-rolled stance and placement together — and they shipped anyway, because there
was no shared strategy to fix: eleven copies of the context factory, four re-rollers with three
budgets, three copies each of the placement, throw and lure helpers. §12.1 is the charter that
replaced them, `scratchpad/lib/fixture.mjs` is the one copy, and `tests/harness-hygiene.test.ts`
fails the build on the four shapes rather than trusting anyone to remember them. The audit it forced
found the fault in **twenty-seven places**, including two in already-committed harnesses
(`battle.mjs` asserted a fixture *and* imported Playwright by an absolute path into a container that
gets reclaimed). A convention nothing checks decays even in tracked code.

**A half-fixed harness fault comes back as its own sibling.** 1.4 measured that the lure strategy
plateaus against siege, pinned a leaper in `arena8` section 1, and left section 2 rolling freely.
Section 2 duly failed here — "16 reclaimed, 2 left" — on a build that had not touched a manual fight,
and the investigation ended where 1.4's notes already were. Both sections pin one now — and so does
`top-state`, which turned up with the identical signature ("notched false, 3 left, 2 stalls, 144s") in
the same sweep.
When a fault is a property of a *shared strategy*, fixing it at one call site is not fixing it.

**And a bound calibrated from one sample sits inside the variance of the thing it measures.**
`arena4` asserts a scripted win takes at least 15s, which was true of the run it was written against.
Across runs it is 17s over 9 holds, 15s over 8, **13s over 7** — the board is `MIN_BOARD`..`MAX_BOARD`
candidates and `pickClaims` takes 55%, so the number of holds a win needs moves by a couple either
way and the clock follows. 2.0 tripped it while changing nothing about a manual fight, which cost an
investigation to establish that nothing was wrong. The floor is arithmetic now — the fastest possible
scripted win is about 5.5 holds × `SCRUB_MS` ≈ 7.7s — so it still catches a fight that stopped being
a fight without catching a different deal.

**One flake, and it was the unit suite rather than a browser.** §8's reachability sweep runs tens of
thousands of `pickLine` calls on purpose — 1.4's note explains why a coarse grid invents shadows —
and it measured **4214ms against vitest's 5000ms default**. So it passed alone and failed while a
browser harness ran beside it, which is the least useful red line there is: it says nothing about the
code and it teaches everybody to re-run and shrug. Both sweeps carry an explicit 30s timeout now. A
test whose result depends on what else the machine is doing is not a test yet.

**And the fleet had to be told which game it measures.** Commander mode is the default, so every
pre-2.0 harness opened a fight where the pointer is not the verb: `arena.mjs` reported 60/63 with
its three scrub checks red and every claim-and-restore check green, which is a harness measuring the
wrong game and saying so precisely. One line each at the context — press the mode chip, wait on
`aria-pressed` rather than on a timeout — rather than fifty edits at fifty click sites.

**1.4 ship gate, actual:** 435 unit tests, a new 22-check browser harness
(`scratchpad/battle.mjs`) that measures each of 1.4's additions on machine state, plus every
earlier harness, `first-run.mjs`, `astro check` clean and a warning-free build. No new step: 1.4
adds mechanics to §5.4, §7.3 and §9.3 rather than building an unbuilt section.

**Four harness lessons, and the first one had been silently true since 0.4.**

**Every `waitForFunction` bound in the fleet was fiction.** Playwright's signature is
`waitForFunction(pageFunction, arg, options)`, and 22 call sites across eleven harnesses passed
`{ timeout: N }` in the *second* position — where it becomes the page function's argument and the
bound falls back to Playwright's 30s default. Measured: a wait asking for 4000ms took **30104ms**.
That is not a tidiness problem, because 20 of those seconds belong to a *game rule* — §11 ends a
fight `IDLE_TRUCE_MS` after the last input, so a wait that overruns 20s **ends the fight it is
waiting on**. It surfaced as `arena8` section 1 reporting "0 reclaimed, 0 left" on any run that
rolled a siege cat: siege never leaves the floor, so the harness's lure-the-cat-to-the-top step
waited for an arrival that was physically impossible, and the game correctly declared a truce
underneath it. The report reads exactly like a broken feature. **A loss and a truce and a win all
look the same from outside** — §7.1's note says this about 1.1's truce bug, and the same blind spot
cost a second afternoon in 1.4, which is the argument for asserting on *who won* every single time.

**A harness that plays every stance the same way is measuring its own strategy.** `arena8` forces
an ambush for the floor check, so nine versions of measurement had only ever fought a cat that
leaps — and flee-and-hold is the counter to a leaper. Applied to siege it is four of every six
seconds spent waiting for a cat that cannot come, and the fight plateaus. The same siege fight,
played the way §9.3's own table describes, is 7 reclaims and a win in 21–23s. The plateau was real
and the diagnosis was not.

**A watched fight loses itself, and that is §2 working.** `battle.mjs` section 2 needs to watch a
board regrow for a minute without playing, and the first version did it with empty paws — so the
board filled and the fight *ended*, because §2 defines a loss as every claim taken **and** nothing
left to throw. The recording stopped early and the check reported "never reached the desperate
tier" while the game had done nothing wrong. Arming treats and never spending them removes the
loss without touching the clock being measured. Ammo really is the thing standing between a full
board and defeat.

**A rate measured across your own play is a measurement of your own play.** The same section first
averaged every regrow gap it saw and reported 18333ms for a 9000ms clock: the gaps that spanned
the harness's own reclaiming included the holding, and a saturated board has no clock at all. Both
are the measurer leaking into the measurement — §12's oldest trap. The fix is to stamp each
interval with the phase it fell inside and average only the ones taken while nothing else touched
the board; the contaminated span shows up in the log as `1×37.0s/straddles`, which is a useful
thing to be able to see rather than a thing to hide.

**And then three older harnesses had to change, none of them because anything regressed** — the
same thing 0.7 recorded when stances first made "the cat will pounce" conditional. `arena5`
deduped its phase log on the phase *string*, so §9.3's double tell was invisible to it: a feint
that re-commits stays in `telegraph` and only drops `boss-feint`, so the second wind-up left no
record and the harness reported five wind-ups against its own floor of six. Keyed on phase **and**
feint it sees both, which is also the right key on the merits — the shoulders dropping is the tell.
`arena7` collected *zero* desperate samples, and its own comment predicted why: the tier's window
"closes behind you", and 1.4 makes it close faster because the last stand regrows the very board
that ends the tier. The tier measuring itself out of existence is the feature; the harness now
pushes back down as far as it takes instead of one claim per round. And `arena8`'s ladder section
was playing the lure strategy against a *random* stance, so a siege roll turned a ladder check into
the plateau above (14 reclaims, 3 left, 121s) — it pins a leaper now, exactly as its own floor
section already did, and siege's winnability is measured in `battle.mjs` where the strategy fits.

**A gate that never ran is the quietest failure in a sweep of green ones.** `first-run.mjs` exited
2 before its first check because its Chrome candidate list did not include the browser a cloud
session actually has. Nothing printed a FAIL; the line was simply blank. It now looks where this
environment keeps Chromium, which is where the gate is usually run.

**The whole fleet, on one build:** `check-ink` 20/20, `cycle` green, `arena` 63/63, `arena2` 27/27,
`arena3` 36/36, `arena4` 39/39, `arena5` 22/22, `arena6` 46/46, `arena7` 25/25, `arena8` 26/26,
`top-state` 20/20, `touch-fight` 43/43, `first-run` all green, `battle` 22/22. Two of those counts
went *up* because a check that used to abort now runs to the end — `arena8` from 16 to 26 once its
ladder fight stopped being fought with the wrong strategy, and `arena5` from 21 to 22 with the
§2 guard added. §7.3's tiers re-measured clean on the new clock: a desperate cat commits **97ms**
into a hold against **514ms** even, and winds up in 250ms against 334ms.

**Step 8 ship gate, actual:** 397 unit tests and a 25-check harness
(`scratchpad/arena8.mjs`), plus every earlier harness, the ink harness, the cycle check and a
warning-free build.

**The floor, settled.** §9.4 promises the bottom rung is "a pure-skill fight for whoever wants
it", and 0.9's retracted stalemate finding put that in doubt — so it was measured rather than
assumed, and the measurement had a sharp form available. The cat can only take ground by
landing a pounce, which needs it *within `POUNCE_RANGE`* of a hold already past
`POUNCE_THRESHOLD`; so a player holding further away than the cat can walk in one scrub cannot
be interrupted at all. At the desperate tier that distance is **423px**, and the question stops
being "how fast is the player" — which a harness cannot honestly emulate — and becomes "does
the board keep offering that much room", which is a property of the page.

It does. A treatless fight was **won in 37s, 7 reclaims, one stall, every claim worked from
482px out.** `LADDER_FLOOR` stays at 0 and §9.4's bottom rung means what it says. Worth noting
against §10's 90–180s target: a skilled treatless win is *fast*, which suggests the ladder's
lower rungs may be where the interesting fights are.

Three things went wrong in the measuring, and all three were the harness playing badly rather
than the game being broken:

- **Fleeing in the wrong space.** The first strategy sorted claims by distance from the cat and
  then scrolled the winner to the viewport centre — destroying the distance it had just sorted
  for. The cat chases the cursor, the cursor had been parked on the previous target's centre,
  and every target arrived at that same centre, so the animal was already standing on it. The
  diagnostic reported the nearest worked claim at **76px** against a 423px requirement, which
  is what stopped this being written up as "the floor is unwinnable".
- **Then keeping a stale measurement.** The second attempt nudged the scroll and re-picked, but
  kept the pre-nudge coordinates when the new candidate was not better — pointing the cursor at
  where a claim used to be. Replaced with a deliberate placement: the offset that puts a claim
  at the bottom of the viewport is arithmetic, and the bottom is the furthest point from a decoy
  held at the top.
- **Asserting a guarantee as a requirement.** The safe-distance check originally demanded that
  *every* worked claim be beyond 423px, and failed on a run that **won** while working one at
  227px. Past that distance the cat provably cannot arrive; inside it, it merely might. The
  check now earns its place by explaining a stall rather than gating a success.

And one real bug, found in the browser and not by the unit tests. **A clean win suppressed the
offer.** Winning without spending a treat is the commonest way a good player wins — the
flee-and-scrub counter needs no treats at all — and `win-clean` sat directly above `win-again`
in §8.4's priority, so §9.4's rematch was never offered to precisely the visitor most likely to
want it. The clean line now carries the question itself. The unit tests could not have caught
this: every line was reachable and every gate correct in isolation. It needed a real fight to
show which branch a good player actually lands on.

**1.2 — touch mode, designed from a measurement rather than from an opinion.** 410 unit tests, a
43-check touch harness (`scratchpad/touch-fight.mjs`) driving real touches through CDP because
Playwright's `touchscreen` only taps and the core verb is a **hold**, `arena.mjs` up to 63 with its
touch section rewritten from asserting the refusal to asserting the fight, and every other harness green on the
same build (63, 27, 36, 39, 21, 46, 25, 25, 20 · ink 20/20 · cycle), and a warning-free build.

**Then the browser found three rules the design had not thought of, and they are one discovery:
on touch, a hold ends in gestures a dwell never did.** A cursor resting on a link does nothing. A
finger resting on one is a click, a text selection, a context menu *and* a drag — and §5.1
deliberately allows a claim *inside* a link, which on a portfolio is most of them. So: the click
that ends a hold is swallowed (`isWorking`), the lift only throws if it was a tap (`isTap`), and
`dragstart` is refused on claims. The third one is the one I would never have predicted: a long
press on a link starts the native link-drag, which fires `pointercancel` and quietly released the
hold a few hundred milliseconds in — **only on claims inside links**, so most of the board on an
index page and none of it on a prose page.

Two of the three were first written wrong in the same way, and it is worth naming: I reached for
the DOM at click time — `e.target.closest('.cat-claimed')` — and a hold that *completes* has
already freed its element, so the check read false at exactly the moment it was needed and the
page navigated out from under a fight the player had just won. **The question was about the
gesture, and the gesture is over by the time you can ask.** The flag has to be set while the hold
is happening. That is the same shape as 1.1's four lifetime bugs, arriving from the other end.

**The whole design came out of step 0, and step 0 was the point.** §5.2's two objections had held
for eleven versions and I could have answered them plausibly and wrongly. Instead: three passes of
measurement before a line of mechanic. What they found, in order —

- **The board leaves the screen on a phone, by a lot.** `boardSlice` borrows from past the fold
  when the on-screen candidates cannot reach `MIN_BOARD`, and a 390px viewport is exactly the
  "screen too thin to hold a game" case that clause was written for: boards spanning **1.3–3.5
  screens**, 8 claims on `/` and `/timeline/`, 3 on `/experience/`.
- **My first threat metric measured the wrong space.** "Distance to the cat" used
  `getBoundingClientRect()` — viewport-relative — on claims sitting up to 3000px down the
  document, so it reported *document* distance and called it threat. Reported 75% of claims
  "already safe" when the honest number, taken once each claim is actually on screen, is different
  in kind. The third time this build has measured fleeing in the wrong space (0.9's harness, then
  1.1's arena3 A/B).
- **Corrected, it said 0 of 19 claims were safe** — 407–422px against a 423px requirement, on
  every page. Read flat that is "a phone fight is unwinnable". Read properly it is the mechanic:
  422px is *half of 844*, and the cat is fixed at the bottom while claims are not. **Scroll
  position is distance.** Pass three confirmed the gradient: high 683–687px (15/15 safe), centred
  413–420px (0/16), low 161–178px (0/16).

That is a designed mechanic arrived at by arithmetic I did not write — `SAFE_FLEE_PX` was derived
in 1.0 for a desktop endgame, and it happens to land one pixel above the middle of a phone screen.
**No difficulty lever shipped**, because step 0 was run to decide whether one was needed and said
no. The plan reserved the right to add a coarse `MIN_BOARD` or an aggression factor; both would
have been magic numbers.

**Nine harness faults, and the pattern is now unmistakable.** A helper that reported a claim as
"placed high" without checking the scroll had put it there — so the fight was played in the danger
band and called safe, the same shape as 1.1's arena8 fighting on the wrong page. A hit-test run
immediately after `scrollTo`, which caught the site's `sticky` header mid-reposition and returned
`NAV.tabbar` at every height; measured with a settle, the chrome scrolls away and the page owns a
**166–402px** safe band. An assertion matching `/rgba?\(/` that failed on
`color(srgb … / 0.17184)` — testing Chromium's choice of notation while the wash worked perfectly
(the alpha is exactly `7% + 19% × 0.536`). And a `-webkit-touch-callout` check read through the
CSSOM, which Chromium strips because it does not implement the property: the declaration was in
the shipped CSS all along, and the honest question is what the *network* served.

Two more came from the browser doing something reasonable that the harness did not model. A point
reported as open ground by `elementFromPoint` still navigated when tapped, because **Chromium
applies touch adjustment on mobile** and snaps a tap near a clickable target onto it — so the
throw check failed for having no fight left rather than for anything to do with throwing, and the
helper now requires a whole neighbourhood to be free. And the probe meant to leave a touch on the
record for the hybrid check held a *claim* for 120ms, which is a tap, on an element that may sit
inside a link: it navigated, and again the failure landed on an unrelated assertion. A third of the
same family: a point found before `place()` scrolled the page, then tapped afterwards, when the
coordinates belonged to whatever had scrolled into them. **All three say the same thing — a
coordinate is only as good as the moment it was taken, and every one of them failed a check that
was not the one at fault.**

**The one that took longest, and it was the site.** A hold on a claim inside a link scrubbed
nothing, reproducibly. Three theories came and went — the click, the link-drag, the board count —
and the last of them was right about *why the count lied* and still wrong about this. What settled
it was following the element itself across time: a claim spanning y 137..156 when the point was
chosen spanned y 126..145 sixty milliseconds later, at **identical `scrollY`**. The site reveals
content on scroll with a `translateY` transition, so a claim scrolled into view keeps *travelling*
for a few hundred milliseconds — and the point picked at its centre was past its bottom edge by the
time the finger landed, so `elementFromPoint` returned the parent link and the game correctly
scrubbed nothing. §12 recorded this in 0.8 against the site's smooth-scroll; the scroll-reveal is
the same trap one layer over, and a fixed pause cannot fix either. The finders now wait for the
rect to stop changing.

**And it explains a flake this build has been misreading since 1.0.** `arena8` has intermittently
reported `nothing parkable` — every claim failing its `elementFromPoint` check, which the harness
surfaces as *"a fight cannot be won"*. 1.1 saw it, patched section 2 around it by fighting on a
different page, and wrote the patch up as the fix. It was not: the cause is this, in
`placeFarTarget`, which scrolled a claim to the bottom of the viewport and hit-tested it while the
reveal was still carrying it. Now hardened the same way. **Three versions of a flake attributed to
the board running out of distance, and it was the harness photographing a moving object** — which
is the strongest argument yet for the rule §12 keeps rediscovering: when a measurement disagrees
with the design, suspect the measurement first, and go and watch the thing rather than theorise
about it. Two of the theories I formed about this one were plausible, cheap to implement, and wrong.

**Worth keeping as a design note rather than a fix:** that means a player who scrolls and holds
*immediately* can miss, for as long as the reveal runs. The reveal belongs to the site rather than
the game, holding again works, and touch mode is not going to start suppressing the page's own
animations — but it is real friction that only exists on touch, because only on touch is scrolling
part of the verb.

**And the one where a game mechanic invalidated the metric.** "Did my hold reclaim
something" was measured as the board count going down — and it failed intermittently, on whichever
runs happened to roll **siege**, whose regrow puts back *the most recently freed element*. So a
hold that worked perfectly read `8 → 7 → 8`, and the count said nothing happened. Three separate
theories about what was interrupting the hold came and went before a diagnostic recorded the actual
events — `pointerup`, then a correctly prevented `click`, no `pointercancel` anywhere — which is
what ruled out interruption entirely and left "it worked, and something put it back". The checks
now watch for `.cat-freed`, which `free(node, true)` adds on a completed scrub and nothing else
does. **A count is a proxy; the class is the event.** That is 1.1's lesson in a new disguise, and
the disguise is what makes it worth writing down twice: the proxy was not prose or `aria-pressed`
this time, it was a number that genuinely counts the right things and is held constant by a
mechanic the check had no reason to know about. (An eighth, smaller: a link-finder that did not
scroll reported "no link in the band" once earlier checks had left the page elsewhere — §11's
promise failing where only the harness was standing in the wrong place.)

Two of the nine are §12's oldest lesson — **measure in the space the mechanic lives in** — and two
are the 1.1 lesson: *a check that names its own expected format is testing the format.* One more
worth keeping: the first version of the tap-versus-hold section found no treats in hand on a cold
load and **skipped both checks while printing PASS**, which is precisely the "guard that turns a
failure into an absence" 1.1 wrote up. It now earns treats by tapping through tabs, and asserts on
`#cat-throw` rather than on the paw row — because counting paws across a hold caught a *win*, and
§7.2 hands spent treats back on close, so "did not throw" read as `3 → 4 in hand` and failed for
being right.

**1.1 — §7.1, then a review pass over the whole thing.** 404 unit tests, a 20-check harness
for the top state (`scratchpad/top-state.mjs`), every earlier harness green on one build (60, 27,
36, 39, 21, 46, 25, 25), the ink harness, the cycle check and a warning-free build. `arena.mjs`
gains a check for the truce bug below, since that one had eight harnesses' worth of room to hide in.

**And one test written against a bug that already shipped.** 1.0's unreachable line — §9.4's
rematch offer shadowing `win-clean`, so the offer never reached the player most likely to want
it — was found by winning a fight and reading the ribbon, and the unit tests could not have
caught it because *every test named its own expected answer*. A line stops being reachable
because of what sits above it in the table, and an assertion of the form "this state gives that
line" is not looking at the table. §8's dialogue now has a sweep instead: 172,800 states across
every axis a `when` reads, and any line the whole grid never once selects is a red line. Its
first run reported eleven dead lines and every one of them was the sweep's own fault — `idleMs`
was pinned at 9000, so `support-idle` shadowed the eleven below it. A coarse grid does not just
miss states, it *invents* shadows, which is the same lesson §12 keeps learning about baselines.

With every numbered section built, the review was the first pass with **nothing to add**, and
that turned out to be its value: seven real bugs, five of them older than this version. Two
things are worth generalising from them.

**Four of the seven are one bug wearing four hats: something outliving its moment.** A timer
firing into the *next* fight; a flag surviving a park that cleared only its classes; a hide
landing on the line after the one it was scheduled for; and a whole fight carrying on inside
its own ending. §13.5's `want`-versus-`on` desync is the same shape and is recorded three
sections away in this document, which is the uncomfortable part. What they have in common is
that each was created by an interruption — a close during a beat, reduce-motion mid-perch, a
line inside another line's fade — and interruption is the one thing this design asks for on
every page:
pillar 2 is that a fight ends in one gesture, at any moment. **A build whose headline promise
is "you can always stop" has to treat every piece of deferred state as something that will be
stopped mid-flight, because that is the advertised way to use it.**

**And two were found by asking a different question, not by testing harder.** The idle truce
had survived four versions of browser testing because a truce and a win leave the same page
behind, and every harness had asked "are the claims gone". The paw-row rollback needed the
question "what happens to a find that lands *during* a fight", which nothing had asked because
finds and fights had been treated as separate features. Both were reachable in ordinary play.
Neither was reachable by adding checks to what was already being checked.

**The harnesses had five faults of their own**, and every one of them was accusing the code.
§12 step 3's A/B never moved the cursor off the claim between its arms, so arm A's hold quietly
completed during arm B's setup and arm B was then measured on ground that had already been won
— a game bug's exact symptom, about one run in five. The ribbon-placement check waited twelve
seconds inside a single `evaluate` without touching the mouse, and a parked cursor gives the cat
almost nothing to say, so the window could pass in silence and the check failed on the game
working correctly. `arena8`'s rung-lifetime section fought on `/timeline/`, the page section 1
of the same file had already written down as the one where this harness's flight cannot resolve;
worse, its two §7.2 checks sat inside `if (won.won)` and so were silently *skipped* rather than
failed. **A guard that turns a failure into an absence is worse than the failure**, and a green
count is not a count of what ran.

The fourth had been right by luck for five versions, and is the one I got wrong twice before
getting right. §12 step 4 ends by asking whether SiteCat has the cat back, and measures that as
displacement over a fixed 900ms. It read 30–51px five runs running, then `0.0px`, and looked
exactly like a broken handover. My first explanation was that the win loop leaves the pointer
resting low on the page and an ambient cat comes and sits *beside* a resting pointer — plausible,
partly true, and not the cause: parking the pointer in a corner first still read `0.0px`.

A trace settled it, and the answer was simpler and worse. **The cat's ambient loop alternates**
— `chooseNext` picks a walk, then an idle, and the idles run for *seconds*; one in the trace
lasted 2.6s while the cat was otherwise wandering happily at `994 → 999 → 1056 → 1145 → 1178`.
So "the cat is walking" is not true at any given instant, and no instantaneous measurement of it
can be a reliable check. It was a coin toss against the phase of a cycle, and it had been landing
heads. The check now polls for movement across several cycles instead. **A property that is only
intermittently true cannot be tested by sampling — the sample size was the bug**, and the two
wrong diagnoses on the way here were both attempts to explain a coin toss with a mechanism.

The fifth is the one worth keeping. Two harnesses reported a **legitimate loss** as a broken
feature — "the top state does not work", "the ladder does not work" — and chasing it is what
produced §9.4's floor measurement above. The fix was a retry, because §9.4 already says what a
rematch is: pressing the toggle again. A wider timeout would have buried the finding. **When a
harness says a feature is broken, the first question is whether the game just beat it.**

**The lying affordance.** `Base.astro` renders `<main id="main" tabindex="-1">` as its
skip-link target. `PROTECTED` contained `[tabindex]`, the click handler used `PROTECTED`, and
so every click inside the page content silently refused to throw a treat — while the crosshair
cursor promised it would. Only the thin strips outside `main` worked. Three harnesses agreed
throwing was fine, because each scanned for a legal point first and quietly found one of those
strips. The fix is two selectors for two questions (`PROTECTED` for what may never be claimed,
`INTERACTIVE` for what a click belongs to) and one new check that does not scan at all: click
the middle of the content, insist a treat appears.

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

### 12.1 The harness charter (2.0) — a fixture is not an assertion

Everything above is a list of lessons, and 2.0 proved that a list is not a mechanism: three
harness failures in one afternoon were all the same mistake, all already written down here, and
all already fixed somewhere else in the fleet. So the rule now lives in code.

**The split.** A harness makes two kinds of statement and they must not be confused.

| | What it is | How it behaves |
|---|---|---|
| **Fixture** | what the harness needs *before* it can measure: a claim in view, a stance that leaps, a claim inside a link, treats in hand | comes from a roll (`pickClaims` seeds from the clock; every fight rolls a stance), so it is **re-rolled until it arrives**, and the report says which attempt it took |
| **Assertion** | what the build does with that fixture | one look. Never retried, never softened, never re-rolled |

The boundary matters because the opposite mistake is worse than the one being fixed: **a suite
loosened until it stays green is worse than a red one.** Re-rolling a fixture is not weakening a
check; re-running an assertion until it passes would be.

**One shared strategy.** `scratchpad/lib/fixture.mjs` holds `deal()` — close the fight, open it
again, ask once more, up to six times — plus the `wants.*` predicates, the context factory (with
the mode declared), `bounded()`, the machine-state readers and the mirrored constants. The fleet
previously had eleven copies of the context factory, four re-rollers with three different budgets,
and three copies each of the placement, throw and lure helpers; that is *why* fixing one call site
never fixed the class. **One loop, all predicates:** `arena4` left the note that separate
re-rollers spend their time undoing each other, so a harness needing a leaping cat *and* a claim in
view asks for both in one `want`.

**Four rules, enforced by `tests/harness-hygiene.test.ts` on every `vitest run`:**

1. a fixture-shaped fallback (`spot ? … : 'none'`, `foe ?? 'never rolled one'`) may appear in
   `fixture(…)` and nowhere else
2. `ok(name, false, …)` is never an assertion — it is a harness saying it could not set itself up
3. `waitForFunction` options go in the **third** argument (1.4's fleet-wide 30s bound)
4. no private re-rollers, and no absolute-path imports — `battle.mjs` shipped one while committed,
   which is the proof that a convention nothing checks decays even in tracked code

**The checker was narrowed once, on purpose.** Its first version matched the *words* — "none",
"nowhere" — and flagged eight correct checks, because `none` is also a CSS value and
`pointer-events: none` is exactly what some assertions assert. A third fallback shape (`x ||
'(none)'`) was then tried and dropped: one real site against four correct ones. **A checker that
has to be suppressed in five places is not enforcing a rule** — and its job is to stop the next
fault, not to be the only reason a known one gets fixed.

**Where the fleet lives.** In `scratchpad/`, committed. Twelve of the fourteen harnesses used to
exist only in a session's `/tmp`, importing Playwright by absolute path into a container that gets
reclaimed — while this document cited them all as `scratchpad/<name>.mjs`. The documentation was
describing a suite that could evaporate, and one container restart mid-session was the reminder.

**What the consolidation itself got wrong, which is the real lesson.** Sixteen files were reduced to
one shared strategy, and **the differences between the copies turned out to be load-bearing three
times** — each caught by a red, none by reading:

- **`armAmmo`'s landing page.** Four harnesses end arming on `/timeline/` (24 claims, ~4 in view at
  once — the board their numbers were calibrated on) and three on `/`. One default silently moved two
  of them, and `arena7`'s desperate-tier measurement collected **zero samples**: the fight simply
  developed differently on a different board. **A shared helper's default is a decision, not a
  convenience** — every call site now states its own board, hops, dwell and settle.
- **`armAmmo(page, 1)`.** A positional `hops` became an options object with no `hops` in it, so the
  section whose entire point was "explore almost nothing" explored five tabs and found five treats.
  **Consolidating helpers means converting call shapes, not just names.** It failed loudly only
  because the check reads the treat count rather than trusting the helper.
- **What "a stance" required.** Two copies also demanded the board exist; flattening that to "just the
  stance" let a deal accept a fight whose claims were not placed yet, and `battle` went three checks
  red — including a treat that never left the HUD, because there was no fight to throw into. The
  condition is three-valued now (`inView` / `any` / `ignore`), one value per original copy, and
  `deal()` takes a `reopen` hook so a file that has always allowed itself a 200ms tail still gets one.

And the checker had to be narrowed **three** times, each time for flagging correct code: the *words*
"none"/"nowhere" (eight false positives — `pointer-events: none` is a thing assertions assert), the
`x || '(none)'` fallback shape (one real site against four readings), and finally its own
documentation — the sentence explaining that `ok(..., false)` is never an assertion parses, to a
regex, as a call to `ok` with `false` second. **A text checker that does not understand comments will
eventually read its own explanation as a violation.**

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

### 13.4 State and persistence — nothing is stored *except one integer*

*Revised in 0.3. 0.2 specified a durable `localStorage` "off" beside a session-only
"on". Building it showed the stored entry could not change any observable
behaviour.*

> **Amended in 2.0, and the boundary is the argument.** §15's endless mode stores one key —
> `cat-best-round`, the deepest round reached. Everything this section was written about is
> still session-only and still dies on a refresh: the fight, the rung, the found-set, the
> collar, the sound toggle, which mode you chose. What is stored is not fight state at all.
> It cannot be spent, it changes nothing about how any future round plays, it can only go
> up, and it is the one thing an *endless* mode needs in order to mean anything past a
> single afternoon.
>
> The 0.3 test still applies and this passes it where the 0.2 opt-out failed: the stored
> entry **does** change something observable — the HUD says "best yet" the first time you
> beat it. **This key, and nothing else, ever.**

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

**Built, 0.8 — the failure row, found exactly where it said it would be.** Step 6
put ~1.9s between the press and the state change, and until then every branch in the
component asked "is the arena on?" — including the toggle's own handler and Esc.
During a flood the answer is *no* while the honest answer to "what did the visitor
ask for" is *yes*, so a second press read as "start one", aborted the curtain, opened
the arena through the abort path, and opened it again when the replacement curtain
reached its hold. Two `open()`s with no `close()` between them replace the claim list
wholesale and strand the first board's styling on the page: twelve marks left behind,
on a page the arena promises to hand back byte-identical.

The fix is that **intent is a separate thing from state**, set the instant the press
lands, and it is what the toggle, Esc and `aria-pressed` all read. Which is also the
better answer to the row above: while a curtain is up, what the button should say is
what you asked it for.

One further trap, worth recording because I walked into it while fixing the first:
syncing intent from `close()` as belt-and-braces is not defensive, it is a race.
Pressing the toggle during the *exit* transition runs the open path, which aborts the
out-curtain and delivers its `close()` — so `close()` lands *after* the new intent and
cancels it. The button then reads "off" over a fight that is opening. Intent is owned
by the entry point; the teardown is mechanism and does not get a vote.

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

### 13.8 The second control (added 1.3), and the third (2.0)

> **2.0 adds "Play it yourself", which is a *mode* rather than a preference.** Same chip, same
> `aria-pressed` handling, same session-only lifetime, and it sits here for the reason this section
> already gives: §13.1 settled that a game does not belong in the accessibility popover, and "which
> game" is more a game than "sound" is. The label is written from the visitor's side — nobody knows
> what "commander mode" is, and everybody knows what *play it yourself* means.
>
> **It only ever takes effect on the next fight**, which is a decision and not a limitation.
> Converting a live fight would have to answer what happens to four kittens halfway through four
> holds, who the boss is hunting on the frame the cursor becomes a target again, and whether a round
> counter becomes a rung. §13.5's lesson is that intent and state disagreeing is where the bugs live,
> so the chip changes intent and the next `open()` reads it. The HUD says what it will do, which is
> the one place the arena's own line describes the future.



The sound toggle in the cat-arena chip is the only other control the fight has
gained since 0.1, so it lives here rather than in a footnote. It is **not** a
second entry point: it cannot start or stop the fight, only the audio (§11). It
is a real `<button>` with `aria-pressed` — the same form rules as §13.3, and the
same "the label does not change with state" rule. State is session-only like
§13.4. It exists because 1.3 added sound and §11's opt-in row is a hard
requirement: the fight may not make a noise until a visitor has said it may.

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
| `injectStreak`, `reseedField`, `resetField`, `stepInk` | `ink-field.ts` | The flood's body |
| `valueNoise2` | `ink.ts` | The **shape of the front** — see below, this was not the plan |
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

**Built, 0.8 — the row that changed, and why it matters more than a row.** The
original table gave the field three jobs: the flood, the render path via
`sampleSmooth`/`coverage`, and the drying. Two of those turned out to be wrong in a
way that only showed on screen.

- **The field cannot supply the front.** Taking the flood's ragged upper edge from
  the ink itself is the honest-sounding version and it produced a **linear-gradient
  wipe**: the field is *empty* above the pours, so there is nothing up there to be
  ragged with, and all that was left was the ramp. A gradient sweeping up the page
  reads as a loading bar, which is precisely what §14.1 says this is not. The front
  is now three octaves of `valueNoise2` per column, drifting with the rise.
- **`coverage` is the wrong curve for a flood.** `COVERAGE_FULL` is `0.055`, tuned
  for a wash where a hint of pigment should already show. Measured against the
  curtain's load, **83% of cells are past it**, so `coverage` returned 1 almost
  everywhere and the "texture" was a constant. The raw load has the range the
  picture needed (p10 0, p50 1.19, p90 1.91) and is tone-mapped without a ceiling.
- **Alpha is coverage; colour is texture.** Not a style choice: §14.3 puts the
  arena's construction behind full cover, so nothing decorative may make the sheet
  see-through. The mottling lives in the ink's darkness instead — except during the
  reveal, where the texture is ramped *back into* the alpha, because
  `inkAfterDrying` is a threshold and returns 1 for a uniform sheet however far
  along the drying is. A sheet with no variation does not dry; it vanishes on one
  frame, which is the snap §14.4 forbids.

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

**Built, 0.8.** Three things this table got wrong, all found by measuring rather
than by looking.

- **A 3px bar cannot slide anywhere.** "Slides in from the top edge" is a legible
  gesture for a panel and an invisible one for a hairline: the whole travel is 3px.
  What arrives instead is the **fill**, measured out from the left while the ink
  dries off it — still an arrival, still from an edge, and actually perceptible.
- **The handoff is not a moment, it is a window, and it has to be aimed.** The bar
  is created during the Hold, behind full ink; a sweep starting there plays entirely
  behind the curtain. Delaying by the hold alone is not enough either, because
  drying is a smoothstep and the sheet is still at 0.99 cover a fifth of the way
  into the Reveal. The delay is `HOLD_FLOOR_MS + 55% of REVEAL_MS`, measured: at the
  hold alone, **one growth frame in six** was visible; now all of them are.
- **The Commit beat does not change the cursor to a paw.** §0 forbids new art. The
  arena's crosshair arrives at Commit instead, which is the same signal — the page
  has stopped being a page — using something that already exists.

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
  **Built, 0.8:** nothing restores focus, because nothing takes it. The arena opens
  no dialog and traps nothing, so the control the visitor pressed simply keeps focus
  through the whole round trip — which is the stronger property, and the one the
  harness pins. "Restores focus" would have been a fix for a problem that does not
  exist, and a `.focus()` call on exit would have *created* one for anybody who
  opened the fight from the keyboard and then tabbed elsewhere.
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

**Built, 0.8.** The two formulas are `tests/curtain.test.ts` rather than a
spreadsheet, which is the same thing that cannot go stale. Every timing above
survived contact; what changed is a row this table did not have.

| Var | `[PH]` | Rationale | "Broken" looks like |
|---|---|---|---|
| `CELL` | 5 | Grid cells per pixel of curtain. Coarser than the wash's 4 because this is a curtain, not a painting — but not the 8 it started at: drying *amplifies* the field's differences, and at 8px what gets amplified is the bilinear lattice | 8: the sheet dries into a regular mesh and reads as a dither pattern |

And one performance finding, which is really a rendering-architecture finding.
Painting per **device** pixel is a 1.15M-iteration loop with two bilinear samples
each, every frame; measured, that ran at **13fps with 261ms gaps** — a flood that
moves half the screen between frames, which is the snap §14.4 forbids arriving by
the back door. The canvas is now sized in *grid* cells and stretched by CSS, the
same trick `InkWash.astro` uses, so the loop is 46k iterations of direct array
reads and the browser's own upscale supplies the softness. That took it to 34fps —
**faster than this machine's idle rAF baseline for the page itself** (31fps), which
is the honest ceiling and the right thing to compare against.

The photosensitivity rule is measured on the page rather than asserted about the
arithmetic: `scratchpad/arena6.mjs` samples composited luminance every frame and
requires at most one reversal per direction, in both themes. The pacing check is
in **cover per millisecond**, not per frame — a per-frame cap turned out to measure
the machine's frame rate, and satisfying it would have meant slowing the flood.

### 14.9 Dependencies

`ink-field.ts` (unchanged — it is already pure), `ink.ts` `inkAfterDrying`,
the §13 toggle (there is no other entry point), and §6's territory bar for the
handoff beat. It depends on **no** mechanic in §5, which is why it can be built
last (§12).

---

## 15. Commander mode (2.0) — the kittens fight, you give orders

### 15.1 Purpose, and the finding that forced it

**The fight was good and nobody could play it.** That is the whole reason this section
exists, and it took five versions to hear properly. 1.2 shipped every numbered section;
1.3 answered "the tester doesn't know what she's doing" with legibility — a teach line, a
clock for every stance, mood and stance tells, sound; 1.4 answered "the pace is slow" with
depth — a last stand, signature moves, a counter. Both were real improvements. Both were
answers to the wrong question, because the same sentence came back.

The problem is not that the fight is unclear. It is that it is **a game with three verbs on
a CV site**. §5.2's core verb is holding a pointer perfectly still for 1400ms; §3's decision
is a resource trade; 1.0 measured that winning means holding 423px from a cat that walks at
170px/s. Positioning, timing and economy — homework, before anything good happens, for a
visitor who came to read about somebody's internship.

So the verb changes **hands**. A kitten does the holding; the visitor watches, or points at
things. Everything §5–§9 measured stays true, because the boss, the board, the stances, the
moods, the dialogue and the endings are untouched — what moved is who performs the hold.

**The promise, stated so it can be tested:** *open it, touch nothing, and the page comes
back.* `scratchpad/commander.mjs` check 1 is that sentence and nothing else.

### 15.2 One round

| Beat | What happens |
|---|---|
| Open | §13's toggle, §14's curtain, §4.1's board — all unchanged. One kitten appears from wherever the cat was. |
| Work | The kitten picks a claim, walks to it, holds it for `KITTEN_WORK_MS`, frees it, picks another. |
| Threat | The boss stalks, telegraphs and pounces at **the nearest kitten**. The cursor is never a target. |
| Hit | The kitten loses its hold and flinches. It loses no ground and does not sit down — see 15.5. |
| Clear | Board empty → the round is banked, the squad gains one, the clock tightens, a new board is dealt on the same page after `ROUND_BEAT_MS`. |
| Full | Board taken → **the same round starts again.** No modal, no penalty, no lost record. |

**There is no losing.** §2's loss and §9.4's ladder are manual mode's; a commander has
neither a treat-of-last-resort nor a rung to stake, so the honest answer to a full board is
another go at it. `roundOutcome` in `squad.ts` is that rule, and what is missing from its
arguments is the feature: it does not take `ammo`.

### 15.3 The two orders

| Click on | Order | Reuses |
|---|---|---|
| a claimed element | the nearest **idle** kitten goes and takes that one | `claimUnder`, and 1.2's `PROTECTED`/`INTERACTIVE` split so links still navigate |
| open page | throw a treat — pulls the cat off whatever it is hunting | §5.4's throw, unchanged |

Both optional, both a single click, neither with a cost. **Ordering deliberately does not
spend a treat**: treats are the throw's resource, and putting a price on the only thing a
commander does would contradict the mode's premise, which is that doing nothing is allowed.

An order is a suggestion about *what*, never about how or when — no queue, no cancel, no
selection. **A bad order is honoured: a commander is allowed to be wrong.** That costs one bit
of state (`Kitten.ordered`) marking the errand §15.4's re-pick rule may not overrule; see the
lesson in §12, because the bit was written, deleted as dead, and then needed.

**A claim sitting under a link cannot be ordered, and that is the intended priority.** The
page's own function outranks the game's: 1.2 split `PROTECTED` from `INTERACTIVE` so that a
claimed card is still a card you can click through to. So the first order reaches most of the
board but not all of it, the visitor gets no feedback about which is which, and the failure
mode is a navigation — the strongest possible interruption. It is accepted rather than fixed,
because the alternative is a fight that eats clicks the page needs, and because the second
order (throw) and doing nothing at all both remain available everywhere. Worth revisiting only
if a real person reports clicking a card and being taken somewhere they did not mean to go.

### 15.4 What a kitten works on next

**Two clocks, compared: can I finish before it arrives?** `workTimeMs` is the walk plus the
hold; `threatTimeMs` is the cat's walk to within `POUNCE_RANGE` at its fastest. Prefer every
claim where the first is smaller, and among those take the one that finishes soonest. When
none qualifies, take the best *ratio* — the claim it comes closest to being able to finish,
which is the one furthest from the cat, which is the only move that changes the situation.

This generalises 1.0's finding rather than replacing it. Set the walk to zero and the rule
reduces to a distance: `POUNCE_RANGE` plus the cat's walk for the length of the hold —
**423px for a 1400ms hold, which is exactly the number 1.0 measured**, and less for a
kitten because it works faster.

Both halves were got wrong first, in ways worth keeping:

- **Safety-first ranking (1.0's strategy, applied literally).** A cursor teleports, so
  distance from the cat is free and maximising it costs nothing. A kitten pays with its legs.
  Measured: it walked to `y: 1303` on a 900px viewport and the board oscillated between three
  and five claims for a minute — six seconds of walking to protect 1.4 seconds of holding.
- **"Take the soonest" as the fallback.** It prices an interruptible hold as though it would
  complete, so a claim under the cat's nose beat one across the room that would actually have
  come back. Traced frame by frame: 0.75 progress, landed on, 0.38, landed on, indefinitely.

### 15.5 Tuning table — all `[PH]`, all derived

| Var | `[PH]` | Rationale | "Broken" looks like |
|---|---|---|---|
| `KITTEN_SPEED` | 250px/s | **Faster than the cat's fastest** (`STALK_SPEED × AGGRO_DESPERATE` = 238). Started at 190 with the opposite reasoning — "a cornered cat should run one down" — which sounds like §7.3's pressure and is the mode failing: a cat that can hold contact cancels the core verb. The cat's threat is ground it takes and guards (§9.3, 1.4's pin), not an animal it deletes | ≤238: a squad in contact never completes a hold, so watching is a lie. ≫300: boards fall before the escalation can bite |
| `KITTEN_WORK_MS` | 1000ms | A kitten's hold, and **not** `SCRUB_MS`. The cat's cycle with no walk to make is `recover × 700 + telegraph × 420 × telegraphScale + LEAP` — **1380ms for siege at even mood, ~1260ms desperate, ~1180ms at the round-aggression cap** — all shorter than a 1400ms hold. A player only survives that by fleeing (0.7); a kitten holding the last claim cannot | ≥1260: a camped claim never comes back, which is the endgame of every round. ≪800: the board falls faster than the escalation can answer |
| `KITTEN_FLINCH_MS` | 220ms | Paint, not a stun — the kitten keeps working through it. Both earlier values *blocked* (900ms matched `SWAT_STUN_MS` for symmetry; 450ms was derived from room to run) and both lost the exchange race above | Anything blocking, at any length. 0: a landed pounce reads as nothing happening |
| `ARRIVE_PX` | 26px | `hunt()`'s own "beside you" distance, reused. Arrival is **sticky**: once holding, a kitten keeps holding until the claim is gone — a tilted element's bounding box drifting a pixel across the threshold otherwise flipped walk/hold on alternate frames and restarted the hold forever | Non-sticky: fifteen seconds of visible wash and nothing ever completing |
| `KITTEN_CAP` | 4 | Each kitten clears about one claim per `KITTEN_WORK_MS` plus a walk, so four finish a `MAX_BOARD` in well under a minute. Also the most motion this site has ever asked for (§11), each one drawn over somebody's writing | Higher: the escalation cannot keep up and rounds stop building |
| Squad size | `1 + rounds cleared`, capped | Round one is one animal on purpose: the clearest possible read on what a kitten *is*. Reinforcement then races the escalation rather than standing apart from it | Starting at the cap: nobody ever sees a single kitten work, which is the mode's whole introduction |
| `ROUND_REGROW_STEP` | 0.82 | The clock tightens per cleared round — the lever 1.4 proved is the one that reaches a distant defender. At siege's 9000ms that is ~1.6s off per round, about one kitten's walk, so a round costs the squad roughly what the reinforcement it just earned pays for | ≤0.6: round four is unclearable however many kittens turned up. ≥0.95: round twelve feels like round one |
| `MIN_REGROW_MS` | `SCRUB_MS`, **per claim** | §9.4's floor restated for a squad: a hold must be worth starting. Charged per claim because §9.3's sweep takes two, and applying it to the interval let two claims arrive on one floor — half the promise. Caught by the rate test, not the browser | Per-interval: a sweeping cornered siege out-reclaims a capped squad at deep rounds |
| `ROUND_AGGRO_STEP` / `CAP` | 0.06 / 1.35 | The meaner half of the escalation, multiplying §7.3's existing aggression — so it needs no new machinery and cannot break §10's whiff invariant, since `telegraphScale` only shortens and floors the wind-up. Capped low because aggression is the lever a *watcher* cannot answer | Cap ≥ `AGGRO_DESPERATE`: a round decided by a number the visitor has no reply to |
| `ROUND_BEAT_MS` | 1500ms | Between rounds: a breath, not an exit. Shorter than `WIN_BEAT_MS` because a win beat is theatre for something *finishing* and this is the same fight continuing | <800: the board changing reads as a glitch. >`WIN_BEAT_MS`: a loading screen between every round |
| `WATCH_TRUCE_MS` | 180s | §11's truce, re-asked for a mode where watching is playing. Measures *presence* — any move, scroll or keypress — rather than play. The hidden-tab truce still covers the commoner case | As short as `IDLE_TRUCE_MS`: the page snatches itself back from somebody watching it. Unbounded: a laptop left here runs an animation loop flat |

**A hit takes tempo, never ground.** `RECLAIM_ON_HIT` is 0 in commander mode, and this is
the load-bearing balance decision of the whole section. It exists in manual mode because a
player who never gets hit would face no pressure (0.6: a loss has to be reachable). A kitten
*cannot dodge* — holding still is the verb — so every landed pounce would be a free claim,
and ground taken by pounces is a second source of board growth that `squad.ts`'s floor does
not price. Measured with it on: one kitten, round one, seventy-two seconds, three claims to
five and back, the round never turning over. The board's rate is the regrow clock alone,
which is the thing §9.3 gives the cat and the thing this section's floor can actually bound.

### 15.6 What is remembered, and what is not

One `localStorage` key: `cat-best-round`, the deepest round ever reached. This reverses
§7.2/§13.4, which said nothing is stored — twice, with arguments — so the boundary is the
justification. Those sections are about **fight state**: territory, the rung, the found-set,
the collar. All of that is still session-only and still dies on a refresh, which is what
keeps losing free. What is stored is one integer that is not fight state, cannot be spent,
changes nothing about how any future round plays, and can only go up. An endless mode needs
one number that survives the tab closing, or "endless" describes a single afternoon.

**This key, and nothing else, ever.** Written through a `try`/`catch` in the style of
`a11y-prefs.ts`: a browser that refuses storage must degrade to "no record yet", not throw
inside a game loop. `commander.mjs` section 5 plays a round with storage denied.

### 15.7 Known properties, honestly

- **A run has no failure state.** With the squad capped and the clock floored, the board's
  rate can never exceed four kittens', so rounds get harder to clear but never impossible: a
  run ends when the visitor stops watching. That is what "no losing" implies, and it makes
  *best round reached* a measure of attention rather than skill. Correct for an idle game on
  a CV site; the first thing to revisit if a playtest finds it hollow.
- **Manual mode is 1.4, and it costs two paths.** Fourteen harnesses measure it and they all
  now declare their mode in one line, because commander mode is the default and a harness
  that does not choose is measuring a spectator being asked to hold still.
- **Still not playtested by a person.** Every number here is `[PH]`, the gate proves the mode
  *works*, and the tester who could not read 1.2 or 1.4 is the only one who can say whether
  this one is finally the right shape.
