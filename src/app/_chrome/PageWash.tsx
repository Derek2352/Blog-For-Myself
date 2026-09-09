'use client';

/**
 * The per-page warm wash, and the cat's tab hint.
 *
 * `Base.astro` took `hue` and `tab` as props and put them on elements it owned: a `.page-bg.wash`
 * div with `style="--hue: 32"`, and `data-cat-tab` on `<body>`. Neither is expressible from a page
 * in the App Router, because the page renders *inside* a layout it cannot reach — so the page
 * declares what it wants and this component applies it.
 *
 * The wash div is rendered here rather than in the layout so a page without one simply does not
 * get one, matching Astro's default. `data-cat-tab` is set on `<body>` in an effect and removed on
 * unmount, so navigating from a category page to the timeline clears it rather than leaving the
 * cat hunting in a tab the reader has left.
 *
 * This is the one place the migration adds a client component purely to reach the document. It is
 * two attributes; the alternative was threading a hue through the layout for every route.
 */
import { useEffect } from 'react';

export default function PageWash({ hue = 32, tab }: { hue?: number; tab?: string }) {
  useEffect(() => {
    if (!tab) return;
    document.body.setAttribute('data-cat-tab', tab);
    return () => document.body.removeAttribute('data-cat-tab');
  }, [tab]);

  return (
    <div
      className="page-bg wash"
      style={{ ['--hue' as string]: String(hue) }}
      aria-hidden="true"
    />
  );
}
