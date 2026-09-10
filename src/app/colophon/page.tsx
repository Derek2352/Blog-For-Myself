/**
 * /colophon — the front-end design page: what this site is made of and why it feels the way it
 * does. Swatches and specimens render straight from the live design tokens, so this page always
 * tells the truth.
 *
 * **Two sentences here are claims about the build, and the Next copy must not inherit them
 * unchecked.** "Built with Astro" is the obvious one and is corrected below. The other is the
 * paragraph describing the cat and its card game: that is still true of the Astro build and is
 * *not yet* true of this one, so the cat must land before this build is the one being served.
 * Recorded here rather than in a task list, because this is the file that would be lying.
 */
import type { Metadata } from 'next';
import PageTitle from '../_ui/PageTitle';
import { categories } from '@/data/categories';
import { resolveWash } from '@/lib/wash';
import PageWash from '../_chrome/PageWash';

export const metadata: Metadata = {
  title: 'Colophon',
  description:
    'How this site is designed and built: palette, type, the index-rail signature, and the files-as-content model.',
  alternates: { canonical: '/colophon/' },
};

const swatches = [
  { name: 'ground', varName: '--color-ground', note: 'warm ivory — afternoon paper' },
  { name: 'surface', varName: '--color-surface', note: 'cream panels and cards' },
  { name: 'ink', varName: '--color-ink', note: 'espresso text' },
  { name: 'muted', varName: '--color-muted', note: 'margin notes, secondary text' },
  { name: 'line', varName: '--color-line', note: 'sand hairlines, frames, ticks' },
  { name: 'accent', varName: '--color-accent', note: 'ledger wine — links, focus' },
  { name: 'signal', varName: '--color-signal', note: 'photo-chemical amber — small markers' },
];

