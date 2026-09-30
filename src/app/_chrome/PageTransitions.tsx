'use client';

/**
 * Page transitions, run by the site rather than by React.
 *
 * **What moves.** The reference site never cuts between scenes. One thing in each — the golden pear —
 * carries across into the next while everything around it falls away past the camera, and the new
 * scene's words arrive once it has landed. A navigation here does the same with what was clicked:
 *
 * - **A card** comes apart into the page it opens: its cover grows into the entry's cover and its
 *   title into the entry's heading. (The Astro site did the cover, as `transition:name`; it was lost
 *   with the move to the App Router, and this is it back.)
 * - **Words** — a tab, a room's name on the home page, a line of the timeline, a tag — grow into the
 *   new page's title.
 * - **Nothing**, where there is no pair to make: a link home, whose banner has an entrance of its
 *   own, or one in a tab's hover list. The page still falls away, from the point that was clicked.
 *
 * Around it the old page recedes — scales up and fades from the point the thing lifted off, as if
 * the camera were passing through it — with the new page already standing behind it, its opening
 * lines arriving one after another as the carried things land. The header holds still, and the tab
 * underline slides. How it looks is in global.css, under "page to page: something carries across".
 *
 * **Why the site runs it and not React.** These were React's `<ViewTransition>`, keyed on the path,
 * and were measured doing the opposite of smooth: React names every top-level block of both pages as
 * its own layer, and the browser photographs each at full size before anything moves — a frozen
 * screen of 200–560ms on every click (561ms in one frame from the home page, with its ink, reel and
 * frosted pane), then an animation at 13–15 frames a second. Here only the window is photographed,
 * plus the header, the tab underline and the things being carried, so a transition costs the same on
 * the richest page as on the emptiest.
 *
 * **How it runs.** A click on an internal link is taken before Next's `<Link>` sees it — `<Link>`
 * stands down on a click that is already handled (`defaultPrevented`) — and the navigation happens
 * inside `document.startViewTransition`, whose update resolves once the new page has committed and
 * its landing spots have been named. Everything the browser would do anyway is left to it: new tabs,
 * modified clicks, downloads, links off the site or to files, in-page anchors, back and forward.
 *
 * Skipped entirely for reduced motion and where the browser has no View Transitions API; the click
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

/**
 * How long a cover about to be photographed may take to decode, in ms. The cover a card lands on is
 * the card's own image — the same file — so it is in memory and decodes in a frame or two; this only
 * bounds a cold cache, where the cover would otherwise land as an empty frame.
 */
const DECODE_MS = 250;

/** The latest place in the arriving order; lines after it arrive together with it. */
const ARRIVE_LAST = 5;

/**
 * When the arriving lines are finished with, in ms: the last of them starts at 0.28s + ARRIVE_LAST ×
 * 0.07s and runs 0.7s (the `vt-arrive` rule in global.css), so everything has arrived by about 1.35s.
 */
const ARRIVE_CLEAR_MS = 1500;

/** The largest link that can travel as words — a tab, a chip, a line of text — and not a panel. */
const WORD_MAX = { w: 520, h: 96 };

/**
 * A landing spot has to be on screen, and in its upper three quarters: a cover that starts at the
 * very foot of a phone's window would take the carried picture off the bottom of the screen, which
 * reads as leaving rather than arriving. The title lands instead.
 */
const LAND_ABOVE = 0.75;

type Kind = 'picture' | 'word';
const NAME: Record<Kind, string> = { picture: 'page-picture', word: 'page-word' };

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
  /* The page it is already on — an in-page anchor, or the same page with a different query. Not a
     page change, so no transition; and the update waits for the *pathname* to change, which a query
     alone never does, so it would have stood frozen for the whole of WAIT_MS. */
  if (url.pathname === location.pathname) return null;
  return url;
}

/** The element's box, if any of it is on screen above `below` × the window's height. */
function onScreen(el: Element | null, below = 1): DOMRect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  if (r.bottom <= 0 || r.right <= 0 || r.left >= innerWidth || r.top >= innerHeight * below) return null;
  return r;
}

/**
 * What the clicked link can carry across: its picture, its words, or both. Whether each one travels
 * is decided on arrival, by whether the new page has somewhere to land it; both are lifted now,
 * because the old page is photographed before the new one exists. One with nowhere to land goes
 * down with its page.
 */
function cargo(a: HTMLAnchorElement): { picture: HTMLElement | null; word: HTMLElement | null } {
  /* A tab's hover list is hidden for the transition (global.css), so nothing in it can be lifted. */
  if (a.closest('.tab-flyout')) return { picture: null, word: null };
  const picture = a.querySelector<HTMLElement>('[data-vt="picture"]');
  let word = a.querySelector<HTMLElement>('[data-vt="word"]');
  if (!word && !picture) {
    const r = a.getBoundingClientRect();
    if (r.width <= WORD_MAX.w && r.height <= WORD_MAX.h) word = a;
  }
  return { picture: onScreen(picture) ? picture : null, word: onScreen(word) ? word : null };
}

/** Where the new page takes it: the entry's cover for a picture, the page's title for words. */
function landing(kind: Kind): HTMLElement | null {
  const main = document.getElementById('main') ?? document.querySelector('main');
  const el =
    kind === 'picture'
      ? main?.querySelector<HTMLElement>('[data-vt-target="picture"]')
      : main?.querySelector<HTMLElement>('h1');
  /* The home page's banner plays an entrance of its own, and a title flying into it would fight it. */
  if (!el || el.closest('.hero-pane')) return null;
  return onScreen(el, LAND_ABOVE) ? el : null;
}

