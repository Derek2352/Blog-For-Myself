import { beforeAll, describe, expect, it } from 'vitest';
import { renderMarkdown } from '../src/server/markdown';

/**
 * The Next renderer against the two things Astro's pipeline did that fail *silently* if lost.
 *
 * Neither would break a build or a page. A comment that survives is readable prose in the page
 * source that was never meant to ship; a Shiki default that survives is a dark slab in the middle
 * of a cream page. Both are the kind of fault that is only ever found by someone looking.
 */

describe('the Next markdown pipeline keeps what Astro was doing', () => {
  /* Shiki loads its themes and grammars on the first render, which took the first test past the
     5s default and reported a *timeout* where there was no fault — the kind of red that sends you
     looking in the wrong place. Paid once, here, so each test below measures only itself. */
  beforeAll(async () => {
    await renderMarkdown(['```js', 'warm', '```'].join('\n'));
  }, 30_000);

  /**
   * The entries use HTML comments as authoring notes — one holds an entire unwritten section plus
   * the reasoning for withholding it. Markdown ships comments verbatim, so this is the difference
   * between a private note and a published one.
   */
  it('strips authoring comments instead of publishing them', async () => {
    const html = await renderMarkdown(
      ['# Title', '', '<!-- FIRST-PASS DRAFT — rewrite this honestly -->', '', 'Real prose.'].join('\n'),
    );
    expect(html).not.toContain('FIRST-PASS');
    expect(html).not.toContain('<!--');
    expect(html).toContain('Real prose.');
  });

  /** A multi-line comment is one `html` node too; the single-line case passing proves less. */
  it('strips a multi-line comment, which is where the naive regex fix fails', async () => {
    const html = await renderMarkdown(
      ['Before.', '', '<!-- STILL TO WRITE', '', '## What I learned', '', 'prompt text', '-->', '', 'After.'].join('\n'),
    );
    expect(html).not.toContain('What I learned');
    expect(html).not.toContain('prompt text');
    expect(html).toContain('Before.');
    expect(html).toContain('After.');
  });

  /**
   * Real inline HTML must still render — the bodies contain figures. A comment stripper that took
   * every `html` node would be indistinguishable from this one on the tests above and would quietly
   * delete the galleries.
   */
  it('leaves real inline HTML alone', async () => {
    const html = await renderMarkdown('<figure><img src="/a.svg" alt="a"></figure>');
    expect(html).toContain('<figure>');
    expect(html).toContain('/a.svg');
  });

  /**
   * `defaultColor: false` is what stops Shiki writing `color`/`background-color` into an inline
   * style that outranks the stylesheet. The custom properties are what `global.css:717-723` reads.
   */
  it('emits Shiki custom properties, never a baked-in inline colour', async () => {
    const html = await renderMarkdown(['```js', 'const x = 1;', '```'].join('\n'));
    expect(html).toContain('--shiki-light');
    expect(html).toContain('--shiki-dark');
    expect(html).not.toMatch(/style="[^"]*background-color:/);
  });

  /** `global.css` targets `pre.astro-code`; the class has to survive the move. */
  it('keeps the class the stylesheet already targets', async () => {
    const html = await renderMarkdown(['```js', 'const x = 1;', '```'].join('\n'));
    expect(html).toContain('astro-code');
  });

  /** GFM, because the bodies use tables and strikethrough. */
  it('renders GitHub-flavoured markdown', async () => {
    const html = await renderMarkdown(['| a | b |', '| - | - |', '| 1 | 2 |'].join('\n'));
    expect(html).toContain('<table>');
  });
});
