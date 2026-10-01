/**
 * Colour arithmetic for the design system: OKLCH in, sRGB and WCAG contrast out.
 *
 * The tokens are written in OKLCH because it is the space where a ramp behaves: equal steps of `L`
 * look like equal steps of lightness, and hue holds still as a colour gets lighter or darker, which
 * is not true of HSL (a "lighter" wine in HSL drifts towards pink and loses its depth). But contrast
 * is defined on sRGB luminance, and screens show sRGB, so every token is also measured there — by
 * these functions, in tests/design-tokens.test.ts and on the /system/ page.
 *
 * Plain .mjs so the token generator, the test suite and the site can all import it unchanged.
 * The matrices are Björn Ottosson's published OKLab ↔ linear-sRGB pair.
 */

/** OKLCH (L 0–1, C, h degrees) → linear sRGB, unclamped. */
export function oklchToLinear([L, C, h]) {
  const hr = (h * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const encode = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const decode = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** Whether an OKLCH colour is inside sRGB, with a hair of tolerance for rounding. */
export function inGamut(lch, eps = 0.002) {
  return oklchToLinear(lch).every((c) => c >= -eps && c <= 1 + eps);
}

/** OKLCH → sRGB channels 0–255 (clamped). */
export function oklchToRgb(lch) {
  return oklchToLinear(lch).map((c) => Math.round(clamp01(encode(c)) * 255));
}

export function oklchToHex(lch) {
  return '#' + oklchToRgb(lch).map((c) => c.toString(16).padStart(2, '0')).join('');
}

/** #rrggbb → OKLCH, for converting the palette this system replaced. */
export function hexToOklch(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => decode(c / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(A, B);
  const h = ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return [L, C, C < 1e-4 ? 0 : h];
}

/** WCAG 2.x relative luminance of an OKLCH colour, as a screen shows it (clamped to sRGB). */
export function luminance(lch) {
  const [r, g, b] = oklchToLinear(lch).map((c) => decode(clamp01(encode(c))));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio between two OKLCH colours, 1–21. */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** CSS text for an OKLCH triple: `oklch(96.4% 0.012 84)`. */
export function css([L, C, h]) {
  const pct = +(L * 100).toFixed(1);
  const c = +C.toFixed(3);
  const hue = c === 0 ? 0 : +h.toFixed(1);
  return `oklch(${pct}% ${c} ${hue})`;
}
