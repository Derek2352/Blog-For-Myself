---
# Chinese name (夾單?) and "Top 16" — set/confirm as you prefer
title: "Ah Gaap — AlipayHK Advice UX Design Competition 2026"
category: "competitions"
date: 2026-04-01
endDate: 2026-06-30
role: "Semi-Finalist"
organization: "AlipayHK × Seed Foundation"
location: "Hong Kong"
updated: 2026-07-26
# note: ""  # one-line personal aside in your voice — shows as an italic margin note
summary: "An AI-powered post-payment ledger concept for the AlipayHK Super App — a public-discourse research pipeline distilled into two evidence-anchored personas, 30+ Figma frames, and a 12-screen interactive prototype, built solo in a one-month sprint."
cover: "./images/cover.svg"
gallery:
  - src: "./images/frame-01.svg"
    alt: "Placeholder frame — persona board from the research pipeline (replace with a real screenshot)"
    caption: "Persona board (placeholder)"
  - src: "./images/frame-02.svg"
    alt: "Placeholder frame — journey map (replace with a real screenshot)"
    caption: "Journey map (placeholder)"
  - src: "./images/frame-03.svg"
    alt: "Placeholder frame — prototype screens (replace with a real screenshot)"
    caption: "Prototype screens (placeholder)"
tags: ["ux", "fintech", "product", "research"]
links: []
featured: true
draft: false
---

<!-- FIRST-PASS DRAFT (from your CV + research) — edit freely in your own voice.
     "How it felt" especially is a placeholder; make it yours. -->

## What it was

The AlipayHK **αdvice** UX Design Competition — run by AlipayHK with the Seed Foundation
and HKFYG — asks young people to reimagine part of Hong Kong's most-used e-wallet. My
entry, **Ah Gaap (夾單)**, was a concept for an AI-powered *post-payment ledger*: a feature
that steps in at the one moment a payment app usually goes quiet — right after you've
paid — and helps a group settle, split, and remember who owes what. I carried it to the
Semi-Final over a one-month solo sprint.

The bet was simple to say and hard to earn: a payment doesn't end when the money moves.
For shared meals, trips, and flat expenses, that's exactly where the friction starts — and
where an everyday super-app can quietly do a lot of good.

## What I did

Rather than design from assumptions, I built the evidence first. I stood up a
public-discourse research pipeline that scraped real Hong Kong online conversation, then
ran it through **BGE-M3** multilingual embeddings (chosen because it handles mixed
Cantonese / English / Traditional-Chinese in one model, and outputs dense *and* sparse
representations), reduced the space with **UMAP**, and clustered with **HDBSCAN** — a
density-based method that finds the natural number of themes and sets genuine noise aside
instead of forcing every post into a bucket. Grounded LLM synthesis then turned those
clusters into **two evidence-anchored personas** and journey maps, with every design claim
traceable back to a specific source post. (The pipeline itself is written up separately as
the *Market Analysis Pipeline* entry.)

On that footing I designed the product end-to-end and shipped it solo: **30+ Figma
frames**, a **12-screen interactive prototype**, and **two pitch decks** — built with Claude
Code, Claude Design, Figma, and a self-deployed market-analysis web app.

The feature splits in two. **夾單** handles the meal you've just paid for: point the camera
at the receipt, let OCR parse the line items, and everyone taps to claim what they actually
ate — then split equally, by percentage, or line by line, with payments tracked as they land
rather than chased in a group chat. **後數** is the longer game: a standing ledger for people
who share expenses constantly, flatmates and travel groups, where the balance simply carries.
Its best trick is settling that balance in as few payments as possible — four people owing
each other in a tangle usually nets down to one or two transfers, and working out which ones
is a problem software should solve rather than the person who happens to be best at mental
arithmetic. On screen it's one line — 「用最少 2 次轉帳，可以結清成個小組」 — and the whole job
was making a graph-reconciliation problem read like a reassurance.

