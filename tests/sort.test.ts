import { describe, it, expect } from 'vitest';
import { byPinnedOrder, byDateDesc } from '@/lib/sort';

const pinned = (order?: number) => ({ data: { order } });
const dated = (iso: string) => ({ data: { date: new Date(iso) } });

describe('byPinnedOrder', () => {
  it('sorts pinned items ascending', () => {
    expect(byPinnedOrder(pinned(1), pinned(2))).toBeLessThan(0);
    expect(byPinnedOrder(pinned(3), pinned(2))).toBeGreaterThan(0);
  });

  it('puts a pinned item before an unpinned one', () => {
    expect(byPinnedOrder(pinned(5), pinned(undefined))).toBeLessThan(0);
    expect(byPinnedOrder(pinned(undefined), pinned(5))).toBeGreaterThan(0);
  });

  it('treats two unpinned items as a tie — never NaN', () => {
    const result = byPinnedOrder(pinned(undefined), pinned(undefined));
    expect(result).toBe(0);
    expect(Number.isNaN(result)).toBe(false);
  });

  it('treats equal pins as a tie', () => {
    expect(byPinnedOrder(pinned(2), pinned(2))).toBe(0);
  });

  it('keeps unpinned items in their original relative order when sorting', () => {
    const a = { id: 'a', data: { order: undefined } };
    const b = { id: 'b', data: { order: undefined } };
    const c = { id: 'c', data: { order: 1 } };
    expect([a, b, c].sort(byPinnedOrder).map((x) => x.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('byDateDesc', () => {
  it('sorts newest first', () => {
    expect(byDateDesc(dated('2026-05-01'), dated('2026-01-01'))).toBeLessThan(0);
  });

  it('ties on identical dates, so a secondary key can decide', () => {
    expect(byDateDesc(dated('2026-04-01'), dated('2026-04-01'))).toBe(0);
  });

  it('orders a list newest to oldest', () => {
    const list = [dated('2025-11-01'), dated('2026-05-02'), dated('2026-01-01')];
    expect(list.sort(byDateDesc).map((d) => d.data.date.getUTCFullYear() + '-' + (d.data.date.getUTCMonth() + 1))).toEqual([
      '2026-5',
      '2026-1',
      '2025-11',
    ]);
  });
});
