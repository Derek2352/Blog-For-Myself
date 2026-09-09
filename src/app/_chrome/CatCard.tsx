'use client';

/**
 * The arena card — markup only. The engine is `src/lib/cat-card.ts`, shared with the Astro build;
 * see that file's header for why it is a module.
 *
 * `transition:persist` is gone and needs no replacement: the root layout keeps this mounted while
 * only the page beneath it changes, so the card survives navigation by construction. The one
 * consequence worth naming is that its disposer now genuinely runs on unmount, which is why the
 * engine returns one.
 *
 * The tile pool is computed on the server and arrives as JSON in `data-pool`, exactly as it did
 * from Astro's frontmatter — the engine reads it from the attribute either way, so nothing about
 * how the board is built changed.
 */
import { useEffect } from 'react';
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
} from '@/lib/cat-art';
import { initCatCard } from '@/lib/cat-card';

export default function CatCard({ poolJson }: { poolJson: string }) {
  useEffect(() => initCatCard(), []);

  return (
    <div className="cat-card-root" data-cat-card data-pool={poolJson}>
      {/* Collapsed: the tappable cat in the corner. Same sprite shapes as the ambient cat (§0:
           nothing new is drawn), rendered small, with idle animation beats to signal interactivity. */}
      <button
        id="cat-card-toggle"
        className="cat-card-icon tap-safe"
        type="button"
        aria-expanded="false"
        aria-controls="cat-card-panel"
        aria-label="Open the cat card game"
      >
        <svg viewBox="0 0 64 40" className="cat-card-icon-svg" aria-hidden="true">
          {/* One drawing, three copies — see `src/lib/cat-art.ts`. This used to be the path data
              pasted in by hand, on the reasoning that a byte-for-byte copy of `#site-cat` was the
              fix for a copy that had drifted (it had dropped the legs and the head, so the cat was
              a floating loaf). Agreeing by hand is not a guarantee; it is a coincidence that had
              already failed once. Now they cannot drift. */}
          <g className="cat-card-tail"><path d={CAT_TAIL_D}></path></g>
          <g className="cat-card-legs">
            {CAT_LEGS.map((l) => (
              <path key={`${l.x}-${l.phase}`} d={catLegD(l.x, l.lean)} />
            ))}
          </g>
          <path className="cat-card-body" d={CAT_BODY_D}></path>
          <g className="cat-card-head">
            <path className="cat-card-ear cat-card-ear-far" d={CAT_EAR_FAR_D}></path>
            <path className="cat-card-ear cat-card-ear-near" d={CAT_EAR_NEAR_D}></path>
            <path d={CAT_HEAD_D}></path>
            <g className="cat-card-eye">
              <ellipse cx={CAT_EYE.cx} cy={CAT_EYE.cy} rx={CAT_EYE.rx} ry={CAT_EYE.ry}></ellipse>
              <ellipse className="cat-card-pupil" cx={CAT_EYE.cx} cy={CAT_EYE.cy} rx={CAT_PUPIL.rx} ry={CAT_PUPIL.ry}></ellipse>
            </g>
          </g>
        </svg>
        {/* Treats collected from browsing, shown on the collapsed icon: the ammo display
             (§2.2) and the "I have something worth playing for" cue in one. */}
        <span className="cat-card-badge" data-badge hidden aria-hidden="true">0</span>
      </button>

      {/* Expanded: the floating card. Scales up from the icon position; no ink curtain — §14.6
           makes the curtain optional and the card's own transition is the simpler open/close. */}
      <section
        id="cat-card-panel"
        className="cat-card-panel"
        role="dialog"
        aria-modal="false"
        aria-label="Cat card game"
        hidden
      >
        {/* Header: controls live inside the card (the HUD chips move here in the migration). */}
        <header className="cat-card-header">
          <span className="cat-card-title rail">cat card</span>
          <div className="cat-card-controls">
            <button
              id="cat-card-sound"
              className="cat-card-btn"
              type="button"
              aria-pressed="true"
            >
              <span className="cat-card-pip" aria-hidden="true"></span>
              <span>sound</span>
            </button>
            <button
              id="cat-card-mode"
              className="cat-card-btn"
              type="button"
              aria-pressed="false"
            >
              <span className="cat-card-pip" aria-hidden="true"></span>
              <span>play it yourself</span>
            </button>
            <button
              id="cat-card-close"
              className="cat-card-btn"
              type="button"
              aria-label="Close the cat card game"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </header>

        {/* Territory: the player's share of the board, so it grows as you win. Sits between the
             header and the board — directly above the thing it measures. */}
        <div className="cat-card-territory" aria-hidden="true">
          <div className="cat-card-territory-fill" data-territory></div>
        </div>

        {/* The board: a mini-grid of tiles, plus the game layer (boss, kittens, treat, ribbon).
             The board element is the coordinate space — see the script's `boardCoords`. */}
        <div className="cat-card-board" data-board role="group" aria-label="Tile board">
          {/* The boss, a small sprite in the same drawing as the icon (§0). */}
          <div className="cat-card-boss" data-boss aria-hidden="true">
            <svg viewBox="0 0 64 40" className="cat-card-boss-svg">
              <path className="cat-card-boss-tail" d={CAT_TAIL_D}></path>
              <g className="cat-card-legs">
                {CAT_LEGS.map((l) => (
              <path key={`${l.x}-${l.phase}`} d={catLegD(l.x, l.lean)} />
            ))}
              </g>
              <path className="cat-card-boss-body" d={CAT_BODY_D}></path>
              {/* The head is a group so it can move as one. It was not, and `[data-phase='eat']
                  .cat-card-boss-head` had been styling a class no element carried — the cat's dip
                  to its treat has never once played. */}
              <g className="cat-card-boss-head">
                <path className="cat-card-boss-ear cat-card-boss-ear-far" d={CAT_EAR_FAR_D}></path>
                <path className="cat-card-boss-ear cat-card-boss-ear-near" d={CAT_EAR_NEAR_D}></path>
                <path d={CAT_HEAD_D}></path>
                <g className="cat-card-eye">
                  <ellipse cx={CAT_EYE.cx} cy={CAT_EYE.cy} rx={CAT_EYE.rx} ry={CAT_EYE.ry}></ellipse>
                  <ellipse className="cat-card-pupil" cx={CAT_EYE.cx} cy={CAT_EYE.cy} rx={CAT_PUPIL.rx} ry={CAT_PUPIL.ry}></ellipse>
                </g>
              </g>
            </svg>
          </div>
          {/* Kittens appear here (cloned from the boss drawing, §0). */}
          <div className="cat-card-squad" data-squad aria-hidden="true"></div>
          {/* A thrown treat. */}
          <div className="cat-card-treat" data-treat aria-hidden="true" hidden>
            <svg viewBox="0 0 24 24"><use href="#treat-fish"></use></svg>
          </div>
          {/* The ribbon: a line inside the card, anchored above the boss. */}
          <div className="cat-card-ribbon" data-ribbon role="status" hidden></div>
        </div>

        {/* Footer: the game's voice on its own line, then round and the treat ammo the visitor
             collected from browsing. Two rows because one row at 320px truncated the caption to
             an ellipsis — the caption is the only thing that says what just happened. */}
        <footer className="cat-card-footer rail">
          <span className="cat-card-caption" data-caption></span>
          <span className="cat-card-stats">
            <span data-round>round 1</span>
            <span className="cat-card-ammo" data-ammo title="Treats collected from browsing"></span>
          </span>
        </footer>
      </section>
    </div>
  );
}
