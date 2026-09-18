export declare const PLATE_MARK: string;
export declare function isPlateSVG(svg: string): boolean;
export declare const ART_MARK: string;
export declare function isArtSVG(svg: string): boolean;
export declare function artTemplateOf(svg: string): string | null;

/** What an entry's frontmatter says its cover is, as opposed to what the file on disk says. */
export declare function coverKind(data?: { cover?: string; art?: string }): 'photo' | 'art' | 'plate';
