/**
 * JSON-LD builders — structured data so search engines understand who this
 * site is about and what each entry is. Person on home/about, Article on
 * entry pages. All values derive from site data and content frontmatter.
 */
import { site } from '@/data/site';
import type { Entry } from '@/lib/content';

export function personSchema(siteUrl: URL | undefined): Record<string, unknown> {
  const sameAs = [site.github, site.linkedin].filter(Boolean);
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: site.name,
    alternateName: 'Derek Yung',
    description: site.tagline,
    url: siteUrl?.toString(),
    email: `mailto:${site.email}`,
    sameAs,
  };
}

/** Home → Category → Entry breadcrumb trail for search results. */
export function breadcrumbSchema(
  siteUrl: URL | undefined,
  trail: { name: string; path: string }[],
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: siteUrl ? new URL(t.path, siteUrl).toString() : t.path,
    })),
  };
}

export function entrySchema(
  entry: Entry,
  opts: { url: string; image: string; categoryLabel: string },
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: entry.data.title,
    description: entry.data.summary,
    url: opts.url,
    image: opts.image,
    datePublished: entry.data.date.toISOString().slice(0, 10),
    dateModified: (entry.data.updated ?? entry.data.date).toISOString().slice(0, 10),
    articleSection: opts.categoryLabel,
    keywords: entry.data.tags.join(', '),
    inLanguage: 'en',
    author: { '@type': 'Person', name: site.name, url: site.github },
  };
}
