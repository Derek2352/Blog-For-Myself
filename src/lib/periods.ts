import { periods } from '@/data/periods';
import { monthKey, monthLabelFromKey } from './format';

/**
 * A resolved grouping bucket for a date: either a named period from
 * src/data/periods.ts (first matching range wins) or, when no period covers
 * the date, a month fallback ("July 2026" / key 2026-07). Nothing breaks for
 * dates outside every period — they simply group by month.
 */
export interface PeriodRef {
  kind: 'period' | 'month';
  id: string;
  label: string;
  /** inclusive ISO dates for the bucket, used for sorting and rail metadata */
  start: string;
  end: string;
}

export function resolvePeriod(date: Date): PeriodRef {
  const t = date.getTime();
  for (const p of periods) {
    const s = Date.parse(`${p.start}T00:00:00.000Z`);
    const e = Date.parse(`${p.end}T23:59:59.999Z`);
    if (t >= s && t <= e) {
      return { kind: 'period', id: p.id, label: p.label, start: p.start, end: p.end };
    }
  }
  const key = monthKey(date);
  const [y, m] = key.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    kind: 'month',
    id: `m-${key}`,
    label: monthLabelFromKey(key),
    start: `${key}-01`,
    end: `${key}-${String(lastDay).padStart(2, '0')}`,
  };
}
