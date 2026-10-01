/**
 * The design system — every value the site's look is made of, in one place.
 *
 * "Contact sheet, annotated", graded warm: ivory paper, espresso ink, a ledger-wine stamp,
 * photo-chemical amber and a sage for taxonomy, set in Instrument Serif over Inter with a mono index
 * rail. That identity is unchanged. What this file changes is how it is held: the old palette was ten
 * hex values on `@theme` and a dark copy of them, and around it the stylesheets had grown 75 raw
 * colours, 30 hand-mixed shadows, 40 inline easing curves and seventeen font sizes. Each was a
 * reasonable local decision, and together they were a palette nobody could see whole.
 *
 * **Three tiers.**
 * 1. *Primitives* — four ramps (paper, wine, amber, sage) in OKLCH, the space where a ramp behaves:
 *    equal steps of L look like equal steps of lightness, and hue holds still as a colour darkens.
 * 2. *Semantics* — what a colour is *for* (ground, ink, accent, line…), once per theme, each one a
 *    pointer into a ramp. Components only ever use these. The dark theme is a different set of
 *    pointers into the same ramps, so the two themes cannot drift apart in hue.
 * 3. *Scales* — type roles, space, radius, elevation and motion, named for their job.
 *
 * **Generated, measured, enforced.** scripts/build-tokens.mjs writes src/styles/tokens.css from this
 * file (never edit that file by hand); tests/design-tokens.test.ts fails if it is stale, if any
 * primitive falls outside sRGB, if a ramp is not monotonic in lightness, or if any text pairing
 * listed in `PAIRS` misses WCAG AA in either theme; tests/design-hygiene.test.ts fails on raw colours
 * and easing curves anywhere else. The /system/ page renders all of it, contrast measured live.
 */

/* ------------------------------------------------------------------ *
 * 1. Primitives — [L 0–1, C, h°]
 * ------------------------------------------------------------------ */

/**
 * Paper: one warm neutral from a white sheet to the umber of film base. The hue walks from 88°
 * (yellowed paper) at the light end to about 65° (espresso) at the dark, the way a warm neutral does
 * in print, and chroma swells through the middle — a grey with no chroma would read cold beside the
 * wine. The light theme lives at the top of it and the candlelit dark theme at the bottom.
 */
export const paper = {
  0: [1, 0, 0],
  25: [0.991, 0.01, 87.5],
  50: [0.968, 0.014, 84.6],
  100: [0.938, 0.018, 83],
  150: [0.909, 0.021, 81.8],
  200: [0.86, 0.024, 80],
  300: [0.77, 0.028, 77],
  400: [0.696, 0.03, 76],
  500: [0.6, 0.029, 72],
  600: [0.504, 0.023, 65],
  700: [0.415, 0.021, 65],
  800: [0.335, 0.023, 70],
  850: [0.312, 0.023, 72],
  900: [0.265, 0.014, 67],
  925: [0.25, 0.016, 74],
  950: [0.212, 0.011, 68],
  975: [0.182, 0.009, 66],
  1000: [0.148, 0.007, 58],
};

/**
 * Wine: the ledger stamp. 600 is the accent the site has always had (#8e2f45). The light end turns
 * a few degrees towards rose, so the tints and the dark theme's accent read as the same ink diluted
 * rather than as a separate pink — the old dark accent had drifted to coral, hue 29°, nineteen
 * degrees off the wine it stood for.
 */
export const wine = {
  50: [0.972, 0.012, 16],
  100: [0.938, 0.03, 15],
  200: [0.875, 0.058, 15],
  300: [0.79, 0.092, 17],
  400: [0.69, 0.12, 14],
  500: [0.57, 0.14, 11],
  600: [0.451, 0.129, 10],
  700: [0.385, 0.112, 9],
  800: [0.315, 0.085, 9],
  900: [0.255, 0.058, 10],
};

