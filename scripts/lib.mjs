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

/** Optional date prompt (for backfilling); defaults to today, validates YYYY-MM-DD. */
export async function promptDate(rl) {
  for (;;) {
    const input = (await rl.question(`Date [${today()}]: `)).trim();
    if (!input) return today();
    if (/^\d{4}-\d{2}-\d{2}$/.test(input) && !Number.isNaN(Date.parse(input))) return input;
    console.log('Use YYYY-MM-DD (or press Enter for today).');
  }
}

/*
 * `xmlEscape` lived here for `placeholderSVG`'s stamped caption. The caption is gone (it announced
 * an unfinished site on twenty-four entries) and nothing else in this file emits XML text, so the
 * helper went with it rather than sitting unused waiting to be rediscovered and misapplied.
 */

export const yamlQuote = (s) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/**
 * Parse category slugs, labels and **hues** out of src/data/categories.ts.
 *
 * Chunked on `slug:` rather than matched with one cross-property regex. The old
 * pattern reached from a `slug` to the next `label` with `[\s\S]*?`, which is
 * fine for two adjacent required fields and wrong the moment an *optional* one
 * joins them: `hue` is absent on some categories, so a lazy match would happily
 * skip into the next category's hue and hand this one a colour belonging to a
 * different section. Splitting first means every field is read from inside the
 * object it belongs to, which is a property of the parse rather than of the
 * current contents of the file.
 */
