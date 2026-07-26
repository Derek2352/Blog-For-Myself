---
# Facts confirmed from CV (Jul 2026): Champion · Feb–Jun 2026 · CGDFF · HKIoD recognition.
# Body rewritten Jul 2026 from Derek's own production document (structure, metaphors,
# tooling, song). Withheld from the page by his decision: the rubric-mapping framing,
# the pre-submission checklist, and the full VO script / lyrics / pitch script.
#
# NOTE ON "How it felt": its first two paragraphs are drafted from Derek's notes — the
# feelings in them are inferred, not reported. Rewrite them in his own words; the closing
# paragraph is already his. (Kept as a YAML comment on purpose: markdown <!-- --> comments
# in the body are passed straight through into the shipped HTML.)
title: "The Blueprint of Tomorrow"
category: "creative-ai"
date: 2026-02-01
endDate: 2026-06-30
updated: 2026-07-26
role: "Champion"
organization: "“What is Corporate Governance?” Creative Video Contest 2026 — Corporate Governance Development Foundation Fund Limited"
location: "Hong Kong"
summary: "A solo AI-animated short film that won Champion against university-wide entries — distilling risk management, ESG, disclosure and accountability into an accessible public narrative, with recognition from The Hong Kong Institute of Directors."
# Draft aside — rewrite or delete; it prints as an italic margin note in your voice.
note: "Shot 35 took the longest and shows the least — the model kept handing me a tree growing out of a skyscraper."
# video: ""  # paste the film link — it will screen here in place of the cover
cover: "./images/cover.svg"
gallery: []
tags: ["ai-film", "corporate-governance", "esg", "champion"]
links: []
featured: false
draft: false
---

## What it was

The Corporate Governance Development Foundation Fund ran a creative video contest with an
unusually hard brief: make corporate governance *watchable*. Two to three minutes, English
voiceover with Chinese and English subtitles, judged by HSUHK academics and by directors from
**The Hong Kong Institute of Directors** — people who do governance for a living and would
notice immediately if I got it wrong.

Governance sounds abstract until you remember what it's for: keeping boards and management
accountable to the people whose money and trust they hold. So I built the film around a
single decision. A young startup CEO, Alex, is offered a contract she shouldn't sign — and
the timeline splits on her choice.

> "Every big idea starts with a choice. Not just what you build… but *how* you build it."

## What I did

Two worlds, same company. In the first, the rules get ignored and the collapse arrives as
falling black dominoes — cold light, restless cuts, each failure knocking over the next until
it stops being a business problem and becomes a community one. Then time rewinds, the same
company chooses differently, and a golden seed grows into a tree of light, shot warm and
slow, until the tree becomes the Hong Kong skyline.

Every principle had to land as something you could *see* rather than a caption. A red audit
folder tossed aside; the green one actually read. One founder shouting down the room; three
founders voting. Documents shredded; an email to investors that tells them the truth. A toxic
alleyway; a zero-emission plant. Riders protesting outside the office; a rider paid a bonus.

My first storyboard ran **eleven shots**. A two-and-a-half minute film needs about **forty-one**,
and finding that out meant rebuilding the whole thing at the right resolution — which turned
out to be where the emotional work actually lived. World A is cut at roughly a second a shot,
handheld, so it feels like losing your footing. World B runs four-second tracking shots so it
feels like breathing again. The pacing does more of the persuading than the script does.

The craft problems were the interesting part. AI drifts — the same character comes back two
shots later with a different face — so I locked Alex, Ben and Chloe into fixed blueprints and
held them across every generation with Midjourney's `--cref` character reference. Stills then
went through an image-to-video pass in Luma and Runway, where the rule I learned the hard way
is to describe **only the camera and the motion**. Mention the face and the model helpfully
rebuilds it, worse. I also let small spoken asides sit under the narration, because a scene
where someone quietly swears at their own decision lands harder than one that only explains.

The shot the whole ending rests on, the tree becoming the city, was the one thing the models
simply couldn't do: they won't morph one object into another cleanly. Asked to try, it handed
me a tree growing out of a skyscraper. Rather than keep arguing with it, I generated both
pushes separately and cross-dissolved them over three seconds in the edit. It reads as
intentional now, which is the only test that matters.

The pitch slides that went with it are hand-drawn, whiteboard-style, on purpose. A formal room
relaxes when it can see someone's actual thinking rather than a textbook definition reformatted
into a deck.

The theme song is original too — a 125 bpm anthem written for the film and produced with
Suno, fading in on the rewind and carrying the final act.

> *"We're leaving all the secrets in the past! / With fairness in our hands and hearts to
> follow…"*

AI use had to be declared to the judges, which I think is exactly as it should be.

## What I learned

The real discipline was **translation without dilution**: making ESG and disclosure legible
to a general audience without flattening what they actually mean. Every simplification had to
survive contact with someone who knows the subject cold — and that constraint is why the
finance side and the film side stopped feeling like two separate things. The writing had to
be *correct* before it was allowed to be moving.

I also learned to treat a model's limitation as a design brief rather than a defect. The
cross-dissolve isn't a workaround I'm hiding; it's the edit the material asked for once I
stopped insisting the tool do something it can't.

And I learned that rhythm is a tool, not a finishing touch. Going from eleven shots to
forty-one wasn't about filling time — shot length is how you make an audience feel hurried or
safe, and I'd been treating it as an afterthought.

## How it felt

Corporate governance is not a subject I'd have chosen for a film. It reads like homework, and
for a while it behaved like one — the concept was the turn. The moment the parallel worlds
arrived, a boardroom topic became something closer to a thriller, and I actually wanted to
make it.

The middle stretch was mostly stubbornness. Shot 35 took the longest and shows the least: a
model insisting that a tree growing out of a skyscraper was what I'd asked for, over and over,
until I stopped trying to win and went around it. Finding out you can simply *edit* past a
limitation felt less like a compromise than a promotion.

Winning Champion — and being recognised by the people who practise governance
professionally — was the moment my two worlds stopped feeling like a split and started
feeling like an advantage.
