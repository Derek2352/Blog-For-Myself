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