export async function loadCategories() {
  const src = await readFile(CATEGORIES_PATH, 'utf8');
  const start = src.indexOf('export const categories');
  const end = src.indexOf('];', start);
  const body = src.slice(start, end);
  const cats = [];
  for (const chunk of body.split(/(?=slug:\s*["'])/).slice(1)) {
    const slug = chunk.match(/slug:\s*["']([^"']+)["']/)?.[1];
    const label = chunk.match(/label:\s*["']([^"']+)["']/)?.[1];
    if (!slug || !label) continue;
    const hue = chunk.match(/^\s*hue:\s*(\d+)/m)?.[1];
    cats.push({ slug, label, ...(hue === undefined ? {} : { hue: Number(hue) }) });
  }
  const reservedMatch = src.match(/RESERVED_SLUGS\s*=\s*\[([^\]]*)\]/);
  const reserved = reservedMatch
    ? [...reservedMatch[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1])
    : [];
  return { cats, reserved, src };
}

/**
 * The hue a category washes its pages with, for anything that has to match it.
 *
 * `undefined` rather than a default when the category declares none, so
 * `placeholderSVG` applies `resolveWash()`'s own fallback (a stable slug hash
 * across the warm band) instead of two files inventing different defaults.
 */
export function categoryHue(cats, slug) {
  return (Array.isArray(cats) ? cats : (cats?.cats ?? [])).find((c) => c.slug === slug)?.hue;
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
 * A placeholder cover (SVG) for entries whose photographs have not landed yet.
 *
 * Designed to read as a *deliberately empty contact-sheet cell* rather than a
 * missing image: warm ground, a faint ledger grid, a sand hairline frame with
 * registration rules, and one small wine crosshair. Colours are the live design
 * tokens (see the @theme block in src/styles/global.css), so a page full of
 * these still looks like the site instead of a wall of dark slabs.
 *
 * **It used to stamp `COVER · PENDING` across the middle, and that was the whole
 * problem.** The drawing already said "deliberately empty"; the words said
 * "unfinished site", in 38px monospace with 10px of letter-spacing, on twenty-four
 * entries at once — the loudest thing on a portfolio meant to be read by
 * recruiters. Nobody outside the project needs to be told a photograph is
 * missing, and the person who does need telling has `npm run photos`, which
 * exists for exactly that and can say it far more precisely. So the plate keeps
 * its registration marks and loses its announcement.
 *
 * **The tint comes from the entry's own category hue**, which is the second
 * thing that was wrong: the hue existed in `src/data/categories.ts`, washed every
 * other surface on the site, and this file ignored it in favour of a private list
 * of six sands picked by its own hash. So a category page showed a set of covers
 * with no relationship to the section they belonged to — data that exists and
 * never reaches the eye, the same fault `--boss-scale` and the tile hues were.
 *
 * A category's covers are siblings rather than clones: the hue is shared, and the
 * slug shifts lightness and the grid's phase a little, so three cards side by side
 * read as one set without looking like a repeated tile.
 *
 * `role="presentation"`, not `role="img"`: the plate carries no information a reader
 * needs, and every `<img>` that points at it already sets `alt=""` for the same
 * reason — the card's own heading and summary name the entry. An `aria-label` here
 * would be a second, worse name for something already named.
 *
 * **The plate stays one fixed light tone, and the dark theme is handled outside it.**
 * A static SVG loaded through `<img>` gets no CSS from the page, and this site's dark
 * mode is class-driven rather than `prefers-color-scheme`, so an in-SVG media query
 * would desync the moment somebody used the toggle against their OS setting — a
 * bright rectangle *and* a wrong one. What ships instead is a filter on the page side:
 * `html.dark [data-plate] img` in `global.css` reverses the lightness and returns the
 * hue, which lands the sand on the dark surface token. The one thing the drawing owes
 * that filter is a way to be recognised, and `PLATE_MARK` in `scripts/cover-plate.mjs`
 * is it — the `<pattern id="ledger">` below. **A redesign here may change every colour
 * and every rule, but dropping that pattern un-recognises twenty-four covers**, so
 * `tests/images.test.ts` fails on it rather than letting the dark theme quietly stop
 * reaching them. Real photographs are never filtered: they carry no mark, so the
 * detector says no and the rule never matches.
 *
 * @param hue   the category's hue in degrees. Omitted, it falls back to a stable
 *              slug hash across the warm band — the same rule `resolveWash()`
 *              applies in `src/lib/wash.ts`, restated here because a build script
 *              cannot import the TypeScript module.
 */
export function placeholderSVG({ seed = '', hue, width = 1600, height = 1000 }) {
  // Mirrors HUE_WHEEL in src/lib/wash.ts. A literal copy on purpose: drift shows
  // up as a cover that does not match its section, which is visible, rather than
  // as a silent import failure in a script that has to run without a build step.
  const HUE_WHEEL = [32, 20, 12, 44, 26, 350, 38];
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const h = typeof hue === 'number' ? hue : HUE_WHEEL[(hash >>> 3) % HUE_WHEEL.length];

  // Sand, not colour: these plates sit behind nothing and must not compete with
  // the photographs that will replace them. Saturation stays low and lightness
  // high; the slug moves lightness by a couple of points so siblings differ.
  const lift = ((hash >>> 7) % 5) - 2; // -2..+2
  const bg = `hsl(${h} 24% ${88 + lift}%)`;
  const grid = `hsl(${h} 18% 34%)`;
  // The frame has to stay *visible*. Tinting it with the hue at 72% lightness made the plate read as
  // an empty box rather than a drawn cell — the registration marks are the whole reason it looks
  // deliberate, so they keep roughly the contrast the old sand hairline had against its ground.
  const lineCol = `hsl(${h} 22% 58%)`;
  const accent = '#8e2f45'; // --color-accent, ledger wine
  const phase = (hash >>> 11) % 40; // the grid does not start in the same place twice
  const cx = width / 2;
  const cy = height / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="presentation">
  <defs>
    <pattern id="ledger" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="translate(${phase} ${phase})">
      <path d="M40 0H0v40" fill="none" stroke="${grid}" stroke-opacity="0.11" stroke-width="1.5"/>
    </pattern>
  </defs>
  <rect width="${width}" height="${height}" fill="${bg}"/>
  <rect width="${width}" height="${height}" fill="url(#ledger)"/>
  <rect x="28" y="28" width="${width - 56}" height="${height - 56}" fill="none" stroke="${lineCol}" stroke-width="2" rx="18"/>
  <line x1="28" y1="88" x2="${width - 28}" y2="88" stroke="${lineCol}" stroke-width="2" stroke-dasharray="2 26"/>
  <line x1="28" y1="${height - 88}" x2="${width - 28}" y2="${height - 88}" stroke="${lineCol}" stroke-width="2" stroke-dasharray="2 26"/>
  <path d="M${cx - 13} ${cy}h26M${cx} ${cy - 13}v26" stroke="${accent}" stroke-opacity="0.7" stroke-width="3"/>
</svg>
`;
}
