/**
 * Site header. A server component: it reads the content layer for the nav tree and the monthly
 * threshold, then hands the results to the two small client pieces that need the current path.
 *
 * That split is the pattern for the whole migration — fetch on the server, and let a client
 * component own only the thing that genuinely cannot be known at build time.
 */
import Link from 'next/link';
import { site } from '@/data/site';
import { getLogs, getNavTree, getCategoryIndex } from '@/server/content';
import { categoryHref } from '@/lib/content-core';
import { roomOf } from '@/lib/rooms';
import NavLinks, { type NavItem } from './NavLinks';
import SiteMenu, { type MenuRoom } from './SiteMenu';
import ThemeToggle from './ThemeToggle';
import A11yControls from './A11yControls';

/**
 * Monthly earns its nav slot only once there are enough monthly logs for it to show something
 * Timeline doesn't. Below the threshold the two pages are nearly the same list, which just makes a
 * visitor click both to find out. The route always exists; this only decides whether it's
 * advertised, and it starts appearing by itself as logs get written.
 */
const MONTHLY_NAV_MIN_LOGS = 4;

/**
 * One row: the name, the work, three places, two switches.
 *
 * The categories used to sit here as two tiers of tabs (see SiteMenu.tsx for why they moved). What
 * is left is what every page needs: whose site this is, a way into the work from anywhere, and the
 * three indexes that are not rooms.
 */
export default async function Header() {
  const [logs, tabs, index] = await Promise.all([getLogs(), getNavTree(1), getCategoryIndex()]);
  const monthly = logs.length >= MONTHLY_NAV_MIN_LOGS;
  const items: NavItem[] = [
    ...(monthly ? [{ href: '/monthly/', label: 'Monthly' }] : []),
    { href: '/timeline/', label: 'Timeline' },
    { href: '/about/', label: 'About' },
    { href: '/search/', label: 'Search', title: 'Press / to search' },
  ];
  /* Slim on purpose: this is the one prop a client component gets on every page, so it carries a
     room's name, its numeral, its counts and one cover — not the entries themselves. */
  const rooms: MenuRoom[] = tabs.map((t) => ({
    slug: t.slug,
    href: categoryHref(t.slug),
    label: t.label,
    numeral: roomOf(t.slug, index).replace(/^Room /, ''),
    entries: t.entryCount,
    logs: t.logCount,
    cover: t.entries[0]
      ? { src: t.entries[0].data.cover.src, width: t.entries[0].data.cover.width, height: t.entries[0].data.cover.height }
      : undefined,
  }));
  const links = [
    { href: '/timeline/', label: 'Everything, in order' },
    ...(monthly ? [{ href: '/monthly/', label: 'Month by month' }] : []),
    { href: '/about/', label: 'About' },
    { href: '/search/', label: 'Search' },
  ];

  return (
    <>
      <header>
        <div className="wrap site-header-row">
          <Link href="/" className="wordmark group" aria-label={`${site.name} — home`}>
            <span className="wordmark-name">Derek Yung</span>
          </Link>
          <nav aria-label="Site" className="site-nav">
            <SiteMenu rooms={rooms} links={links} />
            <span className="site-nav-links">
              <NavLinks items={items} />
            </span>
            {/* The two switches travel together so a wrap never strands one on its own line; the
                a11y popover is anchored right: 0 to its button. */}
            <span className="site-tools">
              <A11yControls />
              <ThemeToggle />
            </span>
          </nav>
        </div>
      </header>
      <p className="sr-only">{site.tagline}</p>
    </>
  );
}
