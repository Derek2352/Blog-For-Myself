import type { APIRoute } from 'astro';
import { categories, type Category } from '@/data/categories';
import { getEntries, getLogs } from '@/lib/content';
import { renderOgCard } from '@/lib/og';

export function getStaticPaths() {
  return categories.map((category) => ({
    params: { slug: category.slug },
    props: { category },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const category = props.category as Category;
  const entries = (await getEntries()).filter((e) => e.data.category === category.slug).length;
  const logs = (await getLogs()).filter((l) => l.data.category === category.slug).length;
  const png = await renderOgCard({
    rail: `INDEX / ${category.slug} · ${entries} ${entries === 1 ? 'ENTRY' : 'ENTRIES'} · ${logs} ${logs === 1 ? 'LOG' : 'LOGS'}`,
    title: category.label,
  });
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
