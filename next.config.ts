import type { NextConfig } from 'next';

/**
 * Next, configured to produce exactly what the Astro build produced: a directory of static files.
 *
 * `output: 'export'` is the whole of the hosting decision. The site is served from Cloud Run via
 * Google AI Studio, which runs containers and would happily run a Node server — so the constraint
 * is not the host. It is that a server buys nothing here. Every page on this site is derivable at
 * build time from markdown in `src/content/`, and the one feature in the Next.js drops that needed
 * a backend was a like counter, which would have meant a Cloud SQL instance billing around the
 * clock to store integers. A static export costs nothing to serve, cannot fall over, and keeps the
 * deploy identical to the one that already works.
 *
 * The cost, stated plainly so it is not rediscovered later: no route handlers, no server actions,
 * no ISR, no middleware. RSS, the sitemap and the OG share cards are all *generated at build time*
 * instead (see `scripts/`), which is what Astro was doing anyway.
 */
const nextConfig: NextConfig = {
  output: 'export',

  /* Astro owns `dist/`; keep the two build outputs from ever meeting. */
  distDir: '.next',

  /**
   * **`src/pages/` belongs to Astro, and Next also claims it.**
   *
   * Next's Pages Router reads `src/pages/` when it exists, alongside the App Router — so the first
   * `next build` walked straight into Astro's routes and tried to bundle `src/pages/rss.xml.js`,
   * which imports Astro's container API, which pulls in esbuild, which requires `os` and
   * `worker_threads` in a browser bundle. The error it produced named `resvg` and `module-not-found`
   * and said nothing about the actual cause.
   *
   * Restricting page extensions to `.tsx` resolves it exactly: every App Router file this build
   * owns is a `.tsx`, and nothing in Astro's `src/pages/` is — they are `.astro`, `.ts` and `.js`.
   * So the two routers cannot see each other's files even while sharing a parent directory. This
   * stops mattering at the cutover, when `src/pages/` goes away; until then it is what lets both
   * builds run from one tree.
   */
  pageExtensions: ['tsx'],

  /**
   * Trailing slashes, because the Astro site has them and links are forever. Astro's default
   * `build.format: 'directory'` emits `/about/index.html`, so every internal link, every canonical
   * URL, the sitemap and every share card already say `/about/`. Turning this off would silently
   * 301 (or 404, depending on the host) every URL anyone has ever bookmarked or that Google has
   * indexed.
   */
  trailingSlash: true,

  /**
   * Required by `output: 'export'` — there is no server to run the optimiser. No loss here: the
   * covers are SVG, and the photographs are already sized by `scripts/photo-plan.mjs`.
   */
  images: { unoptimized: true },

  /* The build is the gate. A type error must stop it, exactly as `astro check` did — and it
     already has, twice, which is the argument for leaving it this way. */
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
