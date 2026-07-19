#!/usr/bin/env node
/**
 * npm run new-entry
 * Scaffolds a substantial entry: prompts for title + category (validated
 * against src/data/categories.ts, offering to create a new tab), then writes
 *   src/content/entries/<slug>/index.md   (full frontmatter, draft: true,
 *                                          four-heading reflection template)
 *   src/content/entries/<slug>/images/    (.gitkeep + generated cover.svg so
 *                                          the build passes before photos)
 * No code edits required — set draft: false to publish.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { makePrompter, slugify, today, yamlQuote, promptCategory, placeholderSVG } from './lib.mjs';
import { photoPlan } from './photo-rules.mjs';

const rl = makePrompter();

const title = (await rl.question('Entry title (e.g. "Ah Gaap — AlipayHK UX Competition"): ')).trim();
if (!title) {
  console.error('A title is required.');
  process.exit(1);
}
const category = await promptCategory(rl);
rl.close();

const date = today();
const slug = slugify(title) || `entry-${date}`;
const dir = new URL(`../src/content/entries/${slug}/`, import.meta.url);
if (existsSync(dir)) {
  console.error(`Entry "${slug}" already exists.`);
  process.exit(1);
}
await mkdir(new URL('images/', dir), { recursive: true });

const md = `---
title: ${yamlQuote(title)}
category: ${yamlQuote(category)}
date: ${date}
# endDate: ${date}
# role: ""
# organization: ""
# location: ""
summary: ""
# note: ""  # one-line personal aside in your voice — shows as a margin note
# video: ""  # YouTube/Vimeo/Bilibili or .mp4 — screens on the page, click-to-play
cover: "./images/cover.svg"
gallery: []
# gallery:
#   - src: "./images/01.jpg"
#     alt: "Describe the photo for screen readers"
#     caption: "Optional caption"
tags: []
links: []
# links:
#   - label: "Project page"
#     url: "https://"
featured: false
draft: true
---

## What it was

<!-- The context: what this project/competition/trip was, who ran it, the scope. -->

## What I did

<!-- Your specific part — decisions, tools, deliverables. -->

## What I learned

<!-- Skills and insights, including the unexpected ones. -->

## How it felt

<!-- The honest, human part. Write freely — this is why the site exists. -->
`;

await writeFile(new URL('index.md', dir), md);
await writeFile(new URL('images/.gitkeep', dir), '');
await writeFile(
  new URL('images/cover.svg', dir),
  placeholderSVG({ bottom: slug, seed: slug }),
);

const plan = photoPlan({ category });

console.log(`
Created src/content/entries/${slug}/

Photo plan for "${category}": a real cover + ~${plan.targetGallery} gallery shots
  ideas: ${plan.shots.join(' · ')}
  (featured entries earn a couple extra — run "npm run photos" for the full list)

Next steps:
  1. Fill in summary (and role/organization/location if relevant) in index.md
  2. Write the four reflection sections — and maybe a one-line "note"
  3. Drop photos into images/ — replace cover.svg (update the "cover:" path)
     and list gallery images with alt text
  4. Set draft: false to publish — it appears in its tab, /timeline,
     /monthly and the homepage automatically. No code edits.
`);
