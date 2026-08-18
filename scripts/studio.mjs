#!/usr/bin/env node
/**
 * npm run studio — a local authoring UI (dev-only).
 *
 * One page at http://127.0.0.1:4455 where you can create and edit entries
 * and logs, type every field and the reflection sections, and place photos /
 * video. It writes straight to src/content/… — the same files the scaffold
 * scripts produce — so the main site (npm run dev / build) picks everything up
 * unchanged. It binds to localhost only and is never part of the built site.
 *
 * Two ways to add media, both landing in the same place:
 *   - drop a file on a slot, or click the slot for the OS file dialog
 *   - drag a batch into `_inbox/` from your file manager and pick each file's
 *     destination from the tray at the top of the Media panel — no dialog, and
 *     you can see the page you're filling while you choose
 *
 * Frontmatter is updated in place (see ./frontmatter.mjs): comments and keys the
 * studio doesn't manage survive a save.
 */
import { createServer } from 'node:http';
import { readFile, writeFile, readdir, mkdir, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { slugify, placeholderSVG, loadCategories, appendCategory, categoryHue } from './lib.mjs';
import {
  SECTIONS,
  ENTRY_KEYS,
  LOG_KEYS,
  parseFrontmatter,
  splitSections,
  rewriteFrontmatter,
  buildEntryFrontmatter,
  buildLogFrontmatter,
  buildEntryBody,
  withFrontmatter,
} from './frontmatter.mjs';

// fileURLToPath, not .pathname: on Windows a file: URL's pathname is
// "/C:/Users/..." and path.join turns that into "\C:\Users\..." — an invalid
// path on the current drive root, so every read and write failed. The same
// applies anywhere the repo path contains a space (it arrives percent-encoded).
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CONTENT = path.join(ROOT, 'src/content');
const INBOX = path.join(ROOT, '_inbox');
const PORT = 4455;
const MAX_EDGE = 2000;
const MAX_BYTES = 2 * 1024 * 1024;
const KINDS = ['workshop', 'short-course', 'talk', 'certification', 'milestone', 'other'];
const PHOTO_EXT = /\.(jpe?g|png|webp|avif|gif|svg)$/i;
const VIDEO_EXT = /\.(mp4|mov|webm|m4v)$/i;
const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.mov': 'video/quicktime', '.m4v': 'video/mp4',
};

const json = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
};

/* ------------------------------- read ------------------------------- */

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

/** Files waiting in _inbox/ — the folder you drag things into from Explorer. */
async function listInbox() {
  if (!existsSync(INBOX)) return [];
  const out = [];
  for (const d of await readdir(INBOX, { withFileTypes: true })) {
    if (!d.isFile() || d.name.startsWith('.') || /^readme\.md$/i.test(d.name)) continue;
    const isPhoto = PHOTO_EXT.test(d.name);
    const isVideo = VIDEO_EXT.test(d.name);
    if (!isPhoto && !isVideo) continue;
    const s = await stat(path.join(INBOX, d.name)).catch(() => null);
    out.push({ name: d.name, type: isVideo ? 'video' : 'photo', bytes: s?.size ?? 0, mtime: s?.mtimeMs ?? 0 });
  }
  out.sort((a, b) => b.mtime - a.mtime);
  return out;
}

async function getState() {
  const { cats } = await loadCategories();
  const [entries, logs, inbox] = await Promise.all([collect('entries'), collect('logs'), listInbox()]);
  return { categories: cats, kinds: KINDS, sections: SECTIONS, entries, logs, inbox };
}

/* ------------------------------- write ------------------------------ */

/**
 * Write frontmatter back into an existing file without disturbing anything the
 * studio doesn't manage, or build it fresh when the file is new.
 */
