import Link from 'next/link';
import { site } from '@/data/site';

/**
 * The sign-off.
 *
 * It was three quiet columns of mono links, which is a sitemap, and a sitemap is a strange last
 * thing to say. The one action a portfolio exists to prompt is getting in touch, so the email is
 * the footer's headline — set in the display face, at the size a closing line deserves — and the
 * links sit underneath it in two short columns, the site and the elsewhere.
 *
 * Email only, on purpose: the phone number is the author's to publish, and it is not here.
 */
export default function Footer() {
  const year = new Date().getFullYear();
  const linkedin: string = site.linkedin;

  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-hello">
          <p className="kicker">say hello</p>
          <a className="footer-mail" href={`mailto:${site.email}`}>
            <span className="link-draw">{site.email}</span>
          </a>
          <p className="footer-tag">{site.tagline.replace(/ · /g, '\u00a0· ')}</p>
        </div>
        <div className="footer-cols">
          <nav className="footer-nav" aria-label="Pages">
            <p className="footer-head">The site</p>
            <Link href="/timeline/">Timeline</Link>
            <Link href="/about/">About</Link>
            <Link href="/search/">Search</Link>
            {/* Without this the colophon was orphaned — built and searchable, but unreachable by
                clicking from anywhere on the site. */}
            <Link href="/colophon/">How this site is made</Link>
          </nav>
          {/* `footer-nav` carries the touch padding — see the `pointer: coarse` block in global.css. */}
          <nav className="footer-nav" aria-label="Contact">
            <p className="footer-head">Elsewhere</p>
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
          </nav>
        </div>
        <div className="footer-base rail">
          <span>
            © {year} {site.name}
          </span>
          <span>{site.mastheadNote}</span>
        </div>
      </div>
    </footer>
  );
}
