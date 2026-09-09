/**
 * The three things a static export cannot generate from a page: `rss.xml`, `sitemap.xml`, and the
 * OG share cards.
 *
 * Astro produced all three as *routes* — `rss.xml.js` and `og/[...slug].png.ts` were endpoints that
 * happened to emit non-HTML. `output: 'export'` has no route handlers by design (see
 * `next.config.ts` for why that trade was made), so they become build artifacts instead: same
 * inputs, same code where it is shareable, written straight into `out/`.
 *
 * **Nothing about the *content* of these files is reimplemented.** The share cards call
 * `renderOgCard` — the same satori + resvg composition, the same fonts, the same CJK subsetting —
 * and the feed and sitemap read the same loader every page reads. The only thing that changed is
 * who calls them and where the bytes land.
 *
 * One genuine loss, stated rather than hidden: Astro's feed carried each entry's **full rendered
 * reflection** in `<content:encoded>`, produced by running its own container renderer over the
 * body. This uses `renderMarkdown` for exactly the same purpose, so the feed keeps full content —
 * but it is now the Next pipeline's HTML rather than Astro's, which means the code blocks carry
 * Shiki's custom properties rather than Astro's inline styles. In a feed reader that shows as
 * unstyled code, which it already did.
 *
 * Run by `npm run build:next`, after `next build` and before Pagefind indexes `out/`.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadEntries, loadLogs } from '../src/server/content-fs';
import { indexCodes, entryHref, logHasBody, logHref } from '../src/lib/content-core';
import { renderMarkdown } from '../src/server/markdown';
import { renderOgCard } from '../src/lib/og';
import { contentImagePath } from '../src/lib/lqip';
import { categoryBySlug, categories } from '../src/data/categories';
import { railRange } from '../src/lib/format';
import { site } from '../src/data/site';
import { SITE_URL, absolute } from '../src/lib/site-url';

const OUT = path.join(process.cwd(), 'out');

/** The draft policy, matching every page: production builds hide drafts unless asked. */
const showDrafts = process.env.SHOW_DRAFTS === '1';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const [allEntries, allLogs] = await Promise.all([loadEntries(), loadLogs()]);
const entries = allEntries.filter((e) => showDrafts || !e.data.draft);
const logs = allLogs.filter((l) => showDrafts || !l.data.draft);
/* Codes come from the unfiltered lists — a code is a position in a sequence. */
const codes = indexCodes(allEntries, allLogs);

/* ------------------------------------------------------------------ *
 * rss.xml
 * ------------------------------------------------------------------ */

/* Body-less logs have no canonical page of their own, so they stay out of the feed (they still
   appear on /monthly and their category page). */
const feedItems = [
  ...(await Promise.all(
    entries.map(async (e) => ({
      title: e.data.title,
      pubDate: e.data.date,
      description: e.data.summary,
      content: (await renderMarkdown(e.body)) || undefined,
      link: entryHref(e),
      categories: [e.data.category, ...e.data.tags],
    })),
  )),
  ...(await Promise.all(
    logs.filter(logHasBody).map(async (l) => ({
      title: l.data.title,
      pubDate: l.data.date,
      description: l.data.summary ?? '',
      content: (await renderMarkdown(l.body)) || undefined,
      link: logHref(l)!,
      categories: [l.data.category, ...l.data.tags],
    })),
  )),
].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(site.title)}</title>
    <description>${esc(site.description)}</description>
    <link>${SITE_URL}/</link>
    <language>${site.locale}</language>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
${feedItems
  .map(
    (i) => `    <item>
      <title>${esc(i.title)}</title>
      <link>${absolute(i.link)}</link>
      <guid isPermaLink="true">${absolute(i.link)}</guid>
      <pubDate>${i.pubDate.toUTCString()}</pubDate>
      <description>${esc(i.description)}</description>
${i.categories.map((c) => `      <category>${esc(c)}</category>`).join('\n')}
${i.content ? `      <content:encoded><![CDATA[${i.content}]]></content:encoded>` : ''}
    </item>`,
  )
  .join('\n')}
  </channel>
</rss>
`;
await writeFile(path.join(OUT, 'rss.xml'), rss, 'utf8');

/* ------------------------------------------------------------------ *
 * sitemap.xml
 * ------------------------------------------------------------------ */

/* The OG endpoints are routes rather than pages and were filtered out of Astro's sitemap; they are
   simply not listed here, which is the same outcome by construction. */
const urls = [
  '/',
  '/about/',
  '/colophon/',
  '/timeline/',
  '/monthly/',
  '/search/',
  '/tags/',
  ...categories.map((c) => `/${c.slug}/`),
  ...entries.map((e) => entryHref(e)),
  ...logs.filter(logHasBody).map((l) => logHref(l)!),
  ...[...new Set([...entries, ...logs].flatMap((i) => i.data.tags))].map((t) => `/tags/${t}/`),
];
await writeFile(
  path.join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...new Set(urls)].map((u) => `  <url><loc>${absolute(u)}</loc></url>`).join('\n')}
</urlset>
`,
  'utf8',
);

/* ------------------------------------------------------------------ *
 * OG share cards
 * ------------------------------------------------------------------ */

await mkdir(path.join(OUT, 'og', 'category'), { recursive: true });

/** Default share card for pages without their own (home, monthly, about…). */
await writeFile(
  path.join(OUT, 'og', 'site.png'),
  Buffer.from(
    await renderOgCard({
      rail: 'PORTFOLIO & REFLECTIONS · HONG KONG',
      title: `${site.name} — the director’s cut of a CV.`,
      footer: site.tagline,
    }),
  ),
);

for (const entry of entries) {
  const category = categoryBySlug(entry.data.category);
  /* '→' isn't in the latin font subset satori loads, so the card uses '-'. */
  const rail = [
    codes.get(`entries:${entry.id}`) ?? 'E-000',
    railRange(entry.data.date, entry.data.endDate).replace(' → ', ' - '),
    category?.label ?? entry.data.category,
  ].join(' · ');
  const png = await renderOgCard({
    rail,
    title: entry.data.title,
    coverFile: (await contentImagePath('entries', entry.id, 'cover')) ?? undefined,
  });
  await writeFile(path.join(OUT, 'og', `${entry.id}.png`), Buffer.from(png));
}

for (const c of categories) {
  /* The rail carries live counts, not the blurb — copied from the endpoint this replaces rather
     than invented. The first attempt guessed a plausible format and produced eight cards that were
     plausible and wrong; the twenty-two entry cards were byte-identical on the first run precisely
     because that endpoint *was* read. Worth the line: "looks like the sort of thing it said" is
     not a port. */
  const n = entries.filter((e) => e.data.category === c.slug).length;
  const l = logs.filter((x) => x.data.category === c.slug).length;
  const png = await renderOgCard({
    rail: `INDEX / ${c.slug} · ${n} ${n === 1 ? 'ENTRY' : 'ENTRIES'} · ${l} ${l === 1 ? 'LOG' : 'LOGS'}`,
    title: c.label,
  });
  await writeFile(path.join(OUT, 'og', 'category', `${c.slug}.png`), Buffer.from(png));
}

console.log(
  `wrote rss.xml (${feedItems.length} items), sitemap.xml (${new Set(urls).size} urls), ${entries.length + categories.length + 1} og cards`,
);
