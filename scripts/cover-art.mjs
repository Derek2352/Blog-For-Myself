/**
 * Drawn covers — the illustrations, as opposed to the plates.
 *
 * ## What this is and why it is separate from `placeholderSVG`
 *
 * `placeholderSVG` in ./lib.mjs draws a *held-open slot*: a warm ground, a ledger grid, a frame and
 * a crosshair, saying "a photograph belongs here". Every entry gets one for free and twenty-three
 * of them are still wearing it, which is correct — those entries have photographs that simply have
 * not been scanned yet.
 *
 * One entry does not. `ah-gaap-alipayhk-ux-design-2026` is a UX competition whose deck and
 * prototype are deliberately withheld (see the frontmatter note on that entry), so its photograph
 * is never arriving. A permanent placeholder on the entry Derek is proudest of is the wrong
 * outcome, and a screenshot of the real prototype is not an available one. The third answer is an
 * illustration: a drawing *about* the work, credited as a drawing.
 *
 * ## Where the drawing came from
 *
 * The two Next.js drops Derek sent in July shipped exactly one piece of genuinely hand-drawn cover
 * art among their five "cover types": a bill-splitting phone scene, built as thirty absolutely
 * positioned `<div>`s and about seventy lines of hand-written CSS (`.mock-phone`, `.phone-island`,
 * `.phone-balance`, `.ai-face`, `.mini-bill`, `.phone-cta`). The other four types were a flat
 * background colour, a flat background colour with a Lucide icon, and two `:after` gradients over
 * JPEGs that were not in either zip. So "port the covers" is really "port the one cover", and the
 * system around it is what makes the second one cheap rather than what makes the first one work.
 *
 * **Three things changed in the port, each for a reason worth stating.**
 *
 * 1. **SVG, not CSS.** Their scene only exists inside a React component, so it cannot be a card
 *    cover, an OG image, or a file anybody can open. An SVG is a cover in the same sense a
 *    photograph is: one file, in `images/`, named by the frontmatter, resolved by the same
 *    `image()` validator, sized by the same `<img width height>`.
 *
 * 2. **The AlipayHK wordmark is gone.** Theirs drew `alipay` + `HK` at 43px with the company's
 *    strapline under it. On a personal portfolio that reads as an official asset of a company
 *    Derek entered a competition with, not as a student's concept work — and it is the one element
 *    of the composition that says nothing about what he did. The credit line below (theirs, kept
 *    almost verbatim, because it was the best thing in either zip) does that job honestly instead.
 *
 * 3. **No legible text on the phone screens.** Theirs typed real interface copy at 5px — "Hey,
 *    I've got the maths.", "HK$ 121.50", "TamJai dinner · 4 friends". Two problems: it is their
 *    copywriting rather than Derek's, and a cover that renders as a plausible screenshot is
 *    precisely what the credit line has to spend itself denying. Bars and rules where the text
 *    would be say *concept drawing* in the drawing's own language, before any caption has to. It
 *    also removes every font dependency from the file, which matters because the OG pipeline
 *    rasterises art through sharp and has no control over what fonts that finds.
 *
 * ## Colour: the drawing is built to survive the dark theme's filter
 *
 * `html.dark [data-drawn] img` in global.css applies `invert(1) hue-rotate(180deg)` — the site's
 * one answer to "a static SVG through `<img>` receives no CSS". That filter is not general-purpose:
 * `placeholderSVG` documents the measurements (`scratchpad/plate-sink.mjs`, twenty-one plates
 * against the dark surface token) that fixed the plate's ground at `hsl(h 18% 88%)` and its
 * saturation at 18%, because at 24% the pinks inverted violet and at 44° it inverted olive.
 *
 * So this file does not pick its own palette. **Every tone below is derived from the same hue at
 * the same low saturation**, and the two most visible ones — the ground and the ink — are the
 * plate's own `bg` and `grid` values, byte for byte. The inversion therefore lands where the
 * plate's already lands, which is a property the drawing inherits rather than one it hopes for.
 * `scratchpad/art-sink.mjs` measures it rather than trusting this paragraph.
 *
 * The two colours that are *not* hue-derived are the site's two brand tokens: `--color-accent`
 * (ledger wine) on the smallest share and the settle button, and `--color-secondary` (sage) on the
 * agent's face — one each, which is the whole brief for the secondary Derek approved in July.
 *
 * ## Adding a template
 *
 * Add an entry to `ART_TEMPLATES`. It costs a `draw(t)` returning SVG body markup, plus the three
 * strings the rest of the site needs: `alt` (what the `<img>` announces), `credit` (what the
 * figcaption admits), and `aspect`. `ART_NAMES` is derived from the keys, `content-schema.ts`
 * validates `art:` against it, and `tests/images.test.ts` will draw the new template at its own
 * aspect and check the result parses. Nothing else needs touching.
 */
import { ART_MARK } from './cover-plate.mjs';

/* ── the shared palette ────────────────────────────────────────────────────────────────────────
 * One hue in, eleven tones out. The two marked "= plate" are copied from `placeholderSVG` and must
 * stay copied: they are what makes the dark filter land in the same place for both kinds of cover.
 */
const palette = (h) => ({
  ground: `hsl(${h} 18% 88%)`, // = plate `bg`
  frame: `hsl(${h} 22% 58%)`, // = plate `lineCol`
  ink: `hsl(${h} 22% 34%)`, // = plate `grid`
  bezel: `hsl(${h} 12% 99%)`, // the phone's white edge — their `#fff`, warmed
  screen: `hsl(${h} 14% 95%)`, // lifts off the ground without becoming a second white
  panel: `hsl(${h} 20% 90%)`, // their `#e0f2ed` balance card, on this site's hue
  chat: `hsl(${h} 16% 92%)`, // their `#eaf2ef` speech bubble
  hair: `hsl(${h} 18% 78%)`, // their `#e4eeec` row rules
  shade: `hsl(${h} 20% 55%)`, // the cast shadow, always drawn at low alpha
  accent: '#8e2f45', // --color-accent, ledger wine
  sage: `hsl(88 26% 82%)`, // the agent's disc — a pale form of --color-secondary
  sageInk: '#647554', // --color-secondary itself
});

/* A rounded bar. Nearly every element of both screens is one, which is the point: an interface
 * abstracted to its blocks. `o` is opacity so the same ink reads as heading, body or caption
 * weight without a second colour entering the drawing. */
const bar = (x, y, w, h, fill, o = 1) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${(h / 2).toFixed(1)}" fill="${fill}"${o === 1 ? '' : ` fill-opacity="${o}"`}/>`;

/* Same, with a corner radius that is not half the height — panels and pills rather than bars. */
const box = (x, y, w, h, r, fill, o = 1) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${o === 1 ? '' : ` fill-opacity="${o}"`}/>`;

/* A polygon from flat [x,y,x,y,…] pairs. Ridges, roofs and skylines are all one of these. */
const poly = (pts, fill, o = 1) =>
  `<polygon points="${pts.join(' ')}" fill="${fill}"${o === 1 ? '' : ` fill-opacity="${o}"`}/>`;

const dot = (cx, cy, r, fill, o = 1) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${o === 1 ? '' : ` fill-opacity="${o}"`}/>`;

const line = (d, stroke, w = 3, o = 1, extra = '') =>
  `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}"${o === 1 ? '' : ` stroke-opacity="${o}"`} stroke-linecap="round"${extra}/>`;

const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Mono text. The only text any drawing carries.
 *
 * `ui-monospace, …, monospace` rather than the site's IBM Plex Mono: an SVG loaded through `<img>`
 * gets no `@font-face` from the page, so a named webfont would silently fall back anyway — and to
 * whatever the *renderer* has, which for the OG pipeline's rasteriser is not the browser's list.
 * A generic stack asks for what every renderer actually has.
 */
const mono = (x, y, str, fill, { size = 22, track = 3.5, o = 0.55, anchor = 'start' } = {}) =>
  `<text x="${x}" y="${y}" fill="${fill}" fill-opacity="${o}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="${size}" letter-spacing="${track}"${anchor === 'start' ? '' : ` text-anchor="${anchor}"`}>${xml(str)}</text>`;

/**
 * ## Per-entry variation
 *
 * Twenty-four entries carry a drawn cover and they have to be twenty-four different pictures. Most
 * of that is the template — a skyline is not a film strip — but five entries share `skyline` and
 * three share `film-strip`, so each template also has to differ *within itself*.
 *
 * **The rule the plate already paid for applies here unchanged**: an axis earns its place by being
 * legible at card size. `placeholderSVG` shipped a ±4-point lightness axis and a grid-phase axis,
 * both real in the file and invisible on the page, and a screenshot of `/competitions/` showed three
 * rectangles nobody could tell apart. A cover is drawn 1600 wide and shown about 360 wide — 0.225× —
 * so **every axis below is structural**: how many towers, how tall, how many frames, where the
 * ridges cross. Nothing varies a colour, because within a category the hue is deliberately shared
 * and a tint that survived that reduction would break the set rather than vary it.
 *
 * A small deterministic PRNG rather than `Math.random()`: `npm run covers` is a catch-up pass that
 * runs over every entry whenever a generator changes, and a random drawing would rewrite all
 * twenty-four files on every run and put a meaningless diff in every commit. Seeded by the slug, so
 * an entry's cover is a property of the entry.
 *
 * mulberry32 — thirty-two bits, one multiply and three shifts, uniform enough for choosing between
 * six tower heights. It is here rather than imported because this file has no dependencies by
 * design; `cover-plate.mjs` is the only import and it is nine lines.
 */
/**
 * Hand out the members of a family in turn, by the entry's position among those sharing a template.
 *
 * **Seeded choice cannot do this job and the contact sheet proved it twice.** Three entries share
 * `conversation`; picking one of four layouts from a hash gives all three the same layout 1 time in
 * 16 and gives *two of the three* the same layout more often than not — the probability that three
 * draws from four are all distinct is 3/8. The first attempt collided on all three (a generator
 * fault, since fixed), and the fixed generator still collided on two. Rewriting the template again
 * would not have helped: the mechanism was wrong, not the drawing.
 *
 * So the discrete family member is chosen by **ordinal** — this is the second entry using
 * `conversation`, so it gets the second layout — which makes distinctness a property of the system
 * rather than a thing that usually happens. `redraw-covers.mjs` numbers them in slug order, so an
 * entry's ordinal is stable across runs and changes only when an entry is added to or removed from
 * that template's set, which is exactly when the covers should be reshuffled anyway.
 *
 * Everything *continuous* stays seeded: how tall the peaks are, how many books, where the mist sits.
 * The split is the point — the seed varies the drawing, the ordinal guarantees the composition.
 */
const cycle = (list, ordinal = 0) => list[(((ordinal | 0) % list.length) + list.length) % list.length];

function variation(seed) {
  let a = 0x9e3779b9;
  for (const ch of String(seed)) a = (Math.imul(a ^ ch.charCodeAt(0), 0x85ebca6b) >>> 0) + 1;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  /*
   * **Discard the first eight outputs, and this is not superstition.** mulberry32 advances its state
   * by a fixed constant and mixes on the way out, so states that start close together produce *first*
   * outputs that are close together — the mixing has had one round to work. The three career-advisory
   * slugs share a sixteen-character prefix, and the first thing `conversation` asks for is a
   * `pick()` of four layouts: all three picked the same one, and the three covers came out as the
   * same picture after a rewrite specifically intended to stop that. It read as a one-in-sixteen
   * coincidence and it was not a coincidence at all.
   *
   * Eight rounds is the usual warm-up for a small-state generator and it is cheap — eight multiplies,
   * once per cover, at build time. `tests/images.test.ts` measures the spread across the site's real
   * slugs rather than trusting this paragraph, because the failure it fixes was invisible in the
   * code and obvious on a contact sheet.
   */
  for (let i = 0; i < 8; i++) next();
  return {
    /** A float in [lo, hi). */
    float: (lo, hi) => lo + next() * (hi - lo),
    /** An integer in [lo, hi], inclusive — counts are inclusive of both ends in prose. */
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    /** One of these. */
    pick: (list) => list[Math.floor(next() * list.length)],
    /** `n` floats in [lo, hi), which is what a ridge or a skyline actually wants. */
    series: (n, lo, hi) => Array.from({ length: n }, () => lo + next() * (hi - lo)),
    /** True `p` of the time. */
    chance: (p) => next() < p,
  };
}

