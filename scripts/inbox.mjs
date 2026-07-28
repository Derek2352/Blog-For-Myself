#!/usr/bin/env node
/**
 * npm run inbox — the single entrance for media.
 * Dump photos/videos into _inbox/ (any names), run this, and answer two or
 * three questions per file. The script:
 *   - resizes oversized photos (long edge > 2000px or > 2MB) on the way in
 *   - moves each photo into the chosen entry's images/ (or the log's folder)
 *   - writes the frontmatter for you: cover / gallery item with alt text /
 *     log image — no hand-editing
 *   - routes video files to public/videos/ and sets the entry's `video:`
 * Frontmatter edits assume the standard template shape that new-entry /
 * new-log generate (which all content here uses).
 */
import { readdir, readFile, writeFile, rename, unlink, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { loadCategories, makePrompter, yamlQuote } from './lib.mjs';
import { photoPlan } from './photo-rules.mjs';

// see the note in studio.mjs: a file: URL's .pathname is "/C:/…" on Windows and
// percent-encodes spaces everywhere, so path.join builds an unusable path
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const INBOX = path.join(ROOT, '_inbox');
const PHOTO_EXT = /\.(jpe?g|png|webp|avif|gif|svg)$/i;
const VIDEO_EXT = /\.(mp4|mov|webm|m4v)$/i;
const MAX_EDGE = 2000;
const MAX_BYTES = 2 * 1024 * 1024;

const fm = (src) => src.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
const fmStr = (block, key) => block.match(new RegExp(`^${key}:\\s*"(.*)"`, 'm'))?.[1];
const fmFlag = (block, key) => new RegExp(`^${key}:\\s*true`, 'm').test(block);
const cleanName = (name) => {
  const ext = path.extname(name).toLowerCase().replace('jpeg', 'jpg');
  const base = path
    .basename(name, path.extname(name))
    .toLowerCase()
    .replace(/[^\w-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${base || 'photo'}${ext}`;
};

async function collectItems() {
  const items = [];
  for (const kind of ['entries', 'logs']) {
    const base = path.join(ROOT, 'src/content', kind);
    for (const dirent of await readdir(base, { withFileTypes: true })) {
      if (!dirent.isDirectory()) continue;
      const indexPath = path.join(base, dirent.name, 'index.md');
      if (!existsSync(indexPath)) continue;
      const block = fm(await readFile(indexPath, 'utf8'));
      const isLog = kind === 'logs';
      const galleryCount = (block.match(/^\s+- src:/gm) ?? []).length;
      const plan = photoPlan({
        category: fmStr(block, 'category') ?? '',
        featured: fmFlag(block, 'featured'),
        isLog,
      });
      const placeholderCover = (fmStr(block, 'cover') ?? '').endsWith('.svg');
      const hasImage = /^image:\s*"/m.test(block);
      const missing = isLog
        ? hasImage
          ? 0
          : 1
        : Math.max(0, plan.targetGallery - galleryCount) + (placeholderCover ? 1 : 0);
      items.push({
        slug: dirent.name,
        isLog,
        indexPath,
        title: fmStr(block, 'title') ?? dirent.name,
        category: fmStr(block, 'category') ?? '',
        missing,
        placeholderCover,
        galleryCount,
        target: plan.targetGallery,
      });
    }
  }
  items.sort((a, b) => b.missing - a.missing || a.slug.localeCompare(b.slug));
  return items;
}

const trim = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function describeItem(i) {
  const name = trim(i.title, 46);
  if (i.isLog) return `${name}  (log${i.missing ? ', no photo yet' : ''})`;
  const needs = [];
  if (i.placeholderCover) needs.push('cover');
  if (i.galleryCount < i.target) needs.push(`${i.target - i.galleryCount} gallery`);
  return `${name}${needs.length ? `  (needs ${needs.join(' + ')})` : ''}`;
}

/** Where a pick will put the file — shown BEFORE anything moves. */
function destinationOf(item, isVideo) {
  if (isVideo) return 'public/videos/';
  if (item.isLog) return `src/content/logs/${item.slug}/`;
  return `src/content/entries/${item.slug}/images/`;
}

async function uniqueDest(dir, name) {
  let candidate = name;
  let n = 2;
  while (existsSync(path.join(dir, candidate))) {
    const ext = path.extname(name);
    candidate = `${path.basename(name, ext)}-${n}${ext}`;
    n += 1;
  }
  return path.join(dir, candidate);
}

/** Move a photo into place, resizing if it's heavier than the site needs. */
async function placePhoto(srcPath, destPath) {
  const ext = path.extname(srcPath).toLowerCase();
  if (ext === '.svg' || ext === '.gif') {
    await rename(srcPath, destPath);
    return 'moved';
  }
  const [meta, size] = [await sharp(srcPath).metadata(), (await stat(srcPath)).size];
  const edge = Math.max(meta.width ?? 0, meta.height ?? 0);
  if (edge <= MAX_EDGE && size <= MAX_BYTES) {
    await rename(srcPath, destPath);
    return 'moved';
  }
  const pipeline = sharp(srcPath).rotate().resize({
    width: MAX_EDGE,
    height: MAX_EDGE,
    fit: 'inside',
    withoutEnlargement: true,
  });
  if (/\.(jpe?g)$/i.test(destPath)) pipeline.jpeg({ quality: 82 });
  await pipeline.toFile(destPath);
  await unlink(srcPath);
  return `resized from ${meta.width}×${meta.height}`;
}

// ---- frontmatter surgery (matches the template shape our scaffolds emit) ----
const setCover = (md, rel) => md.replace(/^cover:\s*".*"$/m, `cover: "${rel}"`);

function appendGallery(md, item) {
  const lines = [`  - src: "${item.src}"`, `    alt: ${yamlQuote(item.alt)}`];
  if (item.caption) lines.push(`    caption: ${yamlQuote(item.caption)}`);
  const block = lines.join('\n');
  if (/^gallery:\s*\[\]\s*$/m.test(md)) {
    return md.replace(/^gallery:\s*\[\]\s*$/m, `gallery:\n${block}`);
  }
  const marker = md.match(/^gallery:\s*$/m);
  if (!marker) return null;
  const start = md.indexOf(marker[0]) + marker[0].length + 1;
  const rest = md.slice(start);
  const next = rest.search(/^[a-zA-Z_][\w-]*:/m);
  const at = start + (next === -1 ? rest.length : next);
  return `${md.slice(0, at)}${block}\n${md.slice(at)}`;
}

function setLogImage(md, rel) {
  if (/^#\s*image:.*$/m.test(md)) return md.replace(/^#\s*image:.*$/m, `image: "${rel}"`);
  if (/^image:\s*".*"$/m.test(md)) return md.replace(/^image:\s*".*"$/m, `image: "${rel}"`);
  return md.replace(/^(kind:.*)$/m, `$1\nimage: "${rel}"`);
}

function setVideo(md, url) {
  if (/^#\s*video:.*$/m.test(md)) return md.replace(/^#\s*video:.*$/m, `video: "${url}"`);
  if (/^video:\s*".*"$/m.test(md)) return md.replace(/^video:\s*".*"$/m, `video: "${url}"`);
  return md.replace(/^(summary:.*)$/m, `$1\nvideo: "${url}"`);
}

// ---- the interview ----
const rl = makePrompter();
const files = (await readdir(INBOX))
  .filter((f) => f !== 'README.md' && !f.startsWith('.'))
  .sort();

if (files.length === 0) {
  console.log('\nInbox is empty. Drop photos/videos into _inbox/ and rerun npm run inbox.');
  process.exit(0);
}

const heic = files.filter((f) => /\.hei[cf]$/i.test(f));
if (heic.length > 0) {
  console.log(`\nSkipping ${heic.length} HEIC file(s) — export as JPG first: ${heic.join(', ')}`);
}

const media = files.filter((f) => PHOTO_EXT.test(f) || VIDEO_EXT.test(f));
const items = await collectItems();
console.log(`\nMEDIA INBOX — ${media.length} file(s) to sort\n${'─'.repeat(56)}`);

// ---- the catalog: pick the TAB first (numbered like the site nav),
//      then the item inside it. Enter repeats your last choice, so a
//      batch from one event files in two keystrokes per photo. ----
const { cats } = await loadCategories();
const byCat = new Map(cats.map((c) => [c.slug, { ...c, items: [] }]));
for (const item of items) byCat.get(item.category)?.items.push(item);

let lastTab = null;
let lastItem = null;
/** 'a' at the Same-place prompt: file every remaining photo into lastItem. */
let stickyAll = false;

async function pickDestination(promptText, allowLogs = true) {
  console.log(`\n${promptText}`);
  for (;;) {
    // level 1 — the tab catalog
    console.log('');
    cats.forEach((c, n) => {
      const eligible = byCat.get(c.slug).items.filter((i) => allowLogs || !i.isLog);
      const hungry = eligible.filter((i) => i.missing > 0).length;
      console.log(
        `  ${String(n + 1).padStart(2)}. ${c.label}${hungry ? `  (${hungry} item${hungry === 1 ? '' : 's'} need photos)` : ''}`,
      );
    });
    const tabDefault = lastTab ? `, Enter = ${byCat.get(lastTab).label}` : '';
    const a = (await rl.question(`  Tab (number/slug${tabDefault}, s = skip, q = quit): `)).trim();
    if (a === 'q') return 'quit';
    if (a === 's') return null;
    let tab = null;
    if (a === '' && lastTab) tab = lastTab;
    else if (cats[Number(a) - 1]) tab = cats[Number(a) - 1].slug;
    else if (byCat.has(a)) tab = a;
    else {
      // power shortcut: typing an exact item slug jumps straight to it
      const direct = items.find((i) => i.slug === a && (allowLogs || !i.isLog));
      if (direct) {
        lastTab = direct.category;
        lastItem = direct;
        return direct;
      }
      console.log(a === '' ? '  (no last tab yet — pick a number)' : `  No tab "${a}".`);
      continue;
    }

    // level 2 — items within the tab
    const group = byCat.get(tab);
    const eligible = group.items.filter((i) => allowLogs || !i.isLog);
    if (eligible.length === 0) {
      console.log(`  ${group.label} has no ${allowLogs ? 'items' : 'entries'} yet — pick another tab.`);
      continue;
    }
    console.log(`\n  ${group.label}:`);
    const top = eligible.slice(0, 15);
    top.forEach((i, n) => console.log(`  ${String(n + 1).padStart(2)}. ${describeItem(i)}`));
    const itemDefault =
      lastItem && lastItem.category === tab && (allowLogs || !lastItem.isLog)
        ? `, Enter = ${trim(lastItem.title, 28)}`
        : '';
    const b = (
      await rl.question(`  Item (number/slug${itemDefault}, b = back, s = skip, q = quit): `)
    ).trim();
    if (b === 'q') return 'quit';
    if (b === 's') return null;
    if (b === 'b') continue;
    let picked = null;
    if (b === '' && itemDefault) picked = lastItem;
    else if (top[Number(b) - 1]) picked = top[Number(b) - 1];
    else picked = eligible.find((i) => i.slug === b) ?? null;
    if (!picked) {
      console.log(`  No item "${b}" in ${group.label} — starting over from the tabs.`);
      continue;
    }
    lastTab = tab;
    lastItem = picked;
    return picked;
  }
}

let moved = 0;
for (const [idx, file] of media.entries()) {
  const srcPath = path.join(INBOX, file);
  const isVideo = VIDEO_EXT.test(file);
  const bytes = (await stat(srcPath)).size;
  const size =
    bytes >= 1024 * 1024
      ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
      : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  let dims = '';
  if (!isVideo && !/\.svg$/i.test(file)) {
    try {
      const m = await sharp(srcPath).metadata();
      dims = ` · ${m.width}×${m.height}`;
    } catch {}
  }
  console.log(`\nFILE ${idx + 1}/${media.length} · ${file}${dims} · ${size}${isVideo ? ' · video' : ''}`);

  if (isVideo) {
    const item = await pickDestination('Attach this film to which entry?', false);
    if (item === 'quit') break;
    if (!item) continue;
    console.log(`  → ${item.title}\n    destination: ${destinationOf(item, true)}`);
    const videosDir = path.join(ROOT, 'public/videos');
    await mkdir(videosDir, { recursive: true });
    const dest = await uniqueDest(videosDir, cleanName(file));
    await rename(srcPath, dest);
    const publicPath = `/videos/${path.basename(dest)}`;
    await writeFile(item.indexPath, setVideo(await readFile(item.indexPath, 'utf8'), publicPath));
    console.log(`  ✓ ${publicPath} → ${item.slug} (video set; it screens on the page, click-to-play)`);
    if (bytes > 25 * 1024 * 1024) {
      console.log('  note: that file is hefty — a YouTube/Bilibili link keeps the repo lighter.');
    }
    moved += 1;
    continue;
  }

  // Once an entry is picked, following photos default there — no catalog
  // re-walk for a batch from the same event. Enter = same place again,
  // a = all remaining files here, n = open the catalog as usual.
  let item = null;
  let autoBatch = false;
  if (lastItem && !lastItem.isLog) {
    if (stickyAll) {
      item = lastItem;
      autoBatch = true;
      console.log(`  → ${item.title} (filing all remaining here)`);
      console.log(`    destination: ${destinationOf(item, false)}`);
    } else {
      const same = (
        await rl.question(
          `Same place? ${trim(lastItem.title, 40)} (Enter = yes, a = all remaining, n = pick elsewhere, s = skip, q = quit): `,
        )
      )
        .trim()
        .toLowerCase();
      if (same === 'q') break;
      if (same === 's') continue;
      if (same === '' || same === 'a') {
        if (same === 'a') {
          stickyAll = true;
          autoBatch = true;
        }
        item = lastItem;
        console.log(`  → ${item.title}\n    destination: ${destinationOf(item, false)}`);
      }
    }
  }
  if (!item) {
    const picked = await pickDestination('Where does this photo go?');
    if (picked === 'quit') break;
    if (!picked) continue;
    item = picked;
    console.log(`  → ${item.title}\n    destination: ${destinationOf(item, false)}`);
  }

  if (item.isLog) {
    const dir = path.dirname(item.indexPath);
    const dest = await uniqueDest(dir, cleanName(file));
    const how = await placePhoto(srcPath, dest);
    const rel = `./${path.basename(dest)}`;
    await writeFile(item.indexPath, setLogImage(await readFile(item.indexPath, 'utf8'), rel));
    console.log(`  ✓ ${path.basename(dest)} → ${item.slug} (log image, ${how})`);
    moved += 1;
    continue;
  }

  const role = autoBatch
    ? 'gallery'
    : (await rl.question('Use as [g]allery or [c]over? [g]: ')).trim().toLowerCase() === 'c'
      ? 'cover'
      : 'gallery';
  const imagesDir = path.join(path.dirname(item.indexPath), 'images');
  await mkdir(imagesDir, { recursive: true });
  const dest = await uniqueDest(imagesDir, cleanName(file));
  const how = await placePhoto(srcPath, dest);
  const rel = `./images/${path.basename(dest)}`;
  let md = await readFile(item.indexPath, 'utf8');

  if (role === 'cover') {
    const old = fmStr(fm(md), 'cover');
    md = setCover(md, rel);
    await writeFile(item.indexPath, md);
    if (old === './images/cover.svg' && existsSync(path.join(imagesDir, 'cover.svg'))) {
      await unlink(path.join(imagesDir, 'cover.svg'));
      console.log('  (removed the generated cover.svg placeholder)');
    }
    console.log(`  ✓ ${path.basename(dest)} → ${item.slug} (cover, ${how})`);
    item.placeholderCover = false;
  } else {
    let alt = (await rl.question("  Alt text (what's in the photo?): ")).trim();
    if (!alt) alt = `Photo from ${item.title}`;
    const caption = (await rl.question('  Caption (optional): ')).trim();
    const next = appendGallery(md, { src: rel, alt, caption });
    if (!next) {
      console.log('  ! Could not find a gallery block in index.md — add the item by hand:');
      console.log(`    - src: "${rel}"\n      alt: ${yamlQuote(alt)}`);
    } else {
      await writeFile(item.indexPath, next);
      console.log(`  ✓ ${path.basename(dest)} → ${item.slug} (gallery, ${how})`);
      item.galleryCount += 1;
    }
  }
  // update the "needs" label but keep list ORDER frozen for the whole
  // session — the same number must mean the same destination on every file
  item.missing = Math.max(0, item.missing - 1);
  moved += 1;
}

rl.close();
console.log(`\n${'─'.repeat(56)}\n${moved} file(s) filed. Check with npm run dev; npm run photos shows what's still missing.\n`);
