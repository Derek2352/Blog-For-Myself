'use client';

/**
 * "/" jumps to search from anywhere — unless you are typing somewhere.
 *
 * Mounted once in the layout rather than re-bound per navigation, and it uses the router instead
 * of `window.location.href` so the jump is a client-side navigation like every other link.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { shortcutsDisabled } from '@/lib/a11y-prefs';

export default function SearchShortcut() {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      // respect the a11y "Disable keyboard shortcuts" toggle (WCAG 2.1.4)
      if (shortcutsDisabled()) return;
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
      router.push('/search/');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [router]);
  return null;
}
