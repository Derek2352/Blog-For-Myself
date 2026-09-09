/**
 * tail-gap — how much of nothing sits between the last thing on a page and its footer.
 *
 * Finding #5 of the page audit was "350–500px of dead space above the footer on short pages,
 * and /search/ in particular is a form and a void". That was read off screenshots, which is the
 * right way to notice it and the wrong way to fix it: a number read off a picture cannot say
 * which of three margins is responsible, and `mt-24` on the footer, `pb-*` on `main` and the
 * page's own last section all look identical from outside.
 *
 * So this measures the stack. For every page: the bottom of the last painted element inside
 * `main`, the top of the footer, the gap between them, and which rules contribute to it. It also
 * reports whether the page is short enough for the gap to matter — on a page that scrolls, dead
 * space at the end is a pause; on a page that does not fill one screen it is the page looking
 * unfinished, which is the fault actually being chased.
 */
import { launch, BASE, fresh } from './lib/fixture.mjs';

const PAGES = [
  ['home', '/'],
  ['timeline', '/timeline/'],
  ['monthly', '/monthly/'],
  ['tags', '/tags/'],
  ['tag', '/tags/ai-film/'],
  ['search', '/search/'],
  ['about', '/about/'],
  ['colophon', '/colophon/'],
  ['category', '/competitions/'],
  // The empty one. `leisure-time` has no entries and no logs, so it is the shortest page the
  // site can build and the likeliest place for the void this file exists to find.
  ['cat-empty', '/leisure-time/'],
  ['entry', '/entry/nextgen-video-challenge-2025/'],
  ['404', '/nowhere-at-all/'],
];

const browser = await launch();
for (const [w, h] of [
  [1280, 900],
  [390, 844],
]) {
  console.log(`\n=== ${w}×${h} ===`);
  console.log(
    '  page       docH  vh-fill   last-in-main            bottom  footerTop   gap  contributors',
  );
  const ctx = await fresh(browser, { viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  for (const [name, path] of PAGES) {
    await page.goto(BASE + path, { waitUntil: 'load' });
    const r = await page.evaluate(() => {
      const main = document.querySelector('main');
      const footer = document.querySelector('footer');
      if (!main || !footer) return null;
      // The last element that actually paints something. `getBoundingClientRect().bottom` on
      // `main` itself would include its own bottom padding, which is one of the things being
      // measured — so walk the descendants and take the furthest ink.
      let last = null;
      let bottom = -Infinity;
      for (const el of main.querySelectorAll('*')) {
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        const paints =
          (el.textContent ?? '').trim().length > 0 ||
          ['IMG', 'SVG', 'HR', 'INPUT', 'CANVAS'].includes(el.tagName) ||
          cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
          cs.borderTopWidth !== '0px' ||
          cs.borderBottomWidth !== '0px';
        if (!paints) continue;
        if (b.bottom > bottom) {
          bottom = b.bottom;
          last = el;
        }
      }
      const fr = footer.getBoundingClientRect();
      const mainCs = getComputedStyle(main);
      const footerCs = getComputedStyle(footer);
      const label = last
        ? `${last.tagName.toLowerCase()}${last.className && typeof last.className === 'string' ? '.' + last.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}`
        : '(none)';
      return {
        docH: Math.round(document.documentElement.scrollHeight),
        vh: window.innerHeight,
        label: label.slice(0, 22),
        bottom: Math.round(bottom + window.scrollY),
        footerTop: Math.round(fr.top + window.scrollY),
        mainPb: mainCs.paddingBottom,
        mainMb: mainCs.marginBottom,
        footerMt: footerCs.marginTop,
        lastMb: last ? getComputedStyle(last).marginBottom : '—',
      };
    });
    if (!r) {
      console.log(`  ${name.padEnd(10)} (no main/footer)`);
      continue;
    }
    const gap = r.footerTop - r.bottom;
    const fills = r.docH > r.vh ? 'scrolls' : `SHORT ${r.vh - r.docH}px`;
    console.log(
      `  ${name.padEnd(10)} ${String(r.docH).padStart(5)} ${fills.padEnd(10)} ${r.label.padEnd(23)} ${String(r.bottom).padStart(6)} ${String(r.footerTop).padStart(9)} ${String(gap).padStart(5)}  main pb=${r.mainPb} mb=${r.mainMb} · footer mt=${r.footerMt} · last mb=${r.lastMb}`,
    );
  }
  await ctx.close();
}
await browser.close();
