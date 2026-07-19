/**
 * Shared helpers for the content scripts (new-entry / new-log).
 * These scripts read src/data/categories.ts as plain text so they stay
 * dependency-free — keep that file's simple object-literal shape.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { stdin, stdout } from 'node:process';

/**
 * Minimal prompt helper. Unlike readline/promises it buffers lines that
 * arrive before a question is asked, so the scripts work interactively AND
 * with piped input (e.g. printf 'a\nb\n' | npm run new-log).
 */
export function makePrompter() {
  const pending = [];
  let waiting = null;
  let buffer = '';
  let ended = false;
  stdin.setEncoding('utf8');
  const onData = (chunk) => {
    buffer += chunk;
    let i;
    while ((i = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, i).replace(/\r$/, '');
      buffer = buffer.slice(i + 1);
      if (waiting) {
        const w = waiting;
        waiting = null;
        w(line);
      } else {
        pending.push(line);
      }
    }
  };
  const onEnd = () => {
    ended = true;
    if (waiting) {
      const w = waiting;
      waiting = null;
      w(buffer);
    }
  };
  stdin.on('data', onData);
  stdin.on('end', onEnd);
  return {
    async question(q) {
      stdout.write(q);
      if (pending.length > 0) {
        const line = pending.shift();
        stdout.write(`${line}\n`);
        return line;
      }
      if (ended) return '';
      return new Promise((resolve) => {
        waiting = resolve;
      });
    },
    close() {
      stdin.off('data', onData);
      stdin.off('end', onEnd);
      stdin.pause();
    },
  };
}

export const CATEGORIES_PATH = new URL('../src/data/categories.ts', import.meta.url);

export const slugify = (s) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

export const today = () => new Date().toISOString().slice(0, 10);

const xmlEscape = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const yamlQuote = (s) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/** Parse category slugs/labels out of src/data/categories.ts. */
export async function loadCategories() {
  const src = await readFile(CATEGORIES_PATH, 'utf8');
  const start = src.indexOf('export const categories');
  const end = src.indexOf('];', start);
  const body = src.slice(start, end);
  const cats = [];
  const re = /slug:\s*["']([^"']+)["'][\s\S]*?label:\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(body)) !== null) cats.push({ slug: m[1], label: m[2] });
  const reservedMatch = src.match(/RESERVED_SLUGS\s*=\s*\[([^\]]*)\]/);
  const reserved = reservedMatch
    ? [...reservedMatch[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1])
    : [];
  return { cats, reserved, src };
}

/** Append a new category object to src/data/categories.ts. */
export async function appendCategory({ slug, label, blurb }) {
  const { src } = await loadCategories();
  const orders = [...src.matchAll(/order:\s*(\d+)/g)].map((m) => Number(m[1]));
  const order = (orders.length ? Math.max(...orders) : 0) + 1;
  const start = src.indexOf('export const categories');
  const end = src.indexOf('];', start);
  const entry = `  {\n    slug: ${JSON.stringify(slug)},\n    label: ${JSON.stringify(label)},\n    order: ${order},\n    blurb: ${JSON.stringify(blurb)},\n  },\n`;
  await writeFile(CATEGORIES_PATH, src.slice(0, end) + entry + src.slice(end));
  return order;
}

/**
 * Ask for a category slug; validate against categories.ts; offer to create
 * a brand-new one (which appends to the data file — a new tab, no code).
 */
export async function promptCategory(rl) {
  const { cats, reserved } = await loadCategories();
  console.log('\nCategories (tabs):');
  for (const c of cats) console.log(`  ${c.slug.padEnd(16)} ${c.label}`);
  for (;;) {
    const input = (await rl.question('\nCategory slug: ')).trim();
    if (cats.some((c) => c.slug === input)) return input;
    if (!input) continue;
    const asSlug = slugify(input);
    if (reserved.includes(asSlug)) {
      console.log(`"${asSlug}" is reserved by a fixed route — pick another name.`);
      continue;
    }
    const create = (
      await rl.question(`"${input}" doesn't exist. Create it as a new tab "${asSlug}"? [y/N] `)
    )
      .trim()
      .toLowerCase();
    if (create === 'y' || create === 'yes') {
      const label =
        (await rl.question(`Tab label [${asSlug}]: `)).trim() || asSlug;
      const blurb = (await rl.question('One-line blurb (optional): ')).trim();
      const order = await appendCategory({ slug: asSlug, label, blurb });
      console.log(`Added "${label}" (order ${order}) to src/data/categories.ts — new tab live.`);
      return asSlug;
    }
  }
}

/**
 * A neutral placeholder cover (SVG) so builds pass before real photos land.
 * Tint varies with the seed so grids don't look like wallpaper.
 */
export function placeholderSVG({ top = 'COVER · PENDING', bottom = '', seed = '', width = 1600, height = 1000 }) {
  const tints = ['#242833', '#2a2f28', '#33292d', '#273234', '#2f2a34', '#343026'];
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const bg = tints[hash % tints.length];
  const lineCol = '#8b95a6';
  const textCol = '#aab3bf';
  const t = xmlEscape(top.toUpperCase());
  const b = xmlEscape(bottom.toUpperCase());
  const midY = height / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Placeholder image">
  <rect width="${width}" height="${height}" fill="${bg}"/>
  <rect x="28" y="28" width="${width - 56}" height="${height - 56}" fill="none" stroke="${lineCol}" stroke-opacity="0.5" stroke-width="2" rx="18"/>
  <line x1="28" y1="88" x2="${width - 28}" y2="88" stroke="${lineCol}" stroke-opacity="0.35" stroke-width="2" stroke-dasharray="2 26"/>
  <line x1="28" y1="${height - 88}" x2="${width - 28}" y2="${height - 88}" stroke="${lineCol}" stroke-opacity="0.35" stroke-width="2" stroke-dasharray="2 26"/>
  <text x="${width / 2}" y="${midY - 14}" text-anchor="middle" font-family="'IBM Plex Mono','Courier New',monospace" font-size="38" letter-spacing="10" fill="${textCol}">${t}</text>
  ${b ? `<text x="${width / 2}" y="${midY + 48}" text-anchor="middle" font-family="'IBM Plex Mono','Courier New',monospace" font-size="22" letter-spacing="6" fill="${textCol}" fill-opacity="0.7">${b}</text>` : ''}
</svg>
`;
}