/* ── phone geometry ───────────────────────────────────────────────────────────────────────────
 * Their handset was 113 × 218 with a 3px border, a 19px radius and 7px of padding — an aspect of
 * 0.518, which is squatter than any real phone (9:19.5 is 0.46). The proportions below are the
 * halfway point at 300 × 610 (0.492): far enough from square to read as a handset, wide enough
 * that the abstracted rows inside it survive the card's reduction.
 *
 * **That reduction is the constraint every number here answers to.** A cover is drawn 1600 wide
 * and shown about 360 wide on a card — 0.225× — so a 12px bar arrives at 2.7px and a 10px gap
 * closes up into tone. Nothing structural below is under 10 units tall or 14 apart.
 *
 * The border, radius and padding are their ratios scaled by 300/113 = 2.65: 3 → 8, 19 → 50,
 * 7 → 19. Keeping the ratios rather than re-picking the numbers is what preserves their drawing's
 * character through a 2.65× enlargement.
 */
const PHONE = { w: 300, h: 610, edge: 8, r: 50, pad: 19 };

/* Their `box-shadow: 7px 10px 18px` scaled by the same 2.65 → 18, 26. The 18px blur is dropped:
 * every other edge on this site is hard (the plate, the cat, the ink plates), a single soft one
 * would be the odd element out, and a hard offset shadow is a screen-print convention rather than
 * a failed attempt at a soft one. It also keeps the file free of filter primitives, which matters
 * for the rasterisers that now see it. Alpha 0.16 is theirs (`#253e3525` is 0.145) rounded up a
 * touch, because this shadow has no blur to spread its weight over. */
const SHADOW = { dx: 18, dy: 26, alpha: 0.16 };

/** The phone shell: cast shadow, bezel, screen. Contents are drawn by the caller in local space. */
const shell = (t) =>
  box(SHADOW.dx, SHADOW.dy, PHONE.w, PHONE.h, PHONE.r, t.shade, SHADOW.alpha) +
  `<rect x="0" y="0" width="${PHONE.w}" height="${PHONE.h}" rx="${PHONE.r}" fill="${t.screen}" stroke="${t.bezel}" stroke-width="${PHONE.edge}"/>` +
  /* The camera island, centred. 31 × 7 of their 113 → 82 × 19 of 300. */
  box((PHONE.w - 82) / 2, 34, 82, 19, 10, t.ink, 0.9);

/**
 * The back handset — the bill itself: a balance, then the transactions under it.
 *
 * Their `.phone-back` in order: island, header with a `＋`, a welcome line, a balance card of
 * three text sizes, two rows each with an emoji / title / sub / `↗`, and a four-glyph nav strip.
 * Every one of those is here as its block. Two rows became three because at 610 tall there is room
 * for it and a list of two reads as a stub.
 */
