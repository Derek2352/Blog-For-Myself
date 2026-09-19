#!/usr/bin/env node
/**
 * npm run headers — regenerate `public/_headers` from `scripts/http-policy.mjs`.
 *
 * The file it writes is inert on Cloud Run, where the server applies the same policy directly. It
 * is generated anyway for one reason: the hand-kept version pointed at `/_astro/*` — Astro's asset
 * directory — for every deploy after the migration to Next, so the only rule it had matched
 * nothing. A generated file cannot drift from the policy, and a test fails if this has not been run.
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { toHeadersFile } from './http-policy.mjs';

const OUT = fileURLToPath(new URL('../public/_headers', import.meta.url));
await writeFile(OUT, toHeadersFile());
console.log('wrote public/_headers from scripts/http-policy.mjs');
