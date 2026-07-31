/**
 * Orientation helper — covers and gallery images arrive with build-time
 * dimensions (via the content schema's image()), so layouts branch on
 * orientation statically: wide photos fill, tall ones get matted or a
 * portrait tile, squares sit in between. Drop in any photo; the layout
 * adapts by itself.
 */
export type Orientation = 'wide' | 'tall' | 'square';

export function orientation(img: { width: number; height: number }): Orientation {
  const ratio = img.width / img.height;
  if (ratio > 1.1) return 'wide';
  if (ratio < 0.9) return 'tall';
  return 'square';
}

/**
 * Is this cover still the generated placeholder?
 *
 * `npm run new-entry` writes a drawn SVG so a fresh entry has something in the
 * frame; every real cover is a photograph. The rule is the file type, which was
 * already the test used by the dev-only photo nudge — this only gives it a name
 * so layouts can use it too, and so it is checked in one place.
 *
 * Astro copies SVGs through the build without transforming them, so the
 * extension survives hashing; `format` is checked first for the cases where a
 * loader supplies it.
 */
export function isPlaceholderCover(img: { src: string; format?: string }): boolean {
  return img.format === 'svg' || img.src.split('?')[0].endsWith('.svg');
}
