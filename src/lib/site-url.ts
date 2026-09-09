/**
 * The live origin, in one place.
 *
 * Astro took this from `site:` in `astro.config.mjs` and baked it into every absolute URL it
 * generated — canonical links, `og:image`, `og:url`, the JSON-LD `url`, the sitemap and the RSS
 * feed. Next has no equivalent config field, and the failure mode if the two ever disagree is the
 * quiet one Astro's own comment warns about: all of those point at a host that does not resolve,
 * and nothing says so.
 *
 * So both builds read it from here. `astro.config.mjs` imports this too, which is what makes the
 * agreement structural rather than a thing to remember.
 */
export const SITE_URL = 'https://derekyung.ai.studio';

/** An absolute URL for a site-relative path, for the tags that require one. */
export const absolute = (path: string): string => new URL(path, SITE_URL).toString();