/** Amber: photo-chemical, the colour of edge print and of a picture light. 400 is the old signal. */
export const amber = {
  50: [0.972, 0.022, 85],
  100: [0.935, 0.05, 82],
  200: [0.875, 0.09, 78],
  300: [0.815, 0.12, 75],
  400: [0.761, 0.1415, 72.15],
  500: [0.685, 0.135, 68],
  600: [0.595, 0.12, 67],
  700: [0.509, 0.102, 70],
  800: [0.42, 0.08, 68],
  900: [0.33, 0.06, 66],
};

/** Sage: taxonomy — what sort of thing something is, as distinct from action (wine) and notice (amber). */
export const sage = {
  50: [0.97, 0.01, 128],
  100: [0.93, 0.022, 128],
  200: [0.86, 0.038, 127],
  300: [0.742, 0.055, 124],
  400: [0.65, 0.058, 126],
  500: [0.59, 0.057, 128],
  600: [0.539, 0.054, 130],
  700: [0.45, 0.048, 131],
  800: [0.36, 0.04, 132],
  900: [0.27, 0.03, 133],
};

/** True black, for the dark theme's shadows only: a candlelit room's shadows have no colour left. */
export const voidBlack = [0, 0, 0];

export const RAMPS = { paper, wine, amber, sage };

/* ------------------------------------------------------------------ *
 * 2. Semantics — what each colour is for, per theme
 * ------------------------------------------------------------------ */

/**
 * Names are the Tailwind colour names the markup already uses (`text-muted`, `border-line`,
 * `bg-accent`…), so a component written against the old palette is written against this one; the
 * additions fill roles that were being improvised with `color-mix` at the point of use.
 */
export const ROLES = {
  ground: 'the page — paper, the wall the work hangs on',
  surface: 'a sheet on the page — cards, panels, mats, popovers',
  sunken: 'a well in the page — code, inputs, an empty frame',
  ink: 'primary text',
  muted: 'secondary text that must still be read',
  faint: 'large or decorative text and glyphs only — never body copy',
  line: 'hairlines, frames, ticks',
  'line-strong': 'a rule that carries structure and has to be seen — a divider, a ruler’s ticks. (An input’s border is `faint`, which meets 3:1.)',
  accent: 'interaction — links, the active tab, focus, the primary action',
  'accent-hover': 'the accent under the pointer',
  'accent-ink': 'text on an accent fill',
  'accent-soft': 'an accent wash behind text — a hovered row, a selection',
  signal: 'notice — markers and badges as fills',
  'signal-text': 'notice, legible as text',
  'signal-soft': 'a notice wash behind text',
  secondary: 'taxonomy — categories, tags, kinds',
  'secondary-soft': 'a taxonomy wash behind text',
  focus: 'the focus ring',
  shadow: 'the colour shadows are mixed from',
  film: 'the reel’s film base',
  'film-hole': 'the reel’s perforations',
};

export const THEMES = {
  light: {
    ground: 'paper.50',
    surface: 'paper.25',
    sunken: 'paper.100',
    ink: 'paper.900',
    muted: 'paper.600',
    faint: 'paper.500',
    line: 'paper.150',
    'line-strong': 'paper.300',
    accent: 'wine.600',
    'accent-hover': 'wine.700',
    'accent-ink': 'paper.0',
    'accent-soft': 'wine.50',
    signal: 'amber.400',
    'signal-text': 'amber.700',
    'signal-soft': 'amber.50',
    secondary: 'sage.600',
    'secondary-soft': 'sage.50',
    focus: 'wine.600',
    shadow: 'paper.900',
    film: 'paper.925',
    'film-hole': 'paper.50',
  },
  /* Candlelit: the same ramps from the bottom. The accent comes up to wine 300 — the stamp seen by
     lamplight — and taxonomy and notice lift with it; everything else is paper read the other way. */
  dark: {
    ground: 'paper.950',
    surface: 'paper.925',
    sunken: 'paper.975',
    ink: 'paper.100',
    muted: 'paper.400',
    faint: 'paper.500',
    line: 'paper.850',
    'line-strong': 'paper.700',
    accent: 'wine.300',
    'accent-hover': 'wine.200',
    'accent-ink': 'paper.950',
    'accent-soft': 'wine.900',
    signal: 'amber.400',
    'signal-text': 'amber.400',
    'signal-soft': 'amber.900',
    secondary: 'sage.300',
    'secondary-soft': 'sage.900',
    focus: 'wine.300',
    shadow: 'void',
    film: 'paper.1000',
    'film-hole': 'paper.800',
  },
};