function lift(el: HTMLElement, kind: Kind): void {
  el.style.setProperty('view-transition-name', NAME[kind]);
  el.dataset.vtLift = kind;
}

/**
 * Give every name back. Run before anything is lifted, because a name may only be used once in a
 * page and a click during a transition would otherwise find the last one's still in place; and on
 * arrival, because an element that outlived the swap — a tab in the header — must let go of its name
 * before the new page's title can take it.
 */
function dropAll(): void {
  for (const el of document.querySelectorAll<HTMLElement>('[data-vt-lift]')) {
    el.style.removeProperty('view-transition-name');
    if (el.dataset.vtLift === 'word-fit') el.style.removeProperty('width');
    delete el.dataset.vtLift;
  }
}

let arrivals = 0;

/**
 * The new page's opening lines — its header's children, then whatever follows the header — arriving
 * one after another while the carried things land. The ones they land on are not among them: they
 * are already here.
 */
function arrive(landed: HTMLElement[]): void {
  if (location.pathname === '/') return; // the banner's own entrance does this at home
  const main = document.getElementById('main') ?? document.querySelector('main');
  const head = main?.querySelector('header');
  if (!head) return;
  const lines = [...head.children, head.nextElementSibling].filter(
    (el): el is HTMLElement => el instanceof HTMLElement && !landed.some((spot) => el.contains(spot)),
  );
  lines.forEach((el, i) => {
    el.dataset.arrive = '';
    /* Capped, so however many lines a page opens with, the last is in before ARRIVE_CLEAR_MS takes
       the markers off — a line still arriving then would jump the rest of the way. */
    el.style.setProperty('--arrive', String(Math.min(i, ARRIVE_LAST)));
  });
  const root = document.documentElement;
  const token = ++arrivals;
  root.classList.add('vt-arrive');
  window.setTimeout(() => {
    for (const el of lines) {
      delete el.dataset.arrive;
      el.style.removeProperty('--arrive');
    }
    if (token === arrivals) root.classList.remove('vt-arrive');
  }, ARRIVE_CLEAR_MS);
}

/**
 * On the new page: name the spots the carried things land on — the cover for a picture, the title for
 * words — and let the rest of the opening lines arrive.
 */
async function land(carrying: { picture: boolean; word: boolean }): Promise<void> {
  dropAll();
  const picture = carrying.picture ? landing('picture') : null;
  const word = carrying.word ? landing('word') : null;
  if (picture) lift(picture, 'picture');
  if (word) {
    lift(word, 'word');
    /* A heading is as wide as its column, and the words that land on it are not: without this the
       flight would end on a box a paragraph wide with a short title at its left edge. Shrinking it to
       its text moves nothing — the text is left-aligned, and a title long enough to wrap is already
       as wide as the column allows. Given back with the name. */
    word.style.setProperty('width', 'fit-content');
    word.dataset.vtLift = 'word-fit';
  }
  arrive([picture, word].filter((el): el is HTMLElement => el !== null));
  const img = picture?.querySelector('img');
  if (img && !img.complete) {
    await Promise.race([
      img.decode().catch(() => {}),
      new Promise((resolve) => window.setTimeout(resolve, DECODE_MS)),
    ]);
  }
}

export default function PageTransitions() {
  const router = useRouter();
  const pathname = usePathname();
  /** Called once the page being navigated to has committed. */
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

    const onClick = (e: MouseEvent) => {
      const url = destination(e);
      if (!url || motionReduced()) return;
      /* Looked up at the click, not held from mount: anything that wraps it later — a test harness
         timing the transition — sees the call. */
      const start = (document as Document & { startViewTransition?: StartViewTransition })
        .startViewTransition;
      if (!start) return;
      const a = (e.target as Element).closest('a[href]') as HTMLAnchorElement;
      e.preventDefault();
      settleScroll();
      dropAll();

      const root = document.documentElement;
      const { picture, word } = cargo(a);
      /* Where the camera goes: through the thing that lifts off, or through the click itself. A
         keyboard's click has no position, so it goes through the link. */
      const through = (picture ?? word ?? a).getBoundingClientRect();
      const x = picture || word || !e.detail ? through.left + through.width / 2 : e.clientX;
      const y = picture || word || !e.detail ? through.top + through.height / 2 : e.clientY;
      root.style.setProperty('--vt-x', `${Math.round(x)}px`);
      root.style.setProperty('--vt-y', `${Math.round(y)}px`);
      if (picture) lift(picture, 'picture');
      if (word) lift(word, 'word');

      const href = url.pathname + url.search + url.hash;
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
            arrived.current = () => {
              if (done) return; // the wait gave up; this page arrives without ceremony
              land({ picture: !!picture, word: !!word }).then(finish, finish);
            };
            window.setTimeout(() => {
              /* Still the old page: nothing of it may keep a name into the new photograph, or the
                 lifted thing would "land" on itself. Everything just falls away. */
              if (!done) dropAll();
              finish();
            }, WAIT_MS);
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
         so only the latest may clean up, or it would take the names and the class away from the
         transition that replaced it half-way through. A skipped transition also rejects `ready`,
         which is the browser reporting what happened, not an error. */
      transition.ready.catch(() => {});
      transition.finished.finally(() => {
        if (id !== latest.current) return;
        root.classList.remove('page-vt');
        dropAll();
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
