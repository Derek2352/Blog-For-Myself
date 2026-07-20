---
# Chinese name (夾單?) and "Top 16" — set/confirm as you prefer
title: "Ah Gaap — AlipayHK Advice UX Design Competition 2026"
category: "competitions"
date: 2026-04-01
endDate: 2026-06-30
role: "Semi-Finalist"
organization: "AlipayHK × Seed Foundation"
location: "Hong Kong"
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

## What I learned

The lesson that stuck: *research is a design material, not a preamble.* Because every
persona trait pointed at a real quote, design debates stopped being about taste and started
being about evidence — and the work got faster, not slower. I also learned how much a
finance-and-FinTech lens changes a UX brief: a ledger feature lives or dies on trust,
legibility, and getting the edge cases (partial payments, disputes, someone leaving the
group) right.

Doing the whole pipeline — scraping, embeddings, clustering, synthesis, prototype, pitch —
alone in a month taught me where my own bottlenecks are, and how far a disciplined
AI-assisted workflow can stretch one person.

## How it felt

<!-- Placeholder — rewrite this honestly in your own words. Prompts if useful:
     the moment the clusters first "made sense"; presenting a solo project to the panel;
     what a one-month sprint did to your weeks; what you'd defend and what you'd redo. -->

Building something end-to-end on my own, against the clock, was equal parts exhausting and
clarifying — and reaching the Semi-Final made the late nights feel like they'd pointed
somewhere real.
