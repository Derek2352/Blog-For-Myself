/**
 * /system/ — the design system, rendered from the file that defines it.
 *
 * Nothing on this page is written down twice. The ramps, roles, type, space, corners, shadows and
 * curves are read from src/design/tokens.mjs at build time; the contrast ratios are measured by the
 * same function the token test uses (src/design/color.mjs), so the numbers here and the numbers that
 * gate the build cannot disagree; and every specimen is drawn with the live CSS variable, so the theme
 * toggle re-grades the page. The colophon says what the site is for. This says what it is made of.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import PageTitle from '../_ui/PageTitle';
import PageWash from '../_chrome/PageWash';
import {
  DURATION,
  EASE,
  ELEVATION,
  LEVELS,
  PAIRS,
  RADIUS,
  RAMPS,
  ROLES,
  SPACE,
  THEMES,
  TYPE,
  resolve,
} from '@/design/tokens.mjs';
import { contrast, css, oklchToHex } from '@/design/color.mjs';

export const metadata: Metadata = {
  title: 'Design system',
  description:
    'The design system behind this site, rendered from its own source: OKLCH colour ramps, roles per theme with measured contrast, type, space, elevation and motion.',
  alternates: { canonical: '/system/' },
};

type Lch = [number, number, number];
type Level = keyof typeof LEVELS;
/* The token module is plain JS; these are the shapes it has, stated once for the type checker. */
const themes = THEMES as Record<'light' | 'dark', Record<string, string>>;
const pairList = PAIRS as unknown as [string, string, Level][];
const ramps = RAMPS as unknown as Record<string, Record<string, Lch>>;

const RAMP_NOTES: Record<string, string> = {
  paper: 'one warm neutral, white sheet to film base',
  wine: 'the ledger stamp — interaction',
  amber: 'photo-chemical — notice',
  sage: 'taxonomy — what sort of thing',
};

/** A ramp step's text colour: ink on the light steps, paper on the dark ones. */
const onSwatch = (lch: Lch) => (lch[0] > 0.62 ? 'var(--color-paper-900)' : 'var(--color-paper-25)');

