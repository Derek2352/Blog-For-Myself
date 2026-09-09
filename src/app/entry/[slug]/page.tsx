/**
 * The entry page — the reason the site exists.
 *
 * Ported whole, including the pieces that are easy to lose: the cover's placeholder height cap,
 * the plate/blur-up split, the prev/next paper plane, the JSON-LD pair, and the reflection's
 * DOM-before-rail ordering.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getEntries,
  getCodes,
  relatedEntries,
  categoryHref,
  entryHref,
  sortForCategory,
  reflectionWritten,
  getEntry,
} from '@/server/content';
import { renderMarkdown } from '@/server/markdown';
import { categoryBySlug } from '@/data/categories';
import { resolveWash } from '@/lib/wash';
import { isPlaceholderCover, orientation } from '@/lib/images';
import { isGeneratedPlate } from '@/lib/cover-plate';
import { entrySchema, breadcrumbSchema } from '@/lib/schema';
import { SITE_URL, absolute } from '@/lib/site-url';
import MetadataRail from '../../_ui/MetadataRail';
import EntryCard from '../../_ui/EntryCard';
import TagChip from '../../_ui/TagChip';
import ReadingAids from '../../_ui/ReadingAids';
import PlaneNav from '../../_ui/PlaneNav';
import PageWash from '../../_chrome/PageWash';

export async function generateStaticParams() {
  return (await getEntries()).map((entry) => ({ slug: entry.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entry = await getEntry(slug);
  if (!entry) return {};
  const category = categoryBySlug(entry.data.category);
  return {
    title: entry.data.title,
    description: entry.data.summary,
    alternates: { canonical: entryHref(entry) },
    openGraph: {
      type: 'article',
      images: [
        {
          url: `/og/${entry.id}.png`,
          alt: `${entry.data.title} — ${category?.label ?? entry.data.category}`,
        },
      ],
    },
  };
}

export default async function EntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = await getEntry(slug);
  if (!entry) notFound();

  const [allEntries, codes, related] = await Promise.all([
    getEntries(),
    getCodes(),
    relatedEntries(entry),
  ]);
  const hasReflection = reflectionWritten(entry);
  const html = hasReflection ? await renderMarkdown(entry.body) : '';
  const code = codes.get(`entries:${entry.id}`) ?? 'E-000';
  const category = categoryBySlug(entry.data.category);
  const ogImage = absolute(`/og/${entry.id}.png`);
  const wash = resolveWash(category ?? { slug: entry.data.category });

  // prev/next within this category, same order as the category grid
  const siblings = sortForCategory(
    allEntries.filter((e) => e.data.category === entry.data.category),
  );
  const index = siblings.findIndex((e) => e.id === entry.id);
  const prev = index > 0 ? siblings[index - 1] : undefined;
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : undefined;
  const placeholderCover = isPlaceholderCover(entry.data.cover);

  /* A blur-up previews a photograph arriving. A plate has nothing to preview — it is flat sand, a
     grid and a crosshair — and on the dark theme the LQIP was actively wrong: `.blurup img` holds
     the image at `opacity: 0` until it loads, so the light blur painted first and the filtered
     plate arrived over it, a bright flash on every entry page in a dark room. Skipping it removes
     the flash. `blurup` goes with it: the class is what holds the image invisible, and without a
     background to hold it over there is nothing to fade in from. */
  const plate = isGeneratedPlate(entry.id);

  const schemas = [
    entrySchema(entry, {
      url: absolute(entryHref(entry)),
      image: ogImage,
      categoryLabel: category?.label ?? entry.data.category,
    }),
    breadcrumbSchema(new URL(SITE_URL), [
      { name: 'Home', path: '/' },
      { name: category?.label ?? entry.data.category, path: categoryHref(entry.data.category) },
      { name: entry.data.title, path: entryHref(entry) },
    ]),
  ];

  return (
    <>
      <PageWash hue={wash.hue} tab={entry.data.category} />
      {schemas.map((s, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(s).replace(/</g, '\\u003c') }}
        />
      ))}
      <ReadingAids />
      <article className="wrap py-10" data-pagefind-body>
        <span className="sr-only" data-pagefind-filter="type">
          Entry
        </span>
        <header className="max-w-3xl">
          <p className="kicker">
            {category && (
              <Link
                href={categoryHref(category.slug)}
                className="hover:underline"
                data-pagefind-filter="category"
              >
                {category.label}
              </Link>
            )}
            {' · '}
            {code}
            {entry.data.draft && <span className="text-signal-text"> · draft</span>}
          </p>
          <h1 className="mt-2 font-display text-4xl leading-[1.08] sm:text-5xl">
            {entry.data.title}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted">{entry.data.summary}</p>
          {entry.data.note && (
            <p className="mt-4 font-display text-xl italic leading-snug">
              <span className="text-signal-text" aria-hidden="true">
                ~{' '}
              </span>
              {entry.data.note}
            </p>
          )}
          {/* mobile: key facts up top; desktop shows them in the rail instead */}
          {(entry.data.role || entry.data.tags.length > 0) && (
            <div className="mt-4 flex flex-wrap items-center gap-2 lg:hidden">
              {entry.data.role && (
                <span className="rail rounded-(--radius-chip) border border-accent px-2 py-1 text-accent">
                  {entry.data.role}
                </span>
              )}
              {entry.data.tags.map((tag) => (
                <TagChip key={tag} tag={tag} />
              ))}
            </div>
          )}
        </header>

        <figure
          className={`frame mt-8 overflow-hidden${!plate ? ' blurup' : ''}`}
          data-plate={plate ? '' : undefined}
        >
          {/* wide covers run full width; tall/square ones hang matted at a capped height */}
          <img
            src={entry.data.cover.src}
            alt={`${entry.data.title} — cover image`}
            width={entry.data.cover.width}
            height={entry.data.cover.height}
            className={[
              orientation(entry.data.cover) === 'wide' ? 'w-full' : 'mx-auto w-auto max-h-[75vh]',
              /* An entry whose cover is still the placeholder put a 690px empty frame between the
                 summary and the first sentence — more than a screen of scrolling before the
                 writing starts, on every entry. Placeholders keep their place as an anchor at a
                 fraction of the height. A real photograph is not capped: this reverts by itself
                 the moment one lands, with no frontmatter change. */
              placeholderCover ? 'max-h-[13rem] object-cover sm:max-h-[15rem]' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        {/* Reflection comes first in the DOM so keyboard/reading order matches the mobile visual
            order (reflection, then rail); lg:order restores the rail to the left column. */}
        <div className="mt-10 grid gap-10 lg:grid-cols-[16rem_1fr] lg:gap-14">
          {hasReflection ? (
            <div
              className="prose-reflection min-w-0 lg:order-2"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <div className="min-w-0 self-start border-t border-line pt-6 lg:order-2">
              <p className="font-display text-2xl italic leading-snug">
                The full reflection is still being written.
              </p>
              <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted">
                The words for this one are coming — the rail alongside has the facts meanwhile.
              </p>
            </div>
          )}
          <MetadataRail entry={entry} code={code} />
        </div>

        {(prev || next) && (
          <nav
            className="mt-16 grid gap-3 sm:grid-cols-2"
            aria-label={`More in ${category?.label ?? entry.data.category}`}
            data-pagefind-ignore
          >
            {prev ? (
              <Link
                href={entryHref(prev)}
                data-plane="prev"
                className="panel group block p-4 transition-colors hover:border-accent"
              >
                <p className="rail">← previous · {codes.get(`entries:${prev.id}`) ?? ''}</p>
                <p className="mt-1 font-display text-lg leading-snug transition-colors group-hover:text-accent">
                  {prev.data.title}
                </p>
              </Link>
            ) : (
              <span className="hidden sm:block" />
            )}
            {next && (
              <Link
                href={entryHref(next)}
                data-plane="next"
                className="panel group block p-4 text-right transition-colors hover:border-accent"
              >
                <p className="rail">{codes.get(`entries:${next.id}`) ?? ''} · next →</p>
                <p className="mt-1 font-display text-lg leading-snug transition-colors group-hover:text-accent">
                  {next.data.title}
                </p>
              </Link>
            )}
          </nav>
        )}
        <PlaneNav
          prevHref={prev ? entryHref(prev) : undefined}
          nextHref={next ? entryHref(next) : undefined}
        />

        {related.length > 0 && (
          <section
            className="mt-16 border-t border-line pt-10"
            aria-labelledby="related-h"
            data-pagefind-ignore
          >
            <p className="kicker">Related</p>
            <h2 id="related-h" className="mt-1 font-display text-2xl">
              Nearby frames
            </h2>
            <div className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3" data-io-stagger>
              {related.map((r) => (
                <EntryCard key={r.id} entry={r} code={codes.get(`entries:${r.id}`) ?? 'E-000'} />
              ))}
            </div>
          </section>
        )}
      </article>
    </>
  );
}
