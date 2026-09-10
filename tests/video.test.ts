import { describe, expect, it } from 'vitest';
import { resolvePlayer } from '../src/lib/video';

/**
 * The video resolver, tested because **nothing else exercises it**.
 *
 * No entry on this site has a `video:` field yet. Every branch below is therefore dead code until
 * the day Derek pastes a link into frontmatter, and the failure mode is an entry page with a dead
 * play button — noticed by a visitor, not by a build. These are the checks that make the first use
 * of it the same as the hundredth.
 *
 * The privacy positions are asserted rather than assumed, because they are the kind of thing a
 * refactor silently drops: YouTube resolves to `youtube-nocookie`, and Bilibili to `autoplay=0`.
 */
describe('resolvePlayer', () => {
  it('takes a youtu.be short link', () => {
    expect(resolvePlayer('https://youtu.be/abc123')).toEqual({
      kind: 'iframe',
      src: 'https://www.youtube-nocookie.com/embed/abc123?autoplay=1',
    });
  });

  it('takes a full youtube watch URL, and reads the id from ?v=', () => {
    const p = resolvePlayer('https://www.youtube.com/watch?v=xyz789&t=42');
    expect(p.kind).toBe('iframe');
    expect(p.src).toContain('/embed/xyz789');
  });

  it('never sends a viewer to youtube.com — always the nocookie host', () => {
    for (const url of ['https://youtu.be/a', 'https://www.youtube.com/watch?v=b', 'https://m.youtube.com/watch?v=c']) {
      expect(resolvePlayer(url).src, url).toContain('youtube-nocookie.com');
    }
  });

  it('takes a vimeo link', () => {
    expect(resolvePlayer('https://vimeo.com/123456789').src).toBe(
      'https://player.vimeo.com/video/123456789?autoplay=1',
    );
  });

  /** Bilibili's player autoplays by default, which is why the parameter is pinned off. */
  it('takes a bilibili BV link and keeps autoplay off', () => {
    const p = resolvePlayer('https://www.bilibili.com/video/BV1xx411c7mD');
    expect(p.kind).toBe('iframe');
    expect(p.src).toContain('bvid=BV1xx411c7mD');
    expect(p.src).toContain('autoplay=0');
  });

  it('plays a root-relative self-hosted file natively', () => {
    expect(resolvePlayer('/videos/film.mp4')).toEqual({ kind: 'file', src: '/videos/film.mp4' });
  });

  it('plays a remote file natively too', () => {
    expect(resolvePlayer('https://example.com/a/film.webm').kind).toBe('file');
  });

  /**
   * Everything unrecognised degrades to a plain link rather than to a broken frame. That is the
   * branch that matters most: it is what an unsupported host, a shortened URL or a typo lands on,
   * and a link that works is a better failure than a player that does not.
   */
  it('degrades anything unrecognised to a link', () => {
    for (const url of [
      'https://example.com/watch/12',
      'not a url at all',
      '/downloads/notes.pdf',
      'https://vimeo.com/',
    ]) {
      expect(resolvePlayer(url).kind, url).toBe('link');
    }
  });
});
