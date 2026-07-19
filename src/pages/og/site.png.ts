import type { APIRoute } from 'astro';
import { site } from '@/data/site';
import { renderOgCard } from '@/lib/og';

/** Default share card for pages without their own (home, monthly, about…). */
export const GET: APIRoute = async () => {
  const png = await renderOgCard({
    rail: 'PORTFOLIO & REFLECTIONS · HONG KONG',
    title: `${site.name} — the director’s cut of a CV.`,
    footer: site.tagline,
  });
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
