# Blog For Myself — portfolio & reflections

The director's cut of my CV: substantial **entries** (projects, competitions, study trips)
with covers, galleries and written reflections, plus light monthly **logs** (workshops,
talks, certificates) that roll up by month and by period (e.g. July + Aug → *Summer 2026*).

**Everything is content-driven.** Adding an entry, a log, a whole navigation tab, or a new
period means adding a file — never editing component or page code. If a nav item, section,
category, or period ever ends up hardcoded in a page/component, that's a bug.

Built with [Next.js](https://nextjs.org) (App Router, static export), React, TypeScript and
Tailwind (v4 tokens). No database, no CMS — the repo *is* the backend. Entries are Markdown files
read at build time; every page, feed, sitemap and share card is derived from them.

The two Next.js/PostgreSQL rewrite proposals this migration drew on are kept at
[`docs/nextjs-drops-proposal.md`](docs/nextjs-drops-proposal.md), with a header recording what was
adopted from them and what was deliberately not. `content/` at the repo root is a dead snapshot from
those zips — the site builds from `src/content/`; see [`content/README.md`](content/README.md).

---

## Setup — step by step

From a fresh clone to a deployed site. Six steps, in order (~15 min).

**Before you start:** [Node.js](https://nodejs.org) 20 (LTS) or newer (`node -v`) and Git
(`git --version`). No database, API key, or environment variable is needed to run the site.

### S-01 · Get the code

```bash
git clone https://github.com/Derek2352/Blog-For-Myself.git
cd Blog-For-Myself
npm install        # one time; re-run only when package.json changes
```

### S-02 · Run locally

```bash
npm run dev        # http://localhost:4321 — Ctrl+C to stop
```

Hot-reloads on save. Drafts are visible here (with a "draft" mark) and stay out of the real
build.

### S-03 · Add content

The month-to-month workflow. An **entry** is a substantial item (cover + gallery +
reflection); a **log** is a light monthly note. Three ways in:

```bash
npm run studio     # visual editor at http://127.0.0.1:4455  (easiest)
npm run new-entry  # scaffold an entry from prompts
npm run new-log    # scaffold a monthly log
```

Or by hand: copy an existing folder under `src/content/entries/<slug>/index.md` (or
`logs/`), put images beside it, reference as `cover: "./cover.jpg"`, then set
`draft: false`. The `category:` must match a slug in `src/data/categories.ts` — a typo
fails the build with a clear message. See [**Adding content**](#adding-content-the-monthly-workflow)
below for the full workflow (studio, media inbox, photo plan).

### S-04 · Make it yours (all data edits, no code)

| What | Where |
|------|-------|
| Name, tagline, email, GitHub, LinkedIn, CV path | `src/data/site.ts` |
| About-page résumé (education, certs, languages, tools) | `src/data/site.ts` → `resume` |
| Navigation tabs (add / rename / reorder) | `src/data/categories.ts` |
| Named seasons (e.g. "Summer 2026") | `src/data/periods.ts` |
| Your CV PDF · portrait photo | `public/cv.pdf` · `src/assets/portrait.svg` |

Adding a category object to `categories.ts` creates its tab, page, share card, and warm
wash automatically. Nothing else to touch. Two optional flags on a category are worth
knowing:

- `primary: true` — also gives it a tile in the homepage's *"Or wander by subject"* grid.
  Without it the category still gets its tab and page; the homepage just doesn't repeat it.
  This is deliberate: listing every category there named them twice on one screen.
- `hue: <number>` — pins its wash colour instead of taking a hashed pick (see
  [Design notes](#design-notes)).

A tab appears only once the category has at least one published entry or log, so a category
you add today stays invisible until you write something in it.

### S-05 · Build & check

```bash
npm run build      # type/schema check + static build + search index (fails here, not live)
npm run preview    # serve the production build locally
npm test           # 36 unit tests
```

### S-06 · Deploy

Set your real URL in `src/lib/site-url.ts` (`SITE_URL`) **and** the `Sitemap:` line in
`public/robots.txt`, then connect the repo to Cloudflare Pages (build command
`npm run build`, output `dist`, `NODE_VERSION=20`). Every push then auto-deploys. Full
host details — Netlify, Vercel, draft previews — are in [**Deploy**](#deploy) below.

---

> **Draft policy:** items with `draft: true` render in `npm run dev` (so you can preview
> them) and are excluded from production builds. Publishing = setting `draft: false`.
> Need to review drafts on a real URL (e.g. your phone)? `npm run build:drafts` builds
> with drafts included and a visible "preview build" watermark — deploy it as a second,
> private project (on Cloudflare Pages: same repo, build command
> `npm run build:drafts`, or set the `SHOW_DRAFTS=1` environment variable). Never point
> your public domain at it.

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

### The Content Studio — `npm run studio` (visual, drop-everything)

The one UI where **everything** goes in, including the text. Run `npm run studio` and open
**http://127.0.0.1:4455** — a local authoring app (dev-only; it writes to `src/content/…`
and is never part of the built site). From it you can:

- create and edit **entries and logs** — every field, the four reflection sections, tags,
  links, draft/featured flags, and a **"+ new tab"** button to add a category on the spot;
- **drag in photos** for the cover and gallery (with alt text + captions) and **video**
  (drop a file or paste a YouTube/Vimeo/Bilibili link) — images are auto-resized and the
  frontmatter is written for you, exactly like `npm run inbox`;
- see live thumbnails of what you've added, and delete an item and its folder.

Typical flow: `npm run studio` in one terminal, `npm run dev` in another, and edit on the
left while the site refreshes on the right. When you're happy, commit and push. The
terminal scripts below still work for anyone who prefers the keyboard:

### The media inbox — `npm run inbox`

**The single entrance for photos and video.** Dump files straight off your phone into
`_inbox/` (any names), run `npm run inbox`, and file each one through a catalog that
mirrors the site nav: pick the **tab by number** (1 = Competitions & Awards, …), then the
item inside it. After the first pick it knows where you're working — **Enter files the
next photo to the same entry**, and `a` files *all* remaining ones there (alt text still
asked per photo). `n` reopens the catalog, `s` skips, `q` quits. The script:

- resizes anything oversized (long edge > 2000px or > 2 MB) on the way in
- moves each photo into the chosen entry's `images/` folder (or the log's folder)
- **writes the frontmatter for you** — cover swap (cleaning up the generated
  placeholder), gallery item with the alt text it asks you for, or the log's `image:`
- routes video files to `public/videos/` and sets the entry's `video:` (they screen
  click-to-play) — though for full films, a YouTube/Bilibili link in `video:` keeps the
  repo lighter

Unsorted files in `_inbox/` are gitignored, so nothing ships until it's been filed.
iPhone HEIC isn't supported — export as JPG first.

### The photo plan — `npm run photos`

The repo tells you **what pictures to paste and how many**. Rules per category live in
`scripts/photo-rules.mjs` (e.g. study trips want ~6 shots — arrival, venue, you in the
room, a surprising detail, the group, one quiet frame; featured entries earn a couple
extra). Three surfaces, one source of truth:

- `npm run photos` — the full report: every entry/log still missing images, sorted by
  most-missing, with shot ideas and a total count to gather.
- `npm run new-entry` — prints the plan for the category you just picked.
- **Dev-only page hint** — entries running on a placeholder cover or a light gallery show
  an amber dashed "photo plan" panel in `npm run dev`. Production visitors never see it.

Tune counts and shot lists freely in `photo-rules.mjs` — it's a nudge, never a build gate.

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
keep it honest. Traditional Chinese renders inline anywhere (夾單, 組長). For screen
readers to pronounce it correctly, wrap any inline non-English run — a word or a whole
passage — in a language span: `<span lang="zh-Hant">夾單</span>` (WCAG 3.1.2 Language of
Parts). The page itself is already declared `lang="en"`, so only the exceptions need marking.

## Videos, search, share cards, CI

- **Film embeds:** add `video: "https://…"` to an entry (YouTube / Vimeo / Bilibili /
  direct `.mp4`) and the entry page screens it where the cover would sit — click-to-play
  (nothing loads until tapped), with the cover as the poster frame. Other URLs fall back
  to a "Watch the film ↗" link.
- **Search:** `/search` is full-text over entries, logs, and About, generated by
  [Pagefind](https://pagefind.app) during `npm run build`. In `npm run dev` the page shows
  a fallback note (the index only exists after a build — `npm run build && npm run preview`
  to try locally).
- **Share cards:** every page gets a branded 1200×630 Open Graph image generated at build
  time (`/og/<entry-id>.png`, `/og/site.png`) — so links pasted into WhatsApp / LinkedIn /
  Slack preview properly even before real photos land. Once an entry's cover is a real
  photo (jpg/png/webp), its card automatically switches to a photo + text layout. Cards
  render Latin text; if you start writing CJK titles, add a Noto Sans TC weight to
  `loadFonts` in `src/lib/og.ts`.
- **CI:** `.github/workflows/ci.yml` runs the unit tests + full build on every push — a
  bad frontmatter edit (or a regression in the date/period/wash logic) fails there
  instead of breaking a deploy.
- **Tests:** `npm test` (Vitest) covers the pure content-model logic — date/range
  formatting, period-vs-month resolution, image orientation, sort order, and per-tab wash
  hue (including the warm-band guard). Add a case in `tests/` when you touch any of those.
- **Analytics (optional):** set `analyticsToken` in `src/data/site.ts` to your Cloudflare
  Web Analytics token and a privacy-friendly beacon (no cookies, no banner) is emitted;
  leave it `''` and nothing loads.
- **Data integrity:** the build fails loudly (with fix-it messages) on bad hand-edited
  data — duplicate/malformed category slugs, reserved-slug collisions, periods that end
  before they start, malformed period dates, entries whose `endDate` precedes `date`, and
  non-kebab-case tags (they become URLs). Overlapping periods and duplicate tab orders
  warn without failing.
- **SEO plumbing:** JSON-LD structured data ships on key pages (Person on home/about,
  Article on every entry with dates/keywords/section); category pages get their own OG
  share cards (`/og/category/<slug>.png`); a web manifest + PNG app icons + theme-color
  metas cover pinned tabs and homescreen saves.
- **Search facets:** `/search` results can be filtered by type (Entry/Log), category, and
  log kind — Pagefind picks these up from the pages automatically.

## Small details worth knowing

- Both `new-entry` and `new-log` ask for a **date** (Enter = today) so backfilling old
  items needs no hand-editing; entries also take an optional `updated:` date shown on the
  rail once you write the reflection.
- Entries whose reflection is still the template show a graceful **"still being
  written"** note publicly instead of four empty headings — write the sections and it
  disappears.
- Press **`/`** anywhere to jump to search. Entry pages **print cleanly** for anyone who
  PDFs them — nav, tab bar, footer, the page wash, the cat, the reading-progress bar and
  the back-to-top button all drop out, leaving the words and the photographs.
  `public/_headers` ships immutable caching for build assets + basic security headers on
  Cloudflare/Netlify.
- **Monthly earns its nav slot.** `/monthly/` always exists, but it is only advertised in
  the header once there are at least `MONTHLY_NAV_MIN_LOGS` (4) published logs — below that
  it and `/timeline/` are nearly the same list, so showing both just makes a visitor click
  twice to find out. It appears by itself as you write logs; the number is one constant at
  the top of `src/app/_chrome/Header.tsx`.
- `npm run photos` also flags **images over 2 MB** — resize to ~2000px on the long edge
  before committing.
- **Orientation is automatic**: drop in any photo — landscape, portrait, or square — and
  the layout adapts by itself (dimensions are read at build time). Wide covers fill their
  frames; portrait covers hang matted on the cream surface at a capped height; gallery
  tiles take orientation-matched shapes so mixed rolls sit together like a real contact
  sheet. No fields to set.
- Draft-preview builds (`build:drafts`) emit `noindex` so a leaked preview URL never gets
  into search engines.

## Personal touches

- **`note` field (entries):** an optional one-line aside in your own voice
  (`note: "the night before the deadline was something else"`) — renders as an italic
  margin note under the summary. Use it where the CV voice isn't enough.
- **`src/data/now.ts` is currently unused.** It fed a "now →" line on the homepage that has
  since been removed, so editing it changes nothing today. The file is kept because the
  lines in it are yours; wire it back into `src/app/page.tsx` if you want that line
  again, or delete it.
- **Scrapbook galleries:** gallery prints rest at slight angles (straightening on hover)
  with italic serif captions — write captions like you'd caption a photo album, not a
  report.
- **The site cat:** an ink-silhouette companion wanders the bottom edge — walks, pauses,
  flicks an ear, sometimes leaves and comes back, climbs a little way up the sides, and
  scampers if tapped. It also treats the visitor's pointer as a mouse: linger near the
  bottom of the page and it will chase, pounce, and sit beside its catch until the
  "mouse" moves again. It persists across page transitions (one cat per visit), is
  `aria-hidden`, and sits still under reduced motion. To retire it, remove `<SiteCat />`
  from `src/app/layout.tsx`.
  On a **mouse** the cat is a real click target, so booping it doesn't also trigger
  whatever is behind it. On **touch** it deliberately isn't: a phone has no cursor for it
  to run from, so a hit-testable cat parked at the bottom edge would swallow taps meant for
  the link underneath. There it reacts via a proximity check instead — the tap reaches the
  link *and* startles the cat on the way past.

---

## Seed content status

- Entries from the CV are published (`draft: false`); reflection bodies are **templates
  waiting for your words** — nothing was invented on your behalf.
- A few items remain `draft: true` (unconfirmed or not-yet-happened): **1.4 Seconds**,
  **Wuyishan 7-Day Exchange**, **Honours Academy**, and the **career-mentor** entries.
  Confirm details, add photos, set `draft: false` to publish. The Mentorship & Career tab
  therefore only shows in dev until you publish something in it.
- All covers are generated placeholders — replace `images/cover.svg` with real photography
  (keep the `cover:` path in sync). Also replace `src/assets/portrait.svg` and
  `public/cv.pdf` (the CV download button points there).

## Design notes

Tokens live in `src/styles/global.css` (`@theme` + `.dark` overrides) — colors, type,
radii; every component consumes them, no ad-hoc hex in markup. See **`/colophon`** on the
site for the living design page (palette, type, the index-rail signature).

- The three deliberately avoided "AI-default" looks (cream + serif + terracotta;
  near-black + acid green; broadsheet hairline columns) stay avoided: this system is
  **warm ivory + espresso ink + a ledger-wine accent + photo-chemical amber** — warm like
  afternoon light, but the accent is wine-red (not terracotta/clay) and the identity comes
  from the mono **index rail** (`E-014 · 2026-04 → 2026-06 · SEMI-FINALIST`) and its
  reel-tick ruler on `/timeline` and period headers. Dark mode is candlelit, not cold.
- **Per-tab warm wash:** every page carries one soft gradient at the top — the same
  afternoon light, shifted a few degrees per tab (never a flat white). Each category
  declares `hue` in `src/data/categories.ts`; omit it on a new tab and it gets a stable
  pick from a hash of its slug. Hues are confined to a narrow **warm band** (amber →
  terracotta → wine) and `tests/wash.test.ts` fails the build if one strays: earlier
  versions ranged into violet/cyan/green, which read as a colour cast fighting the paper.
  Tune the strength via `--wash-a` in `src/styles/global.css`.
  There was also a per-tab *pattern* layer (halftone/ledger/contours/hatch/weave/plus/
  waves). It was removed: page pattern + patterned cards + textured covers stacked three
  deep and made pages feel busy. Photographs should be the only busy thing on a page.
- Type: Instrument Serif (display, sparingly) · Inter (body) · IBM Plex Mono (rail) — all
  self-hosted via Fontsource, with a Traditional-Chinese-safe fallback stack
  (PingFang TC / Microsoft JhengHei / Noto Sans TC).
- Dark mode: class-driven, persisted, defaults to system preference, derived from the same
  tokens.
- **Motion as linkage:** client-side navigation (the App Router keeps the layout mounted) — pages glide,
  a card's cover morphs into its entry page, the active tab underline slides between
  tabs, timeline/monthly items fade in as they arrive, and prev/next launches a small
  paper plane in the direction of travel. Everything stands down under
  `prefers-reduced-motion`, and no interaction exceeds ~600ms.

## Deploy

Static output — any static host works. Update `SITE_URL` in `src/lib/site-url.ts` **and** the
`Sitemap:` line in `public/robots.txt` to your real domain first.

- **Cloudflare Pages (default):** create a Pages project from this repo; build command
  `npm run build`, output directory `dist`. Done.
- **Netlify:** build `npm run build`, publish `dist`.
- **Vercel:** framework preset "Next.js" (build `npm run build`, output `dist`).
- **Google AI Studio / Cloud Run:** serve `dist/` as static files; no Node runtime is needed.

> **The build still writes to `dist/`.** Next's static export always emits `out/`, and
> `scripts/finish-build.mjs` renames it at the end of `npm run build` — so the build command and
> the publish directory are exactly what they were before the framework changed, and no hosting
> configuration needed touching.

Never commit secrets — there are none required today; keep it that way (`.env` is
gitignored).

## Future enhancements (hooks left, not implemented)

- **Bilingual i18n (EN / 繁中):** content model is ready — `lang` handling and CJK-safe
  fonts are in from day one; add Next i18n routing when the time comes.
- **"Ask my portfolio" AI chat:** would need an API key + a small serverless endpoint over
  entries/logs; deliberately stubbed out (no key committed).
- **View/like counts:** needs a tiny external store (e.g. Cloudflare KV); the static build
  stays clean without it.
