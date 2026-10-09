import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { siteOrigin } from '../src/lib/site-url';

/**
 * The site deploys to five hosts from one repo: Cloud Run (the Dockerfile), Cloudflare
 * (`wrangler.jsonc`), Netlify (`netlify.toml`), Vercel (`vercel.json`), and anything else that
 * takes a directory. Each file restates the same two facts — run `npm run build`, publish `dist/` —
 * plus which Node to use, and a restated fact is one that can drift. These hold them together.
 */
const read = (f: string) => readFileSync(path.join(process.cwd(), f), 'utf8');

describe('every host is told the same thing', () => {
  it('builds with npm run build and publishes dist/, which is where finish-build puts it', () => {
    expect(read('scripts/finish-build.mjs')).toContain("path.join(process.cwd(), 'dist')");

    const vercel = JSON.parse(read('vercel.json'));
    expect(vercel.buildCommand).toBe('npm run build');
    expect(vercel.outputDirectory).toBe('dist');
    // `null` is Vercel's "Other". The Next.js preset would look for out/, which finish-build moved.
    expect(vercel.framework).toBeNull();

    const netlify = read('netlify.toml');
    expect(netlify).toMatch(/^\s*command = "npm run build"$/m);
    expect(netlify).toMatch(/^\s*publish = "dist"$/m);
    expect(netlify).toMatch(/^\s*NETLIFY_NEXT_PLUGIN_SKIP = "true"$/m);

    // Full-line `//` comments only, so stripping them leaves plain JSON.
    const wrangler = JSON.parse(read('wrangler.jsonc').replace(/^\s*\/\/.*$/gm, ''));
    expect(wrangler.assets.directory).toBe('./dist');
    expect(wrangler.assets.not_found_handling).toBe('404-page');
    expect(wrangler.main).toBeUndefined();
  });

  it('names one Node major everywhere', () => {
    const major = read('.node-version').trim();
    expect(major).toMatch(/^\d+$/);
    expect(JSON.parse(read('package.json')).engines.node).toBe(`>=${major}`);
    const froms = [...read('Dockerfile').matchAll(/^FROM node:(\d+)-/gm)].map((m) => m[1]);
    expect(froms.length).toBeGreaterThan(0);
    for (const f of froms) expect(f).toBe(major);
    for (const wf of ['ci.yml', 'content-health.yml', 'harness.yml']) {
      const y = read(`.github/workflows/${wf}`);
      expect(y, wf).toContain('node-version-file: .node-version');
      expect(y, wf).not.toMatch(/node-version: \d/);
    }
  });

  it('writes robots.txt at build time, so no hand-kept copy can point at the wrong sitemap', () => {
    /* The hand-kept public/robots.txt named Astro's `sitemap-index.xml` long after the file became
       `sitemap.xml`. The build now writes it from SITE_URL; a copy in public/ would be overwritten
       on every build, so editing it would do nothing — better that it cannot exist. */
    expect(existsSync(path.join(process.cwd(), 'public', 'robots.txt'))).toBe(false);
    expect(read('scripts/build-static-artifacts.ts')).toContain("absolute('/sitemap.xml')");
  });
});

describe('SITE_URL', () => {
  it('defaults to the live deployment, on Cloudflare Workers', () => {
    expect(siteOrigin(undefined)).toBe('https://blog-for-myself.mingyinyunggg.workers.dev');
    expect(siteOrigin('')).toBe('https://blog-for-myself.mingyinyunggg.workers.dev');
  });

  it('takes an origin from the build environment, trailing slash or not', () => {
    expect(siteOrigin('https://derekyung.pages.dev')).toBe('https://derekyung.pages.dev');
    expect(siteOrigin('https://derekyung.netlify.app/')).toBe('https://derekyung.netlify.app');
  });

  it('refuses anything that is not an origin, so a typo fails the build', () => {
    expect(() => siteOrigin('derekyung.com')).toThrow();
    expect(() => siteOrigin('https://example.com/blog')).toThrow(/origin/);
    expect(() => siteOrigin('https://example.com/?x=1')).toThrow(/origin/);
  });
});
