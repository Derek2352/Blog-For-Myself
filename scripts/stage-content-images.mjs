#!/usr/bin/env node
/**
 * Copy every content image into `public/content/…` so the static export can serve it.
 *
 * Astro resolved `./images/cover.svg` itself, hashed the file into `dist/_astro/` and rewrote the
 * reference. A static Next export has no equivalent for a path that arrives as a *string in
 * frontmatter* rather than as an `import`, so the files are staged into `public/` instead and
 * `src/server/content-fs.ts` rewrites the reference to match. The two halves have to agree, which
 * is why the destination shape is written down in one place — `STAGED_PREFIX` there, this script
 * here — and why the harness checks a staged file exists for every cover rather than trusting it.
 *
 * Idempotent, and safe to run before every build. `public/content/` is generated, so it is
 * gitignored: the originals in `src/content/` remain the only copies under version control.
 */
import { cp, rm, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src', 'content');
const DEST = path.join(ROOT, 'public', 'content');

await rm(DEST, { recursive: true, force: true });

let copied = 0;
for (const collection of ['entries', 'logs']) {
  const base = path.join(SRC, collection);
  if (!existsSync(base)) continue;
  for (const dir of await readdir(base, { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name.startsWith('_')) continue;
    const from = path.join(base, dir.name, 'images');
    if (!existsSync(from)) continue;
    const to = path.join(DEST, collection, dir.name, 'images');
    await mkdir(path.dirname(to), { recursive: true });
    await cp(from, to, { recursive: true });
    copied++;
  }
}
/* `src/assets/` too — the portrait on /about/. Astro imported it as a module and let its asset
   pipeline hash and emit it; a static export has no such pipeline for a path that arrives as an
   import, so it is staged exactly like a cover and referenced by URL. */
const ASSETS_SRC = path.join(ROOT, 'src', 'assets');
const ASSETS_DEST = path.join(ROOT, 'public', 'assets');
await rm(ASSETS_DEST, { recursive: true, force: true });
let assets = 0;
if (existsSync(ASSETS_SRC)) {
  await cp(ASSETS_SRC, ASSETS_DEST, { recursive: true });
  assets = (await readdir(ASSETS_SRC)).length;
}

console.log(`staged images for ${copied} item(s) → public/content/, ${assets} asset(s) → public/assets/`);
