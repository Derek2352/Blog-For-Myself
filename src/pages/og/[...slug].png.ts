import type { APIRoute } from 'astro';
import { getEntries, entryCode, type Entry } from '@/lib/content';
import { categoryBySlug } from '@/data/categories';
import { railRange } from '@/lib/format';
import { renderOgCard } from '@/lib/og';
import { contentImagePath } from '@/lib/lqip';

export async function getStaticPaths() {
  const entries = await getEntries();
  return entries.map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
}

export const GET: APIRoute = async ({ props }) => {
  const entry = props.entry as Entry;
  const code = await entryCode(entry);
  const category = categoryBySlug(entry.data.category);
  // '→' isn't in the latin font subset satori loads, so the card uses '-'
  const rail = [
    code,
    railRange(entry.data.date, entry.data.endDate).replace(' → ', ' - '),
    category?.label ?? entry.data.category,
  ].join(' · ');
  const png = await renderOgCard({
    rail,
    title: entry.data.title,
    coverFile: (await contentImagePath('entries', entry.id, 'cover')) ?? undefined,
  });
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
