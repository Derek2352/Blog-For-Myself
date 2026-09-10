---
# Body rewritten Jul 2026 from Derek's own working document for the film. It
# corrects the earlier draft's claim that Wan 2.5 produced synchronised audio in
# one pass — the music came from Suno, the VO from a separate script, and the
# SFX were layered by hand.
# Title: restored to his chosen "Ai (愛)" on 28 Jul, once src/lib/og.ts learned to
# load Noto Sans TC subsets on demand. It had been "(Love)" because the share
# card rendered the character as a tofu box.
# Sections extended Jul 2026 from Derek's reflection on the project. It also
# corrected the origin: the fruit/gummy-bear version was a rebuild of an existing
# commercial, not his own abandoned concept, so the entry no longer implies the
# beat structure was invented here.
# CORRECTION Jul 28 2026: the fenced "Scene 1, in full" block published here was
# NOT his prompt — I wrote it when the earlier document described the telegraphic
# style without quoting one, and published the invention as a verbatim quotation.
# It has been replaced with the real Scene 1 from his working document. The
# fabricated version said "Photoreal, no text"; his specifies 3D text overlays,
# so it was also wrong about the shot. Same pass corrected the voiceover: BOLD /
# RICH / SMOOTH are on-screen type, not spoken, and the film shipped with the
# hushed VO Option 2.
# Deliberately withheld: the other four scene prompts in full, both VO scripts in
# full (only the shipped lines are quoted), the Instagram / TikTok / LinkedIn copy
# and all hashtags, the Alibaba Cloud submission and gratitude statement, the
# 300-word brief, the cover-art direction, and the "actionable next steps".
title: "From Cherry to Cup: Ai (愛)"
category: "creative-ai"
date: 2026-01-01
endDate: 2026-02-28
role: "Winner — Third Place (Global)"
organization: "Alibaba Cloud — 2025 AI Video for Business Competition"
updated: 2026-07-28
summary: "A fifteen-second conceptual coffee commercial, generated end to end and placed third globally — built on a pun, since AI and 愛 (love) are the same sound."
cover: "./images/cover.svg"
# Drawn cover rather than the placeholder plate: see the `art:` section in README.md.
# Replaced automatically the day a real cover.jpg lands beside this file.
art: "film-strip"
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
case that the result can still land as warmth rather than as a demo. For a while it went by
*Liquid Alchemy*, which describes the technique; the pun describes the point, so the pun
won.

It placed **third globally** in the 2025 AI Video for Business Competition run by Alibaba
Cloud. The brief was business storytelling — turn a brand narrative into something people
actually want to watch — so the piece follows a coffee cherry through to a finished cup in
five beats cut for a phone: a morph, a sip, beans dancing on a table, an avalanche of roast,
and the logo. The morph runs cherry → bean → a floating sphere of espresso → a mug landing,
and what it lands on is heart-shaped latte art. The title's joke, poured into the cup.

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
started writing **telegraphic** ones. Comma-separated, no connective tissue, every clause
buying something — a lens, a light, the way a fluid behaves, a texture. Less a description
of a shot than a specification for one, running from the quality of the light to the
render settings. Scene 1, in full:

```text
Hyper-realistic cinematic macro set on dark walnut counter in sun-lit
modern kitchen, golden hour volumetric beams. Extreme close-up sequence:
vibrant red raw coffee cherry with dew spins, seamlessly morphing into
cracked oily dark-roasted bean, then dissolving into floating sphere of
swirling hot espresso with golden crema. Dramatic slow-motion fluid
explosion reveals white mug landing gently, filled with steaming latte
and heart foam art, surrounded by suspended floating beans. 3D animated
white text overlays: 'BOLD' (bean phase), 'RICH' (liquid phase),
'SMOOTH' (mug landing). 100mm macro, f/2.8 bokeh, 8k, ray-traced
reflections, high-detail textures.
```

Five like that, one per beat. The range across them is the part I'd defend: an 85mm
portrait lens and a real human performance for the sip — a woman lifting the mug, the
drink landing, her eyes closing into a smile, skin detail and subsurface scattering
specified because faces are where these models fail first — then a probe-lens flyover
skimming a mountain of roast, then an anamorphic flare tearing open a black void for the
logo. Iterating shot by shot until the cuts read as one piece rather than five generations
stapled together is the real work, and it is direction rather than typing.

Notice where the words live. `BOLD`, `RICH`, `SMOOTH`, then `AROMA.` and `DIVINE.` later on
— all of it asked for *inside* the generation, not laid over the footage afterwards in the
edit. Generative models are famously bad at rendering type, so this was the reckless
choice; it also meant the letters sat in the scene's own light and picked up its shadows,
which no overlay does.

The audio was assembled, not generated. **Suno** wrote the bed — neo-soul and lo-fi, chosen
because the genre carries warmth without asking for attention — but the useful trick was
that you can prompt for *structure*, not just genre. Bracketed section tags force the
arrangement onto your cut rather than the other way round:

```text
[Percussive Intro]
[Snapping fingers]
[Deep Bass Drop]
[Smooth Jazz Piano Melody]
[Upbeat Groove]
[Clean End]
```

The drop is placed to land on the sip at about three seconds, and then you generate until a
take actually does it. The music hits where the film hits because I asked it to, not because
I got lucky in the edit.

The voice went the other way entirely. Where the on-screen type shouts in single words, the
read is nearly a whisper — *"From the earth… to the fire… to the flow."*, later *"Alive with
aroma."* Two registers running at once, and the contrast is what stops fifteen seconds of
luxury commercial from feeling like it's selling at you. Then sound effects layered by hand
— fire crackle under the roast, liquid pour under the sip, beads for the dancing beans, a
digital whoosh on the logo. Three tools and an edit, not one button.

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
borrowing the vocabulary of the crew you don't have — 100mm macro, f/2.8, golden-hour
volumetric beams, subsurface scattering, a probe-lens flyover, an anamorphic flare. That
isn't fussiness or jargon for its own sake; it's the
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
