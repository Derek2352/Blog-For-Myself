#!/usr/bin/env node
/**
 * Compress the built site once, at build time, so the server never compresses anything.
 *
 * ## Why precompute
 *
 * Cloud Run bills CPU by the request. Compressing a 172KB page on the way out costs milliseconds of
 * billed CPU *every time somebody loads it*, and produces a byte-for-byte identical result each
 * time — the same work, paid for again and again, for a site whose pages change only when it is
 * rebuilt. Doing it once in the image turns a per-request cost into a build-time one, and lets the
 * server use the slowest, best Brotli setting rather than the fast one a request budget allows.
 *
 * ## What it is worth here
 *
 * This site ships 15 MB of HTML and 35 MB of RSC payload (`.txt` — what a client-side navigation
 * fetches). Both are text with enormous redundancy: a tag page is 193 KB raw and 58 KB gzipped,
 * and Brotli at quality 11 does better still. Measured on the real output, not estimated — the
 * script prints the totals every run.
 *
 * ## What it does not touch
 *
 * PNG, WOFF2, PDF and JPEG are already compressed; running deflate over them spends CPU to make
 * files marginally larger. And anything under `MIN_BYTES` is skipped: below about a kilobyte the
 * headers and the round trip dominate, and a 200-byte file can easily *grow*.
 *
 * Both encodings are written, not just Brotli. Brotli is near-universal now, but `Accept-Encoding`
 * is the client's statement about itself and a server that ignores it is guessing — gzip is the
 * fallback for anything old or behind a proxy that strips `br`.
 */
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../dist/', import.meta.url));

/** Text formats, where compression is the difference between 193 KB and 58 KB. */
const COMPRESSIBLE = new Set([
  '.html', '.css', '.js', '.mjs', '.json', '.txt', '.svg', '.xml', '.webmanifest', '.map',
]);

/**
 * Below this, compression is not worth a second file on disk and often is not worth doing at all —
 * gzip's own header is 18 bytes and Brotli's dictionary shines only once there is text to match
 * against. 1 KB is the usual floor and it is where this stops paying.
 */
const MIN_BYTES = 1024;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

let files = 0;
let raw = 0;
let gz = 0;
let br = 0;
let skipped = 0;

for await (const file of walk(ROOT)) {
  const ext = path.extname(file).toLowerCase();
  /* Never compress an already-compressed artefact of a previous run. */
  if (ext === '.gz' || ext === '.br') continue;
  if (!COMPRESSIBLE.has(ext)) { skipped++; continue; }
  const info = await stat(file);
  if (info.size < MIN_BYTES) { skipped++; continue; }

  const body = await readFile(file);
  /* Level 9 and quality 11 — the slowest settings either algorithm has. Affordable exactly because
     this runs once per build rather than once per request, which is the whole argument for the
     file existing. */
  const g = gzipSync(body, { level: 9 });
  const b = brotliCompressSync(body, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 11,
      [constants.BROTLI_PARAM_SIZE_HINT]: body.length,
    },
  });

  /* Only keep a variant that actually helps. A file that compresses to more than 95% of itself is
     one the server would be paying to decode for nothing. */
  if (g.length < body.length * 0.95) { await writeFile(`${file}.gz`, g); gz += g.length; } else gz += body.length;
  if (b.length < body.length * 0.95) { await writeFile(`${file}.br`, b); br += b.length; } else br += body.length;

  files++;
  raw += body.length;
}

const mb = (n) => (n / 1048576).toFixed(1);
const pct = (n) => (raw ? ((n / raw) * 100).toFixed(0) : '0');
console.log(
  `precompressed ${files} files (${skipped} skipped): ` +
    `${mb(raw)} MB → gzip ${mb(gz)} MB (${pct(gz)}%), brotli ${mb(br)} MB (${pct(br)}%)`,
);