/**
 * Paper does not take the screen palette. Ink on white, a blue for links because a printout is often
 * photocopied in greyscale and a mid blue survives that where wine turns to mud, and taxonomy in the
 * body's own near-black — a category label is not worth a colour of ink.
 */
export const PRINT = {
  ground: [1, 0, 0],
  surface: [1, 0, 0],
  ink: [0.18, 0, 0],
  muted: [0.37, 0, 0],
  line: [0.89, 0, 0],
  accent: [0.38, 0.14, 265],
  'signal-text': [0.44, 0.09, 70],
  secondary: [0.32, 0, 0],
};

/**
 * Every pairing of text and ground the site actually sets, and the WCAG level it has to meet:
 * `text` is 4.5:1 (AA, body copy), `large` is 3:1 (AA for ≥24px or ≥19px bold, and for UI parts
 * under 1.4.11), and `rule` is 1.8:1 — not a WCAG level, this system's own floor for a line that
 * carries structure, so it never fades into the paper. The test measures each one in both themes;
 * the /system/ page prints the ratios.
 */
export const LEVELS = { text: 4.5, large: 3, rule: 1.8 };

export const PAIRS = [
  ['ink', 'ground', 'text'],
  ['ink', 'surface', 'text'],
  ['ink', 'sunken', 'text'],
  ['muted', 'ground', 'text'],
  ['muted', 'surface', 'text'],
  ['muted', 'sunken', 'text'],
  ['accent', 'ground', 'text'],
  ['accent', 'surface', 'text'],
  ['accent', 'accent-soft', 'text'],
  ['accent-ink', 'accent', 'text'],
  ['signal-text', 'ground', 'text'],
  ['signal-text', 'surface', 'text'],
  ['signal-text', 'signal-soft', 'text'],
  ['secondary', 'ground', 'text'],
  ['secondary', 'surface', 'text'],
  ['secondary', 'secondary-soft', 'text'],
  ['faint', 'ground', 'large'],
  ['faint', 'surface', 'large'],
  ['line-strong', 'ground', 'rule'],
  ['focus', 'ground', 'large'],
  ['focus', 'surface', 'large'],
];

/** Resolve 'paper.50' (or 'void') to its OKLCH triple. */
export function resolve(ref) {
  if (ref === 'void') return voidBlack;
  const [ramp, step] = ref.split('.');
  const lch = RAMPS[ramp]?.[step];
  if (!lch) throw new Error(`unknown colour primitive: ${ref}`);
  return lch;
}

/* ------------------------------------------------------------------ *
 * 3. Scales
 * ------------------------------------------------------------------ */

export const FONTS = {
  display: '"Instrument Serif", "Iowan Old Style", Georgia, "Noto Serif TC", "Songti TC", serif',
  sans: '"Inter Variable", "Inter", system-ui, -apple-system, "Segoe UI", Roboto, "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, Consolas, "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", monospace',
};

/**
 * Type roles. A role is size, leading and tracking decided together — a size on its own is half a
 * decision, and it is how the site had arrived at seventeen of them. Fluid where the text is a
 * headline (a floor for a phone, a ceiling where Instrument Serif, which is narrow, still reads as a
 * headline rather than a poster, and a straight line between); fixed where it is read at length.
 * Tracking tightens as size grows because a display face's default spacing is drawn for text sizes.
 *
 * Each becomes a Tailwind utility (`text-heading`) carrying all three.
 */
