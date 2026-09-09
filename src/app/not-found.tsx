import Link from 'next/link';
import PageWash from './_chrome/PageWash';

/**
 * Next's `not-found.tsx` replaces `404.astro`. In a static export it is written to `404.html`,
 * which is the file Cloudflare Pages, Netlify and a Cloud Run static server all serve for an
 * unmatched path — so the behaviour is the same one Astro had.
 */
export default function NotFound() {
  return (
    <>
      <PageWash hue={340} />
      <div className="wrap flex flex-col items-start justify-center py-24">
        <p className="rail">404 · FRAME NOT FOUND</p>
        <h1 className="mt-3 max-w-xl font-display text-4xl leading-tight sm:text-5xl">
          This frame didn’t make the cut.
        </h1>
        <p className="mt-4 max-w-prose text-muted">
          The page you’re after doesn’t exist (or moved). No stress — everything worth seeing is a
          click away.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/"
            className="fly-hint inline-flex items-center gap-2 rounded-(--radius-chip) bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
          >
            Back home
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="size-4 fill-current"
              aria-hidden="true"
            >
              <path d="M3.4 20.4 21.5 12 3.4 3.6l-.01 6.6L16 12 3.39 13.8z" />
            </svg>
          </Link>
          <Link
            href="/monthly/"
            className="rounded-(--radius-chip) border border-line px-4 py-2 text-sm transition-colors hover:border-accent hover:text-accent"
          >
            Browse the monthly log
          </Link>
        </div>
        <div className="reel-ticks mt-12 w-full max-w-md" aria-hidden="true" />
      </div>
    </>
  );
}
