/**
 * The first-visit welcome note's behaviour, shared by both builds.
 *
 * Shows once ever (localStorage), a beat after the page paints — a note left on the desk, not a
 * gate. The flag is set the moment it opens, so nobody is ever nagged twice, and `handledThisVisit`
 * keeps it to once per session even if the caller fires again.
 *
 * Every judgement in here was made against a reader rather than a spec, so the comments come with
 * it: scrolling counts as an answer, engaging with the note cancels its own countdown, and a visit
 * where the reader scrolled straight past still counts as welcomed.
 */
const KEY = 'welcomed';
/** How long the note stays before clearing itself, once it has opened. */
const AUTO_CLOSE_MS = 8000;
let handledThisVisit = false;

export function maybeWelcome(): void {
  if (handledThisVisit) return;
  try {
    if (localStorage.getItem(KEY)) return;
  } catch {
    return; // no storage → showing every time would nag; skip instead
  }
  const dialog = document.getElementById('welcome-note');
  if (!(dialog instanceof HTMLDialogElement)) return;
  handledThisVisit = true;

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.querySelectorAll('[data-welcome-close]').forEach((el) => {
    el.addEventListener('click', () => dialog.close());
  });

  // Scrolling is an answer: someone who has started reading doesn't need a
  // map, and a real showModal() blocks the page — so get out of the way
  // instead of making them dismiss it first. A scroll during the 700ms wait
  // cancels the opening outright; after that it closes the note.
  let scrolled = false;
  const onScroll = () => {
    scrolled = true;
    dialog.close(); // no-op if it hasn't opened yet
  };
  window.addEventListener('scroll', onScroll, { passive: true, once: true });

  // It also clears itself: a note nobody asked for shouldn't need dismissing.
  // Engaging with it cancels the countdown — pulling it away mid-sentence
  // would be worse than letting it sit. Focus can't be the signal, since
  // showModal() puts focus on the button the moment it opens.
  let countdown: number | undefined;
  const holdOpen = () => {
    if (countdown !== undefined) {
      clearTimeout(countdown);
      countdown = undefined;
    }
  };
  dialog.addEventListener('pointerenter', holdOpen);
  dialog.addEventListener('keydown', holdOpen);

  // Dismissed any other way (button, Esc, backdrop, scroll) → stop listening
  // and drop the countdown rather than leaving either armed for the session.
  dialog.addEventListener(
    'close',
    () => {
      window.removeEventListener('scroll', onScroll);
      holdOpen();
    },
    { once: true },
  );

  setTimeout(() => {
    // Either way this visit counts as welcomed: someone who scrolled straight
    // past has found their own way in and shouldn't meet a modal next time.
    try {
      localStorage.setItem(KEY, '1');
    } catch {}
    if (scrolled) return;
    if (document.getElementById('welcome-note') !== dialog) return;
    dialog.showModal();
    countdown = window.setTimeout(() => dialog.close(), AUTO_CLOSE_MS);
  }, 700);
}
