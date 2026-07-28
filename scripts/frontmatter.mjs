/**
 * Frontmatter read/write for the studio.
 *
 * The studio used to rebuild frontmatter from scratch on every save, emitting
 * only the keys it knows about. That silently deleted two things: YAML comments
 * (several entries carry provenance notes recording corrections and what was
 * deliberately withheld) and any key the studio hadn't been taught about. Open
 * an entry, press Save, lose the notes.
 *
 * So writing is surgical instead. `rewriteFrontmatter` walks the existing block
 * line by line, replaces only the values of managed keys, and passes everything
 * else through untouched — comments, commented-out template hints, unknown keys,
 * blank lines, and trailing inline comments like `date: 2026-04-01 # verify`.
 * `buildEntryFrontmatter` / `buildLogFrontmatter` are still used, but only for
 * files that don't exist yet.
 */
import { yamlQuote } from './lib.mjs';

export const SECTIONS = ['What it was', 'What I did', 'What I learned', 'How it felt'];

/** Canonical key order, used when inserting a key the file didn't have. */
export const ENTRY_KEYS = [
  'title', 'category', 'date', 'endDate', 'updated', 'role', 'organization',
  'location', 'summary', 'note', 'video', 'cover', 'gallery', 'tags', 'links',
  'featured', 'draft', 'order',
];
export const LOG_KEYS = ['title', 'category', 'date', 'kind', 'summary', 'image', 'link', 'tags', 'draft'];

/** Keys dropped from the file when their value is empty. */
const OPTIONAL = new Set([
  'endDate', 'updated', 'role', 'organization', 'location', 'note', 'video',
  'order', 'image', 'link',
]);
/** Keys whose value spans following indented lines. */
const BLOCK_KEYS = new Set(['gallery', 'links']);

const q = yamlQuote;
const isBlank = (v) => v === undefined || v === null || v === '';

/* -------------------------------- read -------------------------------- */

export function parseFrontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: src, block: null };
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
    const rest = kv[2].replace(/\s+#.*$/, '').trim(); // ignore trailing comment
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
        const lm = lines[++i].match(/label:\s*"(.*)"/);
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
  return { data, body, block };
}

export function splitSections(body) {
  const out = { preamble: '', sections: {} };
  const parts = body.split(/^##\s+(.+)$/m);
  out.preamble = (parts[0] ?? '').trim();
  for (let i = 1; i < parts.length; i += 2) out.sections[parts[i].trim()] = (parts[i + 1] ?? '').trim();
  return out;
}

/* -------------------------------- write ------------------------------- */

/** Canonical lines for one key, or null when the key should be omitted. */
function emitKey(key, value) {
  if (key === 'gallery') {
    if (!Array.isArray(value) || !value.length) return ['gallery: []'];
    const L = ['gallery:'];
    for (const g of value) {
      L.push(`  - src: ${q(g.src)}`);
      L.push(`    alt: ${q(g.alt || '')}`);
      if (g.caption) L.push(`    caption: ${q(g.caption)}`);
    }
    return L;
  }
  if (key === 'links') {
    if (!Array.isArray(value) || !value.length) return ['links: []'];
    const L = ['links:'];
    for (const l of value) {
      L.push(`  - label: ${q(l.label)}`);
      L.push(`    url: ${q(l.url)}`);
    }
    return L;
  }
  if (key === 'tags') return [`tags: [${(value || []).map(q).join(', ')}]`];
  if (key === 'featured' || key === 'draft') return [`${key}: ${value ? 'true' : 'false'}`];
  if (isBlank(value)) {
    if (OPTIONAL.has(key)) return null; // cleared in the UI → drop the line
    // a required field left empty: write it empty rather than inventing a value,
    // so `astro check` reports it instead of the studio hiding it
    return [`${key}: ""`];
  }
  if (key === 'order') return [`order: ${Number(value)}`];
  // dates stay unquoted so Astro's z.coerce.date() sees a plain scalar
  if (/^(date|endDate|updated)$/.test(key)) return [`${key}: ${value}`];
  return [`${key}: ${q(String(value))}`];
}

/**
 * Update `data` into an existing frontmatter block, preserving everything the
 * studio doesn't manage. Returns the new block (without the --- fences).
 */
export function rewriteFrontmatter(block, data, keyOrder) {
  // an empty block means a brand-new file: emit the canonical order only
  const lines = block.trim() ? block.split('\n') : [];
  const out = [];
  const seen = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const kv = line.match(/^([a-zA-Z_][\w-]*):/);
    if (!kv) {
      out.push(line); // comment, blank line, or stray text — keep verbatim
      continue;
    }
    const key = kv[1];
    // extent of this key: the line itself plus any following indented lines
    let end = i;
    if (BLOCK_KEYS.has(key) || /^[a-zA-Z_][\w-]*:\s*$/.test(line)) {
      while (end + 1 < lines.length && /^\s+\S/.test(lines[end + 1])) end++;
    }
    seen.add(key);

    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const emitted = emitKey(key, data[key]);
      if (emitted) {
        // keep a trailing inline comment when the value stays a single line
        const trailing = emitted.length === 1 && end === i ? (line.match(/\s+(#.*)$/)?.[1] ?? '') : '';
        out.push(trailing ? `${emitted[0]}  ${trailing}` : emitted[0]);
        out.push(...emitted.slice(1));
      }
      // emitted === null → the field was cleared in the UI, so drop the line
    } else {
      out.push(...lines.slice(i, end + 1)); // unknown key — pass through
    }
    i = end;
  }

  // keys the file never had: append in canonical order
  for (const key of keyOrder) {
    if (seen.has(key) || !Object.prototype.hasOwnProperty.call(data, key)) continue;
    const emitted = emitKey(key, data[key]);
    if (emitted) out.push(...emitted);
  }
  return out.join('\n');
}

export const buildEntryFrontmatter = (d) =>
  ['---', rewriteFrontmatter('', d, ENTRY_KEYS), '---'].join('\n');
export const buildLogFrontmatter = (d) =>
  ['---', rewriteFrontmatter('', d, LOG_KEYS), '---'].join('\n');

/** Wrap an updated block back into a file, body untouched. */
export const withFrontmatter = (block, body) => `---\n${block}\n---\n${body}`;

export function buildEntryBody(sections) {
  return (
    '\n' +
    SECTIONS.map((h) => {
      const found = (sections || []).find((s) => s.heading === h);
      return `## ${h}\n\n${(found?.text || '').trim()}\n`;
    }).join('\n')
  );
}
