'use client';

/**
 * Click-to-play video for entries. The page ships only the cover as a poster plus a play button;
 * the real player (YouTube / Vimeo / Bilibili iframe, or a native `<video>` for direct files) loads
 * on click. Keeps pages fast and tracker-free until the visitor opts in.
 *
 * The URL resolver and the swap both live in `src/lib/video.ts`, shared with the Astro build and
 * unit-tested — which matters here more than elsewhere, because **no entry on this site has a video
 * yet**. Nothing exercises this component until the day one does, so the part that can be checked
 * without a browser is checked without a browser.
 */
import { resolvePlayer, playVideo } from '@/lib/video';
import type { StaticImage } from '@/server/content-fs';

export default function VideoEmbed({
  url,
  title,
  poster,
}: {
  url: string;
  title: string;
  poster: StaticImage;
}) {
  const player = resolvePlayer(url);

  if (player.kind === 'link') {
    return (
      <p className="rail">
        <a href={player.src} target="_blank" rel="noopener">
          Watch the film ↗
        </a>
      </p>
    );
  }

  return (
    <div
      className="frame video-embed relative aspect-video overflow-hidden"
      data-video-kind={player.kind}
      data-video-src={player.src}
      data-video-title={title}
    >
      <img
        src={poster.src}
        alt=""
        width={poster.width}
        height={poster.height}
        className="absolute inset-0 h-full w-full object-cover"
        loading="eager"
        fetchPriority="high"
      />
      <button
        type="button"
        data-video-play
        className="group absolute inset-0 flex h-full w-full cursor-pointer items-center justify-center"
        aria-label={`Play video: ${title}`}
        onClick={(e) => {
          /* The swap replaces the box's own innerHTML, including this button. Reaching for the
             container by `closest` rather than a ref keeps that honest: after the click this
             component's tree is gone and React must not be holding a handle into it. */
          const box = e.currentTarget.closest<HTMLElement>('.video-embed');
          if (box) playVideo(box);
        }}
      >
        <span className="flex items-center gap-3 rounded-(--radius-chip) border border-line bg-ground/95 px-5 py-3 transition-colors group-hover:border-accent">
          <svg viewBox="0 0 24 24" className="size-5 fill-accent" aria-hidden="true">
            <path d="M8 5.5v13l11-6.5-11-6.5Z" />
          </svg>
          <span className="rail text-ink">Play film</span>
        </span>
      </button>
    </div>
  );
}
