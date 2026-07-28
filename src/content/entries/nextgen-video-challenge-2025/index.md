---
# Body rewritten Jul 2026 from Derek's own production document. It corrects the
# first pass, which described the brief as digital-media marketing and said the
# judges rewarded "pairing AI craft with a marketing strategy" — both invented
# from a CV line. The competition ran on Theme 2, Student Learning Experience.
# "How it felt" extended Jul 2026 from Derek's reflection on the project, which
# also reframed the pivot: he dropped the earlier story to a deadline, not to a
# considered judgement about the brief.
# Deliberately withheld: the abandoned first narrative ("The Unseen Anchor"), its
# character names, and its premise — an earlier pass described it as "about not
# being wanted", which is more than the one-clause-no-plot he asked for, so that
# characterisation is gone. Also withheld: the full VO script and title cards,
# and the submitted 300-word write-up and SBUS interview answers verbatim —
# their substance is rewritten here, not quoted. The disappointment at second
# place is published; his note that it stung more than simpler entries deserved
# is not, by his decision.
title: "NextGen Video Challenge: Powered by AI"
category: "creative-ai"
date: 2025-11-01
updated: 2026-07-27
role: "Winner — First Runner-up (Individual)"
organization: "HSUHK School of Business"
summary: "A sixty-second animated short about a first-year who feels invisible — built by chaining fifteen AI tools into one production line. First Runner-up, a Dean's Recommendation Letter, and a place on a funded study tour."
note: "The two character models lived in my folders as “Sad Theo” and “Confident Theo”. The whole film is one becoming the other."
# video: ""  # paste the film link — it will screen here in place of the cover
cover: "./images/cover.svg"
gallery: []
tags: ["ai-film", "award", "deans-recommendation", "generative-video"]
links: []
featured: false
draft: false
---

## What it was

The **NextGen Video Challenge: Powered by AI**, run by the HSUHK School of Business, asked
students to make something under Theme 2 — *student learning experience* — with generative
AI. Not a marketing exercise and not a tech demo: a story about what it is actually like to
be here. I entered on my own and took **First Runner-up in the Individual Category**.

The film is called **The Architect of Me**. Sixty seconds. Theo is a Year 1 student in the
School of Business who moves through a crowded plaza describing himself as *the same ghost
in a different hallway* — the loneliest line I've written, and the one the whole piece hangs
on. He sees a banner for the Social Innovators Challenge, finds a team, builds something,
pitches it, wins, and turns to the camera at the end: *"A year ago, I was looking for an
ending. Here, I found my beginning."*

The idea I'm proudest of is a costume change. Theo starts in a charcoal hoodie with his hair
unbrushed and ends in a bomber jacket in HSUHK's deep green and warm gold. Growth and
belonging become the same visual fact, so the film never has to say either one out loud.

It didn't begin here. I was some way into a different and much more personal story when the
competition email landed, and I dropped it — not because I'd stopped liking it, but because
it wasn't what the brief was asking for and there wasn't time to have both.

## What I did

Sixty seconds of animation came out of fifteen tools arranged in order, and the arrangement
is the actual work. **Gemini** for the script, the gap analysis and the storyboard, with
**Google AI Studio** as the single place every prompt lived so the vocabulary stayed
consistent across models that had never heard of each other.

Then the step I'd repeat on anything: **blocking every scene in FigJam before generating a
frame of it**. Where Theo stands, where the camera is, what's behind him. Generation goes
badly when you ask for a shot you haven't decided on yet, and a design tool turns out to be
the cheapest place to decide.

From there: **Midjourney Niji 6** on a locked moodboard for the plates, so the soft painterly
look held from shot to shot; **Nano Banana** to composite one fixed Theo into those plates
rather than re-rolling him each time; **Kling 2.5** and **Seedance 1.0 Pro** swapped
shot-by-shot depending on which handled that particular motion better, with **Wan 2.5** for
the camera moves neither could manage. **ElevenLabs** gave me two readings of the same voice
— subdued for the boy in the dark bedroom, warm for the one holding the trophy.
**Suno** wrote a theme that walks from solo piano to orchestral pop-rock across the minute.
**Sync.so** for lip-sync, **Galaxy AI** to paint out artifacts at the head and tail of
renders, **Upscayl** on stills before generation and **Topaz** on video after, then
**CapCut** for the grade and the mix.

Three details that aren't obvious and cost me the most to find:

