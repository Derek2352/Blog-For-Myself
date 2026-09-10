/**
 * Hand-written types for scripts/cover-art.mjs, matching scripts/cover-plate.d.mts and
 * scripts/photo-rules.d.mts.
 *
 * The `.mjs` files are build scripts — they run under bare node with no compile step, which is why
 * they are not TypeScript. The site imports three of them anyway (the two detectors and this
 * registry), so each carries a declaration beside it rather than being typed `any` at the boundary
 * where the content model meets it. `ART_NAMES` in particular is what `content-schema.ts` validates
 * `art:` against, and a `string[]` there is the difference between a typo failing at build and a
 * cover quietly not being drawn.
 */

/** A drawing's palette, derived from one hue. Passed to a template's `draw`. */
export interface ArtTones {
  ground: string;
  frame: string;
  ink: string;
  bezel: string;
  screen: string;
  panel: string;
  chat: string;
  hair: string;
  shade: string;
  accent: string;
  sage: string;
  sageInk: string;
}

export interface ArtTemplate {
  /** `[width, height]` the drawing composes for. */
  aspect: [number, number];
  /** What the `<img>` announces — a description of the drawing, not of the entry. */
  alt: string;
  /** The figcaption on the entry page: what this cover is, and what it is not. */
  credit: string;
  /** The mono label drawn into the artwork itself. */
  label: string;
  draw(t: ArtTones): string;
}

export declare const ART_TEMPLATES: Record<string, ArtTemplate>;
export declare const ART_NAMES: string[];
export declare function artMeta(template: string): { alt: string; credit: string } | null;
export declare function coverArtSVG(opts: {
  template: string;
  hue?: number;
  seed?: string;
}): string;
