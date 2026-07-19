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
import type { PatternName } from "@/lib/patterns";

export interface Category {
  slug: string;
  label: string;
  order: number;
  blurb: string;
  /**
   * Optional page texture: a soft background pattern + hue wash for this
   * tab (and its entries/logs). Omit both and the tab still gets a stable
   * one picked from a hash of its slug — new tabs need zero decisions.
   * Patterns: halftone · ledger · contours · hatch · weave · plus · waves
   */
  pattern?: PatternName;
  /** Hue (0–360) for the faint top-of-page wash. */
  hue?: number;
}

export const categories: Category[] = [
  {
    slug: "competitions",
    label: "Competitions & Awards",
    order: 1,
    blurb:
      "Competitive work across finance and AI storytelling — from Bloomberg terminals and pitch stages to award-winning film briefs.",
    pattern: "hatch",
    hue: 8,
  },
  {
    slug: "creative-ai",
    label: "AI & Creative Projects",
    order: 2,
    blurb:
      "AI-animated film, photography, and self-built pipelines — where the analyst and the animator share a desk.",
    pattern: "halftone",
    hue: 285,
  },
  {
    slug: "study-trips",
    label: "Study Trips & Exchanges",
    order: 3,
    blurb:
      "Cross-border programmes between Hong Kong, the mainland, and beyond — innovation ecosystems seen first-hand.",
    pattern: "contours",
    hue: 150,
  },
  {
    slug: "experience",
    label: "Experience",
    order: 4,
    blurb:
      "Roles and internships — applied work in design operations, data, and banking.",
    pattern: "ledger",
    hue: 45,
  },
  {
    slug: "leadership",
    label: "Leadership & Ambassador",
    order: 5,
    blurb:
      "Ambassador programmes and campus leadership — translating AI fluency into shared, usable knowledge.",
    pattern: "plus",
    hue: 25,
  },
  {
    slug: "community",
    label: "Community & Volunteering",
    order: 6,
    blurb:
      "Volunteering that keeps me grounded — books, food, and street-level fundraising in Hong Kong.",
    pattern: "weave",
    hue: 95,
  },
  {
    slug: "career",
    label: "Mentorship & Career",
    order: 7,
    blurb: "Mentors and advisors shaping the road ahead.",
    pattern: "waves",
    hue: 340,
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
