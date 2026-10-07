#!/usr/bin/env node
/**
 * npm run art — the site's art, built and lit in Blender.
 *
 *   npm run art                 render whatever is missing or out of date
 *   npm run art -- --force      render everything again
 *   npm run art -- <slug|file>  only the targets whose path contains this (also `cat`, `icon`)
 *
 * Every entry cover is a studio still life (art/blender/scenes.py): the template the entry's
 * `art:` names, seeded with its slug, on a sweep the colour of its category, rendered twice —
 * window light for the light theme, lamplight for the dark. The portrait slot on /about/ is the
 * same studio's empty frame. Then the cat, part by part (scripts/render-cat.mjs), and the app
 * icons.
 *
 * The flat drawing from `npm run covers` stays the cover's identity: it is what carries the
 * template mark, the title and the entry's seed, it is kept inside the rendered file, and it is the
 * fallback until a render exists. A render records `sceneKey(drawing, scenes.py)`, so a target
 * whose drawing and scene builder are unchanged is skipped.
 *
 * The Ah Gaap gallery frames are not rendered: they are placeholders for screenshots that will
 * replace them, and dressing a placeholder as finished art would misdescribe it.
 *
 * Needs Blender as a Python module: `pip install -r art/blender/requirements.txt` into a Python
 * 3.11 environment, and `BLENDER_PYTHON` pointing at that interpreter if it is not `python3`.
 * Cycles on the CPU: about a minute a cover, both themes, on four cores.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { isArtSVG, isPlateSVG, artTemplateOf } from './cover-plate.mjs';
import { artMeta } from './cover-art.mjs';
import { isRenderedSVG, renderedFrom, vectorInside, vectorKey, sceneKey, wrapRender } from './art-render.mjs';
import { loadCategories, categoryHue } from './lib.mjs';
import { renderCat } from './render-cat.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PY = process.env.BLENDER_PYTHON ?? 'python3';
const DIORAMA = path.join(ROOT, 'art', 'blender', 'diorama.py');
const SCENES = path.join(ROOT, 'art', 'blender', 'scenes.py');

/**
 * Output size. A cover is shown at most ~1100 CSS px wide (the entry page) and ~400 on a card;
 * 1440 serves the first at 1.3× and a card at 3.6×.
 */
const WIDTH = 1440;
const WEBP = { quality: 82, effort: 6, smartSubsample: true };
const SAMPLES = Number(process.env.ART_SAMPLES ?? 64);
/** The portrait washes with the about page's hue (see redraw-covers.mjs). */
const PORTRAIT_HUE = 32;

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter((a) => !a.startsWith('--'));

/** The scene builder letters in the site's own faces: woff2 from node_modules, as TrueType. */
function fonts(dir) {
  const want = {
    MONO: '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2',
    SERIF: '@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2',
  };
  const env = {};
  for (const [k, rel] of Object.entries(want)) {
    const out = path.join(dir, `${k.toLowerCase()}.ttf`);
    const r = spawnSync(PY, ['-I', '-c', 'import sys\nfrom fontTools.ttLib import TTFont\nf=TTFont(sys.argv[1]); f.flavor=None; f.save(sys.argv[2])', path.join(ROOT, 'node_modules', rel), out], { encoding: 'utf8' });
    if (r.status === 0) env[`ART_FONT_${k}`] = out;
    else console.warn(`  (no ${k.toLowerCase()} font: ${r.stderr.trim().split('\n').pop()}; Blender's own face will stand in)`);
  }
  return env;
}

function scene(args, env) {
  const r = spawnSync(PY, ['-I', SCENES, ...args], { encoding: 'utf8', maxBuffer: 64 << 20, env: { ...process.env, ...env } });
  if (r.status !== 0) {
    const tail = `${r.stdout ?? ''}\n${r.stderr ?? ''}`.split('\n').filter((l) => !l.startsWith('Fra:')).slice(-25).join('\n');
    throw new Error(`Blender failed (${args.join(' ')})${r.error ? ` (${r.error.message})` : ''}:\n${tail}\n\nIs bpy installed? pip install -r art/blender/requirements.txt, and set BLENDER_PYTHON.`);
  }
}

/** Every cover to render: the entries that draw art, and the portrait slot. */
async function targets() {
  const { cats } = await loadCategories();
  const out = [];
  const entries = path.join(ROOT, 'src', 'content', 'entries');
  for (const slug of readdirSync(entries).sort()) {
    const md = path.join(entries, slug, 'index.md');
    const file = path.join(entries, slug, 'images', 'cover.svg');
    if (!existsSync(md) || !existsSync(file)) continue;
    const front = readFileSync(md, 'utf8');
    const art = /^art:\s*"([^"]+)"/m.exec(front)?.[1];
    if (!art) continue;
    out.push({
      file,
      slug,
      template: art,
      hue: categoryHue(cats, /^category:\s*"([^"]+)"/m.exec(front)?.[1]) ?? 32,
      location: /^location:\s*"([^"]+)"/m.exec(front)?.[1],
      title: artMeta(art)?.alt,
    });
  }
  out.push({
    file: path.join(ROOT, 'src', 'assets', 'portrait.svg'),
    slug: 'portrait',
    template: 'portrait',
    hue: PORTRAIT_HUE,
    title: 'An empty gallery frame with its mat, waiting for a portrait photograph.',
  });
  return out;
}

