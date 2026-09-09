#!/usr/bin/env node
/**
 * Serve `out/` the way a static host serves it, so the harness fleet can be pointed at the Next
 * build with `BASE_URL`.
 *
 * Two behaviours are the whole reason this is not `npx serve`: **directory index resolution** and
 * **the 404 page**. Every internal link on this site ends in a slash (`trailingSlash: true`, to
 * keep the URLs Astro published), so `/about/` has to resolve to `out/about/index.html`; and an
 * unmatched path has to answer with `out/404.html` and a 404 status, because that is what
 * Cloudflare Pages, Netlify and a static Cloud Run service all do — and two harnesses assert on a
 * real 404 rather than on a redirect.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'out');
const PORT = Number(process.env.PORT ?? 4417);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
};

const send = (res, code, body, type) => {
  res.writeHead(code, { 'Content-Type': type, 'Content-Length': body.length });
  res.end(body);
};

createServer(async (req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  /* Never escape `out/`: resolve, then confirm the result is still inside it. */
  const target = path.normalize(path.join(ROOT, url));
  if (!target.startsWith(ROOT)) return send(res, 403, Buffer.from('forbidden'), 'text/plain');

  for (const candidate of [target, path.join(target, 'index.html'), `${target}.html`]) {
    try {
      const info = await stat(candidate);
      if (!info.isFile()) continue;
      const body = await readFile(candidate);
      return send(res, 200, body, TYPES[path.extname(candidate)] ?? 'application/octet-stream');
    } catch {
      /* try the next shape */
    }
  }

  try {
    return send(res, 404, await readFile(path.join(ROOT, '404.html')), TYPES['.html']);
  } catch {
    return send(res, 404, Buffer.from('not found'), 'text/plain');
  }
}).listen(PORT, () => console.log(`serving out/ on http://localhost:${PORT}`));
