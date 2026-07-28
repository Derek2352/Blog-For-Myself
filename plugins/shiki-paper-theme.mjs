/**
 * Syntax themes built from the site's own palette.
 *
 * Off-the-shelf Shiki themes are calibrated for the background they ship with —
 * `github-light` assumes #fff, `github-dark` assumes #24292e. Dropped onto this
 * site's cream (#fffcf5) and warm brown (#272119) surfaces, two of their token
 * colours fail WCAG AA at the 14.9px the code blocks render at: the keyword red
 * lands at 4.46:1 on cream, and the comment grey at 3.31:1 on the dark surface,
 * which makes the explanatory comments the least readable thing in the block.
 *
 * So the token colours come from `src/styles/global.css` instead — the same ink,
 * muted, accent and signal-text values the rest of the page uses. Every one
 * clears 5.7:1 against the surface it sits on (see tests/code-theme.test.ts,
 * which fails the build's test run if that stops being true), and the blocks
 * read as part of the page rather than as something pasted in from an IDE.
 */

/** Palette pairs, copied from the tokens in global.css. Keep in sync. */
export const PAPER_PALETTE = {
  light: {
    surface: '#fffcf5', // --color-surface
    ink: '#2a241e', //     --color-ink
    muted: '#6e6257', //   --color-muted
    accent: '#8e2f45', //  --color-accent
    signal: '#8a5a14', //  --color-signal-text
  },
  dark: {
    surface: '#272119',
    ink: '#ece4d6',
    muted: '#a89b89',
    accent: '#efa397',
    signal: '#e8a13a',
  },
};

/**
 * One scope map for both themes, so light and dark can never drift apart.
 * Deliberately coarse — four roles, not twenty. The point is legibility and
 * restraint, not an IDE's worth of colour.
 */
const SCOPES = [
  { role: 'muted', scope: ['comment', 'punctuation.definition.comment'] },
  {
    role: 'accent',
    scope: [
      'keyword',
      'keyword.control',
      'keyword.operator',
      'storage',
      'storage.type',
      'entity.name.function',
      'support.function',
      'variable.function',
    ],
  },
  {
    role: 'signal',
    scope: [
      'string',
      'string.quoted',
      'constant.numeric',
      'constant.language',
      'constant.character',
    ],
  },
];

const build = (name, p) => ({
  name,
  type: name === 'paper-dark' ? 'dark' : 'light',
  colors: { 'editor.foreground': p.ink, 'editor.background': p.surface },
  settings: [
    { settings: { foreground: p.ink, background: p.surface } },
    ...SCOPES.map(({ role, scope }) => ({ scope, settings: { foreground: p[role] } })),
  ],
});

export const paperLight = build('paper-light', PAPER_PALETTE.light);
export const paperDark = build('paper-dark', PAPER_PALETTE.dark);

/** Token colours that must stay legible on each surface (used by the test). */
export const TOKEN_ROLES = ['ink', 'muted', 'accent', 'signal'];
