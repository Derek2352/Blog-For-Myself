/**
 * Periods group months into named seasons for /monthly, category log
 * sections, and period labels everywhere. Add an object → a new period
 * grouping exists. Dates are inclusive ISO days.
 *
 * Any entry/log date outside every period simply groups under its month
 * (e.g. "June 2026") — nothing breaks, by design. First matching range wins.
 */
export interface Period {
  id: string;
  label: string;
  /** inclusive ISO date, e.g. "2026-07-01" */
  start: string;
  /** inclusive ISO date, e.g. "2026-08-31" */
  end: string;
}

export const periods: Period[] = [
  { id: "2026-summer", label: "Summer 2026", start: "2026-07-01", end: "2026-08-31" },
  // Add as they come, e.g.
  // { id: "2026-autumn", label: "Autumn 2026", start: "2026-09-01", end: "2026-11-30" },
];
