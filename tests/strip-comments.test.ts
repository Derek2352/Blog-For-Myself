import { describe, it, expect } from 'vitest';
// @ts-expect-error — build-time plugin, plain .mjs with no types
import remarkStripComments from '../plugins/remark-strip-comments.mjs';

/**
 * Authoring notes are written as <!-- … --> in the entry bodies, and markdown
 * ships those verbatim — so before this plugin, "FIRST-PASS DRAFT … edit freely
 * in your own voice" was readable in the published page source of 22 entries.
 * These tests pin the two halves of the contract: comments go, real HTML stays.
 */

type Node = { type: string; value?: string; children?: Node[] };

const run = (tree: Node): Node => {
  remarkStripComments()(tree);
  return tree;
};

const root = (...children: Node[]): Node => ({ type: 'root', children });
const html = (value: string): Node => ({ type: 'html', value });
const para = (...children: Node[]): Node => ({ type: 'paragraph', children });
const text = (value: string): Node => ({ type: 'text', value });

describe('remarkStripComments', () => {
  it('removes a block-level authoring comment', () => {
    const tree = run(root(html('<!-- FIRST-PASS DRAFT — edit freely -->'), para(text('Real prose.'))));
    expect(tree.children).toHaveLength(1);
    expect(tree.children?.[0]?.type).toBe('paragraph');
  });

  it('removes a comment nested inside a paragraph', () => {
    const tree = run(root(para(text('Before '), html('<!-- note to self -->'), text(' after'))));
    const kids = tree.children?.[0]?.children ?? [];
    expect(kids.map((k) => k.type)).toEqual(['text', 'text']);
  });

  it('removes every comment, not just the first — splicing must not skip siblings', () => {
    const tree = run(
      root(
        html('<!-- one -->'),
        html('<!-- two -->'),
        html('<!-- three -->'),
        para(text('kept')),
      ),
    );
    expect(tree.children).toHaveLength(1);
  });

  it('handles a multi-line comment with leading whitespace', () => {
    const tree = run(root(html('\n   <!-- Placeholder —\n     rewrite this honestly -->')));
    expect(tree.children).toHaveLength(0);
  });

  it('leaves real inline HTML alone', () => {
    // no entry body uses these today, so this is the guard that keeps the plugin
    // from quietly eating them the first time one does
    const tree = run(root(html('<br />'), html('<abbr title="Corporate Governance">CG</abbr>')));
    expect(tree.children).toHaveLength(2);
    expect(tree.children?.map((c) => c.value)).toEqual([
      '<br />',
      '<abbr title="Corporate Governance">CG</abbr>',
    ]);
  });

  it('does not touch a comment-looking string in ordinary text', () => {
    const tree = run(root(para(text('write <!-- like this --> to leave yourself a note'))));
    expect(tree.children?.[0]?.children?.[0]?.value).toContain('<!-- like this -->');
  });

  it('leaves a tree with nothing to strip untouched', () => {
    const tree = run(root(para(text('a')), para(text('b'))));
    expect(tree.children).toHaveLength(2);
  });
});
