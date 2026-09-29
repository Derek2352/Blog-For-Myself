'use client';

/**
 * Page-to-page motion, back.
 *
 * The Astro site cross-faded between pages with the browser's View Transitions API, and the
 * `::view-transition-*` rules for it are still in global.css. The migration to Next kept the rules
 * and lost the transitions — the App Router swaps a page's content in place and never asks the
 * browser to animate it — so every click on a landing page has been a hard cut ever since, with the
 * CSS describing a cross-fade that nothing triggered.
 *
 * React's `<ViewTransition>` is the App Router's way back to it. A navigation is already a React
 * Transition, and a boundary that is swapped inside one is animated by `document.startViewTransition`:
 * the old page leaves as `page-out`, the new one arrives as `page-in`, and global.css says what
 * those look like. Keyed on the path so that each page is its own boundary — an *exit* and an
 * *enter*, never an "update" that would stretch one page's snapshot into the other's height.
 *
 * Where the browser has no View Transitions API this renders its children and nothing else.
 */
import { ViewTransition } from 'react';
import { usePathname } from 'next/navigation';

export default function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <ViewTransition key={pathname} enter="page-in" exit="page-out" default="none">
      {children}
    </ViewTransition>
  );
}