async function writeItemFile(indexPath, isEntry, data, bodyText) {
  const keys = isEntry ? ENTRY_KEYS : LOG_KEYS;
  if (existsSync(indexPath)) {
    const { block } = parseFrontmatter(await readFile(indexPath, 'utf8'));
    if (block !== null) {
      return writeFile(indexPath, withFrontmatter(rewriteFrontmatter(block, data, keys), bodyText));
    }
  }
  const fm = isEntry ? buildEntryFrontmatter(data) : buildLogFrontmatter(data);
  return writeFile(indexPath, fm + '\n' + bodyText);
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
        await writeFile(
          path.join(imagesDir, 'cover.svg'),
          placeholderSVG({ seed: slug, hue: categoryHue((await loadCategories()).cats, data.category) }),
        );
      }
    }
    await writeItemFile(path.join(dir, 'index.md'), true, data, buildEntryBody(payload.sections));
  } else {
    const body = (payload.body || '').trim();
    await writeItemFile(path.join(dir, 'index.md'), false, data, '\n' + (body ? body + '\n' : ''));
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

  // frontmatter updated in place; the body — and every comment and unmanaged
  // key in the frontmatter — is left exactly as it was
  const bodyText = isEntry
    ? body.trim()
      ? body.replace(/^\n+/, '\n')
      : buildEntryBody()
    : '\n' + body.trim() + (body.trim() ? '\n' : '');
  await writeItemFile(indexPath, isEntry, data, bodyText);
  return id;
}

/**
 * Take a file the user dropped into _inbox/ from File Explorer and place it on
 * a page. Same destination logic and same resizing as a browser upload — this
 * just reads the bytes off disk and removes the original once it has landed.
 */
async function assignFromInbox({ file, kind, id, role, alt, caption }) {
  const name = path.basename(file); // never let a path escape the inbox
  const src = path.join(INBOX, name);
  if (!existsSync(src)) throw new Error(`"${name}" is no longer in _inbox.`);
  const isVideo = VIDEO_EXT.test(name);
  if (role === 'video' && !isVideo) throw new Error(`"${name}" is not a video file.`);
  if (role !== 'video' && isVideo) throw new Error(`"${name}" is a video — use the video slot.`);

  const buffer = await readFile(src);
  await placeUpload({ kind, id, role, filename: name, buffer, alt, caption });
  await rm(src, { force: true });
  return name;
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
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      return res.end(await readFile(resolved));
    }
    if (req.method === 'GET' && url.pathname === '/api/inbox') {
      return json(res, 200, { inbox: await listInbox(), path: INBOX });
    }
    if (req.method === 'GET' && url.pathname === '/__inbox') {
      // preview a file still sitting in _inbox/ (basename only — no traversal)
      const name = path.basename(url.searchParams.get('f') || '');
      const resolved = path.resolve(path.join(INBOX, name));
      if (!resolved.startsWith(path.resolve(INBOX)) || !existsSync(resolved)) {
        return json(res, 404, { error: 'not found' });
      }
      const ext = path.extname(resolved).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      return res.end(await readFile(resolved));
    }
    if (req.method === 'POST' && url.pathname === '/api/inbox/assign') {
      const p = JSON.parse((await readBody(req)).toString('utf8'));
      await assignFromInbox(p);
      return json(res, 200, {
        ok: true,
        id: p.id,
        item: await collectItem(p.kind === 'entry' ? 'entries' : 'logs', p.id),
        inbox: await listInbox(),
      });
    }
    if (req.method === 'POST' && url.pathname === '/api/inbox/discard') {
      const p = JSON.parse((await readBody(req)).toString('utf8'));
      const name = path.basename(p.file || '');
      const resolved = path.resolve(path.join(INBOX, name));
      if (resolved.startsWith(path.resolve(INBOX)) && existsSync(resolved)) {
        await rm(resolved, { force: true });
      }
      return json(res, 200, { ok: true, inbox: await listInbox() });
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
  console.log('  Create/edit entries & logs, type text, place photos & video.');
  console.log('  Media: drag files into _inbox/ from your file manager, then pick');
  console.log('  where each one goes from the tray on the page (or drop straight in).');
  console.log('  Writes to src/content/… — run "npm run dev" in another tab to preview.');
  console.log('  Local only; Ctrl+C to stop.\n');
});
