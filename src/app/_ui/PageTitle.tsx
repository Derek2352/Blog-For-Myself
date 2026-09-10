/**
 * A page's `<h1>`, in the site's two-voice headline shape: roman, then an italic tail.
 *
 * The Next.js drops used this consistently — "The story, *so far*.", "More than a CV. A little
 * more *me*.", "A few things I've *put myself into*." — and it is the one typographic idea in them
 * worth taking wholesale. This site already owned the move; it just used it once, on the home
 * page, where "Numbers by day, frames by night." runs italic as a whole second line. As a
 * *pattern* it does something a single instance cannot: it gives every page a subject and a turn,
 * so the display face carries a thought rather than a label.
 *
 * A component rather than a convention, because a convention spread across eight files is a thing
 * to remember. Here the shape is the type: a `tail` cannot be forgotten, and it cannot drift into
 * bold, or into a different size, or onto its own line.
 *
 * The tail is `<em>` and not a styled `<span>`: it is a genuine change of voice within the
 * sentence, which is what `<em>` means, and a screen reader reading "The story, *so far*" with
 * emphasis is reading it correctly rather than being told about a font.
 */
export default function PageTitle({
  children,
  tail,
  className = '',
}: {
  /** The roman part — the subject. */
  children: React.ReactNode;
  /** The italic turn. Omit it for a title that is genuinely just a label, like a tag name. */
  tail?: React.ReactNode;
  className?: string;
}) {
  return (
    <h1 className={`mt-2 font-display text-4xl leading-[1.08] text-pretty sm:text-5xl ${className}`}>
      {children}
      {tail && (
        <>
          {' '}
          <em className="italic text-muted">{tail}</em>
        </>
      )}
    </h1>
  );
}
