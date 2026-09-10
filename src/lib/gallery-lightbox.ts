/**
 * The gallery's lightbox — the behaviour, shared by both builds.
 *
 * A native `<dialog>` gives a real focus trap, Esc-to-close and focus restoration for free; this
 * adds the frame counter, arrow-key and swipe navigation, and backdrop-click close. The markup
 * lives in each framework's component; only this runs.
 *
 * `setupGallery` returns a disposer, which the Astro version had no use for (its DOM was replaced
 * wholesale on navigation) and the React version needs as an effect cleanup.
 */

interface LightboxItem {
  src: string;
  alt: string;
  caption: string;
}

export function setupGallery(root: HTMLElement): () => void {
  const dialog = root.querySelector<HTMLDialogElement>('[data-lb-dialog]');
  const dataEl = root.querySelector('[data-lb-data]');
  const img = root.querySelector<HTMLImageElement>('[data-lb-img]');
  const caption = root.querySelector<HTMLElement>('[data-lb-caption]');
  const counter = root.querySelector<HTMLElement>('[data-lb-counter]');
  /* Nothing to tear down if there was nothing to wire. */
  if (!dialog || !dataEl || !img || !caption || !counter) return () => {};

  const items: LightboxItem[] = JSON.parse(dataEl.textContent ?? '[]');
  if (items.length === 0) return () => {};
  const total = String(items.length).padStart(2, '0');
  let index = 0;

  const show = (i: number): void => {
    index = (i + items.length) % items.length;
    const item = items[index]!;
    img.src = item.src;
    img.alt = item.alt;
    caption.textContent = item.caption;
    caption.hidden = item.caption.length === 0;
    counter.textContent = `FRAME ${String(index + 1).padStart(2, '0')} / ${total}`;
  };

  root.querySelectorAll<HTMLButtonElement>('[data-lb-open]').forEach((btn) => {
    btn.addEventListener('click', () => {
      show(Number(btn.dataset.index ?? 0));
      dialog.showModal();
      document.body.style.overflow = 'hidden';
    });
  });

  dialog.querySelector('[data-lb-close]')?.addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-lb-prev]')?.addEventListener('click', () => show(index - 1));
  dialog.querySelector('[data-lb-next]')?.addEventListener('click', () => show(index + 1));

  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(index - 1);
    if (e.key === 'ArrowRight') show(index + 1);
  });

  // touch swipe left/right to navigate frames
  if (items.length > 1) {
    let startX = 0;
    let startY = 0;
    let swiping = false;
    img.addEventListener(
      'pointerdown',
      (e) => {
        if (e.pointerType === 'mouse') return;
        swiping = true;
        startX = e.clientX;
        startY = e.clientY;
      },
      { passive: true },
    );
    img.addEventListener('pointerup', (e) => {
      if (!swiping) return;
      swiping = false;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) show(index + (dx < 0 ? 1 : -1));
    });
  }

  // click on the backdrop (the dialog element itself) closes
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  dialog.addEventListener('close', () => {
    document.body.style.overflow = '';
  });

  /* Nothing to unbind that does not leave with the elements themselves — every listener above is
     on a node inside `root`. The one exception is the body's overflow lock, which must not survive
     a component that unmounts while its lightbox is open. */
  return () => {
    document.body.style.overflow = '';
  };
}
