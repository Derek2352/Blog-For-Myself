#!/usr/bin/env node
/**
 * npm run photos — the photo to-do list.
 * Scans every entry and log, compares what images exist against the
 * suggestions in photo-rules.mjs, and prints what to gather and how many.
 * Items missing the most come first. Nothing here blocks the build —
 * it's a gentle monthly nudge, not a gate.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { photoPlan } from './photo-rules.mjs';

const ROOT = new URL('../src/content/', import.meta.url);
const OVERSIZE_BYTES = 2 * 1024 * 1024; // resize anything bigger before committing

const frontmatter = (src) => src.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
const str = (fm, key) => fm.match(new RegExp(`^${key}:\\s*"(.*)"`, 'm'))?.[1];
const flag = (fm, key) => new RegExp(`^${key}:\\s*true`, 'm').test(fm);

async function collect(kind) {
  const dir = new URL(`${kind}/`, ROOT);
  const slugs = (await readdir(dir, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  const items = [];
  for (const slug of slugs) {
    let src;
    try {
      src = await readFile(new URL(`${slug}/index.md`, dir), 'utf8');
    } catch {
      continue;
    }
    const fm = frontmatter(src);
    items.push({
      kind,
      slug,
      title: str(fm, 'title') ?? slug,
      category: str(fm, 'category') ?? '',
      featured: flag(fm, 'featured'),
      draft: flag(fm, 'draft'),
      cover: str(fm, 'cover') ?? '',
      hasImage: /^image:\s*"/m.test(fm),
      galleryCount: (fm.match(/^\s+- src:/gm) ?? []).length,
    });
  }
  return items;
}

const entries = await collect('entries');
const logs = await collect('logs');

const rows = [];
for (const e of entries) {
  const plan = photoPlan({ category: e.category, featured: e.featured });
  const placeholderCover = e.cover.endsWith('.svg');
  const missing = Math.max(0, plan.targetGallery - e.galleryCount) + (placeholderCover ? 1 : 0);
  rows.push({ ...e, plan, placeholderCover, missing });
}
for (const l of logs) {
  const plan = photoPlan({ isLog: true });
  const missing = l.hasImage ? 0 : plan.targetGallery;
  rows.push({ ...l, plan, placeholderCover: false, missing });
}

rows.sort((a, b) => b.missing - a.missing || a.slug.localeCompare(b.slug));

let totalShots = 0;
console.log('\nPHOTO PLAN — what to paste, and how much\n' + '─'.repeat(56));
for (const r of rows) {
  if (r.missing === 0) continue;
  totalShots += r.missing;
  const tag = r.kind === 'logs' ? 'L' : 'E';
  const flags = [r.featured && 'featured', r.draft && 'draft'].filter(Boolean).join(' · ');
  console.log(`\n${tag} · ${r.title}${flags ? `  (${flags})` : ''}`);
  if (r.kind === 'logs') {
    console.log('   photo: none yet → one honest phone shot is enough (optional)');
    continue;
  }
  if (r.placeholderCover) console.log('   cover: placeholder → swap in a real frame');
  if (r.galleryCount < r.plan.targetGallery) {
    console.log(
      `   gallery: ${r.galleryCount}/${r.plan.targetGallery} → add ${r.plan.targetGallery - r.galleryCount}`,
    );
    console.log(`   ideas: ${r.plan.shots.join(' · ')}`);
  }
}

// oversized images sneak in from phone camera rolls — flag them
const oversized = [];
for (const kind of ['entries', 'logs']) {
  const base = new URL(`${kind}/`, ROOT);
  for (const dirent of await readdir(base, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    for (const sub of ['', 'images/']) {
      let files;
      try {
        files = await readdir(new URL(`${dirent.name}/${sub}`, base));
      } catch {
        continue;
      }
      for (const f of files) {
        if (!/\.(jpe?g|png|webp|avif|gif|svg)$/i.test(f)) continue;
        const s = await stat(new URL(`${dirent.name}/${sub}${f}`, base));
        if (s.size > OVERSIZE_BYTES) {
          oversized.push({
            path: `src/content/${kind}/${dirent.name}/${sub}${f}`,
            mb: (s.size / 1024 / 1024).toFixed(1),
          });
        }
      }
    }
  }
}
if (oversized.length > 0) {
  console.log('\n' + '─'.repeat(56));
  console.log('OVERSIZED IMAGES — resize to ~2000px on the long edge first:');
  for (const o of oversized) console.log(`   ${o.mb} MB  ${o.path}`);
}

const done = rows.filter((r) => r.missing === 0).length;
console.log('\n' + '─'.repeat(56));
console.log(`${done}/${rows.length} items fully pictured · ~${totalShots} photos to gather`);
console.log('Add gallery items with alt text in each entry’s frontmatter; rerun anytime.\n');
