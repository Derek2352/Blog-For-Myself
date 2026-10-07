/**
 * The cat's form, as nine SVG patterns — one per body part — that the cat drawings fill with.
 *
 * The cat is drawn in vector and animated part by part (cat.css, site-cat.ts). Its shading is
 * built in Blender (scripts/render-cat.mjs): each part's outline inflated into clay, lit, rendered,
 * and packed into one sprite sheet per theme. This turns a rectangle of that sheet into a pattern
 * stretched over the part's own bounding box (`objectBoundingBox` units, so the pattern *is* the
 * part's box), which the part then uses as its fill. Three properties follow, and they are why it
 * is a fill rather than an image laid over the cat:
 *
 * - the **outline is the vector's**, so the silhouette, the hit area and the arena's geometry are
 *   exactly what they were;
 * - the shading **moves with the part**: a fill lives in the element's own coordinate space, so a
 *   swinging leg carries its light with it;
 * - it **degrades to the flat cat**: `fill: url(#…) currentColor` falls back to the ink colour if
 *   the pattern is missing, and the sheet is drawn on that same ink, so a part still loading is the
 *   old flat part, not a hole.
 *
 * Both sheets sit in every pattern and the theme picks one (`#cat-textures` rules in cat.css). The
 * defining `<svg>` is sized to nothing rather than `display: none`, which some engines treat as
 * "do not render the patterns inside" either.
 */
import sprite from '@/assets/cat/sprite.json';

export type CatPart = keyof typeof sprite.rects;

/** The fill for one part: its pattern, with the flat ink as the fallback. */
export const catFill = (part: CatPart) => ({ fill: `url(#cat-tex-${part}) currentColor` });

export default function CatTextures() {
  const { width: W, height: H, rects } = sprite;
  return (
    <svg id="cat-textures" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        {(Object.entries(rects) as [CatPart, number[]][]).map(([part, [x, y, w, h]]) => (
          <pattern key={part} id={`cat-tex-${part}`} width="1" height="1" patternContentUnits="objectBoundingBox">
            {(['light', 'dark'] as const).map((theme) => (
              <image
                key={theme}
                className={`cat-tex-${theme}`}
                href={`/assets/cat/cat-${theme}.webp`}
                x={-x / w}
                y={-y / h}
                width={W / w}
                height={H / h}
                preserveAspectRatio="none"
              />
            ))}
          </pattern>
        ))}
      </defs>
    </svg>
  );
}
