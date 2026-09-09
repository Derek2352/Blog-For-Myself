import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { entrySchema, logSchema } from './lib/content-schema';
import { validateData } from './lib/validate-data';

// fail fast on bad hand-edited data (categories/periods) before anything builds
validateData();

/**
 * Two collections, one content model:
 *  - entries: substantial items — cover + gallery + full four-part reflection
 *  - logs:    light monthly activities — short blurb, optional photo
 *
 * (Astro 5 content-layer syntax: the `glob` loader replaces the old `type: 'content'` — same
 * model as spec'd, same folders, plus it strips `/index.md` so `entries/foo/index.md` gets the
 * id `foo`.)
 *
 * **The rules themselves moved out**, to `src/lib/content-schema.ts`, when the Next build needed
 * to validate the same markdown. What is left here is the part that is genuinely Astro's: which
 * folders to glob, how to derive an id from a path, and the `image()` validator — the one thing
 * the two builds legitimately disagree about, which is why it is the one thing injected. See that
 * file's header for why the schema is not simply written twice.
 */

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
  schema: ({ image }) => entrySchema(image()),
});

// Light monthly activities: one optional image, short body
const logs = defineCollection({
  loader: contentGlob('./src/content/logs'),
  schema: ({ image }) => logSchema(image()),
});

export const collections = { entries, logs };
