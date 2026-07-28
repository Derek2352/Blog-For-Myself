---
# Rewritten Jul 2026 from the repository itself (Derek2352/Market-Analysis,
# 90 commits, 17–20 May 2026), not from the CV line the first pass used.
# Correction: the old summary ended "No external APIs, cost-minimized". Synthesis
# calls Claude or DeepSeek and refuses to run without a key (src/cli.py:731) —
# it's the scrape/embed/cluster stages that are API-free. "Playwright-rendered
# PNGs" was checked and is correct (src/render/core.py drives headless Chromium).
# Withheld: which specific sources are ToS-flagged (the mechanism is the story,
# the list isn't), the repo's internal planning notes, and env var names.
title: "Market Analysis Pipeline"
category: "creative-ai"
date: 2026-05-17
endDate: 2026-05-20
updated: 2026-07-28
summary: "A research tool that turns public online discussion into cited personas and journey maps — 34 scrapers across four regions, local embeddings and clustering, synthesis where every claim must name its source, and a web UI to run it from. Built in a four-day sprint."
cover: "./images/cover.svg"
gallery: []
tags: ["nlp", "embeddings", "clustering", "python", "llm"]
links:
  - label: "GitHub — Derek2352/Market-Analysis"
    url: "https://github.com/Derek2352/Market-Analysis"
featured: true
order: 1 # homepage hero (also pins first in its category grid)
draft: false
---

## What it was

It started as the engine under the *Ah Gaap* competition entry: I needed real user
research and had neither a budget nor a panel, so I built something that could read
public discussion and turn it into personas I could actually defend. The design rule was
strict — **traceable, reproducible, cheap** — because a persona nobody can check is just
a nicely typeset opinion.

Then it kept going. What's in the repo now isn't a script but a tool: four regions wired
(Hong Kong, Taiwan, Japan, the US), 34 registered scrapers, a FastAPI service, a Next.js
front end, an export path to PNG and PDF, and a Windows launcher so it runs on a machine
with no Python on it. Ninety commits over four days in May.

## What I did

The core is still a chain where each stage does one job. **Collect** from public sources.
**Normalise** genuinely mixed Cantonese / English / Traditional Chinese — the part that
breaks anything built for tidy English — with per-language tokenisers and query expansion
that splits compounds and crosses languages. **Embed** with BGE-M3, stored in DuckDB
through its vector extension so similarity search needs no separate database. **Reduce
and cluster** with UMAP then HDBSCAN, which finds its own number of themes and is allowed
to call an outlier an outlier. **Synthesise** personas and journey maps. **Render** each
one to a deterministic PNG through headless Chromium, CJK glyphs and all, with no network
call at render time.

Everything up to synthesis runs on my own machine with no API and no per-token cost. The
synthesis step is the exception and I'd rather say so plainly: it calls Claude, or
DeepSeek if you'd rather. That's also where the cost work went — the system prompt and
evidence pack are cached and shipped once per cluster rather than per request, which
takes roughly 70% off the journey call.

The part I'd defend hardest is what happens around the model. Every claim has to cite a
document id from the evidence pack it was given. A validator checks the citations and the
verbatim quotes; when a claim fails twice, the section is marked **unverified** rather
than quietly kept. Numbers like *how many users mentioned this* are computed from the
cluster before the model ever sees it, so they can't be invented. There's an adversarial
pass that argues against the output.

On top of that sits the thing that made it a tool rather than a folder of scripts: a
FastAPI service that streams pipeline events over SSE — replaying what already happened,
then tailing live — and a Next.js interface that shows a run assembling itself, then the
persona cards, the journey maps, and a drawer that opens the underlying quotes behind any
claim.

## What I learned

The most useful thing I built has nothing to do with machine learning. Scraping raises a
question every project quietly skips: *are you allowed to?* So the source registry
records, per source, what the terms of service actually say, whether robots.txt permits
it, when I last checked, and when the parser last worked. Sources whose terms prohibit
scraping can't be switched on by default — not by convention, but because the schema
refuses to construct that object at all, so the only way to run one is to name it
explicitly on the command line and own the decision. Author identities are hashed with a
per-install salt. The tests run against stored fixtures, so the suite never touches a
live site.

Writing that validator taught me more than any of the modelling did. An intention lives
in your head and decays; a constraint in the schema is still there in six months when
you're tired and in a hurry. If a rule matters, make the code unable to break it.

The evaluation suite taught the same lesson from the other end. Five frozen products,
scoring how many known pain points the pipeline actually recovers, wired so CI fails
below a threshold. It is genuinely unpleasant to build the thing that tells you your work
is worse than you thought — and it's the only reason I trust any number the tool produces.

And the API-free choice earned its keep. Owning each local stage forced me to understand
why BGE-M3 over a monolingual model, why UMAP-then-HDBSCAN rather than k-means — no
guessing at *k*, and noise treated as a finding rather than something to be assigned to
the nearest group. Rented black boxes don't teach you that.

## How it felt

Four days, ninety commits, and the constant low-level fear that the whole thing was an
elaborate way of generating plausible nonsense. That fear is the reason for the citation
requirement, the quote checker and the eval set — every one of them exists because I
didn't trust the output and wanted to know rather than hope.

The moment it turned was the first clean cluster map: months of scattered Cantonese
complaints resolving into themes I could name, then a persona whose every line I could
click through to the post it came from. Grounded, and checkable by someone who thinks I'm
wrong.

There's a quieter satisfaction in the parts nobody sees. A pipeline that runs end to end
on its own, raw text in one side and a cited persona out the other. And a validator that
will stop me doing something I'd decided not to do, on a day when I've forgotten I decided
it.
