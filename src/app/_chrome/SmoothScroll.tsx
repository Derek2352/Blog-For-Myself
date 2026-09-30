'use client';

/**
 * Scrolling with weight.
 *
 * A mouse wheel moves a page in steps — a notch, a jump, a notch — and every scroll-linked thing on
 * the page (the banner's depth, the reel's drift, the reveals) inherits those steps. Lenis turns the
 * wheel into a glide: each notch sets a target and the page eases toward it, so the scroll itself is
 * continuous and everything tied to it moves continuously too. That is most of what makes a site
 * like the one Derek pointed at feel smooth; its transitions are smooth because the scroll driving
 * them is.
 *
 * **Where it does not run, on purpose:**
 * - **Touch.** A phone's own momentum scrolling is already a glide, and is better than any
 *   imitation of it. `syncTouch` stays off, and on a device with no fine pointer Lenis is not
 *   created at all — no event listeners, no animation frame loop.
 * - **Reduced motion**, from the OS or from the site's own toggle. A glide is motion, and a reader
 *   who asked for less gets the page moving exactly as far as they scroll, when they scroll.
 * - **Inside things that scroll on their own** — a tab's flyout list, the cat's card, a dialog — which
 *   keep their native scroll (`prevent`, and `allowNestedScroll` for anything else that can).
 *
 * Keyboard, scrollbar and in-page anchor scrolling are left native; Lenis follows them rather than
 * driving them.
 */
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Lenis from 'lenis';
import { motionReduced } from '@/lib/a11y-prefs';
import { remeasureScroll, setSmoothScroll, settleScroll } from '@/lib/smooth-scroll';

/** Elements whose own scrolling must not be taken over. */
const OWN_SCROLL = '[data-lenis-prevent], .tab-flyout, #cat-card-panel, dialog, [role="dialog"]';

export default function SmoothScroll() {
  const pathname = usePathname();

  useEffect(() => {
    const fine = matchMedia('(pointer: fine)');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    let lenis: Lenis | null = null;

    const sync = () => {
      const want = fine.matches && !motionReduced();
      if (want && !lenis) {
        lenis = new Lenis({
          autoRaf: true,
          smoothWheel: true,
          syncTouch: false,
          /* How much of the remaining distance each frame covers. The default, 0.1, settles in
             about half a second at 60fps; slightly less makes the glide a touch longer and softer
             without the page ever feeling as if it is dragging behind the wheel. */
          lerp: 0.09,
          allowNestedScroll: true,
          prevent: (node) => Boolean(node.closest?.(OWN_SCROLL)),
        });
        setSmoothScroll(lenis);
      } else if (!want && lenis) {
        lenis.destroy();
        lenis = null;
        setSmoothScroll(null);
      }
    };
    sync();

    fine.addEventListener('change', sync);
    reduce.addEventListener('change', sync);
    /* The site's own "Reduce motion" is a class on <html> — and so are Lenis's own state classes,
       which change many times a second while the page glides. Reacting only when the answer to
       "is motion reduced?" actually changes keeps this observer from feeding on the scroller it
       controls. */
    let reduced = motionReduced();
    const classes = new MutationObserver(() => {
      const now = motionReduced();
      if (now === reduced) return;
      reduced = now;
      sync();
    });
    classes.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      fine.removeEventListener('change', sync);
      reduce.removeEventListener('change', sync);
      classes.disconnect();
      lenis?.destroy();
      setSmoothScroll(null);
    };
  }, []);

  /* A new page: whatever the old page's glide was doing is over, and the new page is a different
     height. The router has already put the scroll where it belongs by the time this runs. */
  useEffect(() => {
    settleScroll();
    remeasureScroll();
  }, [pathname]);

  return null;
}
