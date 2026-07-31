import { describe, it, expect } from 'vitest';
import { balancedCols } from '@/lib/layout';

describe('balancedCols', () => {
  it('steps down when three columns would strand one card', () => {
    expect(balancedCols(4)).toBe(2); // 3 + 1 → 2 + 2
  });

  it('keeps three when three divides cleanly enough', () => {
    expect(balancedCols(3)).toBe(3);
    expect(balancedCols(5)).toBe(3); // 3 + 2
    expect(balancedCols(6)).toBe(3);
    expect(balancedCols(8)).toBe(3); // 3 + 3 + 2
    expect(balancedCols(9)).toBe(3);
  });

  it('never asks for more columns than there are cards', () => {
    expect(balancedCols(1)).toBe(1);
    expect(balancedCols(2)).toBe(2);
  });

  it('keeps the preferred count when no candidate avoids an orphan', () => {
    expect(balancedCols(7)).toBe(3); // 7 orphans at 3 and at 2
  });

  it('handles an empty grid without dividing by nothing', () => {
    expect(balancedCols(0)).toBe(1);
  });

  it('respects a different preferred maximum', () => {
    expect(balancedCols(6, 4)).toBe(4); // 4 + 2
    expect(balancedCols(5, 4)).toBe(3); // 4 would leave 4 + 1
    expect(balancedCols(9, 4)).toBe(3); // 4 would leave 4 + 4 + 1
  });
});