- **The whole cut runs at 1.18×**, pitch preserved. AI motion floats; everything drifts
  slightly slow and slightly dreamy. Speeding the entire timeline a fraction makes movement
  read as deliberate, and it's the single cheapest fix for the tell that a video was
  generated.
- **Music ducks 8 dB under every spoken line.** The theme has vocals of its own, so left
  alone it argues with the narration for the whole minute. Nobody notices ducking done well
  and everybody notices it missing.
- **The group shots dip to white**, which reads as a camera flash and hides the frames where
  the model quietly gave up on the background.

One decision was strategic and I'd rather say so than pretend otherwise. Green and gold is
the university's palette, and putting the winning version of Theo in it means an
institutional audience watches a character become one of them. That does the story's job —
he belongs now — and the client's job in the same shot. Both were intended. Reading who is
in the room isn't gaming a brief; it's most of what answering one means.

## What I learned

With one model you argue with the prompt. Across fifteen, you defend **continuity** — and
that turns out to be a completely different discipline. Fifteen tools is fifteen chances for
Theo's face to change, for the light to jump, for the hoodie to be a slightly different
grey. Almost every technique in this project exists for that reason and no other: the locked
moodboard, the blocking pass, compositing one fixed character into generated backgrounds
instead of asking for him again. None of those are AI techniques. They're what film
production has always done about continuity, and I arrived at them by having the problem.

The corollary is that the hard part of an AI workflow isn't any single generation. It's the
seams. Every handoff between two tools is a place where quality drops or something silently
changes, and the work is noticing before the audience does.

Audio taught me the same lesson from the other side. I'd have said sound was the last ten
percent of a video; it's closer to half, and it's the half nobody credits. A clean duck and
a theme that changes shape as the story does are worth more than another pass of upscaling.

I also learned that a deadline is a legitimate reason to abandon something good. I liked the
story I dropped. There wasn't a version of that month where I finished both, and choosing
the one the brief was actually asking for turned out to be a skill rather than a compromise
— the sort of thing that's obvious in hindsight and genuinely hard at the time.

There's an odd through-line here too. I used a design tool to think spatially on this
project — FigJam as a place to block shots — about a year before I ended up using Figma as a
programmable environment on the Ah Gaap work. The instinct that a design surface is for
thinking in rather than drawing in started here.

## How it felt

I wrote a first-year student who feels invisible, and I did not have to research him. My own
submission says the film came from the universal anxiety of arriving somewhere new *and from
personal experience*, which was a careful way of saying I knew exactly what the ghost in the
hallway felt like. The story I'd set aside came from the same place, which is probably why
losing it was survivable.

Until that email arrived, this had been play. Characters, storylines, nothing due, no one
waiting. Then it was sixty seconds, a three-hundred-word write-up and a date, and the gear
change was violent. My first honest thought was that I had no idea whether a film could be
built in the time available.

The middle of it disappeared. Weeks of running one shot through Kling and then Seedance to
see which understood the motion, re-reading lines in ElevenLabs until the sad Theo sounded
sad rather than merely slow, nudging the song, painting out a glitch, watching the same
sixty seconds for the four-hundredth time. Somewhere in there I stopped feeling like a
student with a project and started feeling like a very small studio.

Then the part nobody photographs: showing drafts to anyone who would watch, and bracing.
Would they notice the speed-up? The lip-sync going soft on one line? A typo on a title card?
When you have made every frame yourself there is nowhere to look away to, and every flaw is
in your own handwriting.

There's something slightly vertiginous about the result, too. I took my own unease, gave it
to a character, dressed that character in the university's colours, and the university gave
me a prize for it. I don't think that's cynical — the feeling in the film is real, and Theo's
ending is one I'd genuinely wish on a first-year watching it. But I noticed.

The result itself arrived as two feelings about a second apart. First Runner-up, and real
elation. Then: not first. I'd built the whole thing end to end and some part of me had
quietly decided that ought to settle it — and it doesn't, because a placing is what a panel
thought on one particular afternoon. It took a few days, and writing the winners' interview,
to land somewhere better: the medal is theirs to give, the workflow is mine and it travels.
There's an iPad Air on my desk from it that I like a great deal, and it is not the part I
kept.

What outlasted the sixty seconds was bigger than the placing: a formal **Recommendation
Letter signed by the Dean of the School of Business**, and a funded study tour across
**Macao, Zhuhai, Guangzhou and Shenzhen**. This was early — before the corporate-governance
film, before the coffee commercial — and it was the first evidence that the direction I was
betting on had somewhere to go.