function Section({
  id,
  kicker,
  title,
  lede,
  children,
}: {
  id: string;
  kicker: string;
  title: string;
  lede: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-section" aria-labelledby={id}>
      <div className="section-head">
        <p className="kicker">{kicker}</p>
        <h2 id={id} className="mt-1.5 font-display text-section">
          {title}
        </h2>
      </div>
      <p className="mt-4 max-w-(--measure-lede) text-small text-muted">{lede}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default function SystemPage() {
  const pairs = pairList.map(([fg, bg, level]) => {
    const need = LEVELS[level];
    const light = contrast(resolve(themes.light[fg]), resolve(themes.light[bg]));
    const dark = contrast(resolve(themes.dark[fg]), resolve(themes.dark[bg]));
    return { fg, bg, level, need, light, dark };
  });
  const passing = pairs.filter((p) => p.light >= p.need && p.dark >= p.need).length;

  return (
    <>
      <PageWash hue={38} />
      <div className="wrap py-10">
        <header className="max-w-3xl">
          <p className="kicker">design system</p>
          <PageTitle tail="in full.">The system,</PageTitle>
          <p className="mt-4 max-w-(--measure-lede) text-lede text-muted">
            Every colour, size, shadow and curve on this site comes from one file,{' '}
            <code className="font-mono text-[0.9em]">src/design/tokens.mjs</code>. This page is
            drawn from it — the ratios measured, the specimens live — so flip the theme and watch it
            re-grade.
          </p>
          <p className="rail mt-4">
            4 ramps · {Object.keys(ROLES).length} roles × 2 themes · {Object.keys(TYPE).length} type
            roles · {passing}/{pairs.length} pairings at AA in both themes
          </p>
        </header>

        <Section
          id="ramps-h"
          kicker="1 · primitives"
          title="Four ramps, in OKLCH"
          lede="Designed in OKLCH, where equal steps of lightness look equal and a hue holds still as it darkens; shipped as the sRGB each one already is. Every step is inside sRGB — the token test checks — so the hex is the same colour to the last bit a screen can show."
        >
          <div className="grid gap-6">
            {Object.entries(ramps).map(([name, ramp]) => (
              <div key={name}>
                <p className="rail">
                  {name} <span className="normal-case tracking-normal">— {RAMP_NOTES[name]}</span>
                </p>
                <ul className="mt-2 grid list-none grid-cols-[repeat(auto-fill,minmax(5.25rem,1fr))] gap-1.5 p-0">
                  {Object.entries(ramp).map(([step, lch]) => (
                    <li
                      key={step}
                      className="rounded-chip p-2"
                      style={{ background: `var(--color-${name}-${step})`, color: onSwatch(lch) }}
                    >
                      <span className="block font-mono text-label font-medium">{step}</span>
                      <span className="block font-mono text-micro opacity-80">{oklchToHex(lch)}</span>
                      <span className="block font-mono text-micro opacity-70">
                        {css(lch).replace('oklch(', '').replace(')', '')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        <Section
          id="roles-h"
          kicker="2 · semantics"
          title="Roles, once per theme"
          lede="Components only ever name a role. A theme is a set of pointers into the same ramps, so light and dark cannot drift apart in hue — the dark theme is the paper read from the other end."
        >
          <ul className="grid list-none gap-2 p-0 sm:grid-cols-2">
            {Object.entries(ROLES as Record<string, string>).map(([role, purpose]) => (
              <li key={role} className="panel flex items-start gap-3 p-3">
                <span
                  className="mt-0.5 size-10 shrink-0 rounded-chip border border-line"
                  style={{ background: `var(--color-${role})` }}
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="rail block text-ink">{role}</span>
                  <span className="block text-small text-muted">{purpose}</span>
                  <span className="rail mt-0.5 block normal-case">
                    {themes.light[role]} → {themes.dark[role]}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          id="contrast-h"
          kicker="3 · measured"
          title="Every pairing the site sets"
          lede={
            <>
              Text is held to 4.5:1 and large type and controls to 3:1 (WCAG AA); a structural rule to
              1.8:1, this system&apos;s own floor. Measured here by the same function that fails the
              build when a token change would break one.
            </>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-small">
              <thead>
                <tr className="rail text-left">
                  <th className="py-2 pr-4 font-normal">text / ground</th>
                  <th className="py-2 pr-4 font-normal">needs</th>
                  <th className="py-2 pr-4 font-normal">light</th>
                  <th className="py-2 pr-4 font-normal">dark</th>
                  <th className="py-2 font-normal">sample</th>
                </tr>
              </thead>
              <tbody>
                {pairs.map((p) => (
                  <tr key={`${p.fg}/${p.bg}`} className="border-t border-line">
                    <td className="py-2 pr-4 font-mono text-label">
                      {p.fg} / {p.bg}
                    </td>
                    <td className="py-2 pr-4 tabular-nums text-muted">{p.need}:1</td>
                    <td className="py-2 pr-4 tabular-nums">{p.light.toFixed(2)}</td>
                    <td className="py-2 pr-4 tabular-nums">{p.dark.toFixed(2)}</td>
                    <td className="py-2">
                      <span
                        className="inline-block rounded-hair px-2 py-0.5"
                        style={{ background: `var(--color-${p.bg})`, color: `var(--color-${p.fg})` }}
                      >
                        Aa — the quick brown fox
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section
          id="type-h"
          kicker="4 · type"
          title="Thirteen roles, not seventeen sizes"
          lede="Instrument Serif for what is looked at, Inter (the optical-size build) for what is read, Plex Mono for the index rail. A role is size, leading and tracking decided together; headlines are fluid between a phone and a desktop, running text is not."
        >
          <ul className="grid list-none gap-5 p-0">
            {Object.entries(TYPE as Record<string, { size: string; leading: number; tracking: string; use: string }>).map(
              ([role, t]) => {
                const serif = ['display', 'title', 'section', 'quote', 'turn', 'heading'].includes(role);
                const mono = role === 'label' || role === 'micro';
                return (
                  <li key={role} className="grid gap-1 border-t border-line pt-3 md:grid-cols-[12rem_1fr] md:gap-6">
                    <span className="rail">
                      {role}
                      <span className="block normal-case tracking-normal">
                        {t.leading} · {t.tracking}
                      </span>
                    </span>
                    <span
                      className={`min-w-0 ${serif ? 'font-display' : mono ? 'font-mono uppercase' : 'font-sans'} ${
                        role === 'quote' || role === 'turn' ? 'italic' : ''
                      }`}
                      style={{
                        fontSize: `var(--text-${role})`,
                        lineHeight: `var(--text-${role}--line-height)`,
                        letterSpacing: `var(--text-${role}--letter-spacing)`,
                      }}
                    >
                      {t.use.charAt(0).toUpperCase() + t.use.slice(1)}
                    </span>
                  </li>
                );
              },
            )}
          </ul>
        </Section>

        <Section
          id="space-h"
          kicker="5 · space & shape"
          title="Rhythm and corners"
          lede="Space grows about a quarter between a phone and a desktop, so a page loosens on a wide screen while the gap inside a chip stays put. Corners soften with size: one per kind of object."
        >
          <div className="grid gap-8 md:grid-cols-2">
            <ul className="grid list-none gap-2 p-0">
              {Object.keys(SPACE).map((k) => (
                <li key={k} className="flex items-center gap-3">
                  <span className="rail w-16 shrink-0">{k}</span>
                  <span className="h-3 rounded-hair bg-accent" style={{ width: `var(--space-${k})` }} />
                </li>
              ))}
            </ul>
            <ul className="flex list-none flex-wrap items-end gap-4 p-0">
              {Object.entries(RADIUS as Record<string, string>).map(([k, v]) => (
                <li key={k} className="text-center">
                  <span
                    className="block size-16 border border-line-strong bg-surface"
                    style={{ borderRadius: `var(--radius-${k})` }}
                  />
                  <span className="rail mt-1 block">{k}</span>
                  <span className="rail block normal-case">{v}</span>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section
          id="elev-h"
          kicker="6 · elevation"
          title="Five heights above the paper"
          lede="Each a tight contact edge and a long soft fall, mixed from the theme's shadow colour — warm umber on paper, true black by candlelight, at a strength the theme sets."
        >
          <ul className="grid list-none gap-6 p-0 sm:grid-cols-3 lg:grid-cols-5">
            {Object.keys(ELEVATION).map((k) => (
              <li key={k}>
                <span
                  className="flex h-24 items-end rounded-card bg-surface p-3"
                  style={{ boxShadow: `var(--elev-${k})` }}
                >
                  <span className="rail">{k}</span>
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          id="motion-h"
          kicker="7 · motion"
          title="Curves named for what moves"
          lede="Point at a row to run it. A new animation picks a character rather than a number; the durations are where the site's own timings already clustered."
        >
          <ul className="grid list-none gap-3 p-0">
            {Object.entries(EASE as unknown as Record<string, [string, string]>).map(([k, [value, use]]) => {
              const [x1, y1, x2, y2] = value.replace(/[^\d.,-]/g, '').split(',').map(Number);
              return (
                <li key={k} className="group panel grid items-center gap-4 p-3 sm:grid-cols-[4rem_1fr_14rem]">
                  <svg viewBox="-4 -4 108 108" className="size-16 text-accent" aria-hidden="true">
                    <rect x="0" y="0" width="100" height="100" fill="none" stroke="var(--color-line)" />
                    <path
                      d={`M0,100 C${x1 * 100},${100 - y1 * 100} ${x2 * 100},${100 - y2 * 100} 100,0`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    />
                  </svg>
                  <span className="min-w-0">
                    <span className="rail block text-ink">ease-{k}</span>
                    <span className="block text-small text-muted">{use}</span>
                  </span>
                  <span className="relative h-3 rounded-pill bg-sunken" aria-hidden="true">
                    <span
                      className="absolute top-0 left-0 size-3 rounded-pill bg-accent transition-transform duration-(--dur-settle) group-hover:translate-x-[calc(14rem-0.75rem)]"
                      style={{ transitionTimingFunction: `var(--ease-${k})` }}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="rail mt-4 normal-case">
            {Object.entries(DURATION as unknown as Record<string, [string, string]>)
              .map(([k, [v]]) => `${k} ${v}`)
              .join(' · ')}
          </p>
        </Section>

        <Section
          id="parts-h"
          kicker="8 · components"
          title="The parts, with their states"
          lede="Hover, press and focus them: every interactive part answers in the accent, every press dims, and focus is one ring everywhere."
        >
          <div className="grid gap-8 md:grid-cols-2">
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/timeline/" prefetch={false} className="cta cta-primary">
                Primary action
                <span aria-hidden="true" className="go-arrow">
                  →
                </span>
              </Link>
              <Link href="/about/" prefetch={false} className="cta cta-quiet">
                Quiet action
              </Link>
              <Link href="/tags/" prefetch={false} className="go-link">
                Onward
                <span aria-hidden="true" className="go-arrow">
                  →
                </span>
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rail inline-flex items-center rounded-chip border border-line px-2 py-0.5">#a-tag</span>
              <span className="rail inline-flex items-center gap-1.5 rounded-chip border border-line px-1.5 py-px">
                <span className="size-1.5 rounded-full bg-secondary" aria-hidden="true" />
                a kind
              </span>
              <span className="rail rounded-chip bg-signal-soft px-2 py-0.5 text-signal-text">notice</span>
              <span className="rail rounded-chip bg-accent-soft px-2 py-0.5 text-accent">selected</span>
            </div>
            <div className="panel p-5">
              <p className="kicker">
                <span className="room-mark">Room I</span>a kicker
              </p>
              <p className="mt-2 font-display text-heading">A panel — a sheet on the page</p>
              <p className="rail wall-label mt-3">2026 · a wall label · E-000</p>
            </div>
            <div className="frame mat grid h-36 place-items-center">
              <span className="rail">a mat — hung, at rest</span>
            </div>
            <p className="text-body">
              Running text with{' '}
              <Link href="/colophon/" prefetch={false} className="text-accent">
                <span className="link-draw">a link that draws its line</span>
              </Link>{' '}
              and a <span className="bg-accent-soft px-1">selected phrase</span>.
            </p>
            <blockquote className="entry-note">
              <p className="font-display text-quote italic">“A pull-quote, set as a quotation.”</p>
            </blockquote>
          </div>
        </Section>

        <p className="rail mt-section border-t border-line pt-4 normal-case">
          Generated by scripts/build-tokens.mjs · tested by tests/design-tokens.test.ts and
          tests/design-hygiene.test.ts · the site&apos;s story is in the{' '}
          <Link href="/colophon/" prefetch={false} className="text-accent">
            colophon
          </Link>
          .
        </p>
      </div>
    </>
  );
}
