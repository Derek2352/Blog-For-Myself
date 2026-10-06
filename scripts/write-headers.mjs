#!/usr/bin/env node
/**
 * npm run headers — regenerate the host-side copies of `scripts/http-policy.mjs`:
 *
 * - `public/_headers`, read by Cloudflare and Netlify (inert on Cloud Run, where the server applies
 *   the policy directly);
 * - the `headers` key of `vercel.json`, because Vercel does not read `_headers`. The rest of that
 *   file is hand-kept build settings and is left exactly as it is.
 *
 * Generated rather than hand-kept for one reason: the hand-kept `_headers` pointed at `/_astro/*` —
 * Astro's asset directory — for every deploy after the migration to Next, so the only rule it had
 * matched nothing. A generated file cannot drift from the policy, and a test fails if this has not
 * been run.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { toHeadersFile, toVercelHeaders } from './http-policy.mjs';

const HEADERS = fileURLToPath(new URL('../public/_headers', import.meta.url));
await writeFile(HEADERS, toHeadersFile());
console.log('wrote public/_headers from scripts/http-policy.mjs');

const VERCEL = fileURLToPath(new URL('../vercel.json', import.meta.url));
const vercel = JSON.parse(await readFile(VERCEL, 'utf8'));
vercel.headers = toVercelHeaders();
await writeFile(VERCEL, `${JSON.stringify(vercel, null, 2)}\n`);
console.log('wrote vercel.json headers from scripts/http-policy.mjs');
