/**
 * A landing-page section's heading: the mono kicker, the display headline, and — when the section
 * is a preview of something longer — the way to the rest of it.
 *
 * The home page had written this shape out twice by hand (`kicker` + `mt-1 font-display text-3xl`)
 * and the category page a third time, so the three had already drifted apart on size and spacing.
 * One component makes the section rhythm a property of the site rather than of whichever file was
 * edited last.
 *
 * **The rule underneath is the point of it.** A kicker and a headline floating above a grid read as
 * a label for whatever is nearest; a hairline between them and the grid says where the section
 * begins. The action sits on the same baseline at the right, so "there is more of this" is said
 * where the eye already is rather than after the last card — by which point a reader who wanted
 * more has already scrolled past the chance.
 */
import Link from 'next/link';

export default function SectionHead({
  id,
  kicker,
  title,
  action,
}: {
  /** The `<h2>`'s id, for the section's `aria-labelledby`. */
  id: string;
  kicker: string;
  title: React.ReactNode;
  /** Where the rest of this section lives, when it is a preview. */
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-line pb-4">
      <div className="min-w-0">
        <p className="kicker">{kicker}</p>
        <h2 id={id} className="mt-1.5 font-display text-section text-pretty">
          {title}
        </h2>
      </div>
      {action && (
        <Link href={action.href} prefetch={false} className="go-link">
          {action.label}
          <span aria-hidden="true" className="go-arrow">
            →
          </span>
        </Link>
      )}
    </div>
  );
}
