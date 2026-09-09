/**
 * Tailwind 4 for the Next build.
 *
 * Astro loads Tailwind through `@tailwindcss/vite` (see astro.config.mjs) and Next loads it through
 * PostCSS. Two loaders, but *one stylesheet*: both compile `src/styles/global.css`, so the tokens,
 * the `@theme` block and every component rule stay in a single file for as long as the two builds
 * live side by side. That is the point — a migration where the CSS forks is a migration that ends
 * with two sites.
 */
export default { plugins: { '@tailwindcss/postcss': {} } };
