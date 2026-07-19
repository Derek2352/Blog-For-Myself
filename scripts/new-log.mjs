#!/usr/bin/env node
/**
 * npm run new-log
 * The lighter path: a monthly-log item in under a minute. Prompts for
 * title + category (validated, can create a new tab) + kind, then writes
 * src/content/logs/<date>-<slug>/index.md. Set draft: false to publish.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { makePrompter, slugify, today, yamlQuote, promptCategory } from './lib.mjs';

const KINDS = ['workshop', 'short-course', 'talk', 'certification', 'milestone', 'other'];

const rl = makePrompter();

const title = (await rl.question('Log title (e.g. "Life-drawing workshop @ HKAC"): ')).trim();
if (!title) {
  console.error('A title is required.');
  process.exit(1);
}
const category = await promptCategory(rl);
let kind = (await rl.question(`Kind [${KINDS.join('|')}] (default other): `)).trim() || 'other';
if (!KINDS.includes(kind)) {
  console.log(`Unknown kind "${kind}" — using "other".`);
  kind = 'other';
}
rl.close();

const date = today();
const slug = `${date}-${slugify(title) || 'log'}`;
const dir = new URL(`../src/content/logs/${slug}/`, import.meta.url);
if (existsSync(dir)) {
  console.error(`Log "${slug}" already exists.`);
  process.exit(1);
}
await mkdir(dir, { recursive: true });

const md = `---
title: ${yamlQuote(title)}
category: ${yamlQuote(category)}
date: ${date}
kind: ${yamlQuote(kind)}
summary: ""
# image: "./photo.jpg"
# link: "https://"
tags: []
draft: true
---

<!-- Optional: a sentence or two on what it was and one thing I took from it.
     Leave the body empty and the card stays terminal (no detail page). -->
`;

await writeFile(new URL('index.md', dir), md);
console.log(`\nCreated src/content/logs/${slug}/  → fill summary, set draft: false.
It will appear in its tab's monthly section, /monthly (under the right period), and "Lately".`);
