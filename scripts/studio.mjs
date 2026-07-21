#!/usr/bin/env node
/**
 * npm run studio — a local authoring UI (dev-only).
 *
 * One page at http://127.0.0.1:4455 where you can create and edit entries
 * and logs, type every field and the reflection sections, and drag in
 * photos / video. It writes straight to src/content/… — the same files the
 * scaffold scripts produce — so the main site (npm run dev / build) picks
 * everything up unchanged. It binds to localhost only and is never part of
 * the built site.
 */
import { createServer } from 'node:http';
import { readFile, writeFile, readdir, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { slugify, placeholderSVG, loadCategories, appendCategory } from './lib.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const CONTENT = path.join(ROOT, 'src/content');
const PORT = 4455;
const MAX_EDGE = 2000;
const MAX_BYTES = 2 * 1024 * 1024;
const KINDS = ['workshop', 'short-course', 'talk', 'certification', 'milestone', 'other'];
const SECTIONS = ['What it was', 'What I did', 'What I learned', 'How it felt'];

const json = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
};
const q = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/* ------------------------------- read ------------------------------- */

function parseFrontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: src };
  const block = m[1];
  const body = m[2] ?? '';
  const data = {};
  const lines = block.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*#/.test(line) || !line.trim()) continue;
    const kv = line.match(/^([a-zA-Z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    let rest = kv[2].replace(/\s+#.*$/, '').trim(); // strip trailing inline comment
    if (key === 'gallery' && rest === '') {
      const items = [];
      while (i + 1 < lines.length && /^\s+-\s+src:/.test(lines[i + 1])) {
        const item = {};
        const srcm = lines[++i].match(/src:\s*"(.*)"/);
        if (srcm) item.src = srcm[1];
        while (i + 1 < lines.length && /^\s+(alt|caption):/.test(lines[i + 1])) {
          const am = lines[++i].match(/^\s+(alt|caption):\s*"(.*)"$/);
          if (am) item[am[1]] = am[2];
        }
        items.push(item);
      }
      data.gallery = items;
      continue;
    }
    if (key === 'links' && rest === '') {
      const items = [];
      while (i + 1 < lines.length && /^\s+-\s+label:/.test(lines[i + 1])) {
        const item = {};
        const lm = lines[i + 1].match(/label:\s*"(.*)"/);
        i++;
        if (lm) item.label = lm[1];
        if (i + 1 < lines.length && /^\s+url:/.test(lines[i + 1])) {
          const um = lines[++i].match(/url:\s*"(.*)"/);
          if (um) item.url = um[1];
        }
        items.push(item);
      }
      data.links = items;
      continue;
    }
    if (rest.startsWith('[') && rest.endsWith(']')) {
      const inner = rest.slice(1, -1).trim();
      data[key] = inner ? inner.split(',').map((s) => s.trim().replace(/^"|"$/g, '')) : [];
      continue;
    }
    if (rest.startsWith('"') && rest.endsWith('"')) {
      data[key] = rest.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      continue;
    }
    if (rest === 'true' || rest === 'false') data[key] = rest === 'true';
    else data[key] = rest;
  }
  return { data, body };
}

function splitSections(body) {
  const out = { preamble: '', sections: {} };
  const parts = body.split(/^##\s+(.+)$/m);
  out.preamble = (parts[0] ?? '').trim();
  for (let i = 1; i < parts.length; i += 2) {
    out.sections[parts[i].trim()] = (parts[i + 1] ?? '').trim();
  }
  return out;
}

const stripComments = (s) => (s || '').replace(/<!--[\s\S]*?-->/g, '').trim();

async function collectItem(kind, slug) {
  const indexPath = path.join(CONTENT, kind, slug, 'index.md');
  if (!existsSync(indexPath)) return null;
  const raw = await readFile(indexPath, 'utf8');
  const { data, body } = parseFrontmatter(raw);
  const item = { id: slug, kind: kind === 'entries' ? 'entry' : 'log', data };
  if (kind === 'entries') {
    const { preamble, sections } = splitSections(body);
    item.preamble = preamble;
    item.sections = SECTIONS.map((h) => ({ heading: h, text: sections[h] ?? '' }));
    item.hasReflection = SECTIONS.some((h) => stripComments(sections[h]).length > 0);
  } else {
    item.body = stripComments(body);
    item.rawBody = body.trim();
  }
  return item;
}

async function collect(kind) {
  const base = path.join(CONTENT, kind);
  const out = [];
  for (const d of await readdir(base, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const item = await collectItem(kind, d.name);
    if (item) out.push(item);
  }
  out.sort((a, b) => String(b.data.date).localeCompare(String(a.data.date)));
  return out;
}

async function getState() {
  const { cats } = await loadCategories();
  const [entries, logs] = await Promise.all([collect('entries'), collect('logs')]);
  return { categories: cats, kinds: KINDS, sections: SECTIONS, entries, logs };
}

/* ------------------------------- write ------------------------------ */

function buildEntryFrontmatter(d) {
  const L = ['---'];
  L.push(`title: ${q(d.title || 'Untitled')}`);
  L.push(`category: ${q(d.category || '')}`);
  L.push(`date: ${d.date}`);
  if (d.endDate) L.push(`endDate: ${d.endDate}`);
  if (d.updated) L.push(`updated: ${d.updated}`);
  if (d.role) L.push(`role: ${q(d.role)}`);
  if (d.organization) L.push(`organization: ${q(d.organization)}`);
  if (d.location) L.push(`location: ${q(d.location)}`);
  L.push(`summary: ${q(d.summary || '')}`);
  if (d.note) L.push(`note: ${q(d.note)}`);
  if (d.video) L.push(`video: ${q(d.video)}`);
  L.push(`cover: ${q(d.cover || './images/cover.svg')}`);
  if (Array.isArray(d.gallery) && d.gallery.length) {
    L.push('gallery:');
    for (const g of d.gallery) {
      L.push(`  - src: ${q(g.src)}`);
      L.push(`    alt: ${q(g.alt || '')}`);
      if (g.caption) L.push(`    caption: ${q(g.caption)}`);
    }
  } else {
    L.push('gallery: []');
  }
  L.push(`tags: [${(d.tags || []).map(q).join(', ')}]`);
  if (Array.isArray(d.links) && d.links.length) {
    L.push('links:');
    for (const l of d.links) {
      L.push(`  - label: ${q(l.label)}`);
      L.push(`    url: ${q(l.url)}`);
    }
  } else {
    L.push('links: []');
  }
  L.push(`featured: ${d.featured ? 'true' : 'false'}`);
  L.push(`draft: ${d.draft ? 'true' : 'false'}`);
  if (d.order !== undefined && d.order !== null && d.order !== '') L.push(`order: ${Number(d.order)}`);
  L.push('---');
  return L.join('\n');
}

function buildLogFrontmatter(d) {
  const L = ['---'];
  L.push(`title: ${q(d.title || 'Untitled')}`);
  L.push(`category: ${q(d.category || '')}`);
  L.push(`date: ${d.date}`);
  L.push(`kind: ${q(d.kind || 'other')}`);
  L.push(`summary: ${q(d.summary || '')}`);
  if (d.image) L.push(`image: ${q(d.image)}`);
  if (d.link) L.push(`link: ${q(d.link)}`);
  L.push(`tags: [${(d.tags || []).map(q).join(', ')}]`);
  L.push(`draft: ${d.draft ? 'true' : 'false'}`);
  L.push('---');
  return L.join('\n');
}

function buildEntryBody(sections) {
  return (
    '\n' +
    SECTIONS.map((h) => {
      const found = (sections || []).find((s) => s.heading === h);
      return `## ${h}\n\n${(found?.text || '').trim()}\n`;
    }).join('\n')
  );
}

async function saveItem(payload) {
  const { kind, data } = payload;
  const isEntry = kind === 'entry';
  let slug = payload.id;
  const isNew = payload.isNew || !slug;
  if (isNew) {
    const base = slugify(data.title || '') || 'untitled';
    slug = isEntry ? base : `${data.date}-${base}`;
    let n = 2;
    while (existsSync(path.join(CONTENT, isEntry ? 'entries' : 'logs', slug))) {
      slug = isEntry ? `${base}-${n}` : `${data.date}-${base}-${n}`;
      n++;
    }
  }
  const dir = path.join(CONTENT, isEntry ? 'entries' : 'logs', slug);
  await mkdir(dir, { recursive: true });

  if (isEntry) {
    const imagesDir = path.join(dir, 'images');
    await mkdir(imagesDir, { recursive: true });
    if (!existsSync(path.join(imagesDir, '.gitkeep'))) await writeFile(path.join(imagesDir, '.gitkeep'), '');
    // generate a placeholder cover only when none is set yet
    if (!data.cover || data.cover === './images/cover.svg') {
      data.cover = './images/cover.svg';
      if (!existsSync(path.join(imagesDir, 'cover.svg'))) {
        await writeFile(path.join(imagesDir, 'cover.svg'), placeholderSVG({ bottom: slug, seed: slug }));
      }
    }
    const md = buildEntryFrontmatter(data) + '\n' + buildEntryBody(payload.sections);
    await writeFile(path.join(dir, 'index.md'), md);
  } else {
    const body = (payload.body || '').trim();
    const md = buildLogFrontmatter(data) + '\n\n' + (body ? body + '\n' : '');
    await writeFile(path.join(dir, 'index.md'), md);
  }
  return slug;
}

async function placeUpload({ kind, id, role, filename, buffer, alt, caption }) {
  const isEntry = kind === 'entry';
  const dir = path.join(CONTENT, isEntry ? 'entries' : 'logs', id);
  const indexPath = path.join(dir, 'index.md');
  if (!existsSync(indexPath)) throw new Error('Save the item first, then add media.');
  const { data, body } = parseFrontmatter(await readFile(indexPath, 'utf8'));

  const ext = path.extname(filename).toLowerCase().replace('.jpeg', '.jpg') || '.jpg';
  const cleanBase =
    slugify(path.basename(filename, path.extname(filename))) || (role === 'video' ? 'video' : 'photo');

  if (role === 'video') {
    const videosDir = path.join(ROOT, 'public/videos');
    await mkdir(videosDir, { recursive: true });
    let name = `${cleanBase}${ext}`;
    let n = 2;
    while (existsSync(path.join(videosDir, name))) name = `${cleanBase}-${n++}${ext}`;
    await writeFile(path.join(videosDir, name), buffer);
    data.video = `/videos/${name}`;
  } else {
    const imagesDir = isEntry ? path.join(dir, 'images') : dir;
    await mkdir(imagesDir, { recursive: true });
    let name = `${cleanBase}${ext}`;
    let n = 2;
    while (existsSync(path.join(imagesDir, name))) name = `${cleanBase}-${n++}${ext}`;
    const dest = path.join(imagesDir, name);
    // resize if a heavy raster
    if (/\.(jpg|png|webp|avif)$/i.test(ext) && buffer.length > 0) {
      const meta = await sharp(buffer).metadata().catch(() => null);
      const edge = meta ? Math.max(meta.width || 0, meta.height || 0) : 0;
      if (meta && (edge > MAX_EDGE || buffer.length > MAX_BYTES)) {
        let pipe = sharp(buffer).rotate().resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true });
        if (/\.jpg$/i.test(ext)) pipe = pipe.jpeg({ quality: 82 });
        await pipe.toFile(dest);
      } else {
        await writeFile(dest, buffer);
      }
    } else {
      await writeFile(dest, buffer);
    }
    const rel = isEntry ? `./images/${name}` : `./${name}`;
    if (role === 'cover') {
      // remove the placeholder we are replacing
      if (data.cover === './images/cover.svg' && existsSync(path.join(imagesDir, 'cover.svg'))) {
        await rm(path.join(imagesDir, 'cover.svg')).catch(() => {});
      }
      data.cover = rel;
    } else if (role === 'image') {
      data.image = rel;
    } else {
      data.gallery = data.gallery || [];
      data.gallery.push({ src: rel, alt: alt || '', caption: caption || '' });
    }
  }

  // rewrite the file with updated frontmatter, body preserved
  const md = isEntry
    ? buildEntryFrontmatter(data) + '\n' + (body.trim() ? body.replace(/^\n+/, '\n') : buildEntryBody())
    : buildLogFrontmatter(data) + '\n\n' + body.trim() + (body.trim() ? '\n' : '');
  await writeFile(indexPath, md);
  return id;
}

/* ------------------------------ server ------------------------------ */

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 200 * 1024 * 1024) reject(new Error('Upload too large (200MB cap).'));
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (req.method === 'GET' && url.pathname === '/') {
      const html = await readFile(new URL('./studio.html', import.meta.url), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    }
    if (req.method === 'GET' && url.pathname === '/api/state') {
      return json(res, 200, await getState());
    }
    if (req.method === 'GET' && url.pathname === '/__media') {
      // serve a content image / video so the UI can preview it (local only)
      const k = url.searchParams.get('k');
      const id = url.searchParams.get('id') || '';
      const p = url.searchParams.get('p') || '';
      let file;
      if (p.startsWith('/videos/')) file = path.join(ROOT, 'public', p);
      else file = path.join(CONTENT, k === 'entry' ? 'entries' : 'logs', id, p);
      const resolved = path.resolve(file);
      const allowed = resolved.startsWith(path.resolve(CONTENT)) || resolved.startsWith(path.resolve(path.join(ROOT, 'public/videos')));
      if (!allowed || !existsSync(resolved)) return json(res, 404, { error: 'not found' });
      const ext = path.extname(resolved).toLowerCase();
      const types = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime' };
      res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      return res.end(await readFile(resolved));
    }
    if (req.method === 'POST' && url.pathname === '/api/save') {
      const payload = JSON.parse((await readBody(req)).toString('utf8'));
      const id = await saveItem(payload);
      return json(res, 200, { ok: true, id, state: await getState() });
    }
    if (req.method === 'POST' && url.pathname === '/api/upload') {
      const p = JSON.parse((await readBody(req)).toString('utf8'));
      const buffer = Buffer.from(p.dataBase64, 'base64');
      const id = await placeUpload({ ...p, buffer });
      return json(res, 200, { ok: true, id, item: await collectItem(p.kind === 'entry' ? 'entries' : 'logs', id) });
    }
    if (req.method === 'POST' && url.pathname === '/api/new-category') {
      const p = JSON.parse((await readBody(req)).toString('utf8'));
      const slug = slugify(p.label || '');
      if (!slug) return json(res, 400, { error: 'Label required.' });
      const { cats } = await loadCategories();
      if (!cats.some((c) => c.slug === slug)) {
        await appendCategory({ slug, label: p.label, blurb: p.blurb || '' });
      }
      return json(res, 200, { ok: true, slug, state: await getState() });
    }
    if (req.method === 'POST' && url.pathname === '/api/delete') {
      const p = JSON.parse((await readBody(req)).toString('utf8'));
      const dir = path.join(CONTENT, p.kind === 'entry' ? 'entries' : 'logs', p.id);
      if (existsSync(dir)) await rm(dir, { recursive: true, force: true });
      return json(res, 200, { ok: true, state: await getState() });
    }
    json(res, 404, { error: 'Not found' });
  } catch (err) {
    json(res, 500, { error: String(err.message || err) });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  Content Studio  →  http://127.0.0.1:${PORT}\n`);
  console.log('  Create/edit entries & logs, type text, drag in photos & video.');
  console.log('  Writes to src/content/… — run "npm run dev" in another tab to preview.');
  console.log('  Local only; Ctrl+C to stop.\n');
});