Then the part that isn't in any brief. Currency is set in tabular figures so the numbers stop
jittering sideways as digits change; Cantonese and English share a baseline so bilingual rows
sit straight instead of drifting; everything lands on an 8pt grid; and the primary action
stays in the bottom third of a 393×852 screen, where a thumb can actually reach it. The mock
data is Hoi Wong Congee and TamJai SamGor rather than "Restaurant A", and the microcopy is
Cantonese the way people speak it — 「等下慢慢計數先」 — not English translated into
politeness.

After the Semi-Final I kept going and turned it into a proper system: **21 screens** — three
for the architecture, ten for 夾單, seven for 後數, and four for nothing but edge cases: OCR
that isn't sure what it read, a dispute, and a web preview for the person in the group who
doesn't have the app. I gave myself an afternoon — **under four hours** — which is the only
reason the rest of it happened the way it did.

They exist twice over. First as a single self-contained HTML file, Tailwind pulled from a CDN,
which became the source of truth for spacing, colour and motion. Then in Figma, via a
**plugin** I wrote against their API — and here the honest version matters, because the tidy
version isn't true. The plugin lays out the 21-frame grid, builds the chrome every screen
shares (status bar, nav, home indicator), and fully constructs two hero screens with real Auto
Layout: **A1 Payment Success** and **B2 Group Detail**. It cannot do all twenty-one. Ask a
model for that in one pass and you run out of context long before you run out of screens. So
it scaffolds, and I finished the remaining nineteen by hand against the HTML — which is a
better division of labour than the one I set out to build.

## What I learned

The lesson that stuck: *research is a design material, not a preamble.* Because every
persona trait pointed at a real quote, design debates stopped being about taste and started
being about evidence — and the work got faster, not slower. I also learned how much a
finance-and-FinTech lens changes a UX brief: a ledger feature lives or dies on trust,
legibility, and getting the edge cases (partial payments, disputes, someone leaving the
group) right.

Four of the twenty-one screens do nothing but handle things going wrong, and that ratio is
deliberate. The happy path took an afternoon; deciding what the screen says when someone pays
half, disputes a line, or leaves the group still owing money is where the design actually
lived.

I also learned that the tedious half of design work is often automatable, and that noticing
which half is a skill in itself. Writing a plugin to generate the frames took less time than
drawing them would have, and it meant a token change propagated everywhere instead of being
re-applied twenty-one times by hand.

Two smaller things I didn't expect. Figma turned out to be a programmable environment rather
than a canvas: padding, direction and fill stop being panel settings and become
`layoutMode`, `itemSpacing`, `solidPaint` — properties you can compute. And the quality of
what an AI hands back tracks almost exactly how rigorous you were before you asked. The token
list — exact hex values, an 8pt grid, tabular figures, the thumb zone — existed before any
screen did, and that's why the screens came out consistent. A vague prompt doesn't produce
vague work; it produces confident work in the wrong direction.

Doing the whole pipeline — scraping, embeddings, clustering, synthesis, prototype, pitch —
alone in a month taught me where my own bottlenecks are, and how far a disciplined
AI-assisted workflow can stretch one person.

## How it felt

The honest first reaction to my own plan was: how am I going to get twenty-one pixel-perfect
screens out of an afternoon? Sitting with the requirements list — OCR states, animated
markers, balance sheets that have to add up — it read less like a design brief than a dare.

Then I opened the HTML file in a browser and it looked *real*. A grid of iPhone mockups in
Alipay's blue, markers pulsing, spacing that held together. I'd expected something I would
have to apologise for and got something I'd have been happy to hand over. That's the moment
the whole workflow stopped being theoretical for me.

The middle was a wall, and a useful one. The AI couldn't build all twenty-one screens natively
in Figma, and for a while I kept trying to make it — which was me insisting on the version of
the story I'd already decided on. Splitting it instead, letting the plugin scaffold and doing
the finish myself, was slightly deflating for about ten minutes and obviously correct
afterwards. Most of what I learned on this project is in that ten minutes.

By the end I felt genuinely ready — not because the mockups were pretty, but because I could
explain every decision in them and point at where each one came from. Building something
end-to-end on my own, against the clock, was equal parts exhausting and clarifying — and
reaching the Semi-Final made the late nights feel like they'd pointed somewhere real.
