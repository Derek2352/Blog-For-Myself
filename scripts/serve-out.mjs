#!/usr/bin/env node
/**
 * Serve the built site — as the preview server locally, and as the real one on Cloud Run.
 *
 * One server for both, deliberately. The harness fleet drives this on 4416 and asserts on its
 * directory resolution and its 404; the container runs the same file on `$PORT`. If they were two
 * programs, the thing thirty-eight harnesses measure would not be the thing readers get.
 *
 * ## The behaviours that make this not `npx serve`
 *
 * **Directory index resolution.** Every internal link ends in a slash (`trailingSlash: true`, to
 * keep the URLs the site has always published), so `/about/` resolves to `dist/about/index.html`.
 *
 * **A real 404.** An unmatched path answers with `dist/404.html` and a 404 status, because that is
 * what Cloudflare Pages, Netlify and a static Cloud Run service all do — and two harnesses assert
 * on a real 404 rather than a redirect.
 *
 * **Precompressed variants.** `scripts/precompress.mjs` writes `.br` and `.gz` beside each text
 * file at build time; this picks one per `Accept-Encoding` and serves it with `Content-Encoding`.
 * The server never compresses anything itself — see that file for why paying per request for a
 * byte-identical result is the wrong trade on a host that bills CPU.
 *
 * **Headers from one policy.** `scripts/http-policy.mjs` owns them. They used to live in
 * `public/_headers`, which Cloud Run does not read, so none of them had ever reached a browser.
 *
 * **ETags, so `must-revalidate` is cheap.** HTML is served `max-age=0, must-revalidate`, which
 * would be a full re-download of a 172KB page on every visit without one. With it, the browser
 * asks and usually gets a 304 and no body.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { headersFor } from './http-policy.mjs';

const ROOT = path.join(process.cwd(), 'dist');
/* Cloud Run supplies PORT and it is not negotiable; 4416 is what the harness fleet expects. */
const PORT = Number(process.env.PORT ?? 4416);
/* Explicit, because a container that binds only loopback accepts nothing from outside itself —
   the single most common way a working image serves no traffic. */
const HOST = process.env.HOST ?? '0.0.0.0';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
};

/**
 * Weak ETags, hashed from the *uncompressed* bytes and cached in memory.
 *
 * Weak (`W/`) and keyed on the original rather than on the encoding actually sent, because gzip and
 * Brotli of one page are the same page — `Vary: Accept-Encoding` is what tells caches the encodings
 * differ, and a strong ETag would have to be per-encoding to stay honest about byte equality.
 *
 * Cached, and filled lazily rather than at startup: hashing 56 MB before accepting a connection is
 * cold-start latency on every scale-to-zero wake, paid whether or not anyone asks for those files.
 */
const etags = new Map();
async function etagFor(file, size, mtimeMs) {
  const key = `${file}:${size}:${mtimeMs}`;
  const hit = etags.get(key);
  if (hit) return hit;
  const tag = `W/"${createHash('sha1').update(await readFile(file)).digest('base64url').slice(0, 27)}"`;
  etags.set(key, tag);
  return tag;
}

/** The best encoding this client accepts and we have on disk. */
async function pickEncoding(file, accept) {
  const offers = [
    ['br', '.br'],
    ['gzip', '.gz'],
  ];
  for (const [token, ext] of offers) {
    if (!accept.includes(token)) continue;
    try {
      const info = await stat(file + ext);
      if (info.isFile()) return { encoding: token, file: file + ext, size: info.size };
    } catch {
      /* no precompressed variant for this file — try the next, then fall back to raw */
    }
  }
  return null;
}

async function serveFile(req, res, file, urlPath, status = 200) {
  const info = await stat(file);
  const type = TYPES[path.extname(file)] ?? 'application/octet-stream';
  const tag = await etagFor(file, info.size, info.mtimeMs);
  const head = {
    ...headersFor(urlPath),
    'Content-Type': type,
    ETag: tag,
    /* Stated whether or not a variant exists: the response for this URL *does* depend on the
       header, and a shared cache that learned otherwise from one uncompressed reply would go on
       serving it to clients that could have had Brotli. */
    Vary: 'Accept-Encoding',
  };

  /* The whole point of the ETag: 172KB of page becomes a few hundred bytes of "nothing moved". */
  if (req.headers['if-none-match'] === tag) {
    res.writeHead(304, head);
    return res.end();
  }

  const chosen = await pickEncoding(file, String(req.headers['accept-encoding'] ?? ''));
  if (chosen) {
    head['Content-Encoding'] = chosen.encoding;
    head['Content-Length'] = chosen.size;
    res.writeHead(status, head);
    return res.end(req.method === 'HEAD' ? undefined : await readFile(chosen.file));
  }

  head['Content-Length'] = info.size;
  res.writeHead(status, head);
  return res.end(req.method === 'HEAD' ? undefined : await readFile(file));
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD', 'Content-Length': 0 });
    return res.end();
  }

  const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
  /* Never escape the build directory: resolve, then confirm the result is still inside it. */
  const target = path.normalize(path.join(ROOT, urlPath));
  if (!target.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain', 'Content-Length': 9 });
    return res.end('forbidden');
  }

  for (const candidate of [target, path.join(target, 'index.html'), `${target}.html`]) {
    try {
      const info = await stat(candidate);
      if (!info.isFile()) continue;
      return await serveFile(req, res, candidate, urlPath);
    } catch {
      /* try the next shape */
    }
  }

  try {
    return await serveFile(req, res, path.join(ROOT, '404.html'), urlPath, 404);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain', 'Content-Length': 9 });
    return res.end('not found');
  }
});

server.listen(PORT, HOST, () => console.log(`serving dist/ on http://${HOST}:${PORT}`));

/* Cloud Run sends SIGTERM and then waits; without this the process is killed mid-response and the
   platform logs it as a crash rather than a shutdown. */
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
