/**
 * Rendered art — the vector drawings built as 3D dioramas in Blender, and the file format that
 * carries the result.
 *
 * ## The file
 *
 * A rendered cover is still `cover.svg`, and still an SVG, so nothing that finds, validates,
 * sizes or classifies covers had to learn a new kind of file. Inside it:
 *
 * - the **light render** and the **dark render**, as embedded WebP, switched by
 *   `@media (prefers-color-scheme: dark)`. An SVG shown through `<img>` takes that query from the
 *   page's `color-scheme`, and the site sets `color-scheme: dark` on `.dark` — so the picture
 *   follows the site's own theme toggle, not just the device's (checked in Chromium; a browser that
 *   does not pass it through falls back to the device's setting, which is usually the same).
 * - the drawing's **text**, kept as vector on top, in each theme's colours: the credit line that
 *   says the picture is a drawing, and the location chips. Crisp at any size, and never baked into
 *   pixels where a reader cannot select it.
 * - the **original vector**, base64 in `<metadata>`, so a render can be redone from the drawing it
 *   was made from, and `data-render-of` — a hash of that vector — so `npm run covers` can tell an
 *   up-to-date render from a stale one without rendering anything.
 * - every mark the vector carried (`data-cover-art`, the plate mark, `role`, `<title>`), so the
 *   detectors in `cover-plate.mjs` answer exactly as they did.
 *
 * ## Why a dark render rather than the filter
 *
 * The flat drawings go dark through `invert(1) hue-rotate(180deg)` (see the `[data-drawn]` rule in
 * global.css), which works because a flat drawing is only colours. A rendered one is colours *and
 * light*: inverted, every shadow becomes a glow and every highlight a bruise. So the dark render is
 * built from the dark palette — the same filter applied to the drawing's colours before Blender
 * sees them (`darkVector`) — and lit like the light one. The board lands exactly where the filtered
 * plate landed, so the cover still sinks into `--color-surface`; the light comes out the right way
 * round.
 */
import { createHash } from 'node:crypto';

/** The mark every rendered file carries. Also what tells the page to stop applying the filter. */
export const RENDER_MARK = 'data-render="blender"';

/** @param {string} svg @returns {boolean} */
export function isRenderedSVG(svg) {
  return svg.includes(RENDER_MARK);
}

/** A short, stable key for a vector drawing: what a render was made from. */
export function vectorKey(vector) {
  return createHash('sha256').update(vector).digest('hex').slice(0, 16);
}

/**
 * What a cover's render was made from: the drawing (which carries the template, the category hue
 * and the entry's seed) and the scene builder that turned it into a still life. A change to
 * either makes the render stale — `npm run covers` then puts the drawing back, and a test fails
 * until `npm run art` has built it again.
 */
export function sceneKey(vector, scenesSource) {
  return createHash('sha256').update(vector).update('\0').update(scenesSource).digest('hex').slice(0, 16);
}

/** The `data-render-of` key a rendered file records, or null. */
export function renderedFrom(svg) {
  return /data-render-of="([0-9a-f]+)"/.exec(svg)?.[1] ?? null;
}

/** The vector a rendered file was made from, or null. */
export function vectorInside(svg) {
  const b64 = /<metadata id="vector-source">([A-Za-z0-9+/=]+)<\/metadata>/.exec(svg)?.[1];
  return b64 ? Buffer.from(b64, 'base64').toString('utf8') : null;
}

/** The light render's bytes (WebP), for consumers that cannot run the SVG — the share cards. */
export function lightRenderOf(svg) {
  const b64 = /<image class="light" href="data:image\/webp;base64,([A-Za-z0-9+/=]+)"/.exec(svg)?.[1];
  return b64 ? Buffer.from(b64, 'base64') : null;
}

// ---------------------------------------------------------------------------------------------
// The dark palette: the dark theme's filter, applied to colours instead of pixels
// ---------------------------------------------------------------------------------------------

const clamp = (v) => Math.min(1, Math.max(0, v));