const backScreen = (t) => {
  let s = shell(t);
  // Header: a title-weight bar, and the `＋` as an actual pair of crossed rules.
  s += bar(30, 78, 96, 22, t.ink, 0.8);
  s += `<path d="M257 78v22M246 89h22" stroke="${t.ink}" stroke-opacity="0.35" stroke-width="5" stroke-linecap="round"/>`;
  s += bar(30, 118, 150, 12, t.ink, 0.28); // their "Good food. Great company."
  // The balance card. 240 wide inside a 262 content box leaves the 19px padding they used.
  s += box(30, 152, 240, 132, 18, t.panel);
  s += bar(50, 172, 96, 11, t.ink, 0.35); // "YOUR GROUP, ALL SET"
  s += bar(50, 198, 160, 30, t.ink, 0.85); // the amount — the heaviest mark on this screen
  s += bar(50, 242, 112, 12, t.ink, 0.3); // "Friday dinner"
  /* Three rows on a 72 pitch: title, sub 22 under it, hairline 46 under that. 72 is the smallest
     pitch that keeps the hairlines 3.2px apart at card size, which is where a list stops reading
     as a list and starts reading as hatching. */
  for (let i = 0; i < 3; i++) {
    const y = 306 + i * 72;
    s += `<circle cx="46" cy="${y + 7}" r="14" fill="${t.ink}" fill-opacity="0.22"/>`;
    s += bar(74, y, 130, 14, t.ink, 0.6);
    s += bar(74, y + 22, 88, 10, t.ink, 0.28);
    s += `<path d="M250 ${y + 2}l12 12-12 12" fill="none" stroke="${t.ink}" stroke-opacity="0.4" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
    s += `<path d="M30 ${y + 46}h240" stroke="${t.hair}" stroke-width="2"/>`;
  }
  /* Their `⌂　◉　▤　◌` — four positions, the current one filled. 58 apart so the gaps stay 13px at
     card size rather than merging into one bar. */
  for (let i = 0; i < 4; i++) {
    const on = i === 0;
    s += `<circle cx="${70 + i * 58}" cy="552" r="9" fill="${on ? t.accent : t.ink}"${on ? '' : ' fill-opacity="0.3"'}/>`;
  }
  return s;
};

/**
 * The front handset — the agent: a face, a greeting, a message, your share, a settle button.
 *
 * Their `.phone-front`: island, a back arrow / title / ellipsis header, the `.ai-face` disc, a
 * bold hello, a two-line chat bubble, a `.mini-bill` of three sizes, and the `.phone-cta`. The
 * disc is where this site's secondary lives — theirs was a lime `#e1f0bf` circle with an olive
 * glyph, which is structurally the same idea as sage on ivory and needs no other change.
 */
const frontScreen = (t) => {
  let s = shell(t);
  s += `<path d="M46 80l-12 9 12 9" fill="none" stroke="${t.ink}" stroke-opacity="0.5" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
  s += bar(108, 80, 84, 18, t.ink, 0.75);
  for (let i = 0; i < 3; i++)
    s += `<circle cx="${246 + i * 12}" cy="89" r="3.5" fill="${t.ink}" fill-opacity="0.4"/>`;
  // The disc, and the `✳` as three rules through its centre — six arms, at 44 long on an r=44 disc.
  s += `<circle cx="150" cy="190" r="44" fill="${t.sage}"/>`;
  s += `<path d="M150 168v44M131 179l38 22M169 179l-38 22" stroke="${t.sageInk}" stroke-width="7" stroke-linecap="round"/>`;
  s += bar(82, 258, 136, 16, t.ink, 0.7); // "Hey, I've got the maths."
  s += box(34, 300, 232, 92, 16, t.chat);
  s += bar(54, 322, 192, 10, t.ink, 0.3);
  s += bar(54, 348, 172, 10, t.ink, 0.3);
  s += bar(54, 374, 128, 10, t.ink, 0.3);
  // The mini-bill, centred on the 300 shell: (300 − w) / 2 for each of the three widths.
  s += bar(106, 424, 88, 11, t.ink, 0.35);
  s += bar(84, 450, 132, 30, t.ink, 0.9);
  s += bar(96, 494, 108, 10, t.ink, 0.28);
  // Their `.phone-cta` — a filled pill with light text. Here: the wine, and a light bar in it.
  s += box(34, 528, 232, 46, 23, t.accent);
  s += bar(106, 546, 88, 10, t.bezel, 0.85);
  return s;
};

/**
 * The left column: one bar becoming three.
 *
 * This has no counterpart in the drops, and it is the reason the cover works at card size. Two
 * tilted handsets at 0.225× are a pleasant shape and an unreadable one — nothing in them says
 * *bill splitting* rather than *an app*. The diagram does: a 380-wide bar, and beneath it three
 * bars of 170, 118 and 60 which come to exactly 380 once the two 16px gaps are counted. The
 * arithmetic is the drawing — it is the same length, divided.
 *
 * Unequal thirds rather than equal ones because the entry's own product is a ledger between people
 * who owe each other different amounts; three identical bars would draw `÷ 3`, which is the thing
 * the work exists to replace. The smallest share is the wine, and it is the same wine as the
 * settle button on the front handset — one share, followed through.
 */
const splitDiagram = (t) => {
  const x = 96;
  const w = 440;
  const gap = 19;
  const shares = [
    [196, 0.55],
    [136, 0.4],
    [70, 1],
  ];
  /* 196 + 136 + 70 = 402, plus the two 19px gaps = 440. If a share is ever re-weighted this must
     still hold, so it is asserted rather than trusted — a diagram whose halves do not match is
     drawing a different, wrong idea, and it is not the kind of wrong anybody notices by eye. */
  const sum = shares.reduce((n, [sw]) => n + sw, 0) + gap * (shares.length - 1);
  if (sum !== w) throw new Error(`split-bill: shares total ${sum}, source bar is ${w}`);
  /* 448 and 518 put the pair's centre at 496 against a canvas centre of 500 — the column reads as
     centred beside two handsets whose own mass sits high. The 40 between them is deliberate and
     was 70 first: at 70 the two rows read as two unrelated marks, and the whole idea of the
     diagram is that the second row *is* the first one, divided. 40 is a little over one bar
     height, which is close enough to group them and far enough not to look like a wrapped line. */
  let s = bar(x, 448, w, 30, t.ink, 0.8);
  let at = x;
  for (const [sw, o] of shares) {
    s += bar(at, 518, sw, 26, o === 1 ? t.accent : t.ink, o);
    at += sw + gap;
  }
  return s;
};

/* ── travel: where the work happened ──────────────────────────────────────────────────────────
 *
 * The drops had a `mountains` cover: `filter: saturate(.55)` and a green wash over a stock
 * photograph of Chinese mountains, with a white location chip top-left and a big serif title. The
 * photograph was credited to Pexels and was not in either zip, so there is nothing to port but the
 * composition — and the composition is good. **The location chip is the best idea in it**: it is
 * real data (`location:` in the frontmatter), it is short, and it says the one thing the card
 * beside the cover does not. It is kept, in mono, on both travel templates.
 *
 * The big serif title is not kept, on both templates. Their card put the entry's title inside the
 * cover; ours puts it directly underneath, so a title in the drawing is the same words twice — and
 * a webfont in an SVG loaded through `<img>` is a font the renderer does not have. What is kept is
 * the *lockup shape*, drawn as bars, wherever a template wants that weight.
 *
 * Two templates rather than one because five study trips are not five mountains. Wuyishan is a
 * mountain range and Xiangyang sits in them; Guangzhou, Shenzhen and Shanghai are cities, and
 * drawing a city as a ridge would be a prettier cover about a different trip.
 */

/** The chip, top-left. Their `.location-chip`: 1px border, radius 3, 5×7 padding, at 2.65×. */
const locationChip = (t, where) => {
  if (!where) return '';
  const label = String(where).toUpperCase();
  /* Mono is a fixed advance: 0.6 em is the standard ratio, and the tracking is added per character.
     Measuring rather than guessing matters because the chip is a box drawn around text the renderer
     lays out, and a box that is too short crops the last letter on exactly the entries with the
     longest names — `SHANGHAI · YIWU · HANGZHOU` is 26 characters. */
  const size = 22;
  const track = 2.4;
  /* 52 to the text's own start (the arrow and its gap), the run itself, then 26 of right padding.
     The first version budgeted 46 for *both* sides and `GUANGZHOU — NANSHA & TIANHE` came out
     through the right border — 26 characters is the longest `location:` on the site and it is the
     one that has to fit. 0.63 rather than the nominal 0.6 em because the generic monospace a
     renderer falls back to is not always as narrow as the one this was estimated from, and a chip
     a little roomy than its text is invisible where a chip a little tight is a bug. */
  const w = Math.round(52 + label.length * (size * 0.63 + track) + 26);
  return (
    `<rect x="96" y="92" width="${w}" height="54" rx="10" fill="none" stroke="${t.ink}" stroke-opacity="0.3" stroke-width="2"/>` +
    /* Their chip opened with `↗`. Drawn rather than typed: an arrow glyph is the one character in
       their markup that is not in a mono subset everywhere. */
    line('M120 124l14-14M124 110h10v10', t.ink, 3, 0.5) +
    mono(148, 128, label, t.ink, { size, track, o: 0.62 })
  );
};

/**
 * A range of hills as one polygon, spanning the full width and filled down to the bottom edge.
 *
 * `peaks` summits at even intervals with the interval jittered, so the profile is irregular the way
 * a horizon is and never the sawtooth that evenly spaced peaks give. Heights come from `v.series`,
 * so two entries on this template get two different mountains from their own slugs.
 */
const ridge = (v, baseY, peaks, lo, hi, W = 1600, H = 1000) => {
  const step = W / (peaks + 1);
  const pts = [0, H, 0, baseY];
  for (let i = 1; i <= peaks; i++) {
    const x = Math.round(i * step + v.float(-step * 0.28, step * 0.28));
    const y = Math.round(baseY - v.float(lo, hi));
    /* A shoulder before each summit. Without it every peak is an isosceles triangle and the range
       reads as bunting; with it the rise and the fall have different slopes, which is the whole
       silhouette of a hill. */
    pts.push(Math.round(x - step * v.float(0.3, 0.5)), Math.round(baseY - v.float(lo, hi) * 0.45));
    pts.push(x, y);
  }
  pts.push(W, baseY, W, H);
  return pts;
};

/**
 * A bank of mist, as two or three thin bands whose ends fade out.
 *
 * The first version was one opaque rounded rectangle per layer and it read as a scan line on a
 * broken screen: mist has no edges, and a hard rectangle is nothing but edges. Two changes fix it
 * without reaching for a blur filter — which this file avoids for the reason `SHADOW` gives, that
 * every other edge on this site is hard and a rasteriser is one less thing to depend on.
 *
 * A `<linearGradient>` takes the *horizontal* ends to zero, so a band starts and stops the way
 * weather does rather than the way a rule does. Gradients are not filter primitives; every renderer
 * that draws an SVG at all draws these.
 *
 * And a bank is two or three thin bands at different widths rather than one thick one, which fakes
 * the vertical softness the gradient cannot give: the eye reads three offset edges at 0.4 as a
 * gradation and one edge at 0.6 as a line.
 */
const mistBank = (v, baseY) => {
  const id = `mist${Math.round(baseY)}`;
  let s = `<defs><linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.22" stop-color="#fff" stop-opacity="0.62"/><stop offset="0.78" stop-color="#fff" stop-opacity="0.62"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>`;
  const bands = v.int(2, 3);
  for (let b = 0; b < bands; b++) {
    const y = baseY - v.int(-6, 26);
    /* Both ends of the gradient have to be *inside* the frame or the fade is off-canvas and what
       lands is a hard-edged streak across the whole picture — which is what the first render after
       the gradient went in still showed, for a reason the gradient could not fix. The fade occupies
       22% at each end, so a band starting at −180 and running 1560 wide puts both fades outside
       0..1600 and draws a rule. Kept to 1120 at most, and started no further left than −80. */
    const x = v.int(-80, 260);
    const w = v.int(760, 1120);
    s += `<rect x="${x}" y="${y}" width="${w}" height="${v.int(9, 17)}" rx="6" fill="url(#${id})"/>`;
  }
  return s;
};

const ridgeLine = ({ t, v, data }) => {
  /* Four to six layers. Under four the depth is gone and it reads as one hill; over six the back
     layers are within 0.1 opacity of each other and cost drawing for nothing. */
  const layers = v.int(4, 6);
  /* At most two banks of mist, whatever the layer count. Six layers offering four banks put weather
     across the whole middle of the Xiangyang drawing and buried the range it was meant to separate:
     mist is what makes a ridge recede, and mist everywhere makes nothing recede. */
  let banks = 2;
  const horizon = cycle([490, 610], data.ordinal) + v.int(-24, 24);
  /* The sun sits in the top third and never centred — a disc on the axis of symmetry reads as a
     logo. Wine at 0.16 rather than a warm yellow: this drawing has one saturated colour and it is
     the site's, the same rule split-bill follows. */
  let s = dot(v.int(1010, 1330), Math.round(horizon * v.float(0.34, 0.55)), 58, t.accent, 0.16);
  for (let i = 0; i < layers; i++) {
    /* Back layers sit higher and are paler; the front is lower, darker and more jagged. The three
       move together because that is what distance does to a hill: it raises it in the frame, washes
       it out, and flattens it. */
    const f = i / (layers - 1);
    /* `horizon` is where the back layer sits, and it is the axis that makes two mountain covers two
       pictures rather than two profiles: a range low in the frame under a lot of sky is a different
       photograph from one filling it, and that difference survives the card's reduction where a
       change in the peaks alone does not. */
    const baseY = Math.round(horizon + f * (900 - horizon));
    const peaks = 3 + i;
    s += poly(ridge(v, baseY, peaks, 90 - f * 30, 250 - f * 90), t.ink, 0.16 + f * 0.5);
    /* Mist between the layers, not over them — drawn immediately after the ridge it sits in front
       of, which is what makes the range recede. Their photograph had this for free.
       **Partial width and rounded**, which the first version was not: a full-bleed rectangle at
       every layer gave three or four hard horizontal rules across the whole picture and read as
       scan lines on a broken screen rather than as weather. A band that starts and ends inside the
       frame is a bank of cloud sitting in a valley, which is the thing being drawn. Skipping the
       front two layers as well — mist in front of the nearest ridge is fog, and fog hides the
       silhouette that is the entire cover. */
    if (banks > 0 && i < layers - 2 && v.chance(0.7)) {
      s += mistBank(v, baseY);
      banks--;
    }
  }
  return s + locationChip(t, data.location);
};

/**
 * A city, on the same grammar: a horizon, a water band, and a row of towers.
 *
 * The variation that matters here is the skyline profile — how many towers, how tall, and which two
 * are landmarks — because at card size that profile is the entire picture. Window grids and the
 * water's dashes are texture; they carry no difference between entries and are not asked to.
 */
const skyline = ({ t, v, data }) => {
  /* Same axis as `ridge-line`: how much of the frame the city occupies. A skyline at 700 with a wide
     band of water is a waterfront; one at 840 with a sliver is a street. Both are cities these trips
     went to and the two read differently at card size, which is the test. */
  const HORIZON = cycle([700, 830, 765], data.ordinal) + v.int(-16, 16);
  let s = '';
  const towers = v.int(11, 15);
  /** Where each tower meets the water, so its reflection can be under it rather than anywhere. */
  const feet = [];
  /* Two landmarks, never adjacent and never at the very ends: a tapered tower and one with a mast.
     A skyline with no tall event is a bar chart, and one where the event is at the edge is cropped
     by the card. */
  const tallA = v.int(2, Math.floor(towers / 2) - 1);
  /* At least two ordinary towers between them. Adjacent landmarks read as one twin-tower object —
     which is a specific building, not a skyline — and the first render put Shenzhen's two side by
     side. */
  const tallB = v.int(tallA + 3, towers - 3);
  let x = v.int(120, 190);
  for (let i = 0; i < towers && x < 1500; i++) {
    const landmark = i === tallA || i === tallB;
    const w = landmark ? v.int(70, 96) : v.int(44, 104);
    const h = landmark ? v.int(380, 470) : v.int(120, Math.min(300, HORIZON - 240));
    const top = HORIZON - h;
    /* Depth by tone rather than by overlap: the row is one line of buildings and they are behind
       each other only in the sense that a city is. Three steps, so neighbouring towers separate. */
    const ink = v.pick([0.34, 0.48, 0.62, 0.74]);
    if (landmark && v.chance(0.5)) {
      /* Tapered — the profile that makes a tower a landmark rather than a taller box. */
      s += poly([x + w * 0.2, top, x + w * 0.8, top, x + w, HORIZON, x, HORIZON].map(Math.round), t.ink, ink);
    } else {
      s += box(x, top, w, h, 3, t.ink, ink);
    }
    if (landmark) s += line(`M${Math.round(x + w / 2)} ${top}v-${v.int(40, 78)}`, t.ink, 4, ink);
    /* Windows only where there is room for them to read: under about 60 wide at 0.225× a grid of
       dots closes into flat tone and is just a slightly lighter tower. */
    if (w >= 60 && h >= 180) {
      const cols = Math.floor((w - 18) / 22);
      const rows = Math.floor((h - 30) / 34);
      for (let c = 0; c < cols; c++)
        for (let r = 0; r < rows; r++)
          s += box(x + 12 + c * 22, top + 20 + r * 34, 10, 14, 2, t.bezel, 0.5);
    }
    feet.push([Math.round(x + w / 2), w]);
    x += w + v.int(10, 30);
  }
  /* The water. `panel` at 0.75 was almost exactly the ground and the horizon meant nothing; the
     band has to be a shade the eye separates from the sky above it, which on this palette means
     going *down* toward the ink rather than sideways. The rule on top is what makes it a horizon
     rather than a gradient. */
  s += box(0, HORIZON, 1600, 1000 - HORIZON, 0, t.ink, 0.12);
  s += `<path d="M0 ${HORIZON}h1600" stroke="${t.ink}" stroke-opacity="0.32" stroke-width="3"/>`;
  /* Reflections, and each one is under a tower.
     Scattering them at random x was the first version and it looked like litter on the water: a
     reflection is the one mark in a picture whose position is not a free choice, and the eye knows
     it. Two or three broken dashes per reflection, narrowing and fading as they run down, which is
     what a light on moving water does. */
  for (const [cx, w] of feet) {
    if (!v.chance(0.55)) continue;
    for (let k = 0; k < v.int(2, 3); k++) {
      const rw = Math.round(w * v.float(0.4, 0.92));
      s += box(Math.round(cx - rw / 2), HORIZON + 22 + k * v.int(26, 44), rw, 6, 3, t.ink, 0.2 - k * 0.05);
    }
  }
  return s + locationChip(t, data.location);
};

/* ── film: the drops' `coffee` cover, without the photograph ───────────────────────────────────
 *
 * Theirs was a stock coffee photograph under a left-to-right dark gradient, with `.coffee-title` in
 * the top-left — a 5px mono kicker, a 47px serif title over two lines, an 11px italic tail — and
 * `.film-duration` bottom-right: `00:15` beside a 23px circle holding an arrow.
 *
 * The photograph is gone (it was never in the zip) and the words are theirs, so what ports is the
 * **shape of the lockup** and the **duration ring**, which is a genuinely nice piece of furniture.
 * In place of the photograph: the thing all three of these entries actually are, which is a strip of
 * film. Each frame holds an abstract still, chosen per entry, so the three films are three strips.
 */
const STILLS = [
  /* A horizon and a sun. */
  (t, x, y, w, h, v) =>
    box(x, y + h * 0.62, w, h * 0.38, 0, t.ink, 0.34) + dot(x + w * v.float(0.25, 0.7), y + h * 0.4, h * 0.13, t.accent, 0.5),
  /* Two figures — a head and shoulders each, the smallest drawing that reads as people. */
  (t, x, y, w, h) =>
    dot(x + w * 0.36, y + h * 0.4, h * 0.11, t.ink, 0.5) +
    poly([x + w * 0.2, y + h, x + w * 0.28, y + h * 0.58, x + w * 0.44, y + h * 0.58, x + w * 0.52, y + h].map(Math.round), t.ink, 0.5) +
    dot(x + w * 0.66, y + h * 0.46, h * 0.09, t.ink, 0.36) +
    poly([x + w * 0.54, y + h, x + w * 0.6, y + h * 0.64, x + w * 0.73, y + h * 0.64, x + w * 0.79, y + h].map(Math.round), t.ink, 0.36),
  /* A cup on a saucer — theirs was a coffee film and one of ours still is. */
  (t, x, y, w, h) =>
    box(x + w * 0.32, y + h * 0.36, w * 0.3, h * 0.34, 8, t.ink, 0.48) +
    box(x + w * 0.24, y + h * 0.72, w * 0.46, h * 0.07, 6, t.ink, 0.34) +
    line(`M${Math.round(x + w * 0.64)} ${Math.round(y + h * 0.44)}q${Math.round(w * 0.1)} ${Math.round(h * 0.1)} 0 ${Math.round(h * 0.2)}`, t.ink, 6, 0.4),
  /* A ridge — the trip film. */
  (t, x, y, w, h) =>
    poly([x, y + h, x + w * 0.3, y + h * 0.34, x + w * 0.5, y + h * 0.66, x + w * 0.72, y + h * 0.22, x + w, y + h].map(Math.round), t.ink, 0.42),
  /* A window with light falling through it. */
  (t, x, y, w, h) =>
    box(x + w * 0.26, y + h * 0.2, w * 0.44, h * 0.5, 6, t.ink, 0.3) +
    poly([x + w * 0.26, y + h * 0.7, x + w * 0.7, y + h * 0.7, x + w * 0.86, y + h, x + w * 0.42, y + h].map(Math.round), t.bezel, 0.75),
  /* A road running to a vanishing point. */
  (t, x, y, w, h) =>
    poly([x + w * 0.36, y + h * 0.3, x + w * 0.64, y + h * 0.3, x + w * 0.94, y + h, x + w * 0.06, y + h].map(Math.round), t.ink, 0.36) +
    box(x + w * 0.47, y + h * 0.52, w * 0.06, h * 0.12, 2, t.bezel, 0.8) +
    box(x + w * 0.45, y + h * 0.76, w * 0.1, h * 0.14, 2, t.bezel, 0.8),
];

const filmStrip = ({ t, v, data }) => {
  /* Three to five frames. Two is not a strip; six at 0.225× puts each still under 55 display pixels
     wide, where the abstractions above stop being shapes and become marks. */
  const n = cycle([3, 5, 4], data.ordinal);
  const X = 90;
  const W = 1420;
  const Y = 300;
  const H = 380;
  const gutter = 34;
  const gap = 22;
  const fw = (W - gutter * 2 - gap * (n - 1)) / n;
  const fy = Y + 56;
  const fh = H - 112;

  let strip = box(X, Y, W, H, 10, t.ink, 0.82);
  /* Sprockets, both edges. 74 apart because that is the largest pitch that still reads as a
     perforation rather than as a dashed border once the strip is 320 display pixels wide. */
  for (let x = X + 26; x < X + W - 26; x += 74) {
    strip += box(x, Y + 16, 26, 18, 5, t.ground, 0.9);
    strip += box(x, Y + H - 34, 26, 18, 5, t.ground, 0.9);
  }
  /* Every frame gets a different still, and no still repeats within one strip: a strip of the same
     picture four times is a texture, and the point of a film is that it changes. */
  const pool = [...STILLS.keys()];
  for (let i = 0; i < n; i++) {
    const x = X + gutter + i * (fw + gap);
    strip += box(x, fy, fw, fh, 6, t.screen);
    const k = pool.splice(Math.floor(v.float(0, pool.length)), 1)[0];
    strip += STILLS[k](t, x + 14, fy + 14, fw - 28, fh - 28, v);
  }

  /* Their `.coffee-title`, as its shape: a mono kicker, two lines of display weight, an italic tail
     — the proportions are theirs (small / very large / small-italic, tight leading), the words are
     not anybody's. */
  const lock =
    bar(96, 108, 158, 12, t.ink, 0.4) +
    bar(96, 146, 330, 38, t.ink, 0.8) +
    bar(96, 200, 232, 38, t.ink, 0.8) +
    bar(96, 262, 196, 15, t.ink, 0.34);

  /* `.film-duration`, bottom-right — the ring and the arrow, at their ratio on 1600.
     **Their running time is not ported and this is not a stylistic choice.** Theirs read `00:15`,
     and a duration on a cover is a claim about the film: I do not know how long any of Derek's are,
     and inventing one — even from a seed, even plausibly — is a fabricated fact on a portfolio a
     recruiter reads. The ring on its own says *there is a film here*, which is true, and is all the
     furniture was ever doing. */
  const ring =
    `<circle cx="1444" cy="878" r="40" fill="none" stroke="${t.ink}" stroke-opacity="0.4" stroke-width="3"/>` +
    line('M1432 890l24-24M1438 866h18v18', t.ink, 4, 0.5);

  return lock + `<g transform="rotate(-4 800 470)">${strip}</g>` + ring;
};

/* ── the working templates ────────────────────────────────────────────────────────────────────
 *
 * Nothing below has a counterpart in the zips — their remaining four "cover types" were a flat
 * background colour, a flat colour with a Lucide icon, and two `:after` gradients over photographs
 * neither zip contained. What *is* taken from them is the grammar the ported covers established:
 * one drawn object, abstracted to blocks and rules, in the category's hue, with a mono stamp in the
 * bottom-left. That grammar is the reason twenty-four different drawings still read as one hand.
 */

/**
 * A screen of market data — the trading challenge, and the analysis pipeline that reads the same
 * kind of chart.
 *
 * The candles are a **seeded random walk** rather than a set of independent heights, and that is
 * the difference between a chart and a bar chart: a price is where the last price was, plus a
 * change. Independent bars have no shape at all — no trend, no reversal, nothing an eye follows
 * left to right — and at 0.225× a chart with no shape is a texture.
 */
const tradingDesk = ({ t, v, data }) => {
  const X = 120;
  const Y = 176;
  const W = 1360;
  const H = 624;
  let s = box(X + 16, Y + 22, W, H, 22, t.shade, SHADOW.alpha);
  s += `<rect x="${X}" y="${Y}" width="${W}" height="${H}" rx="22" fill="${t.screen}" stroke="${t.bezel}" stroke-width="8"/>`;
  /* A header rule and a ticker of short bars — the strip that runs across the top of every terminal
     ever made, and the cheapest way to say "this is a screen and not a poster". */
  s += bar(X + 40, Y + 40, 190, 20, t.ink, 0.75);
  for (let i = 0, x = X + 268; i < 9 && x < X + W - 60; i++) {
    const w = v.int(56, 120);
    s += bar(x, Y + 44, w, 12, t.ink, v.pick([0.2, 0.28, 0.36]));
    x += w + 22;
  }
  s += `<path d="M${X + 40} ${Y + 88}h${W - 80}" stroke="${t.hair}" stroke-width="2"/>`;

  /* Chart pane on the left, watchlist on the right — the standard split, at 3:1. */
  const cx = X + 44;
  const cy = Y + 128;
  const cw = Math.round((W - 88) * 0.72);
  const ch = H - 210;
  for (let g = 1; g < 4; g++) {
    s += `<path d="M${cx} ${cy + (ch / 4) * g}h${cw}" stroke="${t.hair}" stroke-width="2"/>`;
  }
  /* **Two chart types, chosen by seed.** The first version drew candles always, and the two entries
     on this template came out as the same picture with a different price history — a real difference
     that at card size is invisible, which is the axis rule this file keeps re-learning. A filled
     line is a different silhouette from a row of candles at any size. The walk underneath is shared,
     so both are still the same market drawn two ways rather than two unrelated inventions. */
  const candles = cycle([true, false], data.ordinal);
  const n = candles ? v.int(19, 27) : v.int(34, 46);
  const slot = cw / n;
  /* The walk. `drift` gives the whole chart a direction so it is a story rather than noise; `vol`
     sets how far a single session can travel. Both are seeded, so the two entries on this template
     get two different markets. */
  const drift = v.float(-0.28, 0.34);
  const vol = v.float(0.12, 0.2);
  let price = v.float(0.35, 0.65);
  const yOf = (p) => Math.round(cy + ch - Math.min(1, Math.max(0, p)) * ch);
  const walk = [];
  for (let i = 0; i < n; i++) {
    const open = price;
    price = Math.min(0.94, Math.max(0.06, price + (v.float(-1, 1) * vol + drift / n)));
    walk.push({ open, close: price, hi: Math.max(open, price) + v.float(0, vol * 0.6), lo: Math.min(open, price) - v.float(0, vol * 0.6) });
  }
  if (candles) {
    walk.forEach(({ open, close, hi, lo }, i) => {
      const bx = Math.round(cx + i * slot + slot * 0.2);
      const bw = Math.max(6, Math.round(slot * 0.6));
      const up = close >= open;
      const col = up ? t.ink : t.accent;
      const o = up ? 0.62 : 0.85;
      s += `<path d="M${bx + bw / 2} ${yOf(hi)}V${yOf(lo)}" stroke="${col}" stroke-opacity="${o}" stroke-width="3"/>`;
      s += box(bx, Math.min(yOf(open), yOf(close)), bw, Math.max(5, Math.abs(yOf(open) - yOf(close))), 2, col, o);
    });
  } else {
    /* The same walk as a filled line. The fill is what makes it read at a glance — a 3px stroke on
       its own is a hairline once the cover is 360 wide, and the area under it is the shape. */
    const at = (i) => `${Math.round(cx + i * slot + slot / 2)} ${yOf(walk[i].close)}`;
    const d = walk.map((_, i) => `${i ? 'L' : 'M'}${at(i)}`).join('');
    s += `<path d="${d}L${Math.round(cx + cw)} ${cy + ch}L${cx} ${cy + ch}Z" fill="${t.ink}" fill-opacity="0.14"/>`;
    s += `<path d="${d}" fill="none" stroke="${t.ink}" stroke-opacity="0.7" stroke-width="4" stroke-linejoin="round"/>`;
    /* One marked point, on the last close: a line chart with nothing marked has no subject. */
    s += dot(Math.round(cx + (n - 1) * slot + slot / 2), yOf(walk[n - 1].close), 11, t.accent, 0.9);
  }

  const rx = cx + cw + 34;
  const rw = X + W - 44 - rx;
  s += box(rx, cy, rw, ch, 14, t.panel);
  for (let r = 0; r < 6; r++) {
    const ry = cy + 26 + r * ((ch - 40) / 6);
    s += bar(rx + 22, ry, v.int(70, 120), 13, t.ink, 0.5);
    s += bar(rx + rw - 22 - 62, ry + 2, 62, 10, r % 3 === 0 ? t.accent : t.ink, r % 3 === 0 ? 0.8 : 0.3);
  }
  return s;
};

/**
 * A fan of slides — the pitch competitions.
 *
 * Fanned rather than stacked square, for the reason the ported phone pair is tilted: three
 * rectangles squarely on top of each other read as one rectangle with a thick border. The angles
 * spread from back to front so the stack opens like a hand of cards, and the front slide is the
 * only one carrying content, because that is where an eye goes and the other two are depth.
 */
const pitchDeck = ({ t, v }) => {
  const W = 760;
  const H = 470;
  const angles = [v.float(-11, -6), v.float(-4, 0), v.float(4, 9)];
  let s = '';
  angles.forEach((a, i) => {
    const front = i === angles.length - 1;
    const ox = 420 + i * v.int(28, 60);
    const oy = 250 + i * v.int(10, 30);
    let slide = box(14, 20, W, H, 12, t.shade, SHADOW.alpha);
    slide += `<rect x="0" y="0" width="${W}" height="${H}" rx="12" fill="${t.screen}" stroke="${t.bezel}" stroke-width="7"/>`;
    if (front) {
      slide += bar(56, 62, 300, 26, t.ink, 0.8);
      slide += bar(56, 110, 172, 12, t.ink, 0.3);
      /* A small column chart on the slide, because a pitch deck always has one and because it is
         the mark that separates this template from a plain sheet of paper at card size. */
      const bars = v.int(4, 6);
      const heights = v.series(bars, 60, 190);
      heights.forEach((h, k) => {
        s;
        slide += box(56 + k * 62, 360 - Math.round(h), 40, Math.round(h), 4, k === bars - 1 ? t.accent : t.ink, k === bars - 1 ? 0.85 : 0.34);
      });
      for (let r = 0; r < v.int(3, 4); r++) {
        slide += dot(452, 176 + r * 46, 7, t.ink, 0.45);
        slide += bar(474, 168 + r * 46, v.int(150, 236), 14, t.ink, 0.3);
      }
      slide += bar(452, 350, 150, 12, t.ink, 0.22);
    }
    s += `<g transform="translate(${ox} ${oy}) rotate(${a.toFixed(1)} ${W / 2} ${H / 2})">${slide}</g>`;
  });
  /* The lockup, left of the fan: the same kicker / mass / tail shape the film strip uses. */
  return (
    bar(96, 300, 150, 12, t.ink, 0.4) +
    bar(96, 338, 246, 34, t.ink, 0.78) +
    bar(96, 392, 178, 34, t.ink, 0.78) +
    bar(96, 452, 132, 14, t.ink, 0.3) +
    s
  );
};

/**
 * A technical drawing — for the entry literally called *The Blueprint of Tomorrow*.
 *
 * A dimensioned rectangle with extension lines and arrowheads, a fine grid behind it, and a corner
 * title block. The grid is `id="plan"`, deliberately not `id="ledger"`: that string is the plate's
 * fingerprint, and although `isPlateSVG` now excludes anything carrying the art mark, a template
 * borrowing the *name* of another drawing's signature is asking a future reader to check.
 */
const blueprint = ({ t, v }) => {
  const pitch = v.pick([44, 56, 68]);
  let s = `<defs><pattern id="plan" width="${pitch}" height="${pitch}" patternUnits="userSpaceOnUse"><path d="M${pitch} 0H0v${pitch}" fill="none" stroke="${t.ink}" stroke-opacity="0.1" stroke-width="1.5"/></pattern></defs>`;
  s += `<rect width="1600" height="1000" fill="url(#plan)"/>`;
  const x = 280;
  const y = v.int(230, 300);
  const w = v.int(620, 800);
  const h = v.int(320, 400);
  /* The object: a plan with a bite taken out of one corner, so it is a building rather than a box.
     Which corner, and how deep, is the variation. */
  const notch = v.int(120, 240);
  s += poly([x, y, x + w - notch, y, x + w - notch, y + h * 0.42, x + w, y + h * 0.42, x + w, y + h, x, y + h].map(Math.round), t.ink, 0.13);
  s += line(`M${x} ${y}h${w - notch}v${Math.round(h * 0.42)}h${notch}v${Math.round(h * 0.58)}H${x}Z`, t.ink, 4, 0.6);
  /* Interior partitions — a plan with no rooms in it is a shape. */
  for (let i = 0; i < v.int(2, 3); i++) {
    const px = Math.round(x + w * v.float(0.25, 0.75));
    s += line(`M${px} ${y}v${h}`, t.ink, 2.5, 0.32);
  }
  s += line(`M${x} ${Math.round(y + h * 0.58)}h${w}`, t.ink, 2.5, 0.32);
  /* Dimension line under the object: extension lines down from each end, arrowheads inward. */
  const dy = y + h + 96;
  s += line(`M${x} ${y + h}v${116}M${x + w} ${y + h}v${116}`, t.ink, 2, 0.4);
  s += line(`M${x} ${dy}h${w}`, t.ink, 2.5, 0.55);
  s += line(`M${x + 24} ${dy - 12}l-24 12 24 12M${x + w - 24} ${dy - 12}l24 12-24 12`, t.ink, 2.5, 0.55);
  /* A radius callout on a circular feature — the other half of what a drawing does. */
  /* Kept clear of the title block below it. The first render put the callout at y 600–720 with the
     block starting at 830, and a 104-radius circle at the bottom of that range sat 6px off it —
     two unrelated objects touching, which reads as a mistake rather than as a drawing. */
  const ccx = v.int(1130, 1290);
  const ccy = v.int(560, 640);
  const cr = v.int(70, 104);
  s += `<circle cx="${ccx}" cy="${ccy}" r="${cr}" fill="none" stroke="${t.ink}" stroke-opacity="0.5" stroke-width="3"/>`;
  s += line(`M${ccx} ${ccy}L${ccx + cr} ${ccy}`, t.accent, 3, 0.8);
  s += dot(ccx, ccy, 6, t.accent, 0.8);
  /* Title block, bottom-right: the boxed grid of rules every sheet is signed in. */
  const tb = { x: 1120, y: 830, w: 384, h: 110 };
  s += box(tb.x, tb.y, tb.w, tb.h, 6, t.screen, 0.9);
  s += line(`M${tb.x} ${tb.y}h${tb.w}v${tb.h}h-${tb.w}Z`, t.ink, 3, 0.5);
  s += line(`M${tb.x} ${tb.y + 46}h${tb.w}M${tb.x + 232} ${tb.y}v${tb.h}`, t.ink, 2, 0.35);
  s += bar(tb.x + 20, tb.y + 16, 150, 14, t.ink, 0.5);
  s += bar(tb.x + 20, tb.y + 66, 108, 12, t.ink, 0.3);
  s += bar(tb.x + 252, tb.y + 16, 82, 14, t.ink, 0.3);
  s += bar(tb.x + 252, tb.y + 66, 62, 12, t.ink, 0.3);
  return s;
};

/**
 * Layers of nodes with edges between them — the model built from scratch.
 *
 * Not every node is connected to every node, and that is the point: a fully connected diagram is a
 * solid block of hairlines at card size, and the thing worth drawing about a network is that it is
 * *sparse and uneven*. Edges are chosen per pair, so the shape of the connectivity is the variation.
 */
const modelGraph = ({ t, v }) => {
  const cols = 4;
  const counts = [v.int(4, 6), v.int(5, 7), v.int(4, 6), v.int(2, 3)];
  const xs = [340, 700, 1060, 1380];
  const pts = counts.map((n, c) =>
    Array.from({ length: n }, (_, i) => [xs[c], Math.round(500 - ((n - 1) / 2) * 96 + i * 96)]),
  );
  let s = '';
  /* Edges first so nodes sit on top of them. */
  for (let c = 0; c < cols - 1; c++) {
    for (const [x1, y1] of pts[c]) {
      for (const [x2, y2] of pts[c + 1]) {
        if (!v.chance(0.42)) continue;
        s += `<path d="M${x1} ${y1}C${(x1 + x2) / 2} ${y1} ${(x1 + x2) / 2} ${y2} ${x2} ${y2}" fill="none" stroke="${t.ink}" stroke-opacity="0.22" stroke-width="2.5"/>`;
      }
    }
  }
  pts.forEach((col, c) => {
    const last = c === cols - 1;
    for (const [x, y] of col) {
      s += dot(x, y, last ? 26 : 20, last ? t.accent : t.ink, last ? 0.85 : 0.5);
    }
  });
  /* The tokens going in, along the bottom: a run of small blocks of unequal width, which is what a
     tokenised sentence looks like and is the one mark that says *language* rather than *network*. */
  let x = 150;
  for (let i = 0; i < 14 && x < 1100; i++) {
    const w = v.int(38, 116);
    s += box(x, 856, w, 30, 8, t.ink, v.pick([0.18, 0.26, 0.34]));
    x += w + 14;
  }
  return s;
};

/**
 * A ruled ledger page — the bank internship.
 *
 * **This one is drawn to say as little as possible, on purpose.** That entry is kept deliberately
 * generic: no subdivision, no systems, no figures, nothing client-related. A cover for it must not
 * put back what the writing withholds, so what it shows is the most ordinary object in finance —
 * a ruled sheet with a column and some marks in it. The variation is how many rows carry a figure,
 * which is texture, not information.
 */
const ledgerPage = ({ t, v }) => {
  const X = 400;
  const Y = 150;
  const W = 800;
  const H = 700;
  let s = box(X + 16, Y + 22, W, H, 8, t.shade, SHADOW.alpha);
  s += `<rect x="${X}" y="${Y}" width="${W}" height="${H}" rx="8" fill="${t.screen}" stroke="${t.bezel}" stroke-width="6"/>`;
  s += bar(X + 56, Y + 60, v.int(200, 300), 22, t.ink, 0.7);
  s += `<path d="M${X + 56} ${Y + 116}h${W - 112}" stroke="${t.ink}" stroke-opacity="0.45" stroke-width="3"/>`;
  /* The column rule: the single vertical that makes a sheet a ledger. */
  const colX = X + W - 250;
  s += `<path d="M${colX} ${Y + 96}v${H - 170}" stroke="${t.ink}" stroke-opacity="0.3" stroke-width="2"/>`;
  const rows = v.int(9, 12);
  const pitch = (H - 210) / rows;
  for (let r = 0; r < rows; r++) {
    const ry = Y + 158 + r * pitch;
    s += `<path d="M${X + 56} ${Math.round(ry + pitch - 16)}h${W - 112}" stroke="${t.hair}" stroke-width="2"/>`;
    s += bar(X + 56, ry, v.int(120, 300), 14, t.ink, 0.42);
    if (v.chance(0.78)) {
      const fw = v.int(72, 150);
      s += bar(X + W - 56 - fw, ry, fw, 14, t.ink, 0.55);
    }
  }
  /* One total, ruled twice under it — the only mark on the page with any weight, and it says
     nothing but "this column adds up", which is the whole job. */
  const ty = Y + H - 92;
  s += bar(X + W - 56 - 190, ty, 190, 22, t.ink, 0.8);
  s += `<path d="M${X + W - 260} ${ty + 40}h204M${X + W - 260} ${ty + 50}h204" stroke="${t.ink}" stroke-opacity="0.6" stroke-width="3"/>`;
  return s;
};

/**
 * A person, at the smallest size that still reads as one: a head and a pair of shoulders.
 *
 * Two shapes. Anything more — arms, a face, a neck — is invisible at 0.225× and turns the row into
 * a smear at card size; anything less is a lollipop. The trapezoid is wider at the base than a real
 * silhouette because a straight-sided one reads as a bottle.
 */
const person = (cx, footY, h, fill, o) => {
  /* **Proportions, because the first version's were wrong and it showed.** It gave the head a radius
     of 0.19h — a diameter of 0.38h — against shoulders 0.354h across, so every figure was wider at
     the head than at the body and the row read as chess pawns. Worse, the spacing maths downstream
     was written against the *shoulder* width, so it thought each figure was 0.68h wide when the
     widest part was really the head, and the row came out at half the count it should have been
     with the figures still touching.
     A standing person is about eight heads tall and about two and a half heads across the shoulders.
     At 0.115h for the head radius that gives 0.23h of head against 0.42h of shoulder, which is the
     ratio, and `PERSON_WIDTH` below is the number anything spacing them must use. */
  const head = h * 0.115;
  return (
    dot(Math.round(cx), Math.round(footY - h + head), Math.round(head), fill, o) +
    poly(
      [
        cx - h * 0.14, footY - h + h * 0.27,
        cx + h * 0.14, footY - h + h * 0.27,
        cx + h * 0.21, footY,
        cx - h * 0.21, footY,
      ].map(Math.round),
      fill,
      o,
    )
  );
};

/** The widest part of `person`, as a fraction of its height — the shoulders, at 2 × 0.21. */
const PERSON_WIDTH = 0.42;

/**
 * A cohort — the ambassador programme and the honours academy.
 *
 * One row or two staggered rows, chosen by seed, because two entries share this template and a row
 * of figures is a strong enough silhouette that only its *arrangement* distinguishes one from
 * another. Heights vary a little within a row: identical figures read as a font, not as people.
 *
 * One figure in the wine and one in the sage. The wine is the site's "this one" — it is the marked
 * share on split-bill and the last close on the chart — and here it is the person the entry is
 * about. The sage is the secondary doing exactly its job: a second kind of thing, not a second
 * emphasis.
 */
const cohort = ({ t, v, data }) => {
  const twoRows = cycle([false, true], data.ordinal);
  const SPAN = 1240;
  const LEFT = 180;
  /* **Spacing is derived from the figure, not chosen beside it.** The first version picked a count
     first and divided the span by it, and at eleven figures across 1220 the gap came to 174 while
     a 330-tall figure is 224 across the shoulders — so every figure stood inside its neighbour and
     the row read as one lumpy mass. Height is decided first now, and the count is whatever fits at
     1.12 × the shoulder width. The 0.12 is the daylight: with none the silhouettes merge, and much
     more and it stops being a group and becomes a queue. */
  const h = twoRows ? v.int(250, 290) : v.int(290, 340);
  const width = h * PERSON_WIDTH;
  /* `+ 1` because n figures spread across a span leave n−1 gaps: dividing the span by the pitch
     gives the gaps, not the people. Without it the row was one figure short of filling the frame. */
  const n = Math.max(6, Math.min(twoRows ? 9 : 8, Math.floor(SPAN / (width * 1.14)) + 1));
  /* `n` is the count for **one** row. The first two-row version split it between the rows instead,
     which halved the density: nine figures 113 wide spread over 1240 at 280 apart is not a crowd,
     it is a queue for a bus. A second row is a second row of the same density, offset. */
  const total = twoRows ? n * 2 : n;
  const me = v.int(1, total - 2);
  const pair = (me + v.int(2, Math.max(2, total - 3))) % total;
  const at = (i, count, left, span) => left + (i * span) / Math.max(1, count - 1);
  let s = '';
  /* Tone separates the rows, and it has to: the front row's heads land inside the back row's bodies
     however the two are placed — that is what standing behind somebody looks like — so depth cannot
     come from geometry here. The back row is drawn first and pale, the front dark. Within a row the
     variation is small, because a row of people at three wildly different weights reads as three
     different distances rather than as one group. */
  const draw = (i, cx, footY, size, back) => {
    const fill = i === me ? t.accent : i === pair ? t.sageInk : t.ink;
    const o = i === me ? 0.9 : i === pair ? 0.85 : back ? v.pick([0.2, 0.26]) : v.pick([0.4, 0.5, 0.58]);
    s += person(cx, footY, size, fill, o);
  };
  if (twoRows) {
    /* The back row is offset by half a pitch, so a front figure stands in the gap behind rather than
       exactly in front of somebody — which is what makes it read as two rows and not as one row
       drawn twice. */
    const pitch = SPAN / (n - 1);
    for (let i = 0; i < n; i++) draw(i, at(i, n, LEFT + pitch / 2, SPAN - pitch), 660, h, true);
    for (let i = 0; i < n; i++) draw(n + i, at(i, n, LEFT, SPAN), 830, h + 46, false);
  } else {
    for (let i = 0; i < n; i++) draw(i, at(i, n, LEFT, SPAN), 800, h, false);
  }
  /* A floor rule under them. Without it the figures hang in the middle of the frame; with it they
     are standing somewhere, which is the difference between a group and a set of icons. */
  return s + `<path d="M120 ${twoRows ? 830 : 800}h1360" stroke="${t.ink}" stroke-opacity="0.22" stroke-width="3"/>`;
};

/**
 * Two blocks of speech, leaning toward each other — the career advisory conversations.
 *
 * Three entries share this, one per person Derek sat down with, and what varies is the *shape of
 * the exchange*: how much each side says, which side says more, and whether there is a short third
 * turn. That is a real property of a conversation and it is the only honest thing a drawing can
 * differ by here — the substance is Derek's to write, not a cover's to depict, and the entries
 * carry no public links by his instruction.
 */
const conversation = ({ t, v, data }) => {
  const bubble = (x, y, w, lines, angle, fill, o, tailLeft) => {
    const h = 74 + lines * 46;
    let b = box(12, 18, w, h, 26, t.shade, SHADOW.alpha);
    b += box(0, 0, w, h, 26, fill, o);
    /* The tail. A rounded rectangle with no tail is a card; the tail is the entire glyph. */
    b += poly(
      tailLeft ? [22, h - 20, 96, h - 20, 46, h + 54] : [w - 22, h - 20, w - 96, h - 20, w - 46, h + 54],
      fill,
      o,
    );
    for (let i = 0; i < lines; i++)
      b += bar(40, 42 + i * 46, Math.round(w - 80 - (i === lines - 1 ? v.int(60, 180) : v.int(0, 40))), 18, t.bezel, 0.82);
    return `<g transform="translate(${x} ${y}) rotate(${angle.toFixed(1)} ${w / 2} ${h / 2})">${b}</g>`;
  };

  /**
   * **Discrete arrangements, not jitter — and this is the second attempt.**
   *
   * The first version placed two bubbles at seeded coordinates within narrow ranges and gave each a
   * seeded line count. Three entries share this template, and on the contact sheet the three came
   * out as the same picture: every axis was a small continuous nudge, and a 40px difference in where
   * a bubble sits is nine pixels once the cover is 360 wide. Same lesson as the plate's deleted
   * lightness axis, arrived at from a new direction.
   *
   * Four named shapes of exchange, times which side leads, is sixteen combinations that differ in
   * *silhouette* rather than in placement — and each one is a real thing a conversation does, which
   * is the only honest axis available here. The substance of these three is Derek's to write and
   * carries no public links by his instruction; what a cover may show is the shape, not the words.
   */
  const shape = cycle(['trade', 'listen', 'volley', 'close'], data.ordinal);
  const leadLeft = v.chance(0.5);
  const heavy = { fill: t.accent, o: 0.82 };
  const light = { fill: t.ink, o: 0.64 };
  const a = leadLeft ? heavy : light;
  const b = leadLeft ? light : heavy;
  let s = '';
  if (shape === 'trade') {
    /* One turn each, offset diagonally — the ordinary shape of an hour with somebody. */
    s += bubble(150, v.int(180, 220), v.int(540, 640), v.int(3, 4), v.float(-4, -1), a.fill, a.o, true);
    s += bubble(v.int(800, 870), v.int(430, 500), v.int(480, 580), v.int(2, 3), v.float(1, 5), b.fill, b.o, false);
  } else if (shape === 'volley') {
    /* Four short turns down the frame, alternating sides: quick back-and-forth. */
    for (let i = 0; i < 4; i++) {
      const left = i % 2 === 0;
      const side = left ? a : b;
      s += bubble(left ? v.int(140, 210) : v.int(820, 900), 150 + i * 190, v.int(380, 520), 1 + (i % 2), v.float(-3, 3), side.fill, side.o, left);
    }
  } else if (shape === 'listen') {
    /* One long turn and two short ones — somebody doing most of the talking, which is what an
       advisory hour with a person forty years ahead of you actually is. */
    s += bubble(v.int(560, 700), 170, v.int(700, 820), v.int(5, 6), v.float(1, 4), b.fill, b.o, false);
    s += bubble(160, v.int(300, 360), v.int(300, 400), 1, v.float(-4, -1), a.fill, a.o, true);
    s += bubble(v.int(200, 300), v.int(640, 700), v.int(340, 440), v.int(1, 2), v.float(-2, 3), a.fill, a.o, true);
  } else {
    /* Two long turns nearly touching, one over the other — the part of a conversation where the two
       of you are finishing each other's sentences. */
    s += bubble(v.int(240, 320), 160, v.int(760, 880), v.int(3, 4), v.float(-3, 0), a.fill, a.o, true);
    s += bubble(v.int(430, 520), v.int(480, 540), v.int(720, 840), v.int(3, 4), v.float(0, 4), b.fill, b.o, false);
  }
  return s;
};

/**
 * An artboard mid-edit — the design assistant post.
 *
 * Selection handles are the detail that makes this a *design tool* rather than a picture of a
 * shape: eight small squares on a bounding box is a sight so specific that nobody who has opened
 * a drawing program can read it as anything else. They are the reason this template works at card
 * size, where the toolbar and the swatches are texture.
 */
const artboard = ({ t, v }) => {
  const X = 300;
  const Y = 170;
  const W = 1080;
  const H = 640;
  let s = box(X + 14, Y + 20, W, H, 10, t.shade, SHADOW.alpha);
  s += `<rect x="${X}" y="${Y}" width="${W}" height="${H}" rx="10" fill="${t.screen}" stroke="${t.bezel}" stroke-width="6"/>`;
  /* Guides, dashed, in the accent — the one place a hairline is allowed to be the loud colour,
     because a guide that does not stand out of the artwork is not doing its job. */
  const gx = X + v.int(240, 620);
  const gy = Y + v.int(180, 420);
  s += `<path d="M${gx} ${Y}v${H}M${X} ${gy}h${W}" stroke="${t.accent}" stroke-opacity="0.45" stroke-width="2" stroke-dasharray="14 12"/>`;
  /* The object on the board, and which object is the variation. */
  const ox = gx - v.int(180, 260);
  const oy = gy - v.int(120, 190);
  const ow = v.int(360, 520);
  const oh = v.int(230, 330);
  const kind = v.pick(['rect', 'round', 'ellipse']);
  if (kind === 'ellipse')
    s += `<ellipse cx="${ox + ow / 2}" cy="${oy + oh / 2}" rx="${ow / 2}" ry="${oh / 2}" fill="${t.ink}" fill-opacity="0.34"/>`;
  else s += box(ox, oy, ow, oh, kind === 'round' ? 46 : 6, t.ink, 0.34);
  for (const [hx, hy] of [
    [ox, oy], [ox + ow / 2, oy], [ox + ow, oy],
    [ox, oy + oh / 2], [ox + ow, oy + oh / 2],
    [ox, oy + oh], [ox + ow / 2, oy + oh], [ox + ow, oy + oh],
  ]) {
    s += box(Math.round(hx - 11), Math.round(hy - 11), 22, 22, 3, t.bezel);
    s += line(`M${Math.round(hx - 11)} ${Math.round(hy - 11)}h22v22h-22Z`, t.accent, 3, 0.85);
  }
  /* The toolbar, and a row of swatches along the foot of the board. */
  for (let i = 0; i < 6; i++) s += box(150, 220 + i * 74, 54, 54, 12, t.ink, i === v.int(0, 5) ? 0.7 : 0.24);
  let sx = X + 40;
  for (let i = 0; i < v.int(5, 8); i++) {
    s += box(sx, Y + H - 74, 46, 46, 10, i === 0 ? t.accent : i === 1 ? t.sageInk : t.ink, i < 2 ? 0.85 : v.pick([0.2, 0.3, 0.44]));
    sx += 60;
  }
  /* The cursor. One arrow, and the board is being worked on rather than finished. */
  s += poly([gx + 8, gy + 8, gx + 8, gy + 76, gx + 26, gy + 58, gx + 40, gy + 84, gx + 54, gy + 76, gx + 40, gy + 50, gx + 62, gy + 46], t.ink, 0.9);
  return s;
};

/**
 * A sealed collection bag and a sheet of stickers — the flag day.
 *
 * **This was drawn as a tin first and every render read as a bag**, which turned out to be the
 * drawing telling me something true: a Hong Kong flag day is not a tin. It is a sealed plastic bag
 * on a shoulder strap, cash goes in through a gathered neck that is taped shut, and it is counted
 * at the end of the day by somebody else. Leaning into what it kept insisting on being is both
 * easier to draw and the accurate object.
 *
 * The sticker sheet is the other half of the ritual and the part a passer-by actually sees: you
 * give, you get a sticker, the sticker is a receipt worn in public all morning. A drawing of the
 * bag alone is a drawing about carrying something.
 */
const collectionBag = ({ t, v }) => {
  const X = 590;
  const Y = 260;
  const W = 300;
  const H = 500;
  const neck = 86;
  let s = '';
  /* The strap leaves the neck and leaves the frame — over a shoulder that is not drawn. A closed
     arc between the two top corners is a handbag handle, which is what the tin version drew. */
  s += line(`M${X + 92} ${Y + 40}C${X + 20} ${Y - 190} ${X - 240} ${Y - 90} ${X - 300} ${Y + 160}`, t.ink, 20, 0.28);
  s += box(X + 14, Y + 20, W, H, 20, t.shade, SHADOW.alpha);
  /* The body, then the gathered neck: a narrower band with creases running into it, which is the
     one detail that separates a sealed bag from a shopping bag. */
  /* The body swells toward the bottom. A plain rectangle under a narrower band is a jar; a bag is
     the shape of what somebody put in it, so the sides bow out and the base is the widest part. */
  s += `<path d="M${X + 20} ${Y + neck}q-${46} ${Math.round(H * 0.5)} -${34} ${H - neck - 40}q0 ${40} ${44} ${40}h${W - 68}q${44} 0 ${44}-${40}q${12}-${Math.round(H * 0.42)}-${34}-${H - neck - 40}Z" fill="${t.ink}" fill-opacity="0.66"/>`;
  s += box(X + 64, Y + 16, W - 128, neck + 16, 10, t.ink, 0.5);
  for (let i = 0; i < 4; i++)
    s += line(`M${X + 88 + i * 42} ${Y + 26}v${neck - 4}`, t.ground, 4, 0.4);
  /* The seal across the neck — a flag-day bag is defined by not being openable. */
  s += box(X + 48, Y + neck - 24, W - 96, 38, 8, t.accent, 0.9);
  /* The charity's band across the body, kept wordless. */
  s += box(X + 8, Y + 250, W - 16, 112, 10, t.ground, 0.9);
  s += bar(X + 38, Y + 278, v.int(120, 190), 20, t.ink, 0.6);
  s += bar(X + 38, Y + 316, v.int(80, 120), 15, t.ink, 0.32);

  /* The sheet: a grid of discs on a backing card, with a few already peeled off. The gaps are the
     variation and they are the whole story — a full sheet is a morning that has not started. */
  const SX = v.int(1060, 1140);
  const SY = 380;
  const cols = 3;
  const rows = 4;
  s += box(SX + 12, SY + 16, 300, 380, 12, t.shade, SHADOW.alpha);
  s += box(SX, SY, 300, 380, 12, t.screen);
  let peeled = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = SX + 56 + c * 94;
      const cy = SY + 60 + r * 88;
      if (v.chance(0.3)) {
        /* A hole where one was taken: the backing shows through. */
        s += dot(cx, cy, 34, t.hair, 0.7);
        peeled++;
        continue;
      }
      s += dot(cx, cy, 34, t.ink, v.pick([0.24, 0.32, 0.4]));
      s += line(`M${cx - 12} ${cy}h24`, t.ground, 5, 0.85);
    }
  }
  /* Loose ones, near the sheet — the ones just peeled. Their count follows the holes, so the two
     halves of the drawing agree with each other rather than each inventing a number. */
  for (let i = 0; i < Math.min(3, peeled); i++) {
    const cx = SX + v.int(-150, 40);
    const cy = SY + v.int(300, 460);
    s += dot(cx, cy, 36, t.accent, 0.55);
    s += line(`M${cx - 13} ${cy}h26`, t.ground, 5, 0.85);
  }
  return s;
};

