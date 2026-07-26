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
  /**
   * The small line under your name in the header. Voice, not a label — the
   * literal "Portfolio & Log" wording is kept for the browser title, the RSS
   * feed and the share cards, where "portfolio" is the word that makes you
   * findable. This one is free to have character.
   */
  mastheadNote: 'vibe coded from scratch',
  description:
    'Portfolio and reflections of YUNG Ming Yin (Derek) — Financial Analysis & FinTech (Hons) undergraduate in Hong Kong and AI-creative practitioner. The director’s cut of my CV: competitions, study trips, AI film, and the monthly log.',
  locale: 'en',
  email: 'derekymy@gmail.com',
  github: 'https://github.com/Derek2352',
  /** Add your LinkedIn URL when ready; the footer/about link renders only if set. */
  linkedin: '',
  /** Path (under /public) to the downloadable CV. Replace the placeholder PDF. */
  cvPath: '/cv.pdf',
  /**
   * Cloudflare Web Analytics token (privacy-friendly, no cookies, no banner).
   * Get it from the Cloudflare dashboard → Web Analytics → your site → JS
   * snippet → the `token` value. Leave '' and no analytics script is emitted.
   */
  analyticsToken: '',
} as const;

/**
 * About-page résumé data. Kept here (not inside about.astro) so refreshing a
 * certification, language, or tool is a data edit, never a code edit — the
 * same files-as-content rule the rest of the site follows.
 */
export const resume = {
  education: {
    school: 'The Hang Seng University of Hong Kong (HSUHK)',
    degree: 'BBA (Hons) in Financial Analysis and FinTech',
    dates: 'Sept 2025 – Expected Aug 2029',
    gpa: 'GPA 3.89 / 4.00',
  },
  certifications: [
    'AWS Certified AI Practitioner',
    'AWS Certified Cloud Practitioner',
    'Alibaba Cloud Associate – Cloud Computing',
    'Google Cloud — Gemini Academy for Students',
  ],
  languages: [
    'Cantonese — native',
    'Mandarin — intermediate (PSC 3A)',
    'English — fluent (IELTS 7.5)',
    'Korean — basic',
  ],
  tools: [
    'Tableau',
    'Excel',
    'PowerPoint',
    'Canva',
    'Adobe Photoshop',
    'Figma',
    'CapCut',
    'AWS & Alibaba Cloud',
    'Generative AI + local LLMs',
  ],
} as const;