export const TYPE = {
  display: { size: 'clamp(2.6rem, 1.85rem + 3.2vw, 4.25rem)', leading: 1.02, tracking: '-0.018em', use: 'the banner’s name' },
  title: { size: 'clamp(2.25rem, 1.7rem + 2.3vw, 3.5rem)', leading: 1.06, tracking: '-0.014em', use: 'a page’s h1' },
  section: { size: 'clamp(1.75rem, 1.4rem + 1.4vw, 2.5rem)', leading: 1.1, tracking: '-0.01em', use: 'a section’s h2' },
  quote: { size: 'clamp(1.45rem, 1.25rem + 0.8vw, 1.75rem)', leading: 1.3, tracking: '-0.004em', use: 'a pull-quote, in italic' },
  turn: { size: 'clamp(1.45rem, 1.12rem + 1.35vw, 2.15rem)', leading: 1.15, tracking: '-0.006em', use: 'the italic turn after a display line' },
  heading: { size: 'clamp(1.3rem, 1.18rem + 0.45vw, 1.6rem)', leading: 1.16, tracking: '-0.006em', use: 'a card’s or a panel’s title' },
  subhead: { size: '1.125rem', leading: 1.4, tracking: '-0.005em', use: 'a sans heading inside prose' },
  lede: { size: 'clamp(1.0625rem, 0.98rem + 0.4vw, 1.25rem)', leading: 1.62, tracking: '-0.003em', use: 'the paragraph under a title' },
  prose: { size: '1.0625rem', leading: 1.8, tracking: '0em', use: 'a reflection, read at length' },
  body: { size: '1rem', leading: 1.65, tracking: '0em', use: 'interface text' },
  small: { size: '0.875rem', leading: 1.55, tracking: '0.002em', use: 'summaries, captions' },
  label: { size: '0.72rem', leading: 1.6, tracking: '0.06em', use: 'the index rail — dates, codes, kinds (mono, capitals)' },
  micro: { size: '0.625rem', leading: 1.4, tracking: '0.1em', use: 'edge print on the reel, ticks' },
};

/** Line lengths, in the font's own `ch`. */
export const MEASURE = {
  prose: '65ch',
  lede: '60ch',
  quote: '46ch',
  tight: '48ch',
  narrow: '28ch',
};

/**
 * Space, fluid between a 360px phone and a 1280px desktop: each step grows by about a quarter across
 * that range, so the rhythm of a page loosens on a wide screen without the small steps (the gap in a
 * chip) growing at all. `section` is the gap between a landing page's sections, which was here before.
 */
export const SPACE = {
  '3xs': '0.25rem',
  '2xs': '0.5rem',
  xs: 'clamp(0.75rem, 0.72rem + 0.12vw, 0.8125rem)',
  s: 'clamp(1rem, 0.95rem + 0.22vw, 1.125rem)',
  m: 'clamp(1.5rem, 1.4rem + 0.43vw, 1.75rem)',
  l: 'clamp(2rem, 1.85rem + 0.65vw, 2.5rem)',
  xl: 'clamp(3rem, 2.75rem + 1.1vw, 3.75rem)',
  '2xl': 'clamp(4rem, 3.6rem + 1.75vw, 5.25rem)',
  section: 'clamp(4rem, 2.5rem + 5vw, 7rem)',
};

/** Corners: one per kind of object, softest on the biggest. */
export const RADIUS = {
  hair: '2px',
  chip: '0.5rem',
  card: '0.875rem',
  pane: '1.25rem',
  pill: '999px',
};