/**
 * `invert(1) hue-rotate(180deg)` on one sRGB colour, exactly as the browser computes the CSS
 * filter (Filter Effects §hue-rotate with θ = 180°, cos = −1, sin = 0; CSS filter functions work in
 * sRGB). The wine crosshair #8e2f45 lands on rgb(255 164 186), the value global.css records.
 */
export function darkOf([r, g, b]) {
  const [R, G, B] = [1 - r / 255, 1 - g / 255, 1 - b / 255];
  return [
    clamp(-0.574 * R + 1.43 * G + 0.144 * B),
    clamp(0.426 * R + 0.43 * G + 0.144 * B),
    clamp(0.426 * R + 1.43 * G - 0.856 * B),
  ].map((v) => Math.round(v * 255));
}

function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
}

const hex = ([r, g, b]) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

/** Every colour the drawings use — `hsl(h s% l%)` and `#rrggbb` — rewritten through `darkOf`. */
export function darkVector(svg) {
  // One pass over both spellings. Two chained passes inverted every hsl() twice — the first
  // wrote it out as hex, the second found that hex and turned it back — and the "dark" render
  // came out light.
  return svg.replace(
    /hsl\(\s*([\d.]+)[\s,]+([\d.]+)%[\s,]+([\d.]+)%\s*\)|#([0-9a-fA-F]{6})\b/g,
    (_, h, s, l, x) =>
      hex(darkOf(x ? [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)) : hslToRgb(+h, +s, +l))),
  );
}

// ---------------------------------------------------------------------------------------------
// The wrapper
// ---------------------------------------------------------------------------------------------

/**
 * The rendered file.
 *
 * @param {{ vector: string, light: Buffer, dark: Buffer, transforms?: number[][] }} parts the
 *   drawing; its two renders as WebP, already at the size they will ship at; and, for each
 *   `<text>` in document order, the `matrix()` that carries it onto the rendered surface (see
 *   `write_anchors` in art/blender/diorama.py).
 */
export function wrapRender({ vector, light, dark, transforms = [], key, title: titleText, texts: keepTexts = true }) {
  const open = /<svg\b[^>]*>/.exec(vector)?.[0];
  if (!open) throw new Error('not an SVG');
  const width = /\bwidth="([\d.]+)"/.exec(open)?.[1];
  const height = /\bheight="([\d.]+)"/.exec(open)?.[1];
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const title = titleText ? `<title>${esc(titleText)}</title>` : (/<title>[\s\S]*?<\/title>/.exec(vector)?.[0] ?? '');
  const texts = ((keepTexts && vector.match(/<text\b[\s\S]*?<\/text>/g)) || []).map((t, i) =>
    transforms[i] ? `<g transform="matrix(${transforms[i].map((v) => +v.toFixed(4)).join(' ')})">${t}</g>` : t,
  );
  // A plate keeps saying it is a plate: the mark is a string test, so the definition travels.
  const plateMark = vector.includes('pattern id="ledger"')
    ? '<defs><pattern id="ledger" width="1" height="1"/></defs>'
    : '';
  const attrs = open
    .replace(/^<svg/, '')
    .replace(/>$/, '')
    .trim();
  const b64 = (buf) => buf.toString('base64');
  return [
    `<svg ${attrs} ${RENDER_MARK} data-render-of="${key ?? vectorKey(vector)}">`,
    title,
    plateMark,
    `<metadata id="vector-source">${Buffer.from(vector).toString('base64')}</metadata>`,
    '<style>.dark{display:none}@media (prefers-color-scheme:dark){.light{display:none}.dark{display:inline}}</style>',
    `<image class="light" href="data:image/webp;base64,${b64(light)}" width="${width}" height="${height}"/>`,
    `<image class="dark" href="data:image/webp;base64,${b64(dark)}" width="${width}" height="${height}"/>`,
    texts.length ? `<g class="light">${texts.join('')}</g>` : '',
    texts.length ? `<g class="dark">${darkVector(texts.join(''))}</g>` : '',
    '</svg>',
    '',
  ]
    .filter(Boolean)
    .join('\n');
}
