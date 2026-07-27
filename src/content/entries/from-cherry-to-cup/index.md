---
# Body rewritten Jul 2026 from Derek's own working document for the film. It
# corrects the earlier draft's claim that Wan 2.5 produced synchronised audio in
# one pass — the music came from Suno, the VO from a separate script, and the
# SFX were layered by hand.
# Title: he chose "Ai (愛)", but src/lib/og.ts loads latin-only font subsets, so
# the share card rendered the character as a tofu box. "(Love)" until the OG
# pipeline carries a CJK face.
# Sections extended Jul 2026 from Derek's reflection on the project. It also
# corrected the origin: the fruit/gummy-bear version was a rebuild of an existing
# commercial, not his own abandoned concept, so the entry no longer implies the
# beat structure was invented here.
# Deliberately withheld: the other four scene prompts in full, the Suno BGM
# prompt (the bracketed-structure technique is described, the prompt is not), the
# LinkedIn caption and hashtags, the artist statement and submission sign-off,
# and the document's "actionable next steps".
title: "From Cherry to Cup: Ai (Love)"
category: "creative-ai"
date: 2026-01-01
endDate: 2026-02-28
role: "Winner — Third Place (Global)"
organization: "Alibaba Cloud — 2025 AI Video for Business Competition"
updated: 2026-07-27
summary: "A fifteen-second conceptual coffee commercial, generated end to end and placed third globally — built on a pun, since AI and 愛 (love) are the same sound."
cover: "./images/cover.svg"
gallery: []
# video: ""  # paste the YouTube/Vimeo/Bilibili link — the film plays on this page
tags: ["ai-film", "award", "prompt-engineering", "generative-video"]
links: []
featured: true
draft: false
---

## What it was

The title is the whole argument. **AI** is artificial intelligence; said aloud it is also
**愛** — *ai*, love. A fifteen-second commercial generated end to end by machines, making the
case that the result can still land as warmth rather than as a demo.

It placed **third globally** in the 2025 AI Video for Business Competition run by Alibaba
Cloud. The brief was business storytelling — turn a brand narrative into something people
actually want to watch — so the piece follows a coffee cherry through to a finished cup in
five beats cut for a phone: a morph, a sip, beans dancing on a table, an avalanche of roast,
and the logo.

## What I did

It didn't start as coffee, and it didn't start as mine. The first build was a rebuild — an
existing fruit-to-gummy-bear commercial, taken apart to see whether the models could hold
that much fast physical detail together. By the time I abandoned it, I'd learned the thing
worth keeping: not the subject but the skeleton. Morph, reaction, dance, climax. That
structure carried over; the fruit didn't.

Coffee buys things a sweet does not: steam, a pour, a roast, low warm light. A sensory
register you can shoot, and a premium one you can sell in. The pun only works in that
register too; *love* over a gummy bear is a joke, *love* over a morning cup is a claim.

I built it on Alibaba Cloud's generative stack — **Qwen** for language, **Wan 2.5** for
image-to-video. The craft moves upstream into the prompt, and the change that actually
improved the output was one of register: I stopped writing conversational descriptions and
started writing **telegraphic** ones. Comma-separated, no connective tissue, every token
carrying lens, aperture, light, fluid behaviour, texture. It reads like a shot list because
that is what it is. Scene 1, in full:

```text
Extreme macro, 100mm f/2.8, shallow depth of field. A single glossy red
coffee cherry rests on dark wet slate. Slow push in. The skin splits and
peels back in one continuous motion, revealing a roasted bean beneath —
matte, fissured, still dusted. Warm low-key key light from the left, deep
shadow right, faint steam drifting through the beam. Photoreal, no text.
```

Five prompts like that, one per beat: morph, sip, beans dancing on a table, an avalanche of
roast, the logo. Iterating shot by shot until the cuts read as one piece rather than five
generations stapled together — that's the real work, and it is direction rather than typing.

The audio was assembled, not generated. **Suno** wrote the bed — neo-soul and lo-fi, chosen
because the genre carries warmth without asking for attention — but the useful trick was
that you can prompt for *structure*, not just genre. Bracketed section tags force the
arrangement onto your cut rather than the other way round: a percussive intro under the
morph, the drop landing on the sip at about three seconds. Then generate until a take
actually does it. The music hits where the film hits because I asked it to, not because I
got lucky in the edit. A voiceover line rides each beat: *Start Bold. Get Rich. Make it
Smooth.* Then sound effects layered by hand — fire crackle under the roast, liquid pour
under the sip, beads for the dancing beans, a digital whoosh on the logo. Three tools and an
edit, not one button.

The judging weighed production quality, promotional usability, and social-media engagement,
so I designed for a real audience, not just a showreel: a narrative arc, a brand payoff, and
a length that holds attention.

## What I learned

AI doesn't remove the director; it relocates the effort. Nothing in this piece came from the
models being good — Wan renders a cherry splitting whether or not the film means anything.
The two decisions that made it work were both mine and both cheap: walking away from the
rebuild once it had taught me what it had to teach, and compressing the prompts until every
word did a job. The first is taste, the second is precision, and neither is a feature you
can buy.

The telegraphic style taught me something narrower and more useful. Directing a model means
borrowing the vocabulary of the crew you don't have — 100mm, f/2.8, key light from the left,
fall-off into the right of frame. That isn't fussiness or jargon for its own sake; it's the
difference between describing a shot and writing the order a cinematographer would receive.
And compressing all of it into telegraphic form cost nothing, because the words I cut were
never the ones carrying the picture.

The last thing was about audience. The same fifteen seconds has to be framed one way for a
judge reading it as a business case and another way for someone deciding in half a second
whether to keep watching — and finishing a piece and getting it seen turn out to be two
different jobs.

There's a through-line to the rest of my work here: the same instinct that reads a business
narrative for a pitch reads it for a film.

## How it felt

It began as a dare I'd set myself rather than a project. Could the models actually rebuild a
commercial like that one — the speed, the physics, the way liquid behaves? Nothing of mine
was at stake in the answer, which is probably why I was willing to find out.

Choosing coffee was the moment it stopped being a test. I'd gone in to see whether a tool
worked and came out wanting to make something, and the ambition arrived in the middle rather
than at the start — which is not how I'd assumed creative work went.

Then I lost days to a still image. The cover went round after round — *completely
different*, then *simpler*, then different again — and none of it was technically hard. It
was the specific friction of holding a picture in your head you can't describe well enough
to get back out. Landing the clean 16:9 was satisfying out of all proportion to its size,
which told me something about how much of this work is just declining to accept the
fourth-best version.

Placing third in a *global* field for something I directed frame by frame was a genuine jolt
of encouragement — proof that the creative side of my work travels beyond Hong Kong. The
part I'm quietly happiest about isn't the placing though. It's that the joke survived. AI
and 愛 are the same sound, and fifteen seconds of machine output still came out the far side
feeling like something a person made on purpose.
