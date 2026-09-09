/**
 * Home — the first page ported, and deliberately the one that touches the most machinery: the
 * content layer, the shared derivations, covers with real dimensions, and the archival codes.
 *
 * It renders from `src/server/content.ts`, which means every number on it is derived from the
 * markdown exactly as the Astro page's were.
 */
import Link from 'next/link';
import { getEntries, getNavCategories, entryHref, categoryHref } from '@/server/content';
import { site } from '@/data/site';

export default async function HomePage() {
  const [entries, tabs] = await Promise.all([getEntries(), getNavCategories()]);
  const featured = entries.filter((e) => e.data.featured).slice(0, 3);

  return (
    <div className="wrap py-10">
      <h1 className="font-display text-4xl leading-tight">{site.name}</h1>
      <p className="mt-2 max-w-2xl text-muted">{site.tagline}</p>

      <nav aria-label="Sections" className="mt-8 flex flex-wrap gap-3">
        {tabs.map((c) => (
          <Link key={c.slug} href={categoryHref(c.slug)} className="rail hover:text-accent">
            {c.label} <span className="text-muted">{c.entryCount + c.logCount}</span>
          </Link>
        ))}
      </nav>

      <section className="mt-10">
        <h2 className="rail">Featured</h2>
        <ul className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((e) => (
            <li key={e.id}>
              <Link href={entryHref(e)} className="group block no-underline">
                {/* Dimensions come from the loader's `measure()`, so the card reserves its space
                    before the cover loads — the property Astro's `image()` was providing. */}
                <img
                  src={e.data.cover.src}
                  alt=""
                  width={e.data.cover.width}
                  height={e.data.cover.height}
                  className="w-full rounded border border-line"
                />
                <h3 className="mt-3 font-display text-xl group-hover:text-accent">{e.data.title}</h3>
                <p className="mt-1 text-sm text-muted">{e.data.summary}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
