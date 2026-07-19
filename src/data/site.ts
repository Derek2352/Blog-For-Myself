/**
 * Site-wide identity & contact data.
 * Edit here — nothing below is hardcoded in components.
 * Phone number is deliberately absent from this file: the public site uses
 * email only. Add it yourself if you ever change your mind.
 */
export const site = {
  title: 'Derek Yung',
  /** Full formal name, used on /about and in metadata. */
  name: 'YUNG Ming Yin (Derek)',
  tagline:
    'Financial Analysis & FinTech undergraduate · AI-creative practitioner',
  description:
    'Portfolio and reflections of YUNG Ming Yin (Derek) — Financial Analysis & FinTech (Hons) undergraduate in Hong Kong and AI-creative practitioner. The director’s cut of my CV: competitions, study trips, AI film, and the monthly log.',
  locale: 'en',
  email: 'derekymy@gmail.com',
  github: 'https://github.com/Derek2352',
  /** Add your LinkedIn URL when ready; the footer/about link renders only if set. */
  linkedin: '',
  /** Path (under /public) to the downloadable CV. Replace the placeholder PDF. */
  cvPath: '/cv.pdf',
} as const;
