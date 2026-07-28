import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain .mjs authoring helper, no types needed
import {
  ENTRY_KEYS,
  LOG_KEYS,
  parseFrontmatter,
  rewriteFrontmatter,
  buildEntryFrontmatter,
} from '../scripts/frontmatter.mjs';

/**
 * The studio used to rebuild frontmatter from scratch on save, which silently
 * deleted YAML comments and any key it didn't know about. Several entries carry
 * provenance comments recording corrections and deliberately withheld material,
 * so that was real data loss — open an entry, press Save, notes gone.
 */

const SAMPLE = `# PROVENANCE: rewritten Jul 2026 from the source document.
# Withheld: the full script.
title: "An Entry"
category: "creative-ai"
date: 2026-04-01 # TODO: verify this date
summary: "A blurb."
# video: ""  # paste the film link — screens on the page
cover: "./images/cover.svg"
gallery: []
tags: ["ai-film", "award"]
links: []
featured: true
draft: false
order: 1 # homepage hero`;

const roundTrip = (block: string, patch: Record<string, unknown> = {}) => {
  const { data } = parseFrontmatter(`---\n${block}\n---\nbody\n`);
  return rewriteFrontmatter(block, { ...data, ...patch }, ENTRY_KEYS);
};

describe('frontmatter rewriting', () => {
  it('preserves standalone comments', () => {
    const out = roundTrip(SAMPLE, { title: 'Renamed' });
    expect(out).toContain('# PROVENANCE: rewritten Jul 2026 from the source document.');
    expect(out).toContain('# Withheld: the full script.');
  });

  it('preserves commented-out template hints', () => {
    expect(roundTrip(SAMPLE)).toContain('# video: ""  # paste the film link — screens on the page');
  });

  it('preserves trailing inline comments on values it rewrites', () => {
    const out = roundTrip(SAMPLE, { summary: 'Changed.' });
    expect(out).toContain('# TODO: verify this date');
    expect(out).toContain('order: 1  # homepage hero');
  });

  it('preserves keys the studio does not manage', () => {
    const out = roundTrip(`title: "X"\ncategory: "c"\ndate: 2026-01-01\nsummary: "s"\nsomeFutureKey: "keep me"\ncover: "./images/cover.svg"`, { title: 'Y' });
    expect(out).toContain('someFutureKey: "keep me"');
    expect(out).toContain('title: "Y"');
  });

  it('actually applies the edit', () => {
    const out = roundTrip(SAMPLE, { title: 'Renamed', featured: false });
    expect(out).toContain('title: "Renamed"');
    expect(out).toContain('featured: false');
    expect(out).not.toContain('title: "An Entry"');
  });

  it('keeps key order stable rather than reshuffling the file', () => {
    const keys = [...roundTrip(SAMPLE).matchAll(/^([a-zA-Z_][\w-]*):/gm)].map((m) => m[1]);
    expect(keys).toEqual(['title', 'category', 'date', 'summary', 'cover', 'gallery', 'tags', 'links', 'featured', 'draft', 'order']);
  });

  it('drops an optional field that was cleared in the UI', () => {
    const block = `title: "X"\ncategory: "c"\ndate: 2026-01-01\nrole: "Winner"\nsummary: "s"\ncover: "./c.svg"`;
    const out = rewriteFrontmatter(block, { title: 'X', category: 'c', date: '2026-01-01', role: '', summary: 's', cover: './c.svg' }, ENTRY_KEYS);
    expect(out).not.toContain('role:');
  });

  it('appends a key the file never had, in canonical order', () => {
    const block = `title: "X"\ncategory: "c"\ndate: 2026-01-01\nsummary: "s"\ncover: "./c.svg"`;
    const out = rewriteFrontmatter(block, { title: 'X', category: 'c', date: '2026-01-01', summary: 's', cover: './c.svg', note: 'an aside' }, ENTRY_KEYS);
    expect(out).toContain('note: "an aside"');
  });

  it('rewrites gallery and links blocks wholesale', () => {
    const block = `title: "X"\ncategory: "c"\ndate: 2026-01-01\nsummary: "s"\ncover: "./c.svg"\ngallery:\n  - src: "./images/old.jpg"\n    alt: "old"\ntags: []\nlinks: []`;
    const { data } = parseFrontmatter(`---\n${block}\n---\n`);
    expect(data.gallery).toHaveLength(1);
    const out = rewriteFrontmatter(block, { ...data, gallery: [{ src: './images/new.jpg', alt: 'new', caption: 'cap' }] }, ENTRY_KEYS);
    expect(out).toContain('- src: "./images/new.jpg"');
    expect(out).toContain('caption: "cap"');
    expect(out).not.toContain('old.jpg');
  });

  it('leaves dates unquoted so Astro can coerce them', () => {
    expect(roundTrip(SAMPLE, { date: '2026-05-05' })).toContain('date: 2026-05-05');
    expect(roundTrip(SAMPLE, { date: '2026-05-05' })).not.toContain('date: "2026-05-05"');
  });

  it('escapes quotes in values', () => {
    expect(roundTrip(SAMPLE, { title: 'He said "hi"' })).toContain('title: "He said \\"hi\\""');
  });

  it('builds a fresh block for a file that does not exist yet', () => {
    const fm = buildEntryFrontmatter({
      title: 'New', category: 'creative-ai', date: '2026-07-28', summary: 's',
      cover: './images/cover.svg', gallery: [], tags: [], links: [], featured: false, draft: true,
    });
    expect(fm.startsWith('---\ntitle: "New"')).toBe(true);
    expect(fm.endsWith('\n---')).toBe(true);
    expect(fm).not.toContain('\n\n'); // no stray blank line from an empty block
  });

  it('round-trips a log block', () => {
    const block = `title: "A log"\ncategory: "career"\ndate: 2026-02-02\nkind: "talk"\nsummary: "s"\ntags: []\ndraft: false`;
    const { data } = parseFrontmatter(`---\n${block}\n---\n`);
    const out = rewriteFrontmatter(block, { ...data, summary: 'changed' }, LOG_KEYS);
    expect(out).toContain('kind: "talk"');
    expect(out).toContain('summary: "changed"');
  });
});
