/**
 * Markdown → HTML for the Next build, reproducing Astro's pipeline rather than approximating it.
 *
 * Astro assembled this out of `astro.config.mjs`: remark for parsing, `remarkStripComments`, and
 * Shiki configured with this site's own themes and `defaultColor: false`. Every one of those is
 * load-bearing, and the two that would fail *silently* are the reason this file is careful rather
 * than three lines of `react-markdown`:
 *
 *  1. **Comment stripping.** The entry bodies use `<!-- … -->` as authoring notes — "FIRST-PASS
 *     DRAFT", "Placeholder — rewrite this honestly", and in one case a whole unwritten section
 *     held in a comment with an explanation of why. Markdown passes those through verbatim. A
 *     renderer without this plugin publishes all of it into the page source, and nothing goes red.
 *  2. **`defaultColor: false`.** Shiki's default bakes `background-color` and `color` into an
 *     inline style on the `<pre>`, which beats the stylesheet and drops a slab of dark grey into
 *     the middle of a cream page. Emitting `--shiki-light`/`--shiki-dark` custom properties
 *     instead is what lets `global.css` keep the container in the site palette while token colours
 *     still follow the theme.
 *
 * `pre.astro-code` is kept as the class name, and that is deliberate: `global.css:717-723` targets
 * it, and renaming it here would mean editing the stylesheet the Astro build is still using. The
 * name becomes a misnomer at the cutover; a broken code block on every entry page today is worse
 * than a stale word in a class name, and the rename is a one-line change to make later.
 */
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import rehypeShiki from '@shikijs/rehype';
/* The same two .mjs files the Astro build loads, imported rather than reimplemented — a second
   copy of either is a second thing to keep in step, and the whole point of the shared-plugin
   arrangement is that there is nothing to keep in step. */
import remarkStripComments from '../../plugins/remark-strip-comments.mjs';
import { paperLight, paperDark } from '../../plugins/shiki-paper-theme.mjs';

/**
 * `allowDangerousHtml` + `rehypeRaw`, matching Astro's default for markdown bodies.
 *
 * The bodies genuinely contain HTML that has to render — the gallery figures and a couple of
 * inline spans — so stripping it would break pages. It is safe here in a way it would not be on
 * user-submitted content: every byte of this markdown is written by the site's author and lives in
 * the repository. `remarkStripComments` still runs *before* this, at the mdast level, so the
 * authoring notes are gone before raw HTML is ever re-parsed.
 */
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkStripComments)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  /* Cast because the themes are hand-authored objects rather than Shiki's bundled registrations
     — they are structurally what Shiki wants (see plugins/shiki-paper-theme.mjs, which explains
     why the bundled ones are unusable here: they fail contrast on this site's surfaces). */
  .use(rehypeShiki, {
    themes: { light: paperLight, dark: paperDark },
    defaultColor: false,
  } as Parameters<typeof rehypeShiki>[0])
  .use(rehypeStringify, { allowDangerousHtml: true });

/** Render one body. Async because Shiki loads grammars on demand. */
export async function renderMarkdown(body: string): Promise<string> {
  const file = await processor.process(body);
  return String(file).replace(/<pre class="shiki/g, '<pre class="astro-code shiki');
}
