/**
 * Which player a video URL wants, and where to load it from.
 *
 * Pure, and lifted out of `VideoEmbed.astro` so both builds share it — and so it is testable
 * without a DOM, which matters more than usual here: the failure mode of a wrong branch is an
 * entry page with a dead play button, and no entry on the site has a video yet, so nothing would
 * exercise it until the day it matters.
 *
 * `youtube-nocookie` and the click-to-play gate are the privacy position, not an optimisation: the
 * page ships a poster and a button, and no third-party frame loads until the visitor asks for one.
 */
export type Player =
  | { kind: 'iframe'; src: string }
  | { kind: 'file'; src: string }
  | { kind: 'link'; src: string };

export function resolvePlayer(raw: string): Player {
  // root-relative self-hosted files (e.g. "/videos/film.mp4")
  if (raw.startsWith('/')) {
    return /\.(mp4|webm|mov|m4v)$/i.test(raw)
      ? { kind: 'file', src: raw }
      : { kind: 'link', src: raw };
  }
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { kind: 'link', src: raw };
  }
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') {
    return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}?autoplay=1` };
  }
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const id = u.searchParams.get('v') ?? u.pathname.split('/').pop();
    if (id) return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1` };
  }
  if (host === 'vimeo.com') {
    const id = u.pathname.split('/').filter(Boolean)[0];
    if (id) return { kind: 'iframe', src: `https://player.vimeo.com/video/${id}?autoplay=1` };
  }
  if (host === 'bilibili.com' || host === 'b23.tv') {
    const bvid = u.pathname.split('/').find((p) => p.startsWith('BV'));
    if (bvid) return { kind: 'iframe', src: `https://player.bilibili.com/player.html?bvid=${bvid}&autoplay=0&high_quality=1` };
  }
  if (/\.(mp4|webm|mov|m4v)$/i.test(u.pathname)) return { kind: 'file', src: raw };
  return { kind: 'link', src: raw };
}

/** The click-to-play swap. Shared, so both builds insert the identical player. */
export function playVideo(box: HTMLElement): void {
  const { videoKind, videoSrc, videoTitle } = box.dataset;
  if (!videoSrc) return;
  box.innerHTML = '';
  if (videoKind === 'file') {
    const video = document.createElement('video');
    video.src = videoSrc;
    video.controls = true;
    video.autoplay = true;
    video.className = 'absolute inset-0 h-full w-full';
    box.appendChild(video);
  } else {
    const iframe = document.createElement('iframe');
    iframe.src = videoSrc;
    iframe.title = videoTitle ?? 'Video player';
    iframe.allow =
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen';
    iframe.allowFullscreen = true;
    iframe.className = 'absolute inset-0 h-full w-full border-0';
    box.appendChild(iframe);
  }
}
