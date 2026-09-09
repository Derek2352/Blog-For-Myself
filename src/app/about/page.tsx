import type { Metadata } from 'next';
import { site, resume } from '@/data/site';
import { personSchema } from '@/lib/schema';
import { isPlateAsset } from '@/lib/cover-plate';
import { SITE_URL } from '@/lib/site-url';
import { stagedImage } from '@/server/content-fs';
import PageWash from '../_chrome/PageWash';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Who I am — YUNG Ming Yin (Derek): Financial Analysis & FinTech undergraduate in Hong Kong, AI-creative practitioner.',
  alternates: { canonical: '/about/' },
};

export default async function AboutPage() {
  const linkedin: string = site.linkedin;
  const { education, certifications, languages, tools } = resume;
  /* The portrait slot is a drawn plate until a photograph lands in it, and `npm run covers` keeps
     it drawn — so it takes the dark theme's filter the same way twenty-four covers do. Asked of
     the file rather than asserted here: drop a `.jpg` in and this goes false on its own, which
     matters more than usual because the thing being filtered would be a photograph of a person. */
  const portraitPlate = isPlateAsset('portrait.svg');
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
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">Nice to meet you, properly.</h1>
          <p className="mt-3 text-lg leading-relaxed text-muted">
            {site.name} — {site.tagline}.
          </p>
        </header>

        <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_18rem] lg:gap-16">
          <div className="prose-reflection min-w-0">
            <p>
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
            <p>
              {education.school}
              <br />
              {education.degree}
              <br />
              <span className="rail">
                {education.dates} · {education.gpa}
              </span>
            </p>

            <h2>Certifications</h2>
            <ul>
              {certifications.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>

            <h2>Languages</h2>
            <ul>
              {languages.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>

            <h2>Tools</h2>
            <p>{tools.join(' · ')}</p>

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

          <aside className="self-start lg:sticky lg:top-6">
            <figure className="frame overflow-hidden" data-plate={portraitPlate ? '' : undefined}>
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
            <a
              href={site.cvPath}
              download
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-(--radius-chip) bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
            >
              Download CV (PDF)
            </a>
            <p className="rail mt-2 text-center">the short version, for printers</p>
          </aside>
        </div>
      </div>
    </>
  );
}
