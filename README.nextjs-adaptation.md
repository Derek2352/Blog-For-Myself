# Derek Yung — Portfolio & Reflections

An editorial refresh of [Blog-For-Myself](https://github.com/Derek2352/Blog-For-Myself), adapted to Next.js App Router, TypeScript, and PostgreSQL/Drizzle in this workspace. This does not push changes to the original GitHub repository.

## Run

- Install dependencies with `npm install`.
- Set `DATABASE_URL` in `.env` to your PostgreSQL connection string.
- Apply the schema with `npx drizzle-kit push`.
- Start development with `npm run dev`.
- For production, use `npx next typegen`, `npm exec tsc -- --noEmit --pretty false`, and `npm run build`.

## Content workflow

Original Markdown, including unpublished drafts, lives in `content/entries/<slug>/index.md` and `content/logs/<slug>/index.md`. These are source files, not public assets. Edit or add a file, then run:

`node scripts/sync-content.mjs`

This validates the frontmatter and creates `src/data/entries.json`, excluding drafts. Rebuild to publish. The shared content layer in `src/lib/content.ts` drives categories, search, tags, chronological views, and detail pages.

- Identity, email, résumé: `src/data/site.ts`
- Categories and ordering: `src/data/categories.ts`
- Named seasons: `src/data/periods.ts`
- Featured selection: `featuredSlugs` in `src/lib/content.ts`
- Visual tokens, responsive styles, dark theme, print styles: `src/app/globals.css`

The Next.js adaptation does not include the original Astro content studio, media inbox, or Astro deployment scripts. Run the sync command after editing content; no CMS or authoring endpoint is exposed publicly. Original image galleries were generated placeholders; the refreshed site uses clearly labeled editorial cover art instead. Add original photographs and films when they are ready. No placeholder CV is advertised.

## Features

- Responsive home, subject collections, entry pages, timeline, monthly log, about page, and tag archives.
- Client-side full-text search across published titles, summaries, categories, and tags. Press `/` or `Cmd/Ctrl+K`.
- Category/type filtering and date sorting.
- Persistent light/dark preference; reduced-motion and print support.
- Safe Markdown rendering, share-link copying, original reflection prose.
- PostgreSQL-backed appreciations, idempotent per entry and anonymous visitor cookie. Cookies are HTTP-only, SameSite=Lax, and secure in production. This is lightweight feedback, not an abuse-proof voting system.
- Health check at `/api/health`.

## Browser checks

`npx playwright install --with-deps chromium`

With the production preview running:

`node scripts/smoke-test.mjs`

Set `TEST_BASE_URL` to test a different deployment. Tests cover search, filters, sorting, theme persistence, navigation, unknown pages, and appreciation persistence; test appreciations remain as anonymous feedback unless you reset the test database.

## Image credits

Editorial photographs are downloaded locally into `public/images`:

- Hong Kong: Jacky Chiu / Pexels, photo 11726403.
- Coffee: hello aesthe / Pexels, photo 16045159.
- Mountains: Stijn Dijkstra / Pexels, photo 18709779.

The AlipayHK cover is a CSS editorial illustration, not the original competition prototype. The coffee cover is not a film frame, and the mountain cover is not a photograph from the original study trip. Attribution and those distinctions appear on detail pages. Fonts are self-hosted through Fontsource.
