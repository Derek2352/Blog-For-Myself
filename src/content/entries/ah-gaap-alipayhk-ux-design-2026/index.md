---
# Body corrected Jul 2026 against the design repo (turbo-carnival2352, branch
# claude/alipayhk-gaap-daan-ui-NQiRv — prototype, both decks, and the eight split
# pages built for Figma import). Three corrections: the product has three parts,
# not two (夾單 × 阿夾 × 後數 — the AI agent was missing entirely); the frame count
# was wrong and its own breakdown summed to 24 rather than the 21 it claimed
# (real: 3+10+8+8+5+2 = 36, read from the fid/fname pairs in pages/*.html); and
# the "12-screen prototype" figure isn't verifiable from the bundled prototype,
# so it's gone rather than guessed at.
# Confirmed with Derek: the run ended at the Semi-Final — the 11-slide "Final
# Round" deck was built for a round he didn't reach.
# Withheld: the decks and prototype themselves, and the scraped quotes.
title: "夾單 · 阿夾"
category: "competitions"
date: 2026-04-01
endDate: 2026-06-30
role: "Semi-Finalist"
organization: "AlipayHK「advice」青年科創UX設計比賽暨實習計劃2026"
location: "Hong Kong"
updated: 2026-07-28
note: "The best deck I made is one nobody ever saw."
summary: "A post-payment ledger for the AlipayHK super app, in three parts — 夾單 to split a bill, 阿夾 an AI agent that keeps the record, 後數 a standing ledger between people who share costs constantly. Two personas traced back to scraped Cantonese posts, 36 design frames, built solo."
cover: "./images/cover.svg"
# The one entry whose photographs are never arriving — the decks and the prototype are withheld —
# so its cover is a drawing rather than a slot held open for one. Drawn by `npm run covers` from
# scripts/cover-art.mjs; the entry page credits it as an illustration, not a screenshot.
art: "split-bill"
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

## What it was

**AlipayHK「advice」青年科創UX設計比賽暨實習計劃2026** — a competition and internship
programme asking young people to reimagine part of Hong Kong's most-used e-wallet. My
entry was a concept for a *post-payment ledger*: something that steps in at the one moment
a payment app usually goes quiet — right after you've paid — and helps a group settle,
split, and remember who owes what. I took it to the Semi-Final over a one-month solo sprint.

It has three parts, and they're named the way people would actually say them. **夾單** is
the split itself: the meal you just paid for. **後數** is the standing ledger for people
who share costs constantly — flatmates, travel groups — where the balance simply carries.
And **阿夾** is the AI agent sitting across both, which is where the name comes from: not a
feature, a character.

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

They came out as **阿欣**, a cross-border shopper in her thirties, and **嘉俊**, who pays by
QR every day and had complained — in a real post — that AlipayHK lags a second or two at
the till and he'd rather use PayMe. Each carries the cluster it came from and a confidence
score, so a persona trait isn't an assertion I made up; it's a number and a link to the
thread underneath it.

On that footing I designed the product end-to-end and shipped it solo: **36 design
frames**, an interactive prototype, and **two pitch decks** — built with Claude Code,
Claude Design, Figma, and a self-deployed market-analysis web app.

**夾單** handles the meal you've just paid for: point the camera
at the receipt, let OCR parse the line items, and everyone taps to claim what they actually
ate — then split equally, by percentage, or line by line, with payments tracked as they land
rather than chased in a group chat. **後數** is the longer game: a standing ledger for people
who share expenses constantly, flatmates and travel groups, where the balance simply carries.
Its best trick is settling that balance in as few payments as possible. Four people owing
each other in a tangle is a graph, and a graph can be reduced: in the worked case I put in
the deck, **six transfers collapse to two**. Working out which two is a problem software
should solve rather than whoever in the group is best at mental arithmetic. On screen it's
one line — 「用最少 2 次轉帳，可以結清成個小組」 — and the whole job was making graph
reconciliation read like a reassurance.

**阿夾** is the third part and the one the entry is named after. It reads the group's
messages, receipts and history and offers to do the arithmetic in conversation rather than
in a form. Two of its frames are the ones I'd defend hardest: *Proactive Inference*, where
it notices an expense before anyone files it, and *AI Mediation*, where two people disagree
about who owes what and it arbitrates. Building an agent that takes a position in a money
disagreement between friends is a design stance, not a demo — it has to be right, and it
has to be seen to be fair. There's a *Fairness Audit* frame for exactly that reason.

