import rss from '@astrojs/rss';
import { getEntries, getLogs, entryHref, logHasBody, logHref } from '@/lib/content';
import { site } from '@/data/site';

export async function GET(context) {
  const [entries, logs] = await Promise.all([getEntries(), getLogs()]);
  // Body-less logs have no canonical page of their own, so they stay out of
  // the feed (they still appear on /monthly and their category page).
  const items = [
    ...entries.map((e) => ({
      title: e.data.title,
      pubDate: e.data.date,
      description: e.data.summary,
      link: entryHref(e),
      categories: [e.data.category, ...e.data.tags],
    })),
    ...logs.filter(logHasBody).map((l) => ({
      title: l.data.title,
      pubDate: l.data.date,
      description: l.data.summary ?? '',
      link: logHref(l) ?? '/monthly/',
      categories: [l.data.category, ...l.data.tags],
    })),
  ].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return rss({
    title: `${site.title} — Portfolio & Log`,
    description: site.description,
    site: context.site,
    items,
    customData: '<language>en</language>',
  });
}
