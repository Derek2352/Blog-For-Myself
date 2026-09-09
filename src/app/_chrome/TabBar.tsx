'use client';

/**
 * Category tabs — derived entirely from `src/data/categories.ts` + content.
 *
 * On hover-capable devices each tab expands into a flyout of that category's entries (its
 * "sub-tabs"), collapsing when the pointer leaves. Keyboard users get the same via `:focus-within`.
 * On touch devices the flyout is disabled and tapping the tab just opens the category page.
 *
 * Two tiers, one per row on wide screens. All seven tabs on a single row need 1214px and the
 * content column gives them 1104px, so the bar always wrapped — leaving one tab stranded alone on
 * a second row, at every desktop width, since `.wrap` is capped and a wider screen never helped.
 * Trimming the type and padding only bought enough room to break again on the next category. So
 * the second row is deliberate instead of accidental: flagship categories (`primary` in
 * `categories.ts`) lead, the rest sit beneath in smaller, quieter type — a hierarchy the tab
 * colours already implied. Each row has room to grow, and a new category joins one by itself.
 *
 * Narrow screens are unchanged: the rows go `display: contents` so every tab lands back in one
 * horizontally scrolling strip.
 *
 * **A client component**, because it needs the current path for the active tab and Astro's
 * `Astro.url` has no build-time equivalent in a static export. The *data* still comes from the
 * server — `Header` fetches it and passes it down — so nothing here re-reads the content.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { categoryHref, entryHref } from '@/lib/content-core';
import type { NavCategory } from '@/server/content';

export default function TabBar({ tabs }: { tabs: NavCategory[] }) {
  const pathname = usePathname();
  const path = `${(pathname ?? '/').replace(/\/?$/, '/')}`;
  const bar = useRef<HTMLElement>(null);

  // An empty tier drops out rather than leaving a blank row behind.
  const rows = [
    { tier: 'primary', tabs: tabs.filter((t) => t.primary) },
    { tier: 'secondary', tabs: tabs.filter((t) => !t.primary) },
  ].filter((row) => row.tabs.length > 0);

  /**
   * Mobile: show a scroll hint while more tabs are hidden to the right.
   *
   * Astro bound the resize handler on `window` "so it is registered ONCE", because binding it per
   * page-load would leak. Here the effect's cleanup is that guarantee, so the note survives as
   * history rather than as a rule to keep.
   */
  useEffect(() => {
    const el = bar.current;
    const wrap = el?.closest<HTMLElement>('.tabbar-wrap');
    if (!el || !wrap) return;
    const update = () => {
      const more = el.scrollWidth - el.clientWidth - el.scrollLeft > 8;
      wrap.toggleAttribute('data-more', more);
      /* Both edges, because the fade is on the strip's own content (see the mask in global.css)
         and a strip scrolled to the end with a hard left edge is the same fault mirrored. 8px of
         slack on each side so a rubber-band overscroll does not flicker it. */
      el.toggleAttribute('data-more-right', more);
      el.toggleAttribute('data-more-left', el.scrollLeft > 8);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [pathname]);

  /** Flip the flyout to the right edge when it would overflow the viewport. */
  const checkFlyout = (group: HTMLElement) => {
    const flyout = group.querySelector<HTMLElement>('.tab-flyout');
    if (!flyout) return;
    flyout.classList.remove('flip');
    if (flyout.getBoundingClientRect().right > window.innerWidth - 8) flyout.classList.add('flip');
  };

  return (
    <nav aria-label="Categories" className="tabbar" data-tabbar ref={bar}>
      {rows.map((row) => (
        <div key={row.tier} className={`tabbar-row tabbar-row-${row.tier}`}>
          {row.tabs.map((tab) => {
            const href = categoryHref(tab.slug);
            const active = path === href;
            const hasFlyout = tab.entries.length > 0 || tab.logCount > 0;
            const flyoutId = `flyout-${tab.slug}`;
            return (
              <div
                key={tab.slug}
                className="tab-group"
                onPointerEnter={(e) => checkFlyout(e.currentTarget)}
                onFocus={(e) => checkFlyout(e.currentTarget)}
              >
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  aria-describedby={hasFlyout ? flyoutId : undefined}
                  className={[
                    'relative block whitespace-nowrap transition-colors',
                    active
                      ? 'font-medium text-ink'
                      : tab.primary
                        ? 'text-ink hover:text-accent'
                        : 'text-muted hover:text-ink',
                  ].join(' ')}
                >
                  {tab.label}
                  {/* Astro gave this `transition:name="active-tab"` so the underline slid between
                      tabs during a view transition. The App Router does not run view transitions,
                      so the name would style nothing; the underline still marks the active tab,
                      it just no longer animates between them. Recorded as a known difference
                      rather than quietly dropped. */}
                  {active && <span className="tab-underline" aria-hidden="true" />}
                </Link>
                {hasFlyout && (
                  <div className="tab-flyout" id={flyoutId}>
                    <div className="tab-flyout-inner">
                      <Link className="flyout-head" href={href}>
                        all →
                      </Link>
                      {tab.entries.length > 0 && (
                        <ul className="flyout-list">
                          {tab.entries.map((e) => (
                            <li key={e.id}>
                              <Link href={entryHref(e)}>{e.data.title}</Link>
                            </li>
                          ))}
                        </ul>
                      )}
                      {tab.entryCount > tab.entries.length && (
                        <Link className="flyout-more" href={href}>
                          View all {tab.entryCount} entries →
                        </Link>
                      )}
                      {tab.logCount > 0 && (
                        <Link className="flyout-more" href={`${href}#monthly-log-h`}>
                          + {tab.logCount} monthly {tab.logCount === 1 ? 'log' : 'logs'} →
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
