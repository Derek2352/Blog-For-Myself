import type { Metadata } from 'next';
import PageTitle from '../_ui/PageTitle';
import { site, resume } from '@/data/site';
import { personSchema } from '@/lib/schema';
import { assetDrawnKind } from '@/lib/cover-plate';
import { SITE_URL } from '@/lib/site-url';
import { stagedImage } from '@/server/content-fs';
import PageWash from '../_chrome/PageWash';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Who I am — YUNG Ming Yin (Derek): Financial Analysis & FinTech undergraduate in Hong Kong, AI-creative practitioner.',
  alternates: { canonical: '/about/' },
};

/**
 * How a language line reads as a level, out of five, from its own words ("Cantonese — native",
 * "English — fluent (IELTS 7.5)"). The words stay on the page — the dots are a reading aid beside
 * them, not a replacement — so a line whose level is not one of these simply gets no dots.
 */
const LEVELS: [RegExp, number][] = [
  [/\bnative\b/i, 5],
  [/\bfluent\b/i, 4],
  [/\b(upper[- ])?intermediate\b/i, 3],
  [/\b(elementary|basic)\b/i, 1],
];
function language(line: string) {
  const [name, rest = ''] = line.split(/\s+—\s+/);
  const level = LEVELS.find(([re]) => re.test(rest))?.[1];
  return { name, rest, level };
}

export default async function AboutPage() {
  const linkedin: string = site.linkedin;
  const { education, certifications, languages, tools } = resume;
  /* The portrait slot is a drawn plate until a photograph lands in it, and `npm run covers` keeps
     it drawn — so it takes the dark theme's filter the same way twenty-four covers do. Asked of
     the file rather than asserted here: drop a `.jpg` in and this goes false on its own, which
     matters more than usual because the thing being filtered would be a photograph of a person. */
  const portraitDrawn = assetDrawnKind('portrait.svg');
  const portrait = await stagedImage('/assets/portrait.svg');

  return (
    <>
      <PageWash hue={32} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(personSchema(new URL(SITE_URL))).replace(/</g, '\\u003c'),
        }}
      />
      <div className="wrap py-10" data-pagefind-body>
        <header className="max-w-3xl">
          <p className="kicker">about</p>
          <PageTitle tail="properly.">Nice to meet you,</PageTitle>
          <p className="mt-5 text-balance text-lede text-muted">
            {/* The separator stays with the word before it, so a wrap never opens a line on "·". */}
            {site.name} — {site.tagline.replace(/ · /g, '\u00a0· ')}.
          </p>
        </header>

        <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_19rem] lg:gap-20">
          <div className="prose-reflection about-body min-w-0">
            <p className="about-lede">
              I’m an undergraduate in Financial Analysis and FinTech at the Hang Seng University of
              Hong Kong, and I’m also the person who stays up rendering AI-animated film frames and
              sorting photographs from the last study trip. Two registers, one habit: reading
              numbers carefully and composing frames deliberately.
            </p>
            <p>
              The finance side and the creative side aren’t rival careers — they feed each other.
              The research pipelines I build for competitions borrow the discipline of financial
              analysis; the way I present data borrows the eye I trained on film. Along the way
              that mix has picked up cloud certifications, awards in global AI competitions, and
              seats on cross-border innovation study tours between Hong Kong and the mainland.
            </p>
            <p>
              Honestly, though — the entries on this site say it better than a bio can. Each one
              ends with a written reflection: the honest questions a CV never asks. That’s the
              reason this site exists.
            </p>

            <h2>Education</h2>
            <div className="about-school">
              <p className="about-school-name">{education.school}</p>
              <p>{education.degree}</p>
              <p className="rail">
                {education.dates} · {education.gpa}
              </p>
            </div>

            <h2>Certifications</h2>
            <ol className="about-badges">
              {certifications.map((c, i) => (
                <li key={c}>
                  <span className="about-badge-n" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {c}
                </li>
              ))}
            </ol>

            <h2>Languages</h2>
            <ul className="about-langs">
              {languages.map((l) => {
                const { name, rest, level } = language(l);
                return (
                  <li key={l}>
                    <span className="about-lang-name">{name}</span>
                    <span className="about-lang-level">{rest}</span>
                    {level && (
                      <span className="about-meter" aria-hidden="true">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span key={n} data-on={n <= level ? '' : undefined} />
                        ))}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            <h2>Tools</h2>
            <ul className="about-tools">
              {tools.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>

            <h2>Say hello</h2>
            <p>
              The easiest way to reach me is email:{' '}
              <a href={`mailto:${site.email}`}>{site.email}</a>. I’m also on{' '}
              <a href={site.github} target="_blank" rel="noopener">
                GitHub
              </a>
              {linkedin && (
                <>
                  {' '}
                  and{' '}
                  <a href={linkedin} target="_blank" rel="noopener">
                    LinkedIn
                  </a>
                </>
              )}
              .
            </p>
          </div>

          <aside className="self-start lg:sticky lg:top-24">
            <figure className="frame mat overflow-hidden" data-drawn={portraitDrawn}>
              <img
                src={portrait.src}
                alt="Portrait of Derek Yung (placeholder — photo coming)"
                width={portrait.width}
                height={portrait.height}
                className="w-full object-cover"
                loading="eager"
              />
            </figure>
            <dl className="mt-5 divide-y divide-line border-t border-line text-sm">
              <div className="py-3">
                <dt className="rail">Based in</dt>
                <dd className="mt-1">Hong Kong</dd>
              </div>
              <div className="py-3">
                <dt className="rail">Studying</dt>
                <dd className="mt-1">Financial Analysis &amp; FinTech (Hons), HSUHK</dd>
              </div>
              <div className="py-3">
                <dt className="rail">Making</dt>
                <dd className="mt-1">AI-animated film · photography · writing</dd>
              </div>
            </dl>
            <a href={site.cvPath} download className="cta cta-primary mt-5 w-full justify-center">
              Download CV (PDF)
            </a>
            <p className="rail mt-2 text-center">the short version, for printers</p>
          </aside>
        </div>
      </div>
    </>
  );
}
