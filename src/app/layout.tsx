/**
 * The root layout — `Base.astro`'s head, chrome and boot script.
 *
 * Three things here are not line-for-line translations, and each is a real difference between the
 * two frameworks rather than a preference:
 *
 *  1. **`transition:persist` is gone, and not needed.** Astro swaps whole documents, so the cat
 *     and its card had to be *marked* to survive a navigation. The App Router keeps the layout
 *     mounted and replaces only the page beneath it, so anything rendered here persists by
 *     construction. That is the single biggest simplification in the migration, and it applies to
 *     exactly the components that were hardest to keep alive before.
 *  2. **The head is data, not markup.** `generateMetadata` replaces the block of `<meta>` tags.
 *     The one thing it cannot express is a script that must run *before first paint*, which is why
 *     the theme boot below is still raw HTML — see its own note.
 *  3. **`Astro.url` does not exist during a static export.** Anything that needed the current path
 *     — the canonical link, the header's active tab — now either receives it as a prop from the
 *     page that knows it, or reads it on the client. Nothing guesses.
 */
import type { Metadata, Viewport } from 'next';
import '@fontsource/instrument-serif';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/inter';
import '@fontsource/ibm-plex-mono';
import '@fontsource/ibm-plex-mono/500.css';
import '@/styles/global.css';
import { site } from '@/data/site';
import { SITE_URL } from '@/lib/site-url';
import { A11Y_KEYS } from '@/lib/a11y-prefs';
import { isDraftPreviewBuild } from '@/server/content';
import RouteEffects from './_chrome/RouteEffects';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    /* Astro's two cases: a page with a title gets "Title — Derek Yung", one without gets the
       full masthead line. `template` and `default` are exactly that pair. */
    template: `%s — ${site.title}`,
    default: `${site.title} — Portfolio & Log`,
  },
  description: site.description,
  authors: [{ name: site.name }],
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  alternates: {
    types: { 'application/rss+xml': `${SITE_URL}/rss.xml` },
  },
  openGraph: {
    siteName: site.title,
    type: 'website',
    images: [{ url: '/og/site.png', alt: site.title }],
  },
  twitter: { card: 'summary_large_image' },
  /* Draft-preview deploys must never be indexed if the URL leaks. A page that opts out on its own
     account passes `noindex` through its own metadata and keeps `follow`, because it is thin
     rather than secret. */
  ...(isDraftPreviewBuild ? { robots: { index: false, follow: false } } : {}),
};

export const viewport: Viewport = {
  /* Keyed to the theme actually rendered, not the OS preference — light is the default, so a
     media-keyed value would tint a phone's address bar dark above a light page. The boot script
     re-syncs it from `--color-ground` so the two hexes live in exactly one place. */
  themeColor: '#f9f4ea',
  colorScheme: 'light dark',
};

/**
 * Theme and accessibility modes, applied before first paint.
 *
 * This has to be a raw `<script>` in the document rather than an effect: an effect runs after
 * hydration, and a visitor who chose dark would get a flash of the cream page first. It is the one
 * place in the migration where markup beats the framework's abstraction, and it is the same
 * reasoning Astro's `is:inline` had.
 *
 * Unlike Astro's version there is no `astro:after-swap` listener: the App Router never replaces
 * `<html>`, so the classes it sets are never wiped and never need re-applying.
 */
const themeBoot = `
(() => {
  const syncThemeColor = () => {
    const ground = getComputedStyle(document.documentElement).getPropertyValue('--color-ground').trim();
    if (ground) document.getElementById('theme-color')?.setAttribute('content', ground);
    else document.addEventListener('DOMContentLoaded', syncThemeColor, { once: true });
  };
  try {
    // Light is the default: dark is opt-in through the toggle, so a visitor whose device is in
    // dark mode still lands on the paper look the site is built around. A missing key reads light.
    document.documentElement.classList.toggle('dark', localStorage.getItem('theme') === 'dark');
    for (const k of ${JSON.stringify(A11Y_KEYS)}) {
      document.documentElement.classList.toggle('a11y-' + k, localStorage.getItem('a11y-' + k) === '1');
    }
  } catch {}
  document.documentElement.classList.add('js');
  syncThemeColor();
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta name="theme-color" id="theme-color" content="#f9f4ea" />
        <link rel="sitemap" href="/sitemap.xml" />
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink"
        >
          Skip to content
        </a>
        {isDraftPreviewBuild && (
          <p className="rail border-b border-signal/50 bg-signal/15 px-4 py-1.5 text-center text-signal-text">
            preview build — drafts visible · not the public site
          </p>
        )}
        {/* polite announcement of the new page after client-side navigation */}
        <p className="sr-only" aria-live="polite" data-route-announce />
        <main id="main" className="flex-1" tabIndex={-1}>
          {children}
        </main>
        <RouteEffects />
      </body>
    </html>
  );
}
