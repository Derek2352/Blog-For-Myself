import Link from 'next/link';
import { site } from '@/data/site';

/**
 * Site footer. Server-rendered — nothing here is interactive.
 *
 * The year is computed at build time rather than on the client, which is a small honest change:
 * a static export is a snapshot, and a page built in December that renders "2027" on New Year's
 * Day would be claiming a freshness it does not have. A rebuild is what updates it, which is also
 * what updates everything else on the page.
 */
export default function Footer() {
  const year = new Date().getFullYear();
  const linkedin: string = site.linkedin;

  return (
    <footer className="mt-24 border-t border-line">
      <div className="wrap grid gap-8 py-10 text-sm sm:grid-cols-3">
        <div>
          <p className="font-display text-xl">Derek Yung</p>
          <p className="mt-1 max-w-[28ch] text-muted">{site.tagline}</p>
        </div>
        <nav className="rail flex flex-col items-start gap-2" aria-label="Contact">
          <a href={`mailto:${site.email}`}>{site.email}</a>
          <a href={site.github} target="_blank" rel="noopener">
            GitHub ↗
          </a>
          {linkedin && (
            <a href={linkedin} target="_blank" rel="noopener">
              LinkedIn ↗
            </a>
          )}
          {/* Plain anchors, not <Link>: these leave the app. rss.xml and the CV are files the
              router has no route for, and asking it to prefetch them would 404 in the console. */}
          <a href="/rss.xml">RSS</a>
          <a href={site.cvPath} download>
            Download CV (PDF)
          </a>
          {/* Without this the colophon was orphaned — built and searchable, but unreachable by
              clicking from anywhere on the site. */}
          <Link href="/colophon/">How this site is made</Link>
        </nav>
        <div className="rail sm:text-right">
          <p>
            © {year} {site.name}
          </p>
        </div>
      </div>
    </footer>
  );
}
