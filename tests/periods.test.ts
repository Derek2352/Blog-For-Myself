import { describe, it, expect } from 'vitest';
import { resolvePeriod } from '@/lib/periods';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe('resolvePeriod', () => {
  it('matches a defined period (Summer 2026 spans Jul–Aug)', () => {
    const p = resolvePeriod(d('2026-07-15'));
    expect(p.kind).toBe('period');
    expect(p.id).toBe('2026-summer');
    expect(p.label).toBe('Summer 2026');
  });

  it('includes the inclusive boundaries of a period', () => {
    expect(resolvePeriod(d('2026-07-01')).id).toBe('2026-summer'); // start day
    expect(resolvePeriod(d('2026-08-31')).id).toBe('2026-summer'); // end day
  });

  it('falls back to a month bucket outside every period', () => {
    const p = resolvePeriod(d('2026-04-10'));
    expect(p.kind).toBe('month');
    expect(p.id).toBe('m-2026-04');
    expect(p.label).toBe('April 2026');
    expect(p.start).toBe('2026-04-01');
    expect(p.end).toBe('2026-04-30'); // correct last day
  });

  it('computes the correct last day for months of different lengths', () => {
    expect(resolvePeriod(d('2026-02-15')).end).toBe('2026-02-28'); // non-leap Feb
    expect(resolvePeriod(d('2026-12-01')).end).toBe('2026-12-31');
  });

  it('nothing breaks for a date just outside a period', () => {
    expect(resolvePeriod(d('2026-06-30')).kind).toBe('month'); // day before Summer
    expect(resolvePeriod(d('2026-09-01')).kind).toBe('month'); // day after Summer
  });
});
