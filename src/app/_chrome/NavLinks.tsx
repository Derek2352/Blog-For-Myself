'use client';

/** The utility nav, split out only because the active link needs the current path. */
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavItem {
  href: string;
  label: string;
  title?: string;
}

export default function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const path = `${(pathname ?? '/').replace(/\/?$/, '/')}`;
  return (
    <>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          title={item.title}
          aria-current={path === item.href ? 'page' : undefined}
          className={[
            'py-1 transition-colors hover:text-accent',
            path === item.href ? 'text-accent' : 'text-ink',
          ].join(' ')}
        >
          {item.label}
        </Link>
      ))}
    </>
  );
}
