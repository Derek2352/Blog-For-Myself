/** Hand-written types for scripts/art-render.mjs — see scripts/cover-plate.d.mts for why. */
export declare const RENDER_MARK: string;
export declare function isRenderedSVG(svg: string): boolean;
export declare function vectorKey(vector: string): string;
export declare function sceneKey(vector: string, scenesSource: string): string;
export declare function renderedFrom(svg: string): string | null;
export declare function vectorInside(svg: string): string | null;
export declare function lightRenderOf(svg: string): Buffer | null;
export declare function darkOf(rgb: [number, number, number]): [number, number, number];
export declare function darkVector(svg: string): string;
export declare function wrapRender(parts: {
  vector: string;
  light: Buffer;
  dark: Buffer;
  transforms?: number[][];
  key?: string;
  title?: string;
  texts?: boolean;
}): string;
