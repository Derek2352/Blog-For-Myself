import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Nothing goes out under Derek's name that a machine wrote for him.
 *
 * `npm run new-entry` scaffolds a body and marks it: a `FIRST-PASS DRAFT` comment
 * at the top of the file, and a `Placeholder — rewrite this honestly` comment
 * above any section written as a stand-in. Both are HTML comments, and
 * plugins/remark-strip-comments.mjs removes them at build time — which is right
 * for the reader and useless as a warning, because it means a first pass that
 * never got replaced looks exactly like a finished entry on the live page. There
 * was no way to tell the two apart without opening the file.
 *
 * This is that way. Two rules, both keyed on markers the scaffolding already
 * writes, so there is no new frontmatter to maintain and no way to forget:
 *
 *   1. A published entry may not carry the file-level FIRST-PASS DRAFT marker.
 *   2. A `Placeholder` comment may not be followed by prose — that combination is
 *      precisely "a note saying replace this" plus "the thing that wasn't
 *      replaced".
 *
 * Drafts are exempt: an unpublished entry is allowed to be unfinished.
 *
 * ## The allowlist
 *
 * Ten published entries already carry a first pass, so the rules start as a
 * ratchet rather than a wall — they hold the line at ten and fail on the
 * eleventh. The list is deliberately written out rather than counted: it is also
 * the worklist. **Rewrite an entry in your own words, delete its scaffolding
 * comments, and delete its line here.** When the array is empty, so is the
 * problem, and the rules become absolute on their own.
 */
const ENTRIES = fileURLToPath(new URL('../src/content/entries/', import.meta.url));

const KNOWN_FIRST_PASS = [
  'ai-ambassadors-first-cohort',
  'bloomberg-global-trading-challenge-2025',
  'design-assistant-hsuhk-vpo',
  'flag-day-fundraising',
  'guangzhou-gba-innovation-study-tour',
  'hubei-tech-innovation-delegation-2026',
  'local-food-distribution',
  'read-cycling-volunteer',
  'shenzhen-innovation-visit',
  'ydc-dare-to-change-2025-26',
];

interface Entry {
  slug: string;
  body: string;
  draft: boolean;
}

/** Every entry on disk, split into frontmatter and body. */
function readEntries(): Entry[] {
  const out: Entry[] = [];
  for (const dirent of readdirSync(ENTRIES, { withFileTypes: true })) {
    // node_modules turns up here as a stray build cache; it is not an entry
    if (!dirent.isDirectory() || dirent.name.startsWith('.') || dirent.name === 'node_modules') {
      continue;
    }
    let src: string;
    try {
      src = readFileSync(`${ENTRIES}${dirent.name}/index.md`, 'utf8');
    } catch {
      continue;
    }
    const match = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) continue;
    out.push({
      slug: dirent.name,
      // Frontmatter is excluded on purpose: gallery `alt` text legitimately says
      // "Placeholder frame" while the real screenshots are still being gathered,
      // and that is a picture that is missing, not a sentence someone else wrote.
      body: match[2]!,
      draft: /^draft:\s*true\s*$/m.test(match[1]!),
    });
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

/**
 * Sections where a "replace me" comment is followed by something that reads as
 * the replacement but isn't. A heading, another comment, or the end of the file
 * after the marker all mean the stand-in is genuinely gone.
 */
function placeholdersLeftStanding(body: string): string[] {
  const hits: string[] = [];
  for (const m of body.matchAll(/<!--[\s\S]*?-->/g)) {
    if (!/placeholder/i.test(m[0])) continue;
    const rest = body.slice(m.index! + m[0].length).replace(/^\s+/, '');
    if (rest === '' || rest.startsWith('<!--') || rest.startsWith('#')) continue;
    hits.push(rest.split('\n')[0]!.slice(0, 60));
  }
  return hits;
}

const published = readEntries().filter((e) => !e.draft);

describe('published entries are in his own words', () => {
  it('finds entries to check at all', () => {
    // guards against the walker silently matching nothing and passing forever
    expect(published.length).toBeGreaterThan(10);
  });

  it('carries no unreplaced first-pass draft outside the known list', () => {
    const unexpected = published
      .filter((e) => e.body.includes('FIRST-PASS DRAFT'))
      .map((e) => e.slug)
      .filter((slug) => !KNOWN_FIRST_PASS.includes(slug));
    expect(
      unexpected,
      'published with a FIRST-PASS DRAFT body — rewrite it in your own words and delete the marker',
    ).toEqual([]);
  });

  it('leaves no placeholder comment with prose still under it', () => {
    const offenders = published
      .filter((e) => !KNOWN_FIRST_PASS.includes(e.slug))
      .flatMap((e) => placeholdersLeftStanding(e.body).map((line) => `${e.slug}: "${line}…"`));
    expect(
      offenders,
      'a "replace me" note with the stand-in still under it — replace the prose, then delete the note',
    ).toEqual([]);
  });

  it('keeps the allowlist honest — no stale entries, and it only ever shrinks', () => {
    // A slug that no longer needs the exemption has to leave the list, or the
    // ratchet quietly stops ratcheting.
    const stale = KNOWN_FIRST_PASS.filter(
      (slug) => !published.some((e) => e.slug === slug && e.body.includes('FIRST-PASS DRAFT')),
    );
    expect(stale, 'no longer a first pass (or no longer published) — delete it from the list').toEqual(
      [],
    );
  });
});
