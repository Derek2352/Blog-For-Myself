/**
 * Categories = navigation tabs. This file is the ONLY place navigation is
 * defined. Add an object here (plus at least one entry or log using its slug)
 * and a new tab exists — no component or page code changes, ever.
 *
 * `npm run new-entry` / `npm run new-log` can append to this file for you.
 *
 * Notes
 * - `slug` must match the `category` field of entries/logs (build fails
 *   loudly on a mismatch, by design).
 * - `order` controls tab position (ascending).
 * - Reserved slugs (used by fixed routes): entry, log, monthly, timeline,
 *   about, tags, rss.xml, 404.
 */
export interface Category {
  slug: string;
  label: string;
  order: number;
  blurb: string;
  /** Warm wash hue in degrees. Keep it inside the warm band (see
   * src/lib/wash.ts) — cool hues fight the ivory/espresso/wine palette. */
  hue?: number;
  /**
   * Flagship category. Primary categories read at full weight in the tab bar
   * and are the ones surfaced first in the homepage "start here" browse;
   * everything else is secondary. Omit for a secondary tab.
   */
  primary?: boolean;
}

export const categories: Category[] = [
  {
    slug: "competitions",
    label: "Competitions & Awards",
    order: 1,
    blurb:
      "Competitive work across finance and AI storytelling — from Bloomberg terminals and pitch stages to award-winning film briefs.",
    hue: 12,
    primary: true,
  },
  {
    slug: "creative-ai",
    label: "AI & Creative Projects",
    order: 2,
    blurb:
      "AI-animated film, photography, and self-built pipelines — where the analyst and the animator share a desk.",
    hue: 350,
    primary: true,
  },
  {
    slug: "study-trips",
    label: "Study Trips & Exchanges",
    order: 3,
    blurb:
      "Cross-border programmes between Hong Kong, the mainland, and beyond — innovation ecosystems seen first-hand.",
    hue: 26,
    primary: true,
  },
  {
    slug: "experience",
    label: "Experience",
    order: 4,
    blurb:
      "Roles and internships — applied work in design operations, data, and banking.",
    hue: 44,
    primary: true,
  },
  {
    slug: "leadership",
    label: "Leadership & Ambassador",
    order: 5,
    blurb:
      "Ambassador programmes and campus leadership — translating AI fluency into shared, usable knowledge.",
    hue: 32,
  },
  {
    slug: "community",
    label: "Community & Volunteering",
    order: 6,
    blurb:
      "Volunteering that keeps me grounded — books, food, and street-level fundraising in Hong Kong.",
    hue: 20,
  },
  {
    slug: "career",
    label: "Mentorship & Career",
    order: 7,
    blurb: "Mentors and advisors shaping the road ahead.",
    hue: 340,
  },
  {
    slug: "leisure-time",
    label: "Leisure Time :)",
    order: 8,
    blurb:
      "Off the clock — films watched, places wandered, and whatever else refills the tank.",
    hue: 38,
  },
];

/** Slugs that can never be category slugs — they collide with fixed routes. */
export const RESERVED_SLUGS = [
  "entry",
  "log",
  "monthly",
  "timeline",
  "about",
  "tags",
  "search",
  "colophon",
  "og",
  "rss.xml",
  "404",
] as const;

export const categoryBySlug = (slug: string): Category | undefined =>
  categories.find((c) => c.slug === slug);

export const categorySlugs = categories.map((c) => c.slug);
