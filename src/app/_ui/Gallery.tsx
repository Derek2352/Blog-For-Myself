'use client';

/**
 * Photo gallery with lightbox.
 *
 * Native `<dialog>` gives a real focus trap, Esc-to-close and focus restoration; the rest —
 * counter, arrow keys, swipe, backdrop close — is `src/lib/gallery-lightbox.ts`, shared with the
 * Astro build.
 *
 * **There is no separate full-resolution variant, and that is correct rather than a shortcut.**
 * Astro called `getImage({ src, width: 1800 })` to build one, which earns its keep for a
 * photograph. Every gallery frame on this site today is an SVG, and a vector has no resolution to
 * vary — the 1800px "variant" Astro produced was the same file. So the lightbox loads the same URL
 * the thumbnail does. If real photographs land here, this is the line that has to change, which is
 * why it is written down rather than left as an absence.
 */
import { useEffect, useRef } from 'react';
import { orientation } from '@/lib/images';
import type { StaticImage } from '@/server/content-fs';
import { setupGallery } from '@/lib/gallery-lightbox';

export interface GalleryImage {
  src: StaticImage;
  alt: string;
  caption?: string | undefined;
}

/** Tiles take an orientation-matched aspect, so portrait shots stay portrait. */
const TILE_ASPECT = {
  wide: 'aspect-[4/3]',
  tall: 'aspect-[3/4]',
  square: 'aspect-square',
} as const;

export default function Gallery({ images, id }: { images: GalleryImage[]; id: string }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (root.current) return setupGallery(root.current);
  }, [images]);

  const items = images.map((img) => ({
    alt: img.alt,
    caption: img.caption ?? '',
    src: img.src,
    aspect: TILE_ASPECT[orientation(img.src)],
  }));
  const total = String(items.length).padStart(2, '0');
  const payload = JSON.stringify(
    items.map((i) => ({ src: i.src.src, alt: i.alt, caption: i.caption })),
  ).replace(/</g, '\\u003c');

  return (
    <div className="gallery" data-gallery={id} ref={root}>
      <ul className="grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-3">
        {items.map((img, i) => (
          <li key={img.src.src}>
            <button
              type="button"
              className="frame block w-full cursor-zoom-in overflow-hidden"
              data-lb-open
              data-index={i}
              aria-label={`Open image ${i + 1} of ${items.length}: ${img.alt}`}
            >
              <img
                src={img.src.src}
                alt={img.alt}
                width={img.src.width}
                height={img.src.height}
                className={`${img.aspect} w-full object-cover`}
                loading="lazy"
              />
            </button>
            {img.caption && (
              <p className="mt-2 font-display text-sm italic text-muted">{img.caption}</p>
            )}
          </li>
        ))}
      </ul>

      <dialog data-lb-dialog className="lightbox" aria-label="Image viewer">
        <div className="lightbox-bar">
          <p className="rail" data-lb-counter>
            FRAME 01 / {total}
          </p>
          <button type="button" className="rail lightbox-btn" data-lb-close>
            Close ✕
          </button>
        </div>
        <figure className="lightbox-stage">
          {/* no initial src: an empty src="" resolves to the page URL and triggers a spurious
              document fetch. The lightbox sets src/alt on open. */}
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <img data-lb-img alt="" />
          <figcaption className="rail mt-3 text-center" data-lb-caption hidden />
        </figure>
        <div className="lightbox-bar">
          <button type="button" className="rail lightbox-btn" data-lb-prev aria-label="Previous image">
            ← Prev
          </button>
          <button type="button" className="rail lightbox-btn" data-lb-next aria-label="Next image">
            Next →
          </button>
        </div>
      </dialog>

      <script type="application/json" data-lb-data dangerouslySetInnerHTML={{ __html: payload }} />
    </div>
  );
}
