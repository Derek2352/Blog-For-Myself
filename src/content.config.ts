import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { categorySlugs } from './data/categories';
import { validateData } from './lib/validate-data';

// fail fast on bad hand-edited data (categories/periods) before anything builds
validateData();

/**
 * Two collections, one content model:
 *  - entries: substantial items — cover + gallery + full four-part reflection
 *  - logs:    light monthly activities — short blurb, optional photo
 *
 * (Astro 5 content-layer syntax: the `glob` loader replaces the old
 * `type: 'content'` — same model as speced, same folders, plus it strips
 * `/index.md` so `entries/foo/index.md` gets the id `foo`.)
 *
 * `category` must match a slug in src/data/categories.ts — the build fails
 * with a clear message otherwise, so a typo can never silently orphan content.
 */
const categoryField = z.string().refine((s) => categorySlugs.includes(s), {
  message: `Unknown category. Use one of [${categorySlugs.join(', ')}] or add a new one in src/data/categories.ts`,
});

/** Tags become /tags/<tag>/ URLs, so they must be lowercase kebab-case. */
const tagField = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'Tags must be lowercase kebab-case (e.g. "ai-film")');

const contentGlob = (base: string) =>
  glob({
    pattern: ['**/[^_]*.{md,mdx}', '!**/_*/**'],
    base,
    generateId: ({ entry }) =>
      entry.replace(/\.(md|mdx)$/, '').replace(/\/index$/, ''),
  });

// Substantial items: cover + gallery + full reflection
const entries = defineCollection({
  loader: contentGlob('./src/content/entries'),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      category: categoryField, // drives the tab
      date: z.coerce.date(), // start date (sorting + timeline + period)
      endDate: z.coerce.date().optional(),
      /** When you wrote/last revised the reflection — shown on the rail. */
      updated: z.coerce.date().optional(),
      role: z.string().optional(), // "Individual Champion", "Selected Delegate", …
      organization: z.string().optional(),
      location: z.string().optional(),
      summary: z.string(), // 1–2 sentence card blurb
      /** Optional one-line personal aside, shown as a margin note on the
       *  entry page — your voice, not the CV's. */
      note: z.string().optional(),
      /** Optional video (YouTube / Vimeo / Bilibili URL, or a root-relative
       *  self-hosted file like "/videos/film.mp4"). When set, the entry page
       *  screens the film where the cover would sit — click-to-play. */
      video: z
        .string()
        .refine((v) => v.startsWith('/') || z.string().url().safeParse(v).success, {
          message: 'video must be a full URL or a root-relative path like /videos/film.mp4',
        })
        .optional(),
      cover: image(),
      gallery: z
        .array(
          z.object({
            src: image(),
            alt: z.string(),
            caption: z.string().optional(),
          }),
        )
        .default([]),
      tags: z.array(tagField).default([]),
      links: z
        .array(z.object({ label: z.string(), url: z.string().url() }))
        .default([]),
      featured: z.boolean().default(false),
      draft: z.boolean().default(false),
      order: z.number().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.endDate && data.endDate < data.date) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endDate'],
          message: `endDate (${data.endDate.toISOString().slice(0, 10)}) is before date (${data.date.toISOString().slice(0, 10)}) — swap them`,
        });
      }
      if (data.updated && data.updated < data.date) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['updated'],
          message: 'updated is before the entry date — check the year',
        });
      }
    }),
});

// Light monthly activities: one optional image, short body
const logs = defineCollection({
  loader: contentGlob('./src/content/logs'),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      category: categoryField, // attaches the log to a tab
      date: z.coerce.date(),
      kind: z
        .enum(['workshop', 'short-course', 'talk', 'certification', 'milestone', 'other'])
        .default('other'),
      summary: z.string().optional(),
      image: image().optional(),
      link: z.string().url().optional(),
      tags: z.array(tagField).default([]),
      draft: z.boolean().default(false),
    }),
});

export const collections = { entries, logs };
