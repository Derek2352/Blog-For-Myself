import rss from '@astrojs/rss';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { render } from 'astro:content';
import { getEntries, getLogs, entryHref, logHasBody, logHref } from '@/lib/content';
import { site } from '@/data/site';

/** Render an entry/log body to an HTML string for full-content feeds. */
async function bodyHtml(container, item) {
  try {
    const { Content } = await render(item);
    const html = await container.renderToString(Content);
    // drop the doc wrapper + author-only HTML comments (draft notes)
    return html
      .replace(/^<!DOCTYPE html>/i, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .trim();
  } catch {
    return '';
  }
}

export async function GET(context) {
  const [entries, logs, container] = await Promise.all([
    getEntries(),
    getLogs(),
    AstroContainer.create(),
  ]);

  // Body-less logs have no canonical page of their own, so they stay out of
  // the feed (they still appear on /monthly and their category page).
  const entryItems = await Promise.all(
    entries.map(async (e) => ({
      title: e.data.title,
      pubDate: e.data.date,
      description: e.data.summary,
      content: (await bodyHtml(container, e)) || undefined, // full reflection when written
      link: entryHref(e),
      categories: [e.data.category, ...e.data.tags],
    })),
  );
  const logItems = await Promise.all(
    logs.filter(logHasBody).map(async (l) => ({
      title: l.data.title,
      pubDate: l.data.date,
      description: l.data.summary ?? '',
      content: (await bodyHtml(container, l)) || undefined,
      link: logHref(l) ?? '/monthly/',
      categories: [l.data.category, ...l.data.tags],
    })),
  );

  const items = [...entryItems, ...logItems].sort(
    (a, b) => b.pubDate.getTime() - a.pubDate.getTime(),
  );

  return rss({
    title: `${site.title} — Portfolio & Log`,
    description: site.description,
    site: context.site,
    items,
    customData: '<language>en</language>',
  });
}
