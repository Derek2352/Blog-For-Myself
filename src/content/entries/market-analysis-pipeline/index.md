---
title: "Market Analysis Pipeline"
category: "creative-ai"
date: 2026-04-01 # TODO: verify — aligned to the Ah Gaap sprint; adjust if needed
summary: "A from-scratch analytics pipeline: public Hong Kong sources → mixed Cantonese/English/Traditional-Chinese normalization → BGE-M3 embeddings → UMAP + HDBSCAN clustering → grounded persona and journey-map synthesis → Playwright-rendered PNGs. No external APIs, cost-minimized."
cover: "./images/cover.svg"
gallery: []
tags: ["nlp", "embeddings", "clustering", "python"]
links:
  - label: "GitHub — Derek2352/Market-Analysis"
    url: "https://github.com/Derek2352/Market-Analysis"
featured: true
order: 1 # homepage hero (also pins first in its category grid)
draft: false
---

<!-- FIRST-PASS DRAFT (from your CV + research) — edit freely in your own voice.
     "How it felt" especially is a placeholder; make it yours. -->

## What it was

The engine under the *Ah Gaap* competition entry — a from-scratch analytics pipeline that
turns messy public discourse into grounded, cited user research. The design goal was
deliberately strict: **no external APIs, cost-minimised, reproducible**, so the whole thing
runs on my own machine and every output can be traced to a source.

## What I did

The pipeline is a clean chain, each stage doing one job:

- **Collect** — scrape public Hong Kong sources into a raw corpus.
- **Normalise** — handle genuinely mixed **Cantonese / English / Traditional-Chinese** text,
  the hard part of working with real HK discourse rather than clean English datasets.
- **Embed** — encode with **BGE-M3**, a multilingual model that maps 100+ languages into one
  space and emits dense *and* sparse vectors, so semantically similar posts sit together
  regardless of which language they're written in.
- **Reduce & cluster** — compress with **UMAP** (which preserves local neighbourhood
  structure), then cluster with **HDBSCAN**, which finds the natural number of themes,
  copes with uneven cluster densities, and labels true outliers as noise instead of
  forcing them into a group.
- **Synthesise** — grounded LLM synthesis reads each cluster and writes evidence-anchored
  personas and journey maps, every claim tied back to a real post.
- **Render** — **Playwright** renders the final artefacts to PNG for the deck.

## What I learned

Building it API-free was the best constraint I could have imposed: it forced me to actually
understand each stage — why BGE-M3 over a monolingual model, why UMAP-then-HDBSCAN rather
than k-means (no need to guess *k*, and noise is a feature not a bug) — instead of renting
someone else's black box. The multilingual normalisation step humbled me the most; real
Hong Kong text is code-switched, and pipelines that assume tidy English fall over on it.

Most of all, this is where my two sides meet: the rigour of financial analysis pointed at
unstructured human language, output as something a designer can actually use.

## How it felt

<!-- Placeholder — rewrite this honestly in your own words. Prompts if useful:
     the first clean cluster map; a bug that cost you a night; the satisfaction of a
     pipeline that just runs. -->

There's a particular quiet satisfaction in a pipeline that runs end-to-end on its own — raw
text in one end, a cited persona out the other — and knowing I understand every step in
between.