export default function ColophonPage() {
  const washes = categories.map((c) => ({ label: c.label, ...resolveWash(c) }));

  return (
    <>
      <PageWash hue={38} />
      <div className="wrap max-w-4xl py-10">
        <header>
          <p className="kicker">colophon</p>
          <PageTitle tail="is made.">How this site</PageTitle>
          <p className="mt-3 max-w-prose text-lg leading-relaxed text-muted">
            A portfolio should feel like the person. This one is built to feel like a contact sheet
            someone annotated by hand — photographs first, quiet margin notes underneath, nothing
            shouting.
          </p>
        </header>

        <section className="mt-12" aria-labelledby="idea-h">
          <p className="kicker">the idea</p>
          <h2 id="idea-h" className="mt-1 font-display text-2xl">
            Frames and figures
          </h2>
          <div className="prose-reflection mt-4">
            <p>
              I make film frames and I read financial figures, so the design borrows from both:
              large imagery carries the pages, and a single mono-spaced “index rail” annotates
              everything the way a timecode annotates footage — or a ticker annotates a price. Every
              entry gets an archival code (<span className="rail">E-014</span>), every date is a
              timestamp, and the timeline reads like a reel.
            </p>
            <p>
              That’s the one deliberately bold element. Everything else stays comfortable on
              purpose: warm paper tones, soft corners, generous space. Motion exists to connect
              rather than decorate — pages glide instead of reloading, the tab underline marks where
              you are, and the previous/next arrows send a small paper plane ahead of you. And an
              ink-silhouette cat wanders the bottom edge of every page — it walks, pauses, slips out
              of the room and back, scampers if you tap it, and treats your pointer as a mouse:
              bring it down to the floor and the cat will give chase and pounce. All of it stands
              down the moment your system asks for reduced motion (the cat just sits quietly in the
              corner).
            </p>
            <p>
              A second cat sits in the bottom-right corner and plays a game. Tap it and a card opens
              onto a small board of tiles: the cat claims them one by one, a squad of kittens takes
              them back, and you point at the tile you want next. Everything happens inside the card
              — the page underneath keeps its place and stays readable, and closing the card puts
              the cat back in the corner. Ask for reduced motion and the card opens without its
              flourish, like everything else here.
            </p>
          </div>
        </section>

        <section className="mt-12" aria-labelledby="palette-h">
          <p className="kicker">palette</p>
          <h2 id="palette-h" className="mt-1 font-display text-2xl">
            Colour, from the darkroom
          </h2>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted">
            Rendered live from the design tokens — flip the theme toggle and this page re-grades
            itself. Ivory paper like afternoon light, espresso ink, a wine-red librarian&apos;s
            stamp, photo-chemical amber. Warm on purpose — and deliberately not the default
            cream-and-terracotta or black-and-acid-green looks.
          </p>
          <ul className="mt-5 grid list-none gap-3 p-0 sm:grid-cols-2">
            {swatches.map((s) => (
              <li key={s.name} className="panel flex items-center gap-4 p-3">
                <span
                  className="size-12 shrink-0 rounded-(--radius-chip) border border-line"
                  style={{ background: `var(${s.varName})` }}
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="rail block">{s.varName}</span>
                  <span className="block text-sm text-muted">{s.note}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12" aria-labelledby="washes-h">
          <p className="kicker">light</p>
          <h2 id="washes-h" className="mt-1 font-display text-2xl">
            One warm light, tab by tab
          </h2>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted">
            Each tab carries a single soft wash at the top of the page — the same afternoon light,
            shifted a few degrees in temperature. It&apos;s declared in the same data file that
            defines the tab, and a new tab picks its own automatically. Hues stay inside a
            deliberately narrow warm band (amber through terracotta to wine): earlier versions
            ranged into violet, cyan and green, which read as a colour cast fighting the paper.
            There used to be a patterned texture layer here too — page pattern, patterned cards and
            textured covers stacked three deep, so it was removed. Photographs should be the only
            busy thing on the page.
          </p>
          <ul className="mt-5 grid list-none gap-3 p-0 sm:grid-cols-2">
            {washes.map((w) => (
              <li
                key={w.label}
                className="panel wash p-4"
                style={{ ['--hue' as string]: String(w.hue), ['--wash-a' as string]: '0.16' }}
              >
                <p className="rail">hue {w.hue}</p>
                <p className="mt-1 font-display text-xl">{w.label}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12" aria-labelledby="type-h">
          <p className="kicker">type</p>
          <h2 id="type-h" className="mt-1 font-display text-2xl">
            Three voices
          </h2>
          <div className="mt-5 space-y-4">
            <div className="panel p-5">
              <p className="rail">Instrument Serif — display, used sparingly</p>
              <p className="mt-2 font-display text-3xl leading-snug">
                The director’s cut of a CV, <em>with feelings kept in</em>.
              </p>
            </div>
            <div className="panel p-5">
              <p className="rail">Inter — body, built for reading</p>
              <p className="mt-2 max-w-prose leading-relaxed">
                Reflections are the heart of every entry, so the body face stays out of the way.
                Chinese renders inline without breaking anything: 夾單, 組長, 香港 —{' '}
                <span lang="zh-Hant">粵語都得</span>.
              </p>
            </div>
            <div className="panel p-5">
              <p className="rail">IBM Plex Mono — the index rail</p>
              <p className="mt-2 font-mono text-sm">
                E-014 · 2026-04 → 2026-06 · SEMI-FINALIST · HKG
              </p>
              <div className="reel-ticks mt-3" aria-hidden="true" />
            </div>
          </div>
        </section>

        <section className="mt-12" aria-labelledby="model-h">
          <p className="kicker">under the hood</p>
          <h2 id="model-h" className="mt-1 font-display text-2xl">
            Content is just files
          </h2>
          <div className="prose-reflection mt-4">
            <p>
              Built with Next.js, TypeScript, and Tailwind tokens; no database, no CMS. Entries and
              logs are Markdown files, categories and periods are two tiny data files, and every
              page derives from them — adding a tab, a season, an entry, or a monthly log means
              adding a file, never touching code. The whole site ships as static pages.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
