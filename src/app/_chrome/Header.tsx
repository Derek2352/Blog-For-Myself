/**
 * Site header. A server component: it reads the content layer for the nav tree and the monthly
 * threshold, then hands the results to the two small client pieces that need the current path.
 *
 * That split is the pattern for the whole migration — fetch on the server, and let a client
 * component own only the thing that genuinely cannot be known at build time.
 */
import Link from 'next/link';
import { site } from '@/data/site';
import { getLogs, getNavTree } from '@/server/content';
import NavLinks, { type NavItem } from './NavLinks';
import TabBar from './TabBar';
import ThemeToggle from './ThemeToggle';
import A11yControls from './A11yControls';

/**
 * Monthly earns its nav slot only once there are enough monthly logs for it to show something
 * Timeline doesn't. Below the threshold the two pages are nearly the same list, which just makes a
 * visitor click both to find out. The route always exists; this only decides whether it's
 * advertised, and it starts appearing by itself as logs get written.
 */
const MONTHLY_NAV_MIN_LOGS = 4;

export default async function Header() {
  const [logs, tabs] = await Promise.all([getLogs(), getNavTree()]);
  const items: NavItem[] = [
    ...(logs.length >= MONTHLY_NAV_MIN_LOGS ? [{ href: '/monthly/', label: 'Monthly' }] : []),
    { href: '/timeline/', label: 'Timeline' },
    { href: '/about/', label: 'About' },
    { href: '/search/', label: 'Search', title: 'Press / to search' },
  ];

  return (
    <>
      <header className="border-b border-line">
        <div className="wrap flex flex-wrap items-center gap-x-6 gap-y-2 pb-2 pt-4">
          <Link href="/" className="group mr-auto no-underline">
            <span className="block font-display text-[1.55rem] leading-none transition-colors group-hover:text-accent">
              Derek Yung
            </span>
            <span className="rail mt-1 block">{site.mastheadNote}</span>
          </Link>
          <nav
            aria-label="Site"
            className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm sm:gap-x-5"
          >
            <NavLinks items={items} />
            {/* The two icon buttons travel together so a narrow-screen wrap never strands one on
                its own line, and ml-auto keeps them at the right edge of whatever row they land
                on — the a11y popover is anchored right: 0 to its button, so a left-aligned button
                would push it off-screen. */}
            <div className="ml-auto flex items-center gap-x-3">
              <A11yControls />
              <ThemeToggle />
            </div>
          </nav>
        </div>
        <div className="wrap">
          <div className="tabbar-wrap">
            <TabBar tabs={tabs} />
          </div>
        </div>
      </header>
      <p className="sr-only">{site.tagline}</p>
    </>
  );
}
