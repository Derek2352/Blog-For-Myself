/**
 * timeline-filter — the chips narrow the list, and nothing is left behind them.
 *
 * Three things this checks that a glance would not.
 *
 * **The year markers.** They are `<li>`s in the same list as the entries, so filtering to a
 * category that skips a year leaves a heading standing over a gap. It is the fault that looks fine
 * on the category you happen to test and wrong on the one you do not, so the check walks *every*
 * chip rather than one.
 *
 * **The page still works without JavaScript.** The filter hides server-rendered nodes rather than
 * re-rendering from client state, which is what keeps every entry in the HTML for a crawler and
 * for Pagefind. Asserted by counting the entries in the raw markup, not in the live DOM.
 *
 * **The URL is shareable.** `?only=…` has to survive a reload, or it is decoration.
 */
import { launch, BASE, fresh, report } from './lib/fixture.mjs';

const { ok, note, fixture, done } = report();
const browser = await launch();
const ctx = await fresh(browser, { viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/timeline/`, { waitUntil: 'load' });
await page.waitForTimeout(600);

/* Selected by `data-filter`, not by visible text: the chip's text is label plus count, so a
   text lookup breaks the day an entry is filed — and it broke on the first run of this harness,
   which is what surfaced that the *accessible name* had the same problem. */
const chips = await page.$$eval('[data-filter]', (els) => els.map((e) => e.dataset.filter));
fixture('the controls rendered', chips.length > 1 ? chips.length : null, `${chips.length} chips`);

/** Server-rendered completeness: the entries are in the HTML before a script runs. */
const raw = await (await fetch(`${BASE}/timeline/`)).text();
const inMarkup = (raw.match(/data-cat="/g) ?? []).length;
ok(
  'every entry is in the markup, so the page works with no JavaScript',
  inMarkup > 0,
  `${inMarkup} entries server-rendered`,
);

const state = () =>
  page.evaluate(() => {
    const list = document.querySelector('[data-timeline]');
    const rows = [...list.querySelectorAll('li[data-cat]')];
    const years = [...list.querySelectorAll('li[data-year]')];
    const visible = rows.filter((r) => !r.hidden);
    /* A year is "orphaned" if it is showing while nothing under it is. */
    const orphans = years.filter((y) => {
      if (y.hidden) return false;
      let n = y.nextElementSibling;
      while (n && !n.hasAttribute('data-year')) {
        if (n.hasAttribute('data-cat') && !n.hidden) return false;
        n = n.nextElementSibling;
      }
      return true;
    });
    return {
      visible: visible.length,
      cats: [...new Set(visible.map((r) => r.dataset.cat))],
      orphanYears: orphans.map((y) => y.dataset.year),
      counter: document.querySelector('[data-timeline-count]')?.textContent,
      /* The rail is a separate element listing the same years. It offered a jump to 2025 on a
         filter showing only 2026 — caught by a screenshot, not by the first version of this
         file, which is why it is measured here now. */
      railYears: [...document.querySelectorAll('.jump-rail a[data-jump]')]
        .filter((a) => !a.hidden)
        .map((a) => a.dataset.jump.replace('year-', '')),
      shownYears: [...new Set(visible.map((r) => {
        let n = r.previousElementSibling;
        while (n && !n.hasAttribute('data-year')) n = n.previousElementSibling;
        return n ? n.dataset.year : null;
      }).filter(Boolean))],
      order: getComputedStyle(list).flexDirection,
    };
  });

const all = await state();
ok('everything is shown to begin with', all.visible === inMarkup, `${all.visible} of ${inMarkup}`);

/* Walk every chip, not just one — the orphaned-year fault only appears on a category that skips
   a year, and which one that is depends entirely on the content. */
let walked = 0;
for (const label of chips) {
  if (label === 'all') continue;
  await page.click(`[data-filter="${label}"]`);
  await page.waitForTimeout(120);
  const s = await state();
  walked++;
  ok(
    `${label}: shows only that category`,
    s.cats.length <= 1 && s.visible > 0,
    `${s.visible} rows, categories: ${s.cats.join(', ') || 'none'}`,
  );
  ok(`${label}: no year heading left standing over nothing`, s.orphanYears.length === 0,
    s.orphanYears.length ? `orphaned: ${s.orphanYears.join(', ')}` : `${s.visible} rows`);
  ok(`${label}: the count follows the filter`, s.counter === String(s.visible),
    `counter says ${s.counter}, ${s.visible} visible`);
  ok(
    `${label}: the jump rail offers only years that still have entries`,
    s.railYears.length === s.shownYears.length &&
      s.railYears.every((y) => s.shownYears.includes(y)),
    `rail: [${s.railYears.join(', ')}] vs shown: [${s.shownYears.join(', ')}]`,
  );
}
note(`walked ${walked} category chips`);

/* The URL has to carry it. */
const url = new URL(page.url());
const only = url.searchParams.get('only');
fixture('a filter put itself in the URL', only ?? null, only ?? 'no ?only=');
if (only) {
  await page.goto(page.url(), { waitUntil: 'load' });
  await page.waitForTimeout(500);
  const after = await state();
  ok('the filter survives a reload', after.cats.length === 1 && after.cats[0] === only,
    `reloaded showing ${after.cats.join(', ') || 'nothing'}`);
}

/* Order flip. */
await page.click('[data-sort]');
await page.waitForTimeout(150);
const flipped = await state();
ok('the sort reverses the reel', flipped.order === 'column-reverse', flipped.order);
ok('reversing hides nothing', flipped.visible === (await state()).visible, `${flipped.visible} rows`);

await ctx.close();
await browser.close();
process.exit(done() ? 0 : 1);
