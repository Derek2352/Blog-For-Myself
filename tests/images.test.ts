import { describe, it, expect } from 'vitest';
import { orientation } from '@/lib/images';

describe('orientation', () => {
  it('classifies wide / tall / square', () => {
    expect(orientation({ width: 1600, height: 1000 })).toBe('wide');
    expect(orientation({ width: 900, height: 1400 })).toBe('tall');
    expect(orientation({ width: 1000, height: 1000 })).toBe('square');
  });

  it('treats near-square within tolerance as square', () => {
    expect(orientation({ width: 1050, height: 1000 })).toBe('square'); // ratio 1.05
    expect(orientation({ width: 1000, height: 1050 })).toBe('square'); // ratio 0.95
  });

  it('flips to wide/tall past the 1.1 / 0.9 thresholds', () => {
    expect(orientation({ width: 1200, height: 1000 })).toBe('wide'); // 1.2
    expect(orientation({ width: 1000, height: 1200 })).toBe('tall'); // 0.83
  });
});
