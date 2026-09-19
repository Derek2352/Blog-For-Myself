/** Hand-written types for scripts/http-policy.mjs — see scripts/cover-plate.d.mts for why. */
export interface CacheRule {
  glob: string;
  test: (pathname: string) => boolean;
  extraGlobs?: string[];
  value: string;
  why: string;
}
export declare const CACHE_RULES: CacheRule[];
export declare const SECURITY_HEADERS: Record<string, string>;
export declare function cacheControlFor(pathname: string): string;
export declare function headersFor(pathname: string): Record<string, string>;
export declare function toHeadersFile(): string;
