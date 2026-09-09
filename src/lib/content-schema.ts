/**
 * What an entry and a log *are* — defined once, validated by both builds.
 *
 * ## Why this file exists
 *
 * The schema used to live inside `src/content.config.ts`, which is the only place Astro can read
 * it from. That was correct while Astro was the only consumer. The Next build has to validate the
 * same markdown, and the cheapest thing to do would have been to write a second schema next to the
 * second loader — which is how a content model ends up meaning two different things, and how the
 * two disagree on the day someone adds a field to one of them. The migration's whole risk is
 * forking something that should be single, and the content model is the thing least able to
 * survive being forked.
 *
 * So: one definition, parameterised by the *one* thing the two builds genuinely disagree about.
 *
 * ## The one genuine difference, and why it is a parameter
 *
 * `cover` and `gallery[].src` are images. Astro's content layer hands the schema an `image()`
 * validator that resolves `./images/cover.svg` against the entry's own folder and returns an
 * `ImageMetadata` object — width, height, format, and a hashed `src` — which is what makes
 * `<Image>` able to emit dimensions and stop the page reflowing as covers load. A static Next
 * export has no such helper at schema time; a cover there is a path that has to be resolved to a
 * public URL separately.
 *
 * That is a real difference in what the field *is*, not a difference in the rules, so it is the
 * only thing injected. Every other rule — the category must exist, tags must be kebab-case, a
 * video must be a URL or a root-relative path, `endDate` must not precede `date` — is written once
 * here and enforced identically on both sides.
 */
import { z } from 'zod';
import { categorySlugs } from '@/data/categories';

/**
 * A validator for an image field. Astro passes its own `image()`; the filesystem loader passes a
 * plain string schema. Not typed as `ZodType<ImageMetadata>`, because the two sides legitimately
 * produce different shapes — that difference is the point of the parameter, and pretending
 * otherwise here would just move the lie somewhere else.
 *
 * Both factories are **generic** in it rather than taking `z.ZodTypeAny` directly, and that is
 * load-bearing: a bare `ZodTypeAny` infers `cover` and `gallery[].src` as `any`, which does not
 * fail here — it fails four files away, where `[...slug].astro` hands the gallery to a component
 * expecting `ImageMetadata` and the compiler has nothing left to check it against. The generic
 * carries the caller's own image type all the way through `z.infer`, so Astro keeps the concrete
 * `ImageMetadata` it had before this file existed.
 */
export type ImageField = z.ZodTypeAny;

/**
 * `category` must name a real tab. A typo here would otherwise orphan an entry silently — it would
 * build, publish, and appear on no page — which is the worst failure this content model has,
 * because nothing anywhere goes red.
 */
const categoryField = z.string().refine((s) => categorySlugs.includes(s), {
  message: `Unknown category. Use one of [${categorySlugs.join(', ')}] or add a new one in src/data/categories.ts`,
});

/** Tags become `/tags/<tag>/` URLs, so they must survive being one. */
const tagField = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'Tags must be lowercase kebab-case (e.g. "ai-film")');

/** Substantial items: cover + gallery + the full four-part reflection. */
export const entrySchema = <T extends ImageField>(image: T) =>
  z
    .object({
      title: z.string(),
      category: categoryField, // drives the tab
      date: z.coerce.date(), // start date (sorting + timeline + period)
      endDate: z.coerce.date().optional(),
      /** When you wrote/last revised the reflection — shown on the rail. */
      updated: z.coerce.date().optional(),
      role: z.string().optional(),
      organization: z.string().optional(),
      location: z.string().optional(),
      summary: z.string(), // 1–2 sentence card blurb
      /** Optional one-line personal aside, shown as a margin note — your voice, not the CV's. */
      note: z.string().optional(),
      /** YouTube / Vimeo / Bilibili URL, or a root-relative self-hosted file. */
      video: z
        .string()
        .refine((v) => v.startsWith('/') || z.string().url().safeParse(v).success, {
          message: 'video must be a full URL or a root-relative path like /videos/film.mp4',
        })
        .optional(),
      cover: image,
      gallery: z
        .array(z.object({ src: image, alt: z.string(), caption: z.string().optional() }))
        .default([]),
      tags: z.array(tagField).default([]),
      links: z.array(z.object({ label: z.string(), url: z.string().url() })).default([]),
      featured: z.boolean().default(false),
      draft: z.boolean().default(false),
      order: z.number().optional(),
    })
    .superRefine((data, ctx) => {
      /* Both of these catch a mistyped year, which is otherwise invisible: the entry builds, and
         then sits in the wrong place on the timeline with nothing to indicate why. */
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
    });

/** Light monthly activities: one optional image, short body. */
export const logSchema = <T extends ImageField>(image: T) =>
  z.object({
    title: z.string(),
    category: categoryField, // attaches the log to a tab
    date: z.coerce.date(),
    kind: z
      .enum(['workshop', 'short-course', 'talk', 'certification', 'milestone', 'other'])
      .default('other'),
    summary: z.string().optional(),
    image: image.optional(),
    link: z.string().url().optional(),
    tags: z.array(tagField).default([]),
    draft: z.boolean().default(false),
  });
