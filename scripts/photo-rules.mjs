/**
 * Photo suggestion rules — the "backend" that tells you what to shoot and
 * how many pictures each item wants. One source of truth, consumed by:
 *   - scripts/photo-plan.mjs   (npm run photos — the full report)
 *   - scripts/new-entry.mjs    (prints the plan for a fresh entry)
 *   - src/components/PhotoPlan.astro (dev-only hint on entry pages)
 *
 * Tune freely: `gallery` is the suggested shot count for the category,
 * `shots` are prompts for what to actually gather. Featured entries get
 * FEATURED_BONUS extra. Unknown categories fall back to `default`.
 */
export const FEATURED_BONUS = 2;

export const PHOTO_RULES = {
  'study-trips': {
    gallery: 6,
    shots: [
      'arrival or transit moment',
      'venue, wide',
      'you in the room (someone else’s camera)',
      'a detail that surprised you',
      'the group',
      'one quiet frame — food, streets, light',
    ],
  },
  competitions: {
    gallery: 4,
    shots: [
      'the deliverable up close',
      'stage / presentation moment',
      'certificate, trophy or result screen',
      'process — desk, drafts, the late night',
    ],
  },
  'creative-ai': {
    gallery: 5,
    shots: [
      'best stills (two or three)',
      'process / pipeline screenshot',
      'storyboard or before-and-after',
      'where it showed — screening, post, comments',
    ],
  },
  experience: {
    gallery: 3,
    shots: ['workplace or desk', 'something you made (blur the sensitive bits)', 'badge, building, or team moment'],
  },
  leadership: {
    gallery: 3,
    shots: ['you presenting or hosting', 'the room mid-session', 'materials you prepared'],
  },
  community: {
    gallery: 3,
    shots: ['hands at work', 'the place', 'one small human detail'],
  },
  career: {
    gallery: 2,
    shots: ['the meeting or venue', 'a note or takeaway, photographed'],
  },
  default: {
    gallery: 3,
    shots: ['establishing wide', 'detail close-up', 'a human moment'],
  },
};

export const LOG_RULE = {
  gallery: 1,
  shots: ['one honest phone shot is enough'],
};

/**
 * Compute the plan for an item.
 * @param {{ category?: string, featured?: boolean, isLog?: boolean }} item
 * @returns {{ targetGallery: number, shots: string[] }}
 */
export function photoPlan({ category = '', featured = false, isLog = false }) {
  if (isLog) return { targetGallery: LOG_RULE.gallery, shots: LOG_RULE.shots };
  const rule = PHOTO_RULES[category] ?? PHOTO_RULES.default;
  return {
    targetGallery: rule.gallery + (featured ? FEATURED_BONUS : 0),
    shots: rule.shots,
  };
}
