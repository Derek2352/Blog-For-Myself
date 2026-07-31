// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import remarkStripComments from './plugins/remark-strip-comments.mjs';
import { paperLight, paperDark } from './plugins/shiki-paper-theme.mjs';

// The live origin. Astro bakes this into every absolute URL it generates —
// canonical links, og:image and twitter:image, og:url, the JSON-LD `url`, the
// sitemap and the RSS feed. If it doesn't match where the site is actually
// served, all of those point at a host that doesn't resolve and the build says
// nothing. Change it here and in public/robots.txt together.
export default defineConfig({
  site: 'https://derekyung.ai.studio',
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
  markdown: {
    // Authoring notes live in the .md bodies as <!-- … --> comments. Markdown
    // ships those verbatim, so without this the scaffolding behind each entry
    // ("FIRST-PASS DRAFT", "Placeholder — rewrite this honestly") is readable in
    // the published page source. Strip them at build time instead of relying on
    // remembering to delete each one.
    remarkPlugins: [remarkStripComments],
    /**
     * Shiki's default single theme bakes `background-color` and `color` into an
     * inline style on the <pre>, which beats the stylesheet and drops a slab of
     * GitHub-dark grey into the middle of a cream paper page. `defaultColor:
     * false` emits `--shiki-light` / `--shiki-dark` custom properties instead
     * and applies nothing itself, so global.css keeps the container in the site
     * palette while token colours still follow the theme (see
     * `.prose-reflection pre.astro-code`).
     *
     * The themes are ours rather than GitHub's: on this site's surfaces the
     * bundled ones fail contrast (details in plugins/shiki-paper-theme.mjs).
     */
    shikiConfig: {
      themes: { light: paperLight, dark: paperDark },
      defaultColor: false,
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