/**
 * A stack of crates and a bag — the food distribution.
 *
 * Stacked slightly off-square, each crate rotated a degree or two, because a plumb stack is a
 * rendering and a real one is set down by hand. The offsets are the variation, which is the honest
 * one: what differs between two distributions is how much there was and how it was piled.
 */
const crates = ({ t, v }) => {
  const n = v.int(3, 4);
  const GROUND = 840;
  let s = '';
  let y = GROUND;
  /* **Outlined, not inlaid.** The version before this drew the slats as ground-coloured rectangles
     *inside* the box, and three stacked came out as framed panels leaning on each other — the gaps
     read as the object and the box read as the background. A crate is a light face inside a heavy
     edge, so it is drawn that way: a pale fill, a thick outline, and two slat rules across it.
     Rotation is down to ±1.5° from ±2.6° for the same reason: at 2.6 with a drop shadow under each,
     a stack looks dropped rather than set down. */
  for (let i = 0; i < n; i++) {
    const w = v.int(370, 450);
    const h = v.int(200, 240);
    const x = 460 + v.int(-26, 26);
    const a = v.float(-1.5, 1.5);
    const ink = 0.4 + i * 0.16;
    let crate = box(12, 16, w, h, 10, t.shade, SHADOW.alpha * 0.8);
    crate += box(0, 0, w, h, 10, t.screen);
    crate += line(`M6 6h${w - 12}v${h - 12}H6Z`, t.ink, 9, ink);
    /* One slat rule, not two. Two divided the face into three thin bands and the outlined box read
       as a filing drawer seen edge-on — the same failure the inlaid version had, arrived at from the
       other direction. */
    crate += line(`M6 ${Math.round(h * 0.5)}h${w - 12}`, t.ink, 6, ink * 0.7);
    /* And a sliver of the far end, as a parallelogram off the top-right. This is what actually makes
       it a box: a rectangle with an outline is a panel from any angle, and one facet of depth is the
       whole of three-quarter view. */
    crate += poly([w, 6, w + 44, -26, w + 44, h - 44, w, h - 6].map(Math.round), t.ink, ink * 0.55);
    /* The consignment label, taped on one face. */
    crate += box(Math.round(w * 0.58), Math.round(h * 0.14), Math.round(w * 0.3), Math.round(h * 0.34), 5, t.ground, 0.95);
    crate += bar(Math.round(w * 0.62), Math.round(h * 0.22), Math.round(w * 0.19), 12, t.ink, 0.45);
    crate += bar(Math.round(w * 0.62), Math.round(h * 0.32), Math.round(w * 0.12), 10, t.ink, 0.25);
    s += `<g transform="translate(${x} ${y - h}) rotate(${a.toFixed(1)} ${w / 2} ${h / 2})">${crate}</g>`;
    y -= h + v.int(3, 9);
  }
  /* The bag beside the stack: a rounded body and a handle, which is the whole glyph. */
  const bw = v.int(260, 320);
  const bh = v.int(300, 350);
  const bx = v.int(1010, 1120);
  s += box(bx + 12, GROUND - bh + 18, bw, bh, 16, t.shade, SHADOW.alpha);
  s += box(bx, GROUND - bh, bw, bh, 16, t.accent, 0.78);
  s += line(`M${bx + 52} ${GROUND - bh}v-64q0-50 48-50t48 50v64`, t.ink, 13, 0.45);
  s += `<path d="M300 ${GROUND}h1230" stroke="${t.ink}" stroke-opacity="0.25" stroke-width="4"/>`;
  return s;
};

