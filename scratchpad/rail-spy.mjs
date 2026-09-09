/**
 * rail-spy — does the jump rail point at the part of the page you are actually looking at?
 *
 * **Nothing in the twenty-one-harness fleet asserted on `.jump-rail`, and that is why it was
 * broken for eleven versions.** `JumpRail` observed the element carrying each id, which
 * `PeriodGroup` puts on the `<h2>` rather than on the `<section>` — a ~40px target read through
 * a band a tenth of the viewport high, so it intersected only while transiting about 130px of
 * scroll. Measured on `/monthly/`: nothing marked at 0, 1200 or 2400, `October 2025` at the very
 * bottom, and October still lit after scrolling back to the top, because the callback could only
 * ever *set* a mark. 2.6.4 fixed it. This file is the gate that keeps it fixed.
 *
 * Two pages, because the two rails are shaped differently and the first fix passed on one and
 * failed on the other: `/monthly/` has eleven tall `<section>` targets, `/timeline/` has two
 * 40px `<li>` year markers with no section anywhere near them.
 *
 * Read the `.here` class directly. Two earlier versions of this probe inferred the mark — first
 * by looking for `aria-current` or an accent colour (neither is the mechanism, so it reported
 * "nothing marked" everywhere and accused the page), then by finding the item unlike its
 * neighbours, which cannot work on a two-item rail: with one marked there is no majority, and
 * with none there is no minority. **Guessing at a mechanism is only reasonable while you have
 * not read the code that implements it.**
 *
 * **Verified against the bug it exists for**, because a check that cannot fail is worse than no
 * check — `card-mechanics` spent a version green on an assertion whose subject had been deleted.
 * With `JumpRail`'s pre-2.6.4 script pasted back in, this file reports **6/10**: `/monthly/`
 * marks the right thing at 2 positions of 7 and arrives back at the top still holding
 * `October 2025`, and `/timeline/` marks nothing at any of its 7. Every one of the four failures
 * is a symptom that was observed by hand before this file existed.
 */
import { launch, BASE, fresh, report } from './lib/fixture.mjs';

const { ok, note, done } = report();

/**
 * What the rail says, and what is actually at the reading line — the two halves the check
 * compares. `.here` is read straight off the class `JumpRail` toggles; the section is found the
 * same way the rail finds it, so the two cannot drift apart in this file's favour.
 */
const readRail = (page) =>
  page.evaluate(() => {
    const links = [...document.querySelectorAll('.jump-rail a[data-jump]')];
    const line = window.innerHeight * 0.2;
    // The answer the page *should* give, derived from the DOM rather than from JumpRail's own
    // bookkeeping: the last target whose top has passed the reading line.
    let expect = null;
    for (const a of links) {
      const el = document.getElementById(a.dataset.jump);
      const region = el?.closest('section') ?? el;
      if (region && region.getBoundingClientRect().top <= line) expect = a.textContent.trim();
    }
    return {
      n: links.length,
      marked: links.filter((a) => a.classList.contains('here')).map((a) => a.textContent.trim()),
      expect,
      y: Math.round(window.scrollY),
    };
  });

const jump = async (page, y) => {
  await page.evaluate((t) => window.scrollTo({ top: t, behavior: 'instant' }), y);
  await page.waitForFunction(
    () => {
      const seen = window.__ry;
      window.__ry = Math.round(window.scrollY);
      return seen === window.__ry;
    },
    null,
    { polling: 50 },
  );
  // One more frame than the rail needs: it repaints inside a `requestAnimationFrame`.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
};

const browser = await launch();
for (const path of ['/monthly/', '/timeline/']) {
  const ctx = await fresh(browser, { viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + path, { waitUntil: 'load' });
  const max = await page.evaluate(
    () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
  );

  const first = await readRail(page);
  ok(`${path} has a rail to check`, first.n > 1, `${first.n} items`);

  // At the very top the reader is in the page's own header, above every section, and the rail
  // should say nothing. This is also the regression that mattered most: the old rail arrived
  // here holding whatever it had latched onto last.
  ok(
    `${path} says nothing above the first section`,
    first.marked.length === 0,
    first.marked.join(', ') || 'clear',
  );

  let agreed = 0;
  let checked = 0;
  const seen = new Set();
  for (const frac of [0.08, 0.2, 0.35, 0.5, 0.7, 0.9, 1]) {
    await jump(page, Math.round(max * frac));
    const r = await readRail(page);
    checked++;
    if (r.marked.length === 1 && r.marked[0] === r.expect) agreed++;
    else note(`y=${r.y}: rail says [${r.marked.join(', ') || '—'}], page is in [${r.expect ?? '—'}]`);
    if (r.marked[0]) seen.add(r.marked[0]);
  }
  ok(`${path} marks the section under the reading line, everywhere`, agreed === checked, `${agreed}/${checked} positions`);

  // A rail that latches would show one label for the whole descent. On /monthly/ there are
  // eleven sections and seven stops, on /timeline/ two years — either way, more than one.
  ok(`${path} actually moves as you scroll`, seen.size > 1, `${seen.size} distinct: ${[...seen].join(', ')}`);

  // And back to the top, which is where the old bug was visible without scrolling at all.
  await jump(page, 0);
  const back = await readRail(page);
  ok(`${path} clears again on the way back up`, back.marked.length === 0, back.marked.join(', ') || 'clear');

  await ctx.close();
}
await browser.close();
if (!done()) process.exit(1);
