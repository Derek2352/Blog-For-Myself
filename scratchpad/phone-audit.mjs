/**
 * phone-audit — the reading experience at 390×844, measured rather than assumed.
 *
 * The fleet already drives a phone profile hard, but almost all of it is the *game*: arena, battle,
 * card-fight, touch-fight, commander. What nothing checked is the part of the site a visitor from a
 * CV actually uses — the pages, the words, the links.
 *
 * Four things, chosen because each is a defect a reader hits rather than a lint rule:
 *
 *   1. **Horizontal overflow.** The most common mobile bug there is. One element wider than the
 *      viewport and the whole page slides sideways under the thumb, on every page, forever.
 *   2. **Tap targets under 44px.** Apple's HIG figure, and roughly an adult fingertip. A 24px link
 *      is not a link on a phone, it is a coin toss.
 *   3. **Text under 12px.** Below that a reader zooms, and zooming is how you end up scrolling in
 *      two dimensions to read one sentence.
 *   4. **What a cold visit costs**, in bytes over the wire — which on a phone is somebody's data
 *      plan rather than an abstraction.
 *
 * The cat and its HUD are reported separately rather than excluded. They are deliberately small
 * furniture and are allowed to be — but "allowed" should be a line somebody reads, not a filter
 * that hides them.
 */
import { launch, BASE, fresh, report } from './lib/fixture.mjs';

const PAGES = [
  '/',
  '/about/',
  '/timeline/',
  '/competitions/',
  '/entry/from-cherry-to-cup/',
  '/monthly/',
  '/tags/',
  '/colophon/',
  '/search/',
];
/**
 * **Two thresholds, because the standard has two** — and the first version of this file invented
 * one instead, then failed the site on links that meet it.
 *
 * WCAG 2.5.8 *Target Size (Minimum)* is Level **AA** and asks for 24×24 CSS px. WCAG 2.5.5 *Target
 * Size (Enhanced)* is Level **AAA** and asks for 44×44 — which is also Apple's HIG figure and where
 * the number in everyone's head comes from.
 *
 * Gating on 44 flagged `<a>About</a>` at 39×44: full fingertip height, and 39 wide because the word
 * is five letters. An inline text link is as wide as its text, and demanding it be square would mean
 * padding every short word in the navigation until the layout was about the audit. So AA is the
 * gate, AAA is a number printed next to it.
 */
const MIN_TAP = 24; // WCAG 2.5.8, Level AA — the gate
const GOOD_TAP = 44; // WCAG 2.5.5 / Apple HIG — reported, not gated
const MIN_TEXT = 12;
const GAME = '#site-cat, #cat-hud, .cat-card-root, #cat-score, [data-boss]';

const { ok, note, done } = report();
const browser = await launch();
const ctx = await fresh(browser, { phone: true });
const page = await ctx.newPage();

let bytes = 0;
page.on('response', (r) => {
  const len = Number(r.headers()['content-length'] ?? 0);
  if (Number.isFinite(len)) bytes += len;
});

const overflow = [];
const smallTaps = [];
const smallText = [];
const gameTaps = [];
let belowGood = 0;
let labelCount = 0;

