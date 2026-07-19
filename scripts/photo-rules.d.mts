export declare const FEATURED_BONUS: number;
export declare const PHOTO_RULES: Record<string, { gallery: number; shots: string[] }>;
export declare const LOG_RULE: { gallery: number; shots: string[] };
export declare function photoPlan(item: {
  category?: string;
  featured?: boolean;
  isLog?: boolean;
}): { targetGallery: number; shots: string[] };
