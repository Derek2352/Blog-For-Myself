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
  integrations: [
    mdx(),
    // OG-card image endpoints are routes, not pages — keep them out of the sitemap
    sitemap({ filter: (page) => !page.includes('/og/') }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
