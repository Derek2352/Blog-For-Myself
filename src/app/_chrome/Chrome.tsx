/**
 * The persistent chrome, assembled on the server.
 *
 * A server component so the cat's tab list and the card's tile pool are computed at build time
 * from the content layer — exactly where Astro computed them, in each component's frontmatter.
 * The interactive halves are the two client components it renders.
 */
import { getNavCategories, getNavTree } from '@/server/content';
import { resolveWash } from '@/lib/wash';
import SiteCat from './SiteCat';
import CatCard from './CatCard';

/**
 * Four routes that are not categories but are still places to go, so the board can be made of
 * the whole site rather than only its tabs. Copied from `CatCard.astro`, hues and all: a declared
 * hue wins, otherwise `resolveWash` hashes the slug into the warm band, so a fixed route gets a
 * sensible tile with no decision required — exactly as a brand-new tab would.
 */
const FIXED_TILES = [
  { label: 'About', slug: 'about' },
  { label: 'Timeline', slug: 'timeline' },
  { label: 'Search', slug: 'search' },
  { label: 'Colophon', slug: 'colophon' },
];

export default async function Chrome() {
  const [tabs, nav] = await Promise.all([getNavCategories(), getNavTree()]);
  const pool = [
    ...nav.map((c) => ({ label: c.label, hue: resolveWash(c).hue })),
    ...FIXED_TILES.map((f) => ({ label: f.label, hue: resolveWash(f).hue })),
  ];

  return (
    <>
      <SiteCat tabs={tabs.map((c) => c.slug)} />
      <CatCard poolJson={JSON.stringify(pool)} />
    </>
  );
}
