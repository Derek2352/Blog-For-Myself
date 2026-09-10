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
 * A category's covers are siblings rather than clones: the hue is shared, and three
 * properties of the drawing move with the slug, so a set of cards reads as sheets
 * from one pad rather than one tile printed three times.
 *
 * **Which three, and why those, is the part that had to be redone.** The first version
 * varied lightness by ±2 points and slid the grid's phase within its own cell, and the
 * comment here said siblings differ — but a category page renders every plate at the
 * same hue, and a screenshot of `/competitions/` showed three rectangles no eye could
 * tell apart. Both axes were real in the file and invisible on the page: two points on
 * an 88% ground is nothing, and a phase shift moves 0.11-opacity hairlines by at most a
 * cell. So the rule is now that **an axis earns its place by being legible at card
 * size**, which is where these are actually seen — a cover is drawn 1600px wide and
 * shown about 360px wide, a 4.4× reduction that swallows any small mark. The three that
 * survive that reduction are the ground's lightness, the grid's *pitch* (not its phase),
 * and how far the dashed rules sit from the edge; each is commented with the span it
 * moves through and why that span and not a wider one.
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
 * `html.dark [data-drawn] img` in `global.css` reverses the lightness and returns the
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
  // the photographs that will replace them. Saturation stays low and lightness high.
  //
  // **There used to be a third axis here and the measurement killed it.** The ground's
  // lightness varied ±4 points around 88% in five seeded steps, on the argument that the
  // page ground is 96% (so above ~93% the plate becomes a hole) and the dark theme's filter
  // reverses lightness about the midpoint (so below ~83% it inverts past the dark surface
  // and reads as a light patch). Both walls were reasoned, and the second one was reasoned
  // in the wrong place.
  //
  // `scratchpad/plate-sink.mjs` measured all twenty-one built plates against the dark
  // surface token rgb(39 33 25), which is what "sinks into the ground" means and what 2.6.1
  // checked on exactly one plate. **Eleven of twenty-one were off by more than 8 points on
  // some channel, and the worst by 23.** The pattern follows the lift almost exactly: at 88%
  // the spread is 3–9, at 90% it is 7–8, at 92% the plate lands 15–16 points *darker* than
  // the card it sits in, and at 84% it lands 11–23 points *lighter*. The low wall is real
  // and it is at about 87, not 83.
  //
  // That leaves 87–90 as the honest band, which is 3 points for five steps — and this
  // comment's own rule is that neighbours under two points apart cannot be told apart
  // through the card's frame and shadow. An axis that has to become invisible to be correct
  // is not an axis, so it is gone rather than squeezed. The two remaining axes vary the
  // *drawing* — grid pitch and rule inset — which is the stronger signal anyway, by the same
  // argument already written below: the eye reads texture as a ratio.
  //
  // **Saturation is 18%, and that number is measured too.** With the lift axis gone the whole
  // remaining error is hue: `hue-rotate` is a fixed linear matrix, not a perceptual operation,
  // so how far a plate lands from the dark surface depends on where on the wheel it started —
  // and the two ends of the site's warm band miss in opposite directions. At 24% the pinks
  // (340, 350) landed +11 on blue, reading violet and *above* their card, while 44 landed −9
  // and read olive, *below* it. Ten of twenty-one plates were out by more than 8.
  //
  // Swept 24 → 18 → 14 → 10 and re-measured every plate at each (`plate-sink.mjs`): the count
  // over 8 goes 10 → 3 → 3 → 2 while the median goes 5 → 5 → 6 → 7. Desaturating past 18 stops
  // buying outliers and starts costing the middle, because the dark surface token is itself a
  // warm colour and a neutral plate has to travel to reach it. 18% is where the curve turns.
  //
  // The grid and frame keep their own saturations (18% and 22%) — they are hairlines, so their
  // contribution to the plate's overall colour is small and their job is to be *seen*.
  //
  // This also settles the page audit's finding #6, which named "the `experience` hue (44)
  // inverts to olive rgb(31 27 16)" off a screenshot. It was right about the hue and could not
  // see why: 44 is one of the two ends of the band, and the plate it spotted was one of the
  // ones the lift axis had pushed furthest.
  const bg = `hsl(${h} 18% 88%)`;
  const grid = `hsl(${h} 18% 34%)`;
  // The frame has to stay *visible*. Tinting it with the hue at 72% lightness made the plate read as
  // an empty box rather than a drawn cell — the registration marks are the whole reason it looks
  // deliberate, so they keep roughly the contrast the old sand hairline had against its ground.
  const lineCol = `hsl(${h} 22% 58%)`;
  const accent = '#8e2f45'; // --color-accent, ledger wine
  // Axis 2 — the grid's pitch, which replaced its phase. Phase slid the lines inside
  // their own cell and changed nothing anyone could see; pitch changes the texture of
  // the entire field. The four values are geometric rather than evenly spaced because
  // the eye reads texture as a ratio: each is 30% coarser than the last, and 30% is
  // about the smallest difference in line density that registers as *a different
  // drawing* rather than as the same drawing rendered imprecisely. At the card's 4.4×
  // reduction these land at roughly 9, 12, 15 and 19 CSS px — four distinguishable
  // weaves, none of which closes up into flat tone at the compact card's 96px wide
  // thumbnail. They divide the plate unevenly on purpose: a pitch that tiled exactly
  // would put a line on the frame and read as a table.
  const PITCH = [40, 52, 68, 88];
  const pitch = PITCH[(hash >>> 11) % PITCH.length];
  // Axis 3 — where the two dashed cross-rules sit, as a *fraction of the height*
  // rather than the flat 88px this used to be. Proportional matters now the generator
  // draws more than one aspect: the same 88px is 8.8% of a 1000px cover and 7.8% of a
  // 1125px portrait plate, so an absolute inset quietly redrew the composition every
  // time the shape changed. The three fractions put the rule at roughly a twelfth, a
  // ninth and a seventh of the way in — near enough to the edge to read as a header
  // rule on a form, far enough apart to be told apart, and all three clear of the 28px
  // frame at every size this draws.
  const RULE = [0.088, 0.115, 0.145];
  const inset = Math.round(height * RULE[(hash >>> 17) % RULE.length]);
  const cx = width / 2;
  const cy = height / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="presentation">
  <defs>
    <pattern id="ledger" width="${pitch}" height="${pitch}" patternUnits="userSpaceOnUse">
      <path d="M${pitch} 0H0v${pitch}" fill="none" stroke="${grid}" stroke-opacity="0.11" stroke-width="1.5"/>
    </pattern>
  </defs>
  <rect width="${width}" height="${height}" fill="${bg}"/>
  <rect width="${width}" height="${height}" fill="url(#ledger)"/>
  <rect x="28" y="28" width="${width - 56}" height="${height - 56}" fill="none" stroke="${lineCol}" stroke-width="2" rx="18"/>
  <line x1="28" y1="${inset}" x2="${width - 28}" y2="${inset}" stroke="${lineCol}" stroke-width="2" stroke-dasharray="2 26"/>
  <line x1="28" y1="${height - inset}" x2="${width - 28}" y2="${height - inset}" stroke="${lineCol}" stroke-width="2" stroke-dasharray="2 26"/>
  <path d="M${cx - 13} ${cy}h26M${cx} ${cy - 13}v26" stroke="${accent}" stroke-opacity="0.7" stroke-width="3"/>
</svg>
`;
}
