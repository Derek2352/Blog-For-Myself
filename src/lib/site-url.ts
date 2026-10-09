/**
 * The live origin, in one place.
 *
 * Every absolute URL the site writes — canonical links, `og:image`, `og:url`, the JSON-LD `url`,
 * `sitemap.xml`, `rss.xml` and the `Sitemap:` line of `robots.txt` — is built from this. The failure
 * mode if any of them disagree with where the site actually lives is a quiet one: they point at a
 * host that does not serve it, and nothing says so.
 *
 * The default is where the site lives: the Cloudflare Workers deployment. It used to be the AI Studio
 * deployment, https://derekyung.ai.studio, and when that stopped serving the site this was the quiet
 * failure above, exactly: every canonical link, share card, sitemap entry and feed link on the live
 * site pointed at a Google 404. A build for another host sets `SITE_URL` in that host's build
 * environment (Cloudflare, Netlify and Vercel all have a field for it) — but only on the host that
 * *is* the site. A mirror should leave it alone, so its canonical links keep pointing home.
 */
const DEFAULT = 'https://blog-for-myself.mingyinyunggg.workers.dev';

/**
 * An origin, checked. A bad value fails the build here rather than shipping a sitemap full of
 * unreachable links; a path is refused because every asset URL on the site is root-relative, so the
 * site cannot live under one.
 */
export function siteOrigin(raw: string | undefined): string {
  if (!raw) return DEFAULT;
  const url = new URL(raw);
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`SITE_URL must be an origin like https://example.com, not ${raw}`);
  }
  return url.origin;
}

export const SITE_URL = siteOrigin(process.env.SITE_URL);

/** An absolute URL for a site-relative path, for the tags that require one. */
export const absolute = (path: string): string => new URL(path, SITE_URL).toString();
