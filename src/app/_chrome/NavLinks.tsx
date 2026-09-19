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
            /* `[@media(pointer:coarse)]:py-3` and not a rule in global.css: the first attempt put
               `.nav-link { padding-block }` there and it lost to Tailwind's `py-1`, because
               utilities sit in a later layer and both are single-class selectors. Declaring the
               touch size beside the base size keeps them in one place and in the right order. */
            'py-1 [@media(pointer:coarse)]:py-3 transition-colors hover:text-accent',
            path === item.href ? 'text-accent' : 'text-ink',
          ].join(' ')}
        >
          {item.label}
        </Link>
      ))}
    </>
  );
}