Then the part that isn't in any brief. Currency is set in tabular figures so the numbers stop
jittering sideways as digits change; Cantonese and English share a baseline so bilingual rows
sit straight instead of drifting; everything lands on an 8pt grid; and the primary action
stays in the bottom third of a 393×852 screen, where a thumb can actually reach it. The mock
data is Hoi Wong Congee and TamJai SamGor rather than "Restaurant A", and the microcopy is
Cantonese the way people speak it — 「等下慢慢計數先」 — not English translated into
politeness.

After the Semi-Final I kept going and turned it into a proper system — **36 frames**: three
for the architecture, ten for 夾單, eight for 後數, eight for 阿夾, five for nothing but
things going wrong, and two documenting the components and the micro-detail rules. The edge
cases are OCR that isn't sure what it read, a dispute, a web preview for the person in the
group who doesn't have the app, dark mode, and — the one I like most — the agent getting it
wrong and recovering, because trust is built at the moment a system admits a mistake. I gave
myself an afternoon for the first pass — **under four hours** — which is the only reason the
rest of it happened the way it did.

They exist twice over. First as a single self-contained HTML file, Tailwind pulled from a CDN,
which became the source of truth for spacing, colour and motion. Then in Figma, via a
**plugin** I wrote against their API — and here the honest version matters, because the tidy
version isn't true. The plugin lays out the frame grid, builds the chrome every screen shares
(status bar, nav, home indicator), and fully constructs two hero screens with real Auto
Layout: **A1 Payment Success** and **B2 Group Detail**. It cannot do the whole set. Ask a
model for that in one pass and you run out of context long before you run out of screens. So
it scaffolds, and I finished the rest by hand against the HTML — which is a better division
of labour than the one I set out to build.

Then there's a deck nobody saw. After the Semi-Final I built an eleven-slide Final-round
deck: a traceability table mapping each design decision to the scraped line that justifies
it, the agent's architecture as six signal inputs, and — the part where my degree finally
shows up — a commercial case. Retention framed properly: a wallet is a button people press,
and a shared ledger is a reason to come back. Then the moat, which is the argument I'd stand
behind: no competitor in Hong Kong owns a persistent ledger, native local payment, Cantonese
AI and a shared record all at once. Its closing line is the honest one — next step, actual
first-hand interviews, because everything so far was inferred from posts rather than asked
of anyone. That round never came.

## What I learned

The lesson that stuck: *research is a design material, not a preamble.* Because every
persona trait pointed at a real quote, design debates stopped being about taste and started
being about evidence — and the work got faster, not slower. I also learned how much a
finance-and-FinTech lens changes a UX brief: a ledger feature lives or dies on trust,
legibility, and getting the edge cases (partial payments, disputes, someone leaving the
group) right.

Five of the thirty-six frames do nothing but handle things going wrong, and that ratio is
deliberate. The happy path took an afternoon; deciding what the screen says when someone pays
half, disputes a line, or leaves the group still owing money is where the design actually
lived.

I also learned that the tedious half of design work is often automatable, and that noticing
which half is a skill in itself. Writing a plugin to generate the frames took less time than
drawing them would have, and it meant a token change propagated everywhere instead of being
re-applied by hand across every frame.

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

The honest first reaction to my own plan was: how am I going to get a system's worth of
pixel-perfect screens out of an afternoon? Sitting with the requirements list — OCR states, animated
markers, balance sheets that have to add up — it read less like a design brief than a dare.

Then I opened the HTML file in a browser and it looked *real*. A grid of iPhone mockups in
Alipay's blue, markers pulsing, spacing that held together. I'd expected something I would
have to apologise for and got something I'd have been happy to hand over. That's the moment
the whole workflow stopped being theoretical for me.

The middle was a wall, and a useful one. The AI couldn't build the whole set natively
in Figma, and for a while I kept trying to make it — which was me insisting on the version of
the story I'd already decided on. Splitting it instead, letting the plugin scaffold and doing
the finish myself, was slightly deflating for about ten minutes and obviously correct
afterwards. Most of what I learned on this project is in that ten minutes.

By the end I felt genuinely ready — not because the mockups were pretty, but because I could
explain every decision in them and point at where each one came from. Building something
end-to-end on my own, against the clock, was equal parts exhausting and clarifying — and
reaching the Semi-Final made the late nights feel like they'd pointed somewhere real.