/**
 * A stack of books inside a turning arrow — the book recycling.
 *
 * The arrow is the entry's own name made a shape: these books are not being read, they are being
 * passed on. Drawn as an open ring with a head on one end rather than the three-chasing-arrows
 * recycling mark, which is a registered symbol standing for a specific materials scheme and is not
 * what a book drive is.
 */
const bookStack = ({ t, v }) => {
  const cx = 800;
  const cy = 520;
  const r = 320;
  /* The ring, open at the top-right so the head has somewhere to point. */
  let s = `<path d="M${cx + r} ${cy}A${r} ${r} 0 1 1 ${Math.round(cx + r * Math.cos(-0.7))} ${Math.round(cy + r * Math.sin(-0.7))}" fill="none" stroke="${t.ink}" stroke-opacity="0.26" stroke-width="26" stroke-linecap="round"/>`;
  s += poly(
    [cx + r * Math.cos(-0.7) - 6, cy + r * Math.sin(-0.7) - 62,
     cx + r * Math.cos(-0.7) + 74, cy + r * Math.sin(-0.7) - 6,
     cx + r * Math.cos(-0.7) - 22, cy + r * Math.sin(-0.7) + 52].map(Math.round),
    t.ink,
    0.26,
  );
  /* The stack. Each book is a slab with a spine band; widths and thicknesses vary, and the top one
     is offset, because a stack squared off at every edge is a ream of paper. */
  const n = v.int(4, 6);
  let y = cy + 200;
  for (let i = 0; i < n; i++) {
    const w = v.int(360, 470);
    const h = v.int(58, 88);
    const x = Math.round(cx - w / 2 + v.int(-40, 40));
    const top = i === n - 1;
    s += box(x + 8, y - h + 12, w, h, 7, t.shade, SHADOW.alpha * 0.7);
    s += box(x, y - h, w, h, 7, top ? t.accent : t.ink, top ? 0.85 : 0.3 + i * 0.11);
    /* A full-height spine band at one end and a stack of page edges at the other. The first version
       drew a short inset band and the slabs read as drawer fronts; a book seen from the side is a
       *bound* edge and a *loose* edge, and drawing only one of them leaves it a block. */
    s += box(x + 14, y - h + 8, 26, h - 16, 5, t.ground, 0.5);
    for (let k = 0; k < 3; k++)
      s += box(x + w - 74, y - h + 14 + k * ((h - 28) / 3), 60, 7, 3, t.ground, 0.4);
    y -= h + 8;
  }
  return s;
};

