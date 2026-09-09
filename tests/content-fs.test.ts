import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { loadEntries, loadLogs, STAGED_PREFIX } from '../src/server/content-fs';

/**
 * The filesystem loader is the Next build's only route to the content, and the one failure that
 * would be invisible is **a silently smaller site**: an entry that stops validating, or a folder
 * the glob stops matching, does not produce a broken page — it produces no page, no error, and a
 * portfolio quietly missing a piece of work. Astro had the same exposure and answered it by
 * failing the build; these are the equivalents.
 *
 * Page-level parity against the Astro output is a separate question, answered by the harness fleet
 * once the pages exist. This is the layer under that.
 */

const CONTENT = path.join(process.cwd(), 'src', 'content');
const onDisk = (c: string) =>
  readdirSync(path.join(CONTENT, c), { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .map((d) => d.name)
    .sort();

describe('the filesystem loader sees the whole site', () => {
  it('loads every entry folder on disk, and no others', async () => {
    const loaded = (await loadEntries()).map((e) => e.id).sort();
    expect(loaded).toEqual(onDisk('entries'));
  });

  it('loads every log folder on disk, and no others', async () => {
    const loaded = (await loadLogs()).map((e) => e.id).sort();
    expect(loaded).toEqual(onDisk('logs'));
  });

  /**
   * The id *is* the URL. `content.config.ts` derives it by stripping `/index.md`, so a loader that
   * derived it any other way would move every entry's address without anything failing — the pages
   * would build, at different URLs, and every existing link would break at once.
   */
  it('gives each item the id Astro gives it — the folder name, and nothing else', async () => {
    for (const e of await loadEntries()) {
      expect(e.id, e.filePath).not.toContain('/');
      expect(e.filePath.endsWith(path.join(e.id, 'index.md'))).toBe(true);
    }
  });

  /**
   * Astro resolved covers itself and failed the build on a missing one. Here the file is staged by
   * a separate script, so the reference and the file are produced by two different pieces of code
   * — which is exactly the arrangement where they drift apart. Checked, not assumed.
   */
  it('resolves every cover to a file that has actually been staged', async () => {
    for (const e of await loadEntries()) {
      expect(e.data.cover.src.startsWith(`${STAGED_PREFIX}/entries/${e.id}/`), e.id).toBe(true);
      const onPublic = path.join(process.cwd(), 'public', e.data.cover.src.replace(/^\//, ''));
      expect(existsSync(onPublic), `${e.id}: staged file missing — run scripts/stage-content-images.mjs`).toBe(true);
    }
  });

  /**
   * A cover with no dimensions is a page that reflows as it loads. Every cover on this site is a
   * generated SVG, so this is really a check on the viewBox reader in `measure()` — sharp would
   * otherwise hand back a density-derived guess, and a wrong ratio is not visible in any diff.
   */
  it('measures every cover, and never reports a zero', async () => {
    for (const e of await loadEntries()) {
      expect(e.data.cover.width, e.id).toBeGreaterThan(0);
      expect(e.data.cover.height, e.id).toBeGreaterThan(0);
    }
  });

  /**
   * The loader returns drafts and leaves the filtering to its callers, the same contract Astro's
   * `getCollection` has. Asserted rather than left implicit, because the *other* reading — a
   * loader that drops drafts itself — is equally reasonable, and the day someone assumes it is the
   * day a draft ships.
   */
  it('returns drafts too, leaving the decision to the caller', async () => {
    const drafts = (await loadEntries()).filter((e) => e.data.draft);
    expect(drafts.length).toBeGreaterThan(0);
  });

  /**
   * `body` is raw markdown, exactly as Astro's is. If it ever arrives rendered, the comment-
   * stripping step would be operating on HTML instead of markdown and the provenance notes several
   * entries carry would reach the page.
   */
  it('hands back raw markdown, not rendered HTML', async () => {
    for (const e of await loadEntries()) {
      expect(e.body, e.id).not.toContain('<p>');
    }
  });
});
