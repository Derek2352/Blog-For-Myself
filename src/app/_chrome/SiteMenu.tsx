'use client';

/**
 * The work menu: every room in one panel, behind one word.
 *
 * The header used to carry all seven categories as tabs, in two tiers of two sizes under the name,
 * with the utility links in a third place to the right — three groups of links before a visitor
 * had seen a picture. A portfolio's header has one job, which is to say whose it is and get out of
 * the way, so the rooms moved here: a "Work" button that opens them as a panel, each room with its
 * numeral, its count and the cover a visitor will meet first when they walk in. The home page and
 * every category page still show the rooms in full; the panel is the way there from anywhere else.
 *
 * On a phone the same button reads "Menu" and the panel becomes a sheet that also carries the
 * utility links, which have no room in a 390px row beside the name.
 *
 * Closes on Escape, on a click outside, and on navigation — the three ways a reader says "done".
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';

export interface MenuRoom {
  slug: string;
  href: string;
  label: string;
  /** "I", "II"… — the room's numeral, without the word. */
  numeral: string;
  entries: number;
  logs: number;
  cover?: { src: string; width: number; height: number };
}

export interface MenuLink {
  href: string;
  label: string;
}

export default function SiteMenu({ rooms, links }: { rooms: MenuRoom[]; links: MenuLink[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        root.current?.querySelector<HTMLButtonElement>('button')?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    document.documentElement.toggleAttribute('data-menu-open', true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
      document.documentElement.toggleAttribute('data-menu-open', false);
    };
  }, [open]);

  const here = `${(pathname ?? '/').replace(/\/?$/, '/')}`;

  return (
    <div className="site-menu" ref={root} data-open={open ? '' : undefined}>
      <button
        type="button"
        className="menu-btn"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="menu-word-wide">Work</span>
        <span className="menu-word-narrow">Menu</span>
        <svg className="menu-chev" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="menu-panel" id={panelId} hidden={!open}>
        <p className="menu-kicker kicker">the rooms</p>
        <ul className="menu-rooms">
          {rooms.map((r) => (
            <li key={r.slug}>
              <Link
                href={r.href}
                prefetch={false}
                className="menu-room group"
                aria-current={here === r.href ? 'page' : undefined}
              >
                <span className="menu-thumb" aria-hidden="true">
                  {r.cover ? <img src={r.cover.src} alt="" width={r.cover.width} height={r.cover.height} loading="lazy" decoding="async" /> : null}
                </span>
                <span className="menu-room-text">
                  <span className="menu-numeral">{r.numeral}</span>
                  <span className="menu-label">{r.label}</span>
                  <span className="menu-count">
                    {r.entries > 0 ? `${r.entries} ${r.entries === 1 ? 'entry' : 'entries'}` : ''}
                    {r.entries > 0 && r.logs > 0 ? ' · ' : ''}
                    {r.logs > 0 ? `${r.logs} ${r.logs === 1 ? 'log' : 'logs'}` : ''}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <ul className="menu-links">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} prefetch={false} aria-current={here === l.href ? 'page' : undefined}>
                {l.label}
                <span aria-hidden="true"> →</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