const scenesSource = readFileSync(SCENES, 'utf8');
const tmp = mkdtempSync(path.join(tmpdir(), 'render-art-'));
let rendered = 0;
let current = 0;
try {
  const env = fonts(tmp);
  for (const t of await targets()) {
    const rel = path.relative(ROOT, t.file);
    if (only.length && !only.some((o) => rel.includes(o))) continue;
    const text = readFileSync(t.file, 'utf8');
    const vector = isRenderedSVG(text) ? vectorInside(text) : text;
    if (!vector || !(isArtSVG(vector) || isPlateSVG(vector))) {
      console.log(`  keep    ${rel} (not a drawing this project made)`);
      continue;
    }
    if (t.template !== 'portrait' && artTemplateOf(vector) !== t.template) {
      console.log(`  stale   ${rel} draws ${artTemplateOf(vector)} but asks for ${t.template} — run npm run covers first`);
      continue;
    }
    const key = sceneKey(vector, scenesSource);
    if (!force && isRenderedSVG(text) && renderedFrom(text) === key) {
      current++;
      continue;
    }
    const t0 = Date.now();
    const pngs = {};
    for (const theme of ['light', 'dark']) {
      pngs[theme] = path.join(tmp, `${theme}.png`);
      scene(
        ['--template', t.template, '--theme', theme, '--seed', t.slug, '--hue', String(t.hue), '--out', pngs[theme],
         ...(t.template === 'portrait' ? ['--width', '900', '--height', '1125'] : ['--width', String(WIDTH)]),
         '--samples', String(SAMPLES), ...(t.location ? ['--location', t.location] : [])],
        env,
      );
    }
    const [light, dark] = await Promise.all(
      ['light', 'dark'].map((k) => sharp(pngs[k]).webp(WEBP).toBuffer()),
    );
    writeFileSync(t.file, wrapRender({ vector, light, dark, key, title: t.title, texts: false }));
    rendered++;
    console.log(`  render  ${rel.padEnd(72)} ${Math.round((light.length + dark.length) / 1024)} KB  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
console.log(`\nrendered ${rendered}, already current ${current}`);
if (!only.length || only.includes('cat')) await renderCat({ force });
if (!only.length || only.includes('icon')) await renderIcons();

/**
 * The app icons, from `public/favicon.svg`: the rounded tile as a card seen square-on, the frame
 * a rolled tube, the dot raised (`--mode icon`). The favicon itself stays vector — at 16 px a lit
 * form is noise, and the browser tab is the one place the flat mark reads better.
 *
 * Drawn at 512 by scaling the favicon's 32-unit drawing ×16 first, so the renderer's card and
 * bevel sizes (in drawing units) mean the same thing on an icon as on a cover.
 */
async function renderIcons() {
  const favicon = readFileSync(path.join(ROOT, 'public', 'favicon.svg'), 'utf8');
  const key = vectorKey(favicon + readFileSync(DIORAMA, 'utf8'));
  const keyFile = path.join(ROOT, 'art', 'icon.key');
  if (!force && existsSync(keyFile) && readFileSync(keyFile, 'utf8').trim() === key) {
    console.log('icons: current');
    return;
  }
  const inner = favicon.slice(favicon.indexOf('>') + 1, favicon.lastIndexOf('</svg>'));
  const work = mkdtempSync(path.join(tmpdir(), 'render-icon-'));
  try {
    const svg = path.join(work, 'icon.svg');
    writeFileSync(svg, `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><g transform="scale(16)">${inner}</g></svg>`);
    const png = path.join(work, 'icon.png');
    const r = spawnSync(PY, ['-I', DIORAMA, '--mode', 'icon', '--svg', svg, '--out', png, '--width', '512', '--samples', String(SAMPLES)], { encoding: 'utf8', maxBuffer: 64 << 20 });
    if (r.status !== 0) throw new Error(`Blender failed on the icon:\n${(r.stderr || r.stdout).slice(-2000)}`);
    const pub = (f) => path.join(ROOT, 'public', f);
    await sharp(png).png({ compressionLevel: 9, palette: false }).toFile(pub('icon-512.png'));
    await sharp(png).resize(192).png({ compressionLevel: 9 }).toFile(pub('icon-192.png'));
    // iOS paints a transparent corner black and rounds the icon itself, so the touch icon is the
    // tile's own colour to the edge.
    const tile = /<rect[^>]*fill="(#[0-9a-fA-F]{6})"/.exec(favicon)?.[1] ?? '#8e2f45';
    await sharp(png).flatten({ background: tile }).resize(180).png({ compressionLevel: 9 }).toFile(pub('apple-touch-icon.png'));
    writeFileSync(keyFile, `${key}\n`);
    console.log('icons: rendered icon-512, icon-192, apple-touch-icon');
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
