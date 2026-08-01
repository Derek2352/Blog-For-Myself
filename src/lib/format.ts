/** Formatting helpers. Date formatting is UTC-based so `2026-07-01` never drifts a day. */

/** Estimated reading time from a markdown body: "~N min" (min 1). */
export function readingTime(text: string): string {
  const stripped = text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^##?\s.*$/gm, '')
    .replace(/!?\[.*?\]\(.*?\)/g, '')
    .trim();
  const words = stripped.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return `~${minutes} min`;
}

/** "2026-07" — used for month grouping keys and the mono rail. */
export const monthKey = (d: Date): string => d.toISOString().slice(0, 7);

/** "2026-07-18" */
export const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

/** "July 2026" from a "2026-07" key. */
export function monthLabelFromKey(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** "Apr 2026" */
export const humanMonth = (d: Date): string =>
  d.toLocaleDateString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/** "Apr 2026" · "Apr – Jun 2026" · "Nov 2025 – Feb 2026" */
export function humanRange(start: Date, end?: Date): string {
  if (!end || monthKey(end) === monthKey(start)) return humanMonth(start);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const startLabel = sameYear
    ? start.toLocaleDateString('en', { month: 'short', timeZone: 'UTC' })
    : humanMonth(start);
  return `${startLabel} – ${humanMonth(end)}`;
}

/** Mono-rail range: "2026-04" · "2026-04 → 2026-06" */
export function railRange(start: Date, end?: Date): string {
  if (!end || monthKey(end) === monthKey(start)) return monthKey(start);
  return `${monthKey(start)} → ${monthKey(end)}`;
}