/**
 * Sources in, clusters, a cited output — the research pipeline.
 *
 * This exists because the entry it is for kept being drawn as a trading desk, and it is not one. It
 * is a tool that reads public discussion, groups it, and writes personas where **every claim has to
 * name its source** — which is the entry's own point and the thing worth putting in the picture. So
 * the last stage carries a footnote rule and superscript marks, and the drawing is about provenance
 * rather than about analysis.
 *
 * It also settles a collision the seed could not. `trading-desk` picks candles or a line by coin
 * flip, and two entries whose slugs both landed on candles would have come out as the same picture
 * — the kind of "different" that is real in the file and invisible on the page.
 */
const pipeline = ({ t, v }) => {
  const Y = 330;
  const H = 300;
  /* Three stages, so **two** arrows. The first version listed a fourth x and drew three, and the
     last one pointed out of the pipeline into empty ground — a diagram claiming a stage that is not
     there, which on a drawing about provenance is a particularly bad thing to leave in. */
  const xs = [200, 660, 1110];
  let s = '';
  /* Arrows first, behind the stages, so a stage sits on its own inbound arrow. */
  for (let i = 0; i < xs.length - 1; i++) {
    const from = xs[i] + (i === 0 ? 300 : 300);
    const to = xs[i + 1];
    s += line(`M${from} ${Y + H / 2}h${to - from - 26}`, t.ink, 5, 0.35);
    s += poly([to - 30, Y + H / 2 - 20, to, Y + H / 2, to - 30, Y + H / 2 + 20], t.ink, 0.35);
  }
  /* Stage one: a fan of source cards. How many is the variation, and it is the honest one — what
     differs between two runs of a pipeline is how much went into it. */
  const sources = v.int(4, 6);
  for (let i = 0; i < sources; i++) {
    const w = 220;
    const h = 250;
    const a = -14 + i * (28 / (sources - 1));
    let card = box(0, 0, w, h, 10, t.screen);
    card += line(`M4 4h${w - 8}v${h - 8}H4Z`, t.ink, 4, 0.4);
    card += bar(26, 30, v.int(90, 160), 14, t.ink, 0.45);
    for (let r = 0; r < 4; r++) card += bar(26, 68 + r * 30, v.int(90, 168), 10, t.ink, 0.22);
    s += `<g transform="translate(${xs[0] + 40} ${Y + 24}) rotate(${a.toFixed(1)} ${w / 2} ${h})">${card}</g>`;
  }
  /* Stage two: clusters. Two or three groups of dots, each group tight and the groups apart — the
     whole content of the word "clustering" and the only mark here that has to be legible small. */
  const groups = v.int(2, 3);
  for (let g = 0; g < groups; g++) {
    const gx = xs[1] + 70 + (g % 2) * 160;
    const gy = Y + 60 + Math.floor(g / 2) * 140 + (g % 2) * 60;
    const wine = g === 0;
    for (let k = 0; k < v.int(5, 8); k++) {
      s += dot(gx + v.int(-52, 52), gy + v.int(-46, 46), v.int(11, 17), wine ? t.accent : t.ink, wine ? 0.7 : v.pick([0.28, 0.4, 0.52]));
    }
    s += `<circle cx="${gx}" cy="${gy}" r="76" fill="none" stroke="${t.ink}" stroke-opacity="0.22" stroke-width="3" stroke-dasharray="12 10"/>`;
  }
  /* Stage three: the persona card — a figure and a few lines about them. */
  s += box(xs[2] + 14, Y + 20, 320, H, 14, t.shade, SHADOW.alpha);
  s += box(xs[2], Y, 320, H, 14, t.screen);
  s += `<rect x="${xs[2]}" y="${Y}" width="320" height="${H}" rx="14" fill="none" stroke="${t.ink}" stroke-opacity="0.4" stroke-width="4"/>`;
  s += person(xs[2] + 70, Y + 150, 110, t.ink, 0.55);
  s += bar(xs[2] + 140, Y + 62, 110, 16, t.ink, 0.55);
  for (let r = 0; r < 3; r++) s += bar(xs[2] + 140, Y + 98 + r * 26, v.int(60, 110), 10, t.ink, 0.26);
  /* The citations: a rule across the foot of the card and short numbered stubs under it. A claim
     with a source under it looks exactly like this and like nothing else. */
  s += `<path d="M${xs[2] + 26} ${Y + 196}h268" stroke="${t.ink}" stroke-opacity="0.45" stroke-width="3"/>`;
  for (let r = 0; r < v.int(2, 4); r++) {
    s += dot(xs[2] + 34, Y + 224 + r * 28, 7, t.accent, 0.8);
    s += bar(xs[2] + 50, Y + 218 + r * 28, v.int(90, 190), 10, t.ink, 0.3);
  }
  return s;
};

