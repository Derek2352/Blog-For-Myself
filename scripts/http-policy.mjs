/**
 * What headers this site's files are served with — written once, applied everywhere.
 *
 * ## Why this file exists
 *
 * The caching rules lived in `public/_headers`, in Cloudflare Pages' format, and two things were
 * wrong with that. The first is that **the rule had been dead since the migration**: it matched
 * `/_astro/*`, which is where Astro put its hashed assets, and Next puts them under
 * `/_next/static/`. So the one rule whose whole job was "cache the immutable things forever"
 * matched nothing at all, on every deploy, for months — a config that is wrong in a way no build
 * step can see, which is the same failure shape as the `import.meta.glob` that silently returned
 * `{}` and the test that passed for the wrong reason.
 *
 * The second is that `_headers` is **read by Cloudflare Pages and Netlify and by nothing else**.
 * This site is served from Cloud Run, where the file is an inert 300 bytes in the image. Every
 * security header in it — nosniff, Referrer-Policy, X-Frame-Options, Permissions-Policy — has
 * therefore never reached a browser.
 *
 * So the policy moves here, where the server can apply it, and `public/_headers` is *generated*
 * from it (`npm run headers`) so the file stays correct and stays useful if this ever moves to a
 * host that reads it. `tests/http-policy.test.ts` fails if the two drift apart.
 *
 * ## The rules, and why each one
 *
 * The question a cache policy answers is: *if I change this file, how long until a reader sees the
 * change — and if I do not, how long until they stop asking?* Two shapes of answer:
 *
 * - **Content-addressed names** — `/_next/static/chunks/0anb_3ixyf82o.js`, and the fonts beside
 *   it. The hash *is* the version, so the file at that URL can never change. A year, immutable, no
 *   revalidation: the browser must not even ask.
 * - **Stable names** — `/about/index.html`, `/content/entries/x/images/cover.svg`, `/og/*.png`,
 *   the Pagefind index. Same URL, new bytes, every deploy. These must revalidate, or a reader who
 *   visited last week gets last week's site with no way to know.
 *
 * Revalidation is cheap because the server sends an `ETag`: the browser asks, gets a 304 with no
 * body, and a 172KB page costs a few hundred bytes. That is the trade — one round trip in exchange
 * for never serving a stale page.
 *
 * The `.txt` files are Next's RSC payloads, the thing a client-side navigation fetches instead of
 * a whole page. They carry the same policy as HTML *deliberately*: they are a parallel
 * representation of the same content, and a cached payload sitting behind a fresh page is a site
 * that renders two different versions of itself depending on how you arrived at it.
 */

/** A year. The longest value `max-age` is worth setting; past this, browsers round down anyway. */
const YEAR = 31536000;

/**
 * Matched in order, first hit wins. Written as prefix/suffix tests rather than regexes because
 * the same list has to become `_headers` globs, and a regex does not translate.
 */
export const CACHE_RULES = [
  {
    glob: '/_next/static/*',
    test: (p) => p.startsWith('/_next/static/'),
    value: `public, max-age=${YEAR}, immutable`,
    why: 'content-hashed by Next — the URL changes when the bytes do',
  },
  {
    /* Media, by directory rather than by extension — these are prefix tests so they translate to
       `_headers` globs exactly, where extension matching is patchy.
     *
     * An hour, not zero. These are stable-named like the HTML, but a cover or a share card changes
     * only when somebody re-runs `npm run covers`, and an image being an hour out of date harms
     * nobody. Revalidating every one of them on every page view would mean a couple of dozen
     * conditional requests per page to learn that nothing moved — the cost of correctness, spent
     * where correctness was not in question. HTML keeps the strict rule because a stale *page* is
     * how a reader ends up on last week's site without knowing. */
    glob: '/content/*',
    test: (p) => p.startsWith('/content/') || p.startsWith('/og/') || p.startsWith('/assets/'),
    extraGlobs: ['/og/*', '/assets/*'],
    value: 'public, max-age=3600',
    why: 'stable name, changes only when the generators are re-run',
  },
  {
    /* Everything else is stable-named and replaced in place on deploy. `must-revalidate` rather
       than `no-cache`: the browser may reuse it within the same navigation, but must check before
       reusing it later. With an ETag that check is a 304. */
    glob: '/*',
    test: () => true,
    value: 'public, max-age=0, must-revalidate',
    why: 'stable name, new bytes every deploy — always check',
  },
];

/**
 * Applied to every response.
 *
 * Deliberately no Content-Security-Policy. This site inlines its RSC payload and its theme script
 * in `<script>` tags, so a useful CSP needs per-response nonces, which a static file server cannot
 * mint — and a CSP loose enough to allow `unsafe-inline` states a protection it does not provide.
 * Four headers that are true beat five where one is theatre.
 */
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

/** The `Cache-Control` for a URL path. */
export function cacheControlFor(pathname) {
  return CACHE_RULES.find((r) => r.test(pathname)).value;
}

/** Every header for a URL path, security included. */
export function headersFor(pathname) {
  return { ...SECURITY_HEADERS, 'Cache-Control': cacheControlFor(pathname) };
}

/**
 * The same policy as a Cloudflare Pages / Netlify `_headers` file.
 *
 * Generated rather than hand-kept, because a hand-kept copy is what pointed at `/_astro/*` for
 * months. Order matters in that format too — most specific first — which is the order of the list.
 */
export function toHeadersFile() {
  const lines = [
    '# GENERATED by scripts/http-policy.mjs — run `npm run headers` after changing it.',
    '#',
    '# Read by Cloudflare Pages and Netlify. The site is served from Cloud Run, where this file is',
    '# inert and the same policy is applied by scripts/serve-out.mjs instead. Kept generated, and',
    '# correct, so moving host is a deploy rather than a debugging session.',
    '',
  ];
  for (const rule of CACHE_RULES) {
    lines.push(`# ${rule.why}`);
    for (const glob of [rule.glob, ...(rule.extraGlobs ?? [])]) {
      lines.push(glob, `  Cache-Control: ${rule.value}`);
    }
    if (rule.glob === '/*') {
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) lines.push(`  ${k}: ${v}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