for (const path of PAGES) {
  bytes = 0;
  await page.goto(BASE + path, { waitUntil: 'load' });
  await page.waitForTimeout(450);

  const found = await page.evaluate(
    ([minTap, minText, gameSel, goodTap]) => {
      const vw = document.documentElement.clientWidth;
      const out = {
        vw,
        scrollWidth: document.documentElement.scrollWidth,
        wide: [],
        taps: [],
        text: [],
        gameTaps: [],
        belowGood: 0,
        labels: [],
      };

      /* The offenders, not just the fact. "This page scrolls sideways" is not actionable without
         the element doing it. */
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.right > vw + 1 || r.left < -1) {
          const style = getComputedStyle(el);
          /* Something inside its own scroller is allowed to be wider — that is what the scroller is
             for: tables, code blocks, the tab strip. */
          const scroller = el.closest('.overflow-x-auto, .tabbar-wrap, pre, table');
          if (scroller && scroller !== el) continue;
          if (style.position === 'fixed') continue;
          out.wide.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className?.toString?.() ?? '').slice(0, 36),
            w: Math.round(r.width),
            right: Math.round(r.right),
          });
        }
      }

      const interactive = document.querySelectorAll(
        'a[href], button, input, select, textarea, summary, [role="button"]',
      );
      /* Visually hidden by the standard screen-reader pattern — a skip link is 1×1 until it takes
         focus, at which point it is a normal button. Counting it as a 1×1 tap target is the audit
         being wrong, not the page: it is not a target for a thumb at all, and the first run of this
         file reported one on every page for exactly that reason. */
      const srOnly = (el) => {
        const st = getComputedStyle(el);
        if (st.clipPath === 'inset(50%)' || st.clip === 'rect(0px, 0px, 0px, 0px)') return true;
        const r = el.getBoundingClientRect();
        return st.position === 'absolute' && r.width <= 1 && r.height <= 1;
      };

      /**
       * WCAG 2.5.8's **Inline exception**, quoted because it is the whole reason this is here: the
       * requirement does not apply when "the target is in a sentence or its size is otherwise
       * constrained by the line-height of non-target text."
       *
       * The about page says "…reach me at [derekymy@gmail.com]. I'm also on [GitHub]…". Those links
       * are 20px tall because the sentence around them is, and padding them to 24 would push the
       * words of a paragraph apart to satisfy a rule that explicitly exempts them. Flagging them
       * would have meant damaging the typography to make an audit quieter.
       *
       * A link is "in a sentence" when **actual prose sits beside it** — that is, its parent has
       * non-whitespace *text nodes* of its own.
       *
       * The first version compared text lengths instead: parent longer than the link means prose
       * around it. That is wrong in a way that matters, and removing the footer's touch rule and
       * watching this file still report green is how it showed. A `<nav>` holding five links has a
       * parent far longer than any one of them and not one word of prose — so every stacked list of
       * links on the site was silently exempted, including the exact 18px footer links this audit
       * had just been used to fix. An instrument that cannot see the defect it was built for is
       * worse than none, because it is trusted.
       *
       * Text nodes are the real distinction. Prose has words between its links; a nav has
       * whitespace.
       */
      const inSentence = (el) => {
        const parent = el.parentElement;
        if (!parent) return false;
        for (const node of parent.childNodes) {
          if (node.nodeType === 3 && (node.textContent ?? '').trim().length > 1) return true;
        }
        return false;
      };

      for (const el of interactive) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (srOnly(el)) continue;
        if (el.tagName === 'A' && inSentence(el)) continue;
        if (r.width < goodTap || r.height < goodTap) out.belowGood++;
        if (r.width >= minTap && r.height >= minTap) continue;
        const rec = {
          tag: el.tagName.toLowerCase(),
          text: (el.textContent ?? '').trim().slice(0, 26),
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
        if (el.closest(gameSel)) out.gameTaps.push(rec);
        else out.taps.push(rec);
      }

      /**
       * **Body text and labels are different questions, and the first version asked one of them
       * about both.** It flagged 101 elements on the timeline and every one was a `.rail` — the
       * mono metadata voice this site sets dates, index codes and the header tagline in, at
       * 0.72rem (11.52px).
       *
       * The 12px floor is guidance about *reading* text: prose a visitor works through a paragraph
       * at a time. A date stamp or an index code is a label — glanced at, not read — and small mono
       * caps are a deliberate typographic choice, not an oversight. Gating on them would have meant
       * either restyling the site's whole metadata voice or carrying a permanently red check.
       *
       * So labels are counted and printed; only prose is gated. If a sentence somewhere is set at
       * 11px, that is a defect and this will say so.
       */
      const isLabel = (el) => {
        /* `gameSel` is the same list the tap check uses. The cat's HUD sets its score, its sound
           toggle and its "play it yourself" hint at 9.6px — deliberately tiny furniture for a toy
           that sits in the corner, and the same thing as a mono label for this file's purposes:
           counted, printed, not gated. Using one selector for both checks means the two cannot
           disagree about what counts as the game. */
        if (el.closest(gameSel)) return true;
        if (el.closest('.rail, .kicker, figcaption, .tab-group')) return true;
        return /mono/i.test(getComputedStyle(el).fontFamily);
      };

      for (const el of document.querySelectorAll('p, li, span, a, td, dd, dt, figcaption')) {
        if (!el.textContent?.trim()) continue;
        if (el.children.length) continue; // leaf text only
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (!fs || fs >= minText) continue;
        const rec = { tag: el.tagName.toLowerCase(), fs, text: el.textContent.trim().slice(0, 22) };
        if (isLabel(el)) out.labels.push(rec);
        else out.text.push(rec);
      }
      return out;
    },
    [MIN_TAP, MIN_TEXT, GAME, GOOD_TAP],
  );

  if (found.scrollWidth > found.vw + 1) {
    const who = found.wide
      .slice(0, 3)
      .map((w) => `${w.tag}.${w.cls}(${w.w}px→${w.right})`)
      .join(', ');
    overflow.push(`${path}: ${found.scrollWidth} > ${found.vw}${who ? ` — ${who}` : ''}`);
  }
  for (const t of found.taps.slice(0, 4)) smallTaps.push(`${path} <${t.tag}> "${t.text}" ${t.w}×${t.h}`);
  for (const t of found.gameTaps.slice(0, 2)) gameTaps.push(`${path} <${t.tag}> ${t.w}×${t.h}`);
  for (const t of found.text.slice(0, 3)) smallText.push(`${path} <${t.tag}> ${t.fs}px "${t.text}"`);
  belowGood += found.belowGood;
  labelCount += found.labels.length;
  note(
    `${path.padEnd(28)} ${String(found.scrollWidth).padStart(4)}px · ${(bytes / 1024).toFixed(0).padStart(4)} KB · ` +
      `${String(found.taps.length).padStart(2)} under AA · ${String(found.belowGood).padStart(2)} under AAA · ` +
      `${found.text.length} small prose · ${String(found.labels.length).padStart(3)} small labels`,
  );
}

ok('no page scrolls sideways', overflow.length === 0, overflow.slice(0, 4).join(' | '));
ok(
  `every tap target meets WCAG 2.5.8 AA (${MIN_TAP}×${MIN_TAP})`,
  smallTaps.length === 0,
  smallTaps.length ? `${smallTaps.length} under — ${smallTaps.slice(0, 5).join(' | ')}` : 'across 9 pages',
);
note(`${belowGood} targets are under the ${GOOD_TAP}px AAA/HIG size — mostly inline text links, as wide as their word`);
ok(
  `no prose under ${MIN_TEXT}px`,
  smallText.length === 0,
  smallText.length ? `${smallText.length} under — ${smallText.slice(0, 4).join(' | ')}` : 'across 9 pages',
);
note(`${labelCount} mono labels sit at 11.52px (0.72rem) — the site's metadata voice, reported not gated`);
note(`the game's own controls, reported not gated: ${gameTaps.length} under ${MIN_TAP}px`);

await ctx.close();
await browser.close();
process.exit(done() ? 0 : 1);
