// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Set this to your production URL before deploying (also update public/robots.txt).
// Cloudflare Pages default: https://<project>.pages.dev
export default defineConfig({
  site: 'https://blog-for-myself.pages.dev',
  output: 'static',
  /**
   * Preload internal pages before they're clicked, so browsing feels instant.
   * `viewport` covers touch as well as hover (a phone never hovers), and Astro
   * throttles it to idle time and skips it entirely on slow connections or when
   * the visitor has Data Saver on. Pages here are small static HTML, so the
   * bandwidth cost is low and the perceived gain is large.
   */
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
  integrations: [
    mdx(),
    // OG-card image endpoints are routes, not pages — keep them out of the sitemap
    sitemap({ filter: (page) => !page.includes('/og/') }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
