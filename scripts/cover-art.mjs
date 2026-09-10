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
  'split-bill': {
    aspect: [1600, 1000],
    alt: 'Concept illustration: a bill drawn as one long bar dividing into three unequal shares, beside two tilted handsets — a shared bill with its transactions, and an assistant offering one person their share to settle.',
    credit: 'Editorial concept illustration, drawn for this page. Not the original competition prototype.',
    label: 'EDITORIAL CONCEPT',
    draw(t) {
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
 * @param seed     accepted and ignored, for the same reason. The plate's three seeded axes exist
 *                 to keep a category page from looking like one tile printed twelve times; a
 *                 specific drawing is not one of a set.
 */
export function coverArtSVG({ template, hue = 32, seed: _seed = '' } = {}) {
  const spec = ART_TEMPLATES[template];
  if (!spec) {
    throw new Error(
      `Unknown cover art template "${template}". Known templates: ${ART_NAMES.join(', ')}`,
    );
  }
  const [width, height] = spec.aspect;
  const t = palette(hue);
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
  ${spec.draw(t)}
  <rect x="28" y="28" width="${width - 56}" height="${height - 56}" fill="none" stroke="${t.frame}" stroke-width="2" rx="18"/>
  <text x="96" y="916" fill="${t.ink}" fill-opacity="0.55" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="22" letter-spacing="3.5">${spec.label}</text>
</svg>
`;
}
