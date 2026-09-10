> **Historical — this describes a proposal, not this site.**
>
> This is the README that shipped inside the two Next.js/PostgreSQL rewrite zips, kept as a record
> of what they proposed. **The site was migrated to Next.js, but not to this design.** Read
> `README.md` for what actually runs.
>
> **Adopted from the proposal:** Next.js App Router with a static export; the dependency set
> (Next 16, React 19, Tailwind 4 via PostCSS, gray-matter); reading markdown at build time rather
> than committing a generated `entries.json`; and the sage green — shipped two percent darker than
> proposed, at `#647554`, because `#697b58` measures 4.19:1 on this ground and would have been the
> only sub-AA colour in the palette.
>
> **Deliberately not adopted, and why:**
>
> - **PostgreSQL, Drizzle and the appreciations/reactions API.** Every page here is derivable at
>   build time, and this was the only feature needing a backend — a Cloud SQL instance billing
>   around the clock to store integers. The static export costs nothing to serve and cannot fall
>   over. If reactions are wanted later, Firestore has a real free tier and is the additive change.
> - **The olive palette and DM Sans.** The ledger wine and warm ivory are load-bearing: the cover
>   plates, the ink wash and the cat's paper halo are all tuned to that ground. The green was taken
>   as a *secondary* instead, for taxonomy — wine says *interactive*, amber says *notice this*,
>   sage says *this is what sort of thing it is*.
> - **Stock photography covers.** The generated ink plates are Derek's own and match the
>   ink-silhouette identity. The zips credited three Pexels photographs and contained none of them,
>   while stripping the `images/` directory from all 26 entries — adopting that as written would
>   have left every entry with no cover at all.
> - **Deleting the cat and the arena.** Both zips removed them. They are ~7,500 lines specified
>   across eighteen sections of `docs/cat-boss-gdd.md` and measured by thirty-five harnesses; they
>   were re-ported to React instead, and the whole fleet passes unmodified.
> - **The second zip's page set**, which had no `/search`, `/colophon`, `/log`, RSS, sitemap or OG
>   image routes.
> - **The source style.** Both zips were minified and comment-free; this repository documents its
>   reasoning in the code.
>
> No file from either zip was copied in. Every component was written from the Astro original, which
> is why the harness fleet still passes — the DOM contract came from this repository's own code.

---

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