/**
 * Every drawing this site can put on a cover.
 *
 * `alt` is what a screen reader hears in place of the image, and it describes the *drawing* — a
 * reader who cannot see it should learn that this is an illustration, not be told the entry's
 * title a second time (the heading beside it already says that).
 *
 * `credit` is the figcaption, and it is the whole reason the plate/art distinction is worth
 * having. It is the drops' own line, kept almost verbatim, because they got this exactly right:
 * a cover depicting the product a competition was about will be read as a screenshot of it unless
 * something says otherwise, and on a portfolio a recruiter reads, that misreading is not harmless.
 */
export const ART_TEMPLATES = {
  artboard: {
    aspect: [1600, 1000],
    alt: 'Concept illustration: a design canvas with a shape selected inside its handles, dashed guides, a tool column and a row of colour swatches.',
    credit: 'Editorial concept illustration, drawn for this page. Not a screenshot of the work.',
    label: 'EDITORIAL CONCEPT',
    draw: artboard,
  },
  'book-stack': {
    aspect: [1600, 1000],
    alt: 'Concept illustration: a stack of books inside a large turning arrow, standing for books passed on rather than kept.',
    credit: 'Editorial concept illustration, drawn for this page. Not a photograph of the drive.',
    label: 'EDITORIAL CONCEPT',
    draw: bookStack,
  },
  cohort: {
    /** one row, or two staggered. */
    compositions: 2,
    aspect: [1600, 1000],
    alt: 'Concept illustration: a group of simplified figures standing in a row, two of them picked out in colour.',
    credit: 'Editorial concept illustration, drawn for this page. Not a photograph of the group.',
    label: 'EDITORIAL CONCEPT',
    draw: cohort,
  },
  'collection-bag': {
    aspect: [1600, 1000],
    alt: 'Concept illustration: a sealed collection bag on a shoulder strap beside a sheet of flag stickers, some of them already taken.',
    credit: 'Editorial concept illustration, drawn for this page. Not a photograph of the day.',
    label: 'EDITORIAL CONCEPT',
    draw: collectionBag,
  },
  conversation: {
    /** trade, listen, volley, close — four shapes an hour with somebody takes. */
    compositions: 4,
    aspect: [1600, 1000],
    alt: 'Concept illustration: two blocks of speech leaning toward each other, one longer than the other, each holding a few lines.',
    credit: 'Editorial concept illustration, drawn for this page. It depicts a conversation, not anything said in one.',
    label: 'EDITORIAL CONCEPT',
    draw: conversation,
  },
  crates: {
    aspect: [1600, 1000],
    alt: 'Concept illustration: a hand-set stack of labelled crates beside a carrier bag.',
    credit: 'Editorial concept illustration, drawn for this page. Not a photograph of the distribution.',
    label: 'EDITORIAL CONCEPT',
    draw: crates,
  },
  'trading-desk': {
    /** candles, or a filled line. */
    compositions: 2,
    aspect: [1600, 1000],
    alt: 'Concept illustration: a market terminal showing a candlestick chart beside a short watchlist, under a ticker strip.',
    credit: 'Editorial concept illustration, drawn for this page. Not a screenshot of a real terminal, and the chart is not real market data.',
    label: 'EDITORIAL CONCEPT',
    draw: tradingDesk,
  },
  pipeline: {
    aspect: [1600, 1000],
    alt: 'Concept illustration: a fan of source documents feeding a set of clustered points, feeding a profile card whose claims each carry a citation.',
    credit: 'Editorial concept illustration, drawn for this page. Not output from the tool.',
    label: 'EDITORIAL CONCEPT',
    draw: pipeline,
  },
  'pitch-deck': {
    aspect: [1600, 1000],
    alt: 'Concept illustration: three presentation slides fanned out, the front one carrying a title, a short column chart and a few bullet lines.',
    credit: 'Editorial concept illustration, drawn for this page. Not slides from the deck.',
    label: 'EDITORIAL CONCEPT',
    draw: pitchDeck,
  },
  blueprint: {
    aspect: [1600, 1000],
    alt: 'Concept illustration: a technical plan drawing — a dimensioned outline with interior partitions, a radius callout and a corner title block, over a fine grid.',
    credit: 'Editorial concept illustration, drawn for this page. Not a drawing from the project.',
    label: 'EDITORIAL CONCEPT',
    draw: blueprint,
  },
  'model-graph': {
    aspect: [1600, 1000],
    alt: 'Concept illustration: four columns of nodes joined by a sparse web of curved edges, above a row of uneven blocks standing for tokens.',
    credit: 'Editorial concept illustration, drawn for this page. Not a diagram of the actual architecture.',
    label: 'EDITORIAL CONCEPT',
    draw: modelGraph,
  },
  'ledger-page': {
    aspect: [1600, 1000],
    alt: 'Concept illustration: a ruled ledger sheet with a column of entries and a ruled total at the foot.',
    credit: 'Editorial concept illustration, drawn for this page. Not a document from the work.',
    label: 'EDITORIAL CONCEPT',
    draw: ledgerPage,
  },
  'ridge-line': {
    /** the range low under a lot of sky, or filling the frame. */
    compositions: 2,
    aspect: [1600, 1000],
    /* The front ridge fills to the bottom edge, so the label sits on ink and has to be light. The
       drops solved this exact problem in the same place and the same way — `.cover-mountains
       .artwork-label { color: #fff }` is one of the four rules their mountains cover consisted of. */
    labelOnInk: true,
    alt: 'Concept illustration: layered mountain ridges receding into mist, with the trip’s location on a small chip.',
    credit: 'Editorial concept illustration, drawn for this page. Not a photograph of the trip.',
    label: 'EDITORIAL CONCEPT',
    draw: ridgeLine,
  },
  skyline: {
    /** the skyline high, low, or mid-frame. */
    compositions: 3,
    aspect: [1600, 1000],
    alt: 'Concept illustration: a city skyline of towers above a horizon and a band of water, with the trip’s location on a small chip.',
    credit: 'Editorial concept illustration, drawn for this page. Not a photograph of the city.',
    label: 'EDITORIAL CONCEPT',
    draw: skyline,
  },
  'film-strip': {
    /** three, four or five frames. */
    compositions: 3,
    aspect: [1600, 1000],
    alt: 'Concept illustration: a tilted strip of film whose frames each hold a different simple scene, beside a title block and a play ring.',
    credit: 'Editorial concept illustration, drawn for this page. Not a frame from the film.',
    label: 'EDITORIAL CONCEPT',
    draw: filmStrip,
  },
  'split-bill': {
    aspect: [1600, 1000],
    alt: 'Concept illustration: a bill drawn as one long bar dividing into three unequal shares, beside two tilted handsets — a shared bill with its transactions, and an assistant offering one person their share to settle.',
    credit: 'Editorial concept illustration, drawn for this page. Not the original competition prototype.',
    label: 'EDITORIAL CONCEPT',
    /* The one template that does not vary: it is a specific illustration of a specific product, and
       it is the only entry using it. `v` is in the signature because every other template needs it. */
    draw({ t }) {
      return (
        splitDiagram(t) +
        /* Their `.cover-large .phone-back { left: 42% }` / `.phone-front { left: 63% }` — 21% of the
         * canvas apart, and at that spacing on a 1600 canvas the front handset buried the back
         * one's entire right half — its rows lost their chevrons, its nav strip lost three of its
         * four dots, and the back screen stopped reading as a list at all. Their phones were
         * narrower relative to their canvas; the same percentages do not survive the change of
         * frame. Opened to 408 apart (712 and 1120), which leaves 148 of overlap: enough that the
         * two are plainly one stack rather than two objects, little enough that both screens are
         * still legible. Their rotations are kept unchanged at −13° and +12° — the tilt pair *is*
         * the composition, and it is the part of their drawing worth having. */
        `<g transform="translate(712 250) rotate(-13)">${backScreen(t)}</g>` +
        `<g transform="translate(1120 150) rotate(12)">${frontScreen(t)}</g>`
      );
    },
  },
};

