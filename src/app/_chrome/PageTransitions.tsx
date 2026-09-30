'use client';

/**
 * Page transitions, run by the site rather than by React.
 *
 * They used to be React's `<ViewTransition>`, keyed on the path, and they were measured doing two
 * things that are the opposite of smooth:
 *
 * 1. **A frozen screen on every click — 200 to 560ms.** React names every top-level block of the
 *    outgoing and incoming page as its own transition layer, and the browser has to photograph each
 *    one, at full size, before anything moves. The home page's blocks are the heaviest on the site —
 *    the ink canvas, the reel's forty-odd frames, the frosted pane — and the frame that captured
 *    them took 561ms, during which the page showed a still of itself and ignored input.
 * 2. **An animation at 13–15 frames a second**, every frame 55–80ms, compositing those same layers.
 *
 * Here the only thing photographed is the window: one image of the old page, one of the new, plus
 * the header (which holds still) and the tab underline (which slides). The cost of a transition no
 * longer depends on how rich the page is.
 *
 * **How it runs.** A click on an internal link is taken before Next's `<Link>` sees it — `<Link>`
 * stands down on a click that is already handled (`defaultPrevented`) — and the navigation is done
 * inside `document.startViewTransition`, whose update resolves when the new page has committed.
 * Everything the browser would do anyway is left to it: new tabs, modified clicks, downloads, links
 * off the site, links to files the router has no page for, in-page anchors, and back/forward.
 *
 * **What it looks like** is in global.css, under `html.page-vt`: a band of pale ink rising up the
 * window with the new page behind it — the site's own material, and the textured wipe of the
 * reference site rather than a flat cross-fade.
 *
 * Skipped entirely for reduced motion, and where the browser has no View Transitions API; the click
 * then goes to `<Link>` as it always did.
 */
import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motionReduced } from '@/lib/a11y-prefs';
import { settleScroll } from '@/lib/smooth-scroll';

interface ViewTransitionLike {
  ready: Promise<void>;
  finished: Promise<void>;
}
type StartViewTransition = (update: () => Promise<void>) => ViewTransitionLike;

/**
 * The longest the old page may stand frozen waiting for the new one, in ms.
 *
 * The photograph of the old page is on screen from the click until the new page commits, and while
 * it is, nothing responds. On a warm route that is a frame or two. On a slow connection it is the
 * round trip, and past this the transition gives up waiting and plays anyway — the new page then
 * arrives a moment later without ceremony, which is better than a page that stops answering.
 */
const WAIT_MS = 900;

/** The tide's masks — see `--tide-new` / `--tide-old` in global.css. */
const MASKS = ['/tide-new.png', '/tide-old.png'];

/** Paths the router serves as pages: no file extension, or one it renders (`.html`). */
const isPagePath = (path: string) => !/\.[a-z0-9]{2,5}$/i.test(path) || path.endsWith('.html');

/** The same-site page this click is going to, or null when the browser should have it. */
function destination(e: MouseEvent): URL | null {
  if (e.defaultPrevented || e.button !== 0) return null;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
  if (!a || a.hasAttribute('download') || 'noTransition' in a.dataset) return null;
  if (a.target && a.target !== '_self') return null;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || !isPagePath(url.pathname)) return null;
  // Same page, different anchor (or none): an in-page jump, not a navigation.
  if (url.pathname === location.pathname && url.search === location.search) return null;
  return url;
}

export default function PageTransitions() {
  const router = useRouter();
  const pathname = usePathname();
  /** Resolves the transition waiting on the page that is being navigated to. */
  const arrived = useRef<(() => void) | null>(null);
  /** Which transition is the current one — a click during a transition starts another. */
  const latest = useRef(0);

  /* The new page has committed — and the router has already scrolled it to where it belongs. */
  useEffect(() => {
    arrived.current?.();
    arrived.current = null;
  }, [pathname]);

  useEffect(() => {
    if (typeof document.startViewTransition !== 'function') return;

    /* The tide's two masks, fetched once the page has nothing better to do. A mask that has not
       loaded when a transition starts would hide the page it belongs to for the length of the
       transition, so they are asked for long before any click can need them. */
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1200));
    idle(() => {
      for (const src of MASKS) new Image().src = src;
    });

    const onClick = (e: MouseEvent) => {
      const url = destination(e);
      if (!url || motionReduced()) return;
      /* Looked up at the click, not held from mount: anything that wraps it later — a test harness
         timing the transition — sees the call. */
      const start = (document as Document & { startViewTransition?: StartViewTransition })
        .startViewTransition;
      if (!start) return;
      e.preventDefault();
      settleScroll();
      const href = url.pathname + url.search + url.hash;
      const root = document.documentElement;
      const id = ++latest.current;
      root.classList.add('page-vt');
      const transition = start.call(
        document,
        () =>
          new Promise<void>((resolve) => {
            let done = false;
            const finish = () => {
              if (done) return;
              done = true;
              resolve();
            };
            arrived.current = finish;
            window.setTimeout(finish, WAIT_MS);
            /* The outgoing page has been photographed by the time this runs, so the live document
               can be moved to the top unseen. Left to the router, a page reached from far down a
               longer one landed a few pixels down (measured: y=10) — the swap briefly shortens the
               document, the browser clamps the scroll to fit, and the router's "is the new page
               already in view?" check then passes at 10 and leaves it there. A link to an anchor is
               the router's to scroll, so it is left alone. */
            if (!url.hash) window.scrollTo({ top: 0, behavior: 'instant' });
            router.push(href);
          }),
      );
      /* A click during a transition skips it for the new one, and the skipped one still finishes —
         so only the latest may take the class off, or it would strip the tide from the transition
         that replaced it half-way through. A skipped transition also rejects `ready`, which is the
         browser reporting what happened, not an error. */
      transition.ready.catch(() => {});
      transition.finished.finally(() => {
        if (id === latest.current) root.classList.remove('page-vt');
      });
    };

    /* A head start on the fetch. `<Link>` prefetches on hover, which a phone never does; the press
       comes 50–150ms before the click, and that is time the frozen photograph does not have to
       cover. */
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a) return;
      const url = new URL(a.href, location.href);
      if (url.origin === location.origin && isPagePath(url.pathname) && url.pathname !== location.pathname) {
        router.prefetch(url.pathname + url.search);
      }
    };

    /* Capture on the window: ahead of React's own listeners, which Next's `<Link>` handles its
       clicks through. */
    window.addEventListener('click', onClick, true);
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [router]);

  return null;
}
