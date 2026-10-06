import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  CACHE_RULES,
  SECURITY_HEADERS,
  cacheControlFor,
  headersFor,
  toHeadersFile,
  toVercelHeaders,
} from '../scripts/http-policy.mjs';

/**
 * The headers this site is served with, and the file that mirrors them.
 *
 * `public/_headers` was hand-kept, and it pointed at `/_astro/*` — Astro's asset directory — for
 * every deploy after the migration to Next, which puts hashed assets under `/_next/static/`. The
 * one rule whose job was "cache the immutable things forever" therefore matched nothing, on every
 * deploy, for months. Nothing could catch it: the file is data, read by a host, and a wrong path in
 * it looks exactly like a right one.
 *
 * So the policy is code now, the file is generated from it, and these hold the two together.
 */
describe('the header policy', () => {
  it('caches content-hashed assets forever and nothing else', () => {
    expect(cacheControlFor('/_next/static/chunks/0anb_3ixyf82o.js')).toContain('immutable');
    expect(cacheControlFor('/_next/static/media/inter-cyrillic.woff2')).toContain('immutable');
    // Everything below is stable-named — same URL, new bytes on the next deploy.
    for (const p of ['/', '/about/', '/index.html', '/tags/index.txt', '/sitemap.xml']) {
      expect(cacheControlFor(p), p).toBe('public, max-age=0, must-revalidate');
    }
  });

  it('gives generated media an hour, because revalidating each one per page view buys nothing', () => {
    for (const p of [
      '/content/entries/x/images/cover.svg',
      '/og/entry-x.png',
      '/assets/portrait.svg',
    ]) {
      expect(cacheControlFor(p), p).toBe('public, max-age=3600');
    }
  });

  it('never points at /_astro/ again', () => {
    // The actual bug, named. An asset path from the previous framework is not a thing to rediscover.
    const file = toHeadersFile();
    expect(file).not.toContain('_astro');
    expect(CACHE_RULES.some((r) => r.glob.includes('_astro'))).toBe(false);
    // And the rule that replaced it is really there.
    expect(file).toContain('/_next/static/*');
  });

  it('puts the security headers on every response', () => {
    const h = headersFor('/anything/');
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) expect(h[k]).toBe(v);
    // Including on an immutable asset — these are about the response, not about caching.
    expect(headersFor('/_next/static/x.js')['X-Content-Type-Options']).toBe('nosniff');
  });

  it('matches the committed public/_headers', () => {
    /* The enforcement. `npm run headers` regenerates the file; if this fails, somebody edited the
       generated copy by hand or changed the policy without regenerating — which is exactly how the
       _astro rule outlived the framework that needed it. */
    const onDisk = readFileSync(path.join(process.cwd(), 'public', '_headers'), 'utf8');
    expect(onDisk).toBe(toHeadersFile());
  });

  it('orders the rules most-specific first, because the server takes the first match', () => {
    // The server does `.find()`. A `/*` rule placed above the others would silently swallow every
    // specific one.
    expect(CACHE_RULES.at(-1)?.glob).toBe('/*');
    expect(CACHE_RULES.findIndex((r) => r.glob === '/_next/static/*')).toBe(0);
  });

  it('never sends one header twice from the _headers file, because Cloudflare would join them', () => {
    /* Cloudflare applies every rule whose glob matches, and "if a header is applied twice in the
       `_headers` file, the values are joined with a comma separator". The first generated file
       set Cache-Control on both `/_next/static/*` and `/*`, so a hashed script would have gone out
       as `…immutable, public, max-age=0, must-revalidate`. This reads the file the way that host
       does — every matching block, every header — and checks what a browser would actually get. */
    const blocks: { re: RegExp; headers: [string, string][] }[] = [];
    for (const line of toHeadersFile().split('\n')) {
      if (line.startsWith('/')) {
        const re = new RegExp(`^${line.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
        blocks.push({ re, headers: [] });
      } else if (line.startsWith('  ')) {
        const [k, ...v] = line.trim().split(': ');
        blocks.at(-1)!.headers.push([k, v.join(': ')]);
      }
    }
    const served = (p: string) => {
      const got = new Map<string, string[]>();
      for (const b of blocks.filter((b) => b.re.test(p))) {
        for (const [k, v] of b.headers) got.set(k, [...(got.get(k) ?? []), v]);
      }
      return got;
    };
    const HOST_DEFAULT = 'public, max-age=0, must-revalidate';
    for (const p of [
      '/_next/static/chunks/0anb_3ixyf82o.js',
      '/content/entries/x/images/cover.svg',
      '/og/entry-x.png',
      '/assets/portrait.svg',
      '/',
      '/about/',
      '/tags/index.txt',
    ]) {
      const got = served(p);
      for (const [k, vs] of got) expect(vs, `${p} ${k}`).toHaveLength(1);
      // What the browser ends up with is the policy: ours where we set one, the host's otherwise.
      expect(got.get('Cache-Control')?.[0] ?? HOST_DEFAULT, p).toBe(cacheControlFor(p));
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) expect(got.get(k), `${p} ${k}`).toEqual([v]);
    }
  });

  it('gives vercel.json the same policy, because Vercel does not read _headers', () => {
    const onDisk = JSON.parse(readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf8'));
    expect(onDisk.headers).toEqual(toVercelHeaders());
    // And the same discipline: the catch-all leaves Cache-Control to the host.
    const all = onDisk.headers.find((h: { source: string }) => h.source === '/(.*)');
    expect(all.headers.map((h: { key: string }) => h.key)).not.toContain('Cache-Control');
    expect(onDisk.headers[0]).toEqual({
      source: '/_next/static/(.*)',
      headers: [{ key: 'Cache-Control', value: cacheControlFor('/_next/static/x.js') }],
    });
  });
});