/**
 * Elevation. Four heights, each two shadows — a tight contact edge and a long soft fall — mixed from
 * the theme's shadow colour, so a shadow on paper is a warmer umber and one in the dark theme is true
 * black, at a strength (`k`) the theme sets. The numbers are the old site's own best shadows, kept
 * and named: `sheet` is a panel lying on the page, `rest` the mat on the wall, `lift` a card under
 * the pointer, `float` a pane or a flyout over the page, `overlay` a dialog.
 */
export const ELEVATION = {
  sheet: [
    [0, 1, 1, 0, 0.04],
    [0, 2, 5, -2, 0.06],
  ],
  rest: [
    [0, 1, 2, 0, 0.08],
    [0, 14, 26, -20, 0.4],
  ],
  lift: [
    [0, 2, 4, -2, 0.08],
    [0, 22, 40, -22, 0.34],
  ],
  float: [
    [0, 2, 6, -3, 0.1],
    [0, 24, 48, -26, 0.32],
  ],
  overlay: [
    [0, 4, 10, -4, 0.12],
    [0, 40, 80, -32, 0.42],
  ],
};
/** Shadow strength per theme: paper casts soft umber shadows; a dark room needs deeper ones to read. */
export const SHADOW_K = { light: 1, dark: 2.2 };
/** The lit top edge of a raised surface, as an alpha of white per theme. */
export const EDGE_LIGHT = { light: 0.4, dark: 0.07 };

/**
 * Motion. Curves are named for the kind of movement, so a new animation picks a character rather than
 * a number. Durations are named for their job: the seven steps are where the forty-odd timings the site
 * had already chosen actually clustered, so moving onto them changed nothing anyone would notice.
 * Choreography — the banner's entrance, a page handing over — keeps its own timings beside the curves,
 * because there the numbers *are* the design and are explained where they are set.
 */
export const EASE = {
  settle: ['cubic-bezier(0.16, 1, 0.3, 1)', 'arrives fast and settles long — underlines drawing, sheen, a cover easing in'],
  snap: ['cubic-bezier(0.2, 0.6, 0.2, 1)', 'answers the hand — press, lift, the header tucking away'],
  glide: ['cubic-bezier(0.2, 0.75, 0.25, 1)', 'paper moving — prints fanning, a page coming forward, lines arriving'],
  depart: ['cubic-bezier(0.45, 0, 0.8, 0.35)', 'accelerating away — a page receding past the camera'],
  carry: ['cubic-bezier(0.45, 0, 0.15, 1)', 'a picture carried from page to page'],
  'carry-light': ['cubic-bezier(0.3, 0, 0.1, 1)', 'words carried from page to page — lighter, quicker off the mark'],
};

export const DURATION = {
  tap: ['120ms', 'press feedback'],
  quick: ['200ms', 'colour changing, a small fade'],
  brisk: ['300ms', 'a control moving — a lift, the header tucking away'],
  move: ['400ms', 'something drawing or travelling — an underline, an arrow, a shadow lengthening'],
  paper: ['600ms', 'paper moving — prints fanning, a picture light coming up'],
  settle: ['900ms', 'a slow settle — a cover easing in, the sheen crossing a print'],
  draw: ['1200ms', 'a rule drawing itself across a section'],
};

/**
 * The page wash: one soft gradient of a section's own hue (src/lib/wash.ts) over the paper — light
 * falling on it, not a colour cast — at this strength per theme, and at this saturation and
 * lightness, which are the wash's character and not any one section's.
 */
export const WASH = { light: 0.1, dark: 0.14, saturation: '38%', lightness: '50%' };

/**
 * The paper's grain: the wall the work hangs on is not a flat colour. A tile of fine noise sits on
 * the page's ground only — sheets (cards, panels, mats) lie on top of it smooth, the way a print sits
 * on a plaster wall — at an opacity per theme. public/grain.png is drawn by scripts/build-grain.mjs.
 */
export const GRAIN = { light: 0.06, dark: 0.05, tile: '180px' };
