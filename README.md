# Blog For Myself — portfolio & reflections

The director's cut of my CV: substantial **entries** (projects, competitions, study trips)
with covers, galleries and written reflections, plus light monthly **logs** (workshops,
talks, certificates) that roll up by month and by period (e.g. July + Aug → *Summer 2026*).

**Everything is content-driven.** Adding an entry, a log, a whole navigation tab, or a new
period means adding a file — never editing component or page code. If a nav item, section,
category, or period ever ends up hardcoded in a page/component, that's a bug.

Built with [Astro](https://astro.build) content collections, TypeScript, Tailwind (v4
tokens), MDX, and `astro:assets`. No database, no CMS — the repo *is* the backend.

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:4321 — drafts are visible here, with a "draft" mark
npm run build      # type/schema check + static build into dist/ — drafts excluded
npm run preview    # serve the production build locally
```

> **Draft policy:** items with `draft: true` render in `npm run dev` (so you can preview
> them) and are excluded from production builds. Publishing = setting `draft: false`.

---

## Adding content (the monthly workflow)

### A. New entry — `npm run new-entry`

Prompts for a title and category (validated against `src/data/categories.ts`, and offers to
create a brand-new tab on the spot). Creates:

```
src/content/entries/<slug>/
├── index.md          # full frontmatter (draft: true) + the four-heading reflection
└── images/
    ├── .gitkeep
    └── cover.svg     # generated placeholder so the build passes before photos land
```

Then: fill in the frontmatter, write the reflection, drop photos into `images/`
(replace `cover.svg` and add `gallery` items **with alt text**), and set `draft: false`.
The entry appears in its tab, on `/timeline`, on `/monthly`, and in the homepage "Lately"
strip automatically.

### B. New log — `npm run new-log`

The 60-second path for small monthly things (a workshop, a talk, a certificate). Creates
`src/content/logs/<date>-<slug>/index.md`. Fill the one-line `summary`, optionally add an
`image`/`link`/short body, set `draft: false`. It appears in its tab's monthly section, on
`/monthly` under the right period, and in "Lately".

A log **with a body** gets a small detail page; a log **without one** stays a terminal
card — no dead pages.

### C. New tab (category)

Append one object to `src/data/categories.ts`:

```ts
{ slug: "music", label: "Music & Sound", order: 8, blurb: "…" },
```

The tab, its category page, its entries grid, and its monthly-log section all exist as soon
as one entry or log uses `category: "music"`. (Empty categories stay out of the nav but
their URL works.) The build **fails loudly** if an entry/log uses a category slug that
doesn't exist — typos can't silently orphan content. Avoid the reserved slugs listed at the
top of that file (`entry`, `log`, `monthly`, `timeline`, `about`, `tags`, …).

### D. New period (season)

Append one object to `src/data/periods.ts`:

```ts
{ id: "2026-autumn", label: "Autumn 2026", start: "2026-09-01", end: "2026-11-30" },
```

Every entry/log dated inside the range groups under it on `/monthly` and in category log
sections. Dates outside every period simply group by month ("June 2026") — nothing breaks.

## Reflection template

Every entry's body uses the same four headings, so future-me stays consistent:

```md
## What it was
## What I did
## What I learned
## How it felt
```

Write them as prose, not bullet lists. "How it felt" is the reason this site exists —
keep it honest. Traditional Chinese renders inline anywhere (夾單, 組長); for long CJK
passages you can wrap them: `<span lang="zh-Hant">…</span>`.

---

## Seed content status

- Entries from the CV are published (`draft: false`); reflection bodies are **templates
  waiting for your words** — nothing was invented on your behalf.
- Items marked `# TODO: verify` at the top of their frontmatter (Blueprint of Tomorrow,
  1.4 Seconds, Inner Mongolia, Wuyishan, Portugal & Spain, BOCHK, Honours Academy,
  community/career items, HKFYG certificate log) are `draft: true` with approximate dates —
  confirm details, add photos, then publish. Community & Mentorship tabs therefore only
  show in dev until you publish something in them.
- All covers are generated placeholders — replace `images/cover.svg` with real photography
  (keep the `cover:` path in sync). Also replace `src/assets/portrait.svg` and
  `public/cv.pdf` (the CV download button points there).

## Design notes

Tokens live in `src/styles/global.css` (`@theme` + `.dark` overrides) — colors, type,
radii; every component consumes them, no ad-hoc hex in markup. See **`/colophon`** on the
site for the living design page (palette, type, the index-rail signature).

- The three deliberately avoided "AI-default" looks (cream + serif + terracotta;
  near-black + acid green; broadsheet hairline columns) are avoided on purpose: this system
  is a **warm gallery white + archival cobalt + photo-chemical amber**, soft radii,
  photography-forward, with one bold element — the mono **index rail** (`E-014 ·
  2026-04 → 2026-06 · SEMI-FINALIST`) and its reel-tick ruler on `/timeline` and period
  headers.
- Type: Instrument Serif (display, sparingly) · Inter (body) · IBM Plex Mono (rail) — all
  self-hosted via Fontsource, with a Traditional-Chinese-safe fallback stack
  (PingFang TC / Microsoft JhengHei / Noto Sans TC).
- Dark mode: class-driven, persisted, defaults to system preference, derived from the same
  tokens. Motion respects `prefers-reduced-motion`.

## Deploy

Static output — any static host works. Update `site` in `astro.config.mjs` **and** the
`Sitemap:` line in `public/robots.txt` to your real domain first.

- **Cloudflare Pages (default):** create a Pages project from this repo; build command
  `npm run build`, output directory `dist`. Done.
- **Netlify:** build `npm run build`, publish `dist`.
- **Vercel:** framework preset "Astro" (build `npm run build`, output `dist`).

Never commit secrets — there are none required today; keep it that way (`.env` is
gitignored).

## Future enhancements (hooks left, not implemented)

- **Bilingual i18n (EN / 繁中):** content model is ready — `lang` handling and CJK-safe
  fonts are in from day one; add Astro i18n routing when the time comes.
- **Search:** [Pagefind](https://pagefind.app) pairs perfectly with Astro static — add the
  postbuild step and a search box.
- **"Ask my portfolio" AI chat:** would need an API key + a small serverless endpoint over
  entries/logs; deliberately stubbed out (no key committed).
- **View/like counts:** needs a tiny external store (e.g. Cloudflare KV); the static build
  stays clean without it.