/** The names `art:` may take. Derived from the registry so the two cannot disagree. */
export const ART_NAMES = Object.keys(ART_TEMPLATES).sort();

/**
 * What the site needs to know about a drawing without drawing it — the `<img alt>` and the
 * figcaption. Separate from `coverArtSVG` so a React server component can ask for two strings
 * without the drawing code being reachable from the page it renders.
 *
 * @param {string} template a key of `ART_TEMPLATES`
 * @returns {{ alt: string, credit: string } | null} `null` for a name no template answers to
 */
export function artMeta(template) {
  const spec = ART_TEMPLATES[template];
  return spec ? { alt: spec.alt, credit: spec.credit } : null;
}

/**
 * Draw one.
 *
 * @param template one of `ART_NAMES`. Unknown names throw rather than falling back to a plate:
 *                 a cover that quietly becomes a placeholder is the failure `redraw-covers` spent
 *                 two rewrites learning to make visible.
 * @param hue      the category's hue in degrees, as `placeholderSVG` takes it. Defaulted to 32
 *                 (the site's own warm centre, the hue `/about/` washes with) rather than hashed:
 *                 the plate hashes because twenty-four of them share a page and must differ, and
 *                 an illustration has no siblings to differ from.
 * @param seed     the entry's slug. Drives the structural variation described on `variation()` —
 *                 how many towers, how many frames, where the ridges cross — so that the five study
 *                 trips sharing `skyline` are five different skylines rather than one printed five
 *                 times. A template used by exactly one entry may ignore it.
 * @param data     the entry's own frontmatter, for the fields a drawing can honestly show. Today
 *                 that is `location` and nothing else: the travel templates put it in a chip, which
 *                 is the one idea from the drops' `mountains` cover worth having, and it is real
 *                 rather than decorative — `Wuyishan, Fujian` is a fact about the entry that the
 *                 card beside it does not carry.
 */
export function coverArtSVG({ template, hue = 32, seed = '', data = {} } = {}) {
  const spec = ART_TEMPLATES[template];
  if (!spec) {
    throw new Error(
      `Unknown cover art template "${template}". Known templates: ${ART_NAMES.join(', ')}`,
    );
  }
  const [width, height] = spec.aspect;
  const t = palette(hue);
  const v = variation(seed);
  /* `role="img"` and a `<title>`, where the plate carries `role="presentation"`. Through an `<img>`
     neither is read — the `alt` on the tag wins — so this changes nothing today. It is here because
     the two files genuinely differ in kind: a plate depicts nothing, and this depicts something. A
     description that lives beside the drawing is also the description that survives the file being
     opened, inlined, or dropped into a deck.

     The frame is the plate's, unchanged: same 28 inset, same 18 radius, same `lineCol`. It is the
     one element both kinds of cover share, and it is what makes a page mixing them read as one
     hand rather than as an illustration that wandered in. */
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" ${ART_MARK}${template}">
  <title>${spec.alt.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</title>
  <rect width="${width}" height="${height}" fill="${t.ground}"/>
  ${spec.draw({ t, v, data })}
  <rect x="28" y="28" width="${width - 56}" height="${height - 56}" fill="none" stroke="${t.frame}" stroke-width="2" rx="18"/>
  ${mono(96, 916, spec.label, spec.labelOnInk ? t.bezel : t.ink, { o: spec.labelOnInk ? 0.8 : 0.55 })}
</svg>
`;
}
