'use client';

/**
 * The ambient cat — markup only. The state machine is `src/lib/site-cat.ts`, shared with the Astro
 * build; see that file's header for why it is a module.
 *
 * **`transition:persist` has no counterpart here, and needs none.** Astro swapped whole documents,
 * so the cat, its treat and its HUD each had to be marked to survive a navigation. This component
 * is rendered by the root layout, which the App Router keeps mounted while only the page beneath
 * it changes — so persistence is structural rather than declared. It is the clearest single
 * simplification in the migration, and it lands on the component that was hardest to keep alive.
 *
 * The two effects are exactly the two moments the Astro version had: the element arrives (once —
 * the engine guards on `dataset.init` besides), and a page arrives (per navigation, because the
 * treat has to be reconsidered).
 */
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import {
  CAT_TAIL_D,
  CAT_BODY_D,
  CAT_HEAD_D,
  CAT_EAR_FAR_D,
  CAT_EAR_NEAR_D,
  CAT_LEGS,
  catLegD,
  CAT_EYE,
  CAT_PUPIL,
  CAT_COLLAR_D,
  CAT_NOTCH_D,
} from '@/lib/cat-art';
import { initSiteCat, siteCatPageChanged } from '@/lib/site-cat';

export default function SiteCat({ tabs }: { tabs: string[] }) {
  const root = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (root.current) initSiteCat(root.current);
  }, []);

  /* Per navigation. Runs after the mount effect on the first pass, which is the same order
     `astro:page-load` produced. */
  useEffect(() => {
    siteCatPageChanged();
  }, [pathname]);

  return (
    <>
      <div id="site-cat" aria-hidden="true" ref={root}>
        <span className="cat-flip">
          <svg viewBox="0 0 64 40" width="48" height="30" fill="currentColor" className="cat-svg">
            <g className="cat-tail"><path d={CAT_TAIL_D}></path></g>
            <g className="cat-legs">
              {CAT_LEGS.map((l) => (
                <path
                  key={`${l.x}-${l.phase}`}
                  className={`cat-leg leg-${l.phase}`}
                  d={catLegD(l.x, l.lean)}
                />
              ))}
            </g>
            <path className="cat-body" d={CAT_BODY_D}></path>
            {/* `.cat-gaze` exists only to own the yaw's rotation origin (§17). It wraps the head
                rather than replacing it because `.cat-head` already carries two animations of its
                own — `cat-groom` and `cat-munch` — and both rotate or translate about the default
                origin. Giving *that* element a neck origin would silently redraw two shipped poses;
                giving the yaw its own group changes nothing that already works. */}
            <g className="cat-gaze">
            <g className="cat-head">
              <path className="cat-ear ear-far" d={CAT_EAR_FAR_D}></path>
              {/* The near ear is a group so the notch can ride with it: the arena rotates
                  `.cat-ear` during a pounce's wind-up, and a notch drawn as a sibling would
                  detach from the ear it belongs to. */}
              <g className="cat-ear ear-near">
                <path d={CAT_EAR_NEAR_D}></path>
                {/* The notch — the confrontation path's proof, the collar's opposite number
                    (docs/cat-boss-gdd.md §7.1). Earned by winning a fight, session-only, and
                    the one piece of new art the design allows itself.

                    Drawn as a *mark* rather than a wedge bitten out of the silhouette. The ear
                    renders about 4×5px, so a missing wedge that small is either invisible or —
                    if filled with the page's ground colour to fake a cut — plainly wrong the
                    moment the cat walks across a photograph. A coloured nick is legible at
                    this size and speaks the language the collar already established. */}
                <path
                  className="cat-notch"
                  d={CAT_NOTCH_D}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"></path>
              </g>
              <path className="cat-skull" d={CAT_HEAD_D}></path>
              {/* Earned, not decorative: this only appears once every treat is found. The affection
                  tiers otherwise only widen an idle animation repertoire, which is close to invisible —
                  a collar is a change to the cat you can actually point at.

                  **Inside the head, after the skull.** Two orderings are load-bearing here and they are
                  different questions. *After the skull* is what makes it visible at all: placed before,
                  the skull paints over the throat and the only part left showing is the inch escaping
                  below the chin, which reads as a tongue. *Inside `.cat-head`* is what keeps it on the
                  cat: as a sibling it stayed in the root frame while §17's gaze turned the head out from
                  under it, and `scratchpad/marks.mjs` measured it sliding off the throat at full
                  deflection. This is the same argument the notch makes one level down — a mark belongs
                  to the part it is a mark *on* — and it is why containment is now a property of the
                  drawing rather than of the pose. */}
              <path
                className="cat-collar"
                d={CAT_COLLAR_D}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.0"
                strokeLinecap="round"></path>
              {/* A group, so the blink squashes the eye *and* what is inside it. `.cat-eye` used to
                  be the whole eye; now it is the socket, and `.cat-pupil` is the part §17 moves. */}
              <g className="cat-eye">
                <ellipse cx={CAT_EYE.cx} cy={CAT_EYE.cy} rx={CAT_EYE.rx} ry={CAT_EYE.ry}></ellipse>
                <ellipse
                  className="cat-pupil"
                  cx={CAT_EYE.cx}
                  cy={CAT_EYE.cy}
                  rx={CAT_PUPIL.rx}
                  ry={CAT_PUPIL.ry}></ellipse>
              </g>
            </g>
            </g>
          </svg>
          {/* purr/pet feedback — a couple of small marks, never text */}
          <span className="cat-hearts" aria-hidden="true"></span>
        </span>
      </div>

      {/* The treat hiding in the current tab. Position and shape are set by the script;
          pointer-events stay off so it can never intercept a click meant for a link. */}
      <div id="cat-treat" aria-hidden="true" hidden>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <use href="#treat-fish"></use>
        </svg>
      </div>

      {/* Progress. Decorative and aria-hidden: it's an easter egg, not information a
          screen-reader user is missing out on, and announcing level-ups mid-read would
          be an intrusion rather than a reward.

          It used to stay hidden until the first find, on the theory that an empty row
          would be furniture nobody could explain. The row is now explained — the line
          under it always reads "n / N treats" — so it shows from the first page load
          instead, as an invitation. A visitor who never sees the row can't play. */}
      <div id="cat-hud">
        <div id="cat-score" aria-hidden="true" data-empty>
          <div className="cat-paws">
            {tabs.map((slug) => (
              <span key={slug} className="cat-paw" data-slug={slug} />
            ))}
          </div>
          <p className="cat-caption rail"></p>
        </div>

        {/* The arena controls moved into the card in 2.2 (§2.2: the HUD chips — arena toggle,
            sound, mode — live in the card header now). What stays here is the paw row, which
            is the site-wide treat economy the card reads for ammo: a visitor earns paws by
            browsing, and the card spends them. */}
      </div>

      {/* Treat shapes, defined once and referenced by <use>. */}
      <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }} data-cat-sprites>
        <defs>
          <g id="treat-fish">
            <path d="M3 12c4-5 9-5 13 0-4 5-9 5-13 0Z" fill="currentColor"></path>
            <path d="M16 12l5-4v8l-5-4Z" fill="currentColor"></path>
          </g>
          <g id="treat-yarn">
            <circle cx="12" cy="12" r="7" fill="currentColor"></circle>
            <path d="M6 9c4 1 8 4 10 8M9 6c3 2 6 6 7 10" stroke="var(--color-ground)" strokeWidth="1.2" fill="none"></path>
          </g>
          <g id="treat-bell">
            <path d="M12 4a6 6 0 0 1 6 6v6H6v-6a6 6 0 0 1 6-6Z" fill="currentColor"></path>
            <circle cx="12" cy="19" r="2" fill="currentColor"></circle>
          </g>
          <g id="treat-feather">
            <path d="M18 4c2 6-2 13-9 16l-2-2C10 13 13 7 18 4Z" fill="currentColor"></path>
          </g>
          <g id="treat-biscuit">
            <rect x="5" y="7" width="14" height="10" rx="4" fill="currentColor"></rect>
            <circle cx="10" cy="12" r="1.1" fill="var(--color-ground)"></circle>
            <circle cx="14" cy="12" r="1.1" fill="var(--color-ground)"></circle>
          </g>
        </defs>
      </svg>
    </>
  );
}
