/**
 * The design system's one rule, enforced: values come from tokens.
 *
 * Before src/design/tokens.mjs, the stylesheets held 75 raw colours, 30 hand-mixed shadows and 40
 * inline easing curves, and the markup seventeen font sizes — each a reasonable decision made in one
 * place, and together a palette nobody could see whole. Writing the tokens down fixed that once. This
 * keeps it fixed: a raw colour, a hand-written curve or a one-off type size anywhere outside the token
 * file fails the build, with the place it was written.
 *
 * What is deliberately *not* a raw colour:
 * - comments, which discuss colours by value all the time;
 * - `mask-image` stops, where `#000` is an alpha channel and not a colour anyone sees;
 * - `hsl()` whose hue is a variable — a category's wash, a game tile's hue — where the colour is data;
 * - `transparent`, `currentColor`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const STYLES = 'src/styles';
const sheets = readdirSync(STYLES)
  .filter((f) => f.endsWith('.css') && f !== 'tokens.css')
  .map((f) => [f, readFileSync(join(STYLES, f), 'utf8')] as const);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : [];
  });
}
const markup = walk('src').map((f) => [f, readFileSync(f, 'utf8')] as const);

/** Blank comments (keeping line numbers), and drop mask declarations, whose colours are alpha. */
function code(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .replace(/(?:-webkit-)?mask(?:-image)?\s*:[^;]*;/g, (d) => d.replace(/[^\n]/g, ' '));
}
const lineOf = (s: string, i: number) => s.slice(0, i).split('\n').length;

describe('the stylesheets take their values from the tokens', () => {
  it('has stylesheets to check at all', () => {
    expect(sheets.length).toBeGreaterThan(3);
  });

  it('names no colour of its own', () => {
    const raw: string[] = [];
    const COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(\s*[\d.]|\b(?:oklch|oklab|lab|lch)\(\s*[\d.]/g;
    for (const [f, css] of sheets) {
      const c = code(css);
      for (const m of c.matchAll(COLOUR)) raw.push(`${f}:${lineOf(c, m.index!)}  ${m[0]}`);
    }
    expect(raw, `raw colours — use a token from src/design/tokens.mjs:\n${raw.join('\n')}`).toEqual([]);
  });

  it('writes no easing curve of its own', () => {
    const raw: string[] = [];
    for (const [f, css] of sheets) {
      const c = code(css);
      for (const m of c.matchAll(/cubic-bezier\(/g)) raw.push(`${f}:${lineOf(c, m.index!)}`);
    }
    expect(raw, `inline curves — use var(--ease-*):\n${raw.join('\n')}`).toEqual([]);
  });
});

describe('the markup takes its type from the roles', () => {
  it('sets no one-off font size or leading', () => {
    const raw: string[] = [];
    for (const [f, src] of markup) {
      for (const m of src.matchAll(/\b(?:text-\[\d*\.?\d+(?:rem|px)\]|leading-\[[^\]]+\])/g))
        raw.push(`${f}:${lineOf(src, m.index!)}  ${m[0]}`);
    }
    expect(raw, `one-off type — use a role (text-heading, text-quote…):\n${raw.join('\n')}`).toEqual([]);
  });

  it('names no colour in a class', () => {
    const raw: string[] = [];
    for (const [f, src] of markup) {
      for (const m of src.matchAll(/\b(?:bg|text|border|fill|stroke|from|to|via|ring|outline)-\[#[0-9a-fA-F]+\]/g))
        raw.push(`${f}:${lineOf(src, m.index!)}  ${m[0]}`);
    }
    expect(raw).toEqual([]);
  });
});
