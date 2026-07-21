import { describe, it, expect } from 'vitest';
import {
  monthKey,
  isoDay,
  monthLabelFromKey,
  humanMonth,
  humanRange,
  railRange,
} from '@/lib/format';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe('format helpers (UTC-stable)', () => {
  it('monthKey / isoDay', () => {
    expect(monthKey(d('2026-07-01'))).toBe('2026-07');
    expect(isoDay(d('2026-07-01'))).toBe('2026-07-01');
    // no day drift at UTC midnight
    expect(monthKey(d('2026-01-01'))).toBe('2026-01');
    expect(isoDay(d('2026-12-31'))).toBe('2026-12-31');
  });

  it('monthLabelFromKey', () => {
    expect(monthLabelFromKey('2026-07')).toBe('July 2026');
    expect(monthLabelFromKey('2025-11')).toBe('November 2025');
  });

  it('humanMonth', () => {
    expect(humanMonth(d('2026-04-15'))).toBe('Apr 2026');
  });

  it('humanRange: single month, same-year span, cross-year span', () => {
    expect(humanRange(d('2026-04-01'))).toBe('Apr 2026');
    expect(humanRange(d('2026-04-01'), d('2026-04-30'))).toBe('Apr 2026'); // same month
    expect(humanRange(d('2026-04-01'), d('2026-06-30'))).toBe('Apr – Jun 2026'); // same year
    expect(humanRange(d('2025-11-01'), d('2026-02-28'))).toBe('Nov 2025 – Feb 2026'); // cross year
  });

  it('railRange: mono timecode style', () => {
    expect(railRange(d('2026-04-01'))).toBe('2026-04');
    expect(railRange(d('2026-04-01'), d('2026-04-20'))).toBe('2026-04'); // same month collapses
    expect(railRange(d('2026-04-01'), d('2026-06-01'))).toBe('2026-04 → 2026-06');
  });
});
