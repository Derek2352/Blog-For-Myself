'use client';

/**
 * The paper plane: prev/next launches a little plane that arcs off in the direction of travel,
 * then the next page glides in. Reduced motion — or a modified click — falls through to plain
 * navigation.
 *
 * Two things Astro's version had to work around are simply gone. It bound the click handlers
 * inside `astro:page-load` and noted that the arrow-key listener had to live on `document`
 * "registered ONCE", because otherwise it would "stack a listener per entry visited and fire stale
 * handlers pointing at previous pages' links". Here the component owns both links, so the handlers
 * are props and the key listener's lifetime is the page's.
 *
 * One thing is genuinely different and worth stating: the plane was appended to
 * `document.documentElement` rather than `body`, because Astro's router replaced body content on
 * swap and the plane had to keep flying across it. The App Router does not replace the body, so
 * that reasoning no longer applies — but the plane is still appended outside React's tree, because
 * an element animating across a route change should not be owned by the route it started in.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motionReduced, shortcutsDisabled } from '@/lib/a11y-prefs';

const PLANE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 21.5 12 3.4 3.6l-.01 6.6L16 12 3.39 13.8z"/></svg>';

function fly(link: HTMLAnchorElement, dir: 1 | -1): void {
  const rect = link.getBoundingClientRect();
  const plane = document.createElement('span');
  plane.className = 'paper-plane';
  plane.innerHTML = PLANE_SVG;
  plane.style.left = `${rect.left + rect.width / 2}px`;
  plane.style.top = `${rect.top + rect.height / 2}px`;
  const svg = plane.querySelector('svg');
  if (dir === -1 && svg) svg.style.transform = 'scaleX(-1)';
  document.documentElement.appendChild(plane);

  const dx = dir * window.innerWidth * 0.55;
  const flight = plane.animate(
    [
      { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
      {
        transform: `translate(${dx * 0.6}px, -46px) rotate(${dir * -10}deg)`,
        opacity: 1,
        offset: 0.65,
      },
      { transform: `translate(${dx}px, -84px) rotate(${dir * -16}deg) scale(0.8)`, opacity: 0 },
    ],
    { duration: 460, easing: 'cubic-bezier(0.3, 0.1, 0.3, 1)' },
  );
  const cleanUp = () => plane.remove();
  flight.finished.catch(() => {}).finally(cleanUp);
  /* Guaranteed sweep: if a route change cancels the animation mid-flight, `finished` may never
     settle, so never leave a plane stranded. */
  setTimeout(cleanUp, 900);
}

export default function PlaneNav({ prevHref, nextHref }: { prevHref?: string; nextHref?: string }) {
  const router = useRouter();

  useEffect(() => {
    const go = (selector: string, href: string) => {
      const link = document.querySelector<HTMLAnchorElement>(selector);
      if (link && !motionReduced()) fly(link, selector.includes('prev') ? -1 : 1);
      /* The navigation starts *now* rather than after the flourish: the plane flies alongside the
         page transition, so the click feels immediate — waiting for the full animation first cost
         ~900ms per prev/next. */
      router.push(href);
    };

    // ← / → jump between entries in the category (skips when typing/searching).
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // respect the a11y "Disable keyboard shortcuts" toggle (WCAG 2.1.4)
      if (shortcutsDisabled()) return;
      const t = e.target as HTMLElement | null;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t?.isContentEditable)
        return;
      if (e.key === 'ArrowLeft' && prevHref) {
        e.preventDefault();
        go('a[data-plane="prev"]', prevHref);
      }
      if (e.key === 'ArrowRight' && nextHref) {
        e.preventDefault();
        go('a[data-plane="next"]', nextHref);
      }
    };

    const onClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[data-plane]');
      if (!link) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      const dir = link.dataset.plane === 'prev' ? -1 : 1;
      if (!motionReduced()) fly(link, dir);
      router.push(link.getAttribute('href')!);
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
    };
  }, [prevHref, nextHref, router]);

  return null;
}
