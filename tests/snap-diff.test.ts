import { describe, expect, it } from 'vitest';
// @ts-expect-error — the harness fleet's shared lib, plain .mjs
import { snapDiff } from '../scratchpad/lib/fixture.mjs';

/**
 * The instrument three of arena's checks are built on.
 *
 * `snapDiff` answers pillar 2 — "the card never touches the page while it plays" — by comparing a
 * snapshot of every element's tag, classes and inline style against a baseline. For months it
 * compared them **by position**: `clean[i] !== now[i]`. Insert one `<script>` into the head and
 * every element after it is compared against its neighbour, so one event is reported as hundreds
 * and the "first difference" names two elements with no relationship to each other.
 *
 * The checks that used it failed roughly four runs in five and were kept out of CI for it. The
 * message — "245 differences, first: 47:BODY:… → 47:SCRIPT::" — was misleading enough that finding
 * the cause took two sessions and four probes.
 *
 * `snapDiff` takes a Playwright page and evaluates the snapshot script on it. A stub with the one
 * method it calls is enough to test the alignment, and keeps the unit suite free of a browser.
 */
const pageYielding = (rows: string[]) => ({ evaluate: async () => rows });
const diff = (before: string[], after: string[]) => snapDiff(pageYielding(after), '', before);

const BASE = ['HTML::', 'BODY:flex:', 'HEADER:site:', 'MAIN::', 'P:lede:', 'FOOTER::'];

describe('snapDiff', () => {
  it('says nothing changed when nothing changed', async () => {
    const d = await diff(BASE, [...BASE]);
    expect(d.n).toBe(0);
    expect(d.detail).toBe('identical');
  });

  it('reports one insertion as one difference, wherever it lands', async () => {
    /* The actual bug, at the position that caused it: near the top, so everything after shifts. */
    const withScript = ['HTML::', 'SCRIPT::', ...BASE.slice(1)];
    const d = await diff(BASE, withScript);
    expect(d.n).toBe(1);
    expect(d.detail).toContain('added SCRIPT::');
    // The old positional compare made this the length of everything after the insertion.
    expect(d.n).not.toBe(BASE.length);
  });

  it('reports one removal as one difference', async () => {
    const d = await diff(BASE, BASE.filter((r) => !r.startsWith('HEADER')));
    expect(d.n).toBe(1);
    expect(d.detail).toContain('removed HEADER:site:');
  });

  it('pairs a removal and an insertion at the same place into one change', async () => {
    /* A restyled element is one event, not two. Reporting it as a removal plus an unrelated
       addition is the same class of noise the positional compare produced, smaller. */
    const restyled = BASE.map((r) => (r === 'P:lede:' ? 'P:lede:opacity:0' : r));
    const d = await diff(BASE, restyled);
    expect(d.n).toBe(1);
    expect(d.detail).toContain('changed P:lede: → P:lede:opacity:0');
  });

  it('counts several independent edits separately', async () => {
    const d = await diff(BASE, [...BASE, 'SPAN:probe:', 'SPAN:probe:', 'SPAN:probe:']);
    expect(d.n).toBe(3);
  });

  it('handles repeated identical descriptors, which a set comparison could not', async () => {
    /* Sibling list items are byte-identical as descriptors. The alignment has to count them, not
       deduplicate them — dropping one of four `LI::` is a difference. */
    const four = ['UL::', 'LI::', 'LI::', 'LI::', 'LI::'];
    const three = ['UL::', 'LI::', 'LI::', 'LI::'];
    expect((await diff(four, four)).n).toBe(0);
    expect((await diff(four, three)).n).toBe(1);
    expect((await diff(three, four)).n).toBe(1);
  });

  it('survives an empty side', async () => {
    expect((await diff([], [])).n).toBe(0);
    expect((await diff(BASE, [])).n).toBe(BASE.length);
    expect((await diff([], BASE)).n).toBe(BASE.length);
  });
});
