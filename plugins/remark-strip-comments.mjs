import { visit } from 'unist-util-visit';

/**
 * Drop HTML comments from content bodies so they never reach the published page.
 *
 * Markdown passes `<!-- … -->` straight through into the rendered HTML. That is
 * fine for a code comment in a layout, but the entries use comments as *authoring
 * notes* — "FIRST-PASS DRAFT … edit freely in your own voice", "Placeholder —
 * rewrite this honestly", "To be written after the internship". All of it was
 * being shipped, so anyone reading view-source on a portfolio site found the
 * scaffolding behind the prose.
 *
 * Stripping them here means the notes stay in the .md files, where they are
 * genuinely useful while writing, and simply stop being published — rather than
 * having to remember to delete each one before it ships.
 *
 * Works at the mdast level, where a comment is unambiguously an `html` node whose
 * value opens with `<!--`. A rehype pass would depend on how raw HTML happens to
 * be parsed further down the pipeline. Every other `html` node is left alone, so
 * real inline HTML in a body still renders.
 */
export default function remarkStripComments() {
  return (tree) => {
    // Collect first, remove after: splicing a parent's children while visiting it
    // makes the walker skip siblings.
    const doomed = [];
    visit(tree, 'html', (node, index, parent) => {
      if (parent && typeof index === 'number' && node.value.trimStart().startsWith('<!--')) {
        doomed.push({ parent, node });
      }
    });
    for (const { parent, node } of doomed) {
      const i = parent.children.indexOf(node);
      if (i !== -1) parent.children.splice(i, 1);
    }
  };
}
