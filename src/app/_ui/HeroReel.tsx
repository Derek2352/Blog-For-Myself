/**
 * The reel: every entry's cover, running as film along the foot of the banner.
 *
 * The site has described itself this way since the colophon was written — the index rail
 * "annotates everything the way a timecode annotates footage — or a ticker annotates a price",
 * the timeline "reads like a reel", and the tagline is *frames by night*. This is that sentence
 * made literal and put where the eye lands first: a strip of real film carrying the real covers,
 * in the order they happened, with each entry's archival code and month printed along the edge
 * the way stock carries its edge codes. It moves like a ticker because it is one.
 *
 * Two strips, crossing: the near one full strength and running left, a far one smaller, fainter
 * and running right. Two speeds in two directions is what gives a band of film depth rather than
 * making it a marquee.
 *
 * **What it is not.** It is not content — nothing on it is new information, and every frame is
 * already on the page it came from — so it is `aria-hidden` and takes no pointer events: the
 * reader's route through the banner is still the pane and the featured entry. It is also not on
 * the cat arena's list of claimable things (src/lib/arena.ts), which is why none of its classes
 * are `.frame`, `.rail` or anything else on that list.
 *
 * **What it costs.** Nothing on the main thread. The loop and the scroll drift are CSS animations
 * of `transform`, which the compositor runs; the images are the covers the site already ships,
 * about 6 KB each, and on a phone the reel is below the first screen, where `loading="lazy"` keeps
 * them until it is scrolled to.
 */
import type { Entry } from '@/server/content';
import { monthKey } from '@/lib/format';

interface Frame {
  id: string;
  src: string;
  width: number;
  height: number;
  edge: string;
}

function Strip({ frames, className }: { frames: Frame[]; className: string }) {
  return (
    <div className={`reel-strip ${className}`}>
      <div className="reel-drift">
        {/* Two identical runs, and the loop moves the track by exactly one of them: at the end of
            each cycle the second run sits precisely where the first began, so the reset is
            invisible. Each frame carries its own sprocket holes for the same reason — a pattern
            laid along the whole track would only line up at the seam if the run's width happened
            to be a multiple of the hole pitch, and with a fluid frame width it never is. */}
        <div className="reel-track">
          {[0, 1].map((copy) => (
            <div className="reel-run" key={copy}>
              {frames.map((f) => (
                <span className="reel-frame" key={`${copy}-${f.id}`}>
                  <img
                    src={f.src}
                    alt=""
                    width={f.width}
                    height={f.height}
                    loading="lazy"
                    decoding="async"
                  />
                  <span className="reel-edge">{f.edge}</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HeroReel({
  entries,
  codes,
  className = '',
}: {
  entries: Entry[];
  /** The archival code map the page already holds — `E-014` and so on. */
  codes: Map<string, string>;
  className?: string;
}) {
  /* Oldest first, like footage: the edge codes count up as the film runs. */
  const frames: Frame[] = [...entries]
    .sort((a, b) => a.data.date.getTime() - b.data.date.getTime())
    .map((e) => ({
      id: e.id,
      src: e.data.cover.src,
      width: e.data.cover.width,
      height: e.data.cover.height,
      edge: `${codes.get(`entries:${e.id}`) ?? ''} ▸ ${monthKey(e.data.date)}`,
    }));
  if (frames.length < 3) return null;

  return (
    <div className={`reel ${className}`} aria-hidden="true">
      {/* The far strip comes first so the near one paints over it where they cross. It runs the
          reel backwards, so the two never show the same frame side by side. */}
      <Strip frames={[...frames].reverse()} className="reel-far" />
      <Strip frames={frames} className="reel-near" />
    </div>
  );
}
