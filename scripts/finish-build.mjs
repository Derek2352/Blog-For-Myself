#!/usr/bin/env node
/**
 * Move `out/` to `dist/`, so the deploy contract does not change with the framework.
 *
 * Astro built to `dist/`, and the host — Cloudflare Pages today, Cloud Run via Google AI Studio —
 * is configured with that directory name. Next's `output: 'export'` always writes to `out/` and
 * offers no setting for it.
 *
 * That leaves two options, and this is the safer one. Renaming here means the build command
 * (`npm run build`) and the output directory (`dist`) are both exactly what they were, so the
 * migration needs **no change to any hosting configuration** and cannot break a deploy by being
 * forgotten. The alternative — publish `out/` and ask for the host setting to be updated — is one
 * manual step whose failure mode is a live site serving the previous build, or nothing.
 *
 * It is a move rather than a copy on purpose: exactly one output directory exists when the build
 * finishes, so there is never a stale `out/` to deploy by mistake.
 */
import { rm, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const OUT = path.join(process.cwd(), 'out');
const DIST = path.join(process.cwd(), 'dist');

if (!existsSync(OUT)) {
  console.error('no out/ to publish — did `next build` run?');
  process.exit(1);
}
await rm(DIST, { recursive: true, force: true });
await rename(OUT, DIST);
console.log('published out/ → dist/');
