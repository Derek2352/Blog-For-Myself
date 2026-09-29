import { describe, expect, it } from 'vitest';
import { roman, roomOf } from '@/lib/rooms';

describe('rooms', () => {
  it('writes roman numerals', () => {
    expect([1, 2, 3, 4, 5, 8, 9, 10, 14].map(roman)).toEqual(['I', 'II', 'III', 'IV', 'V', 'VIII', 'IX', 'X', 'XIV']);
  });
  it('numbers only rooms with something in them, in order', () => {
    const index = [
      { slug: 'a', entryCount: 2 },
      { slug: 'empty', entryCount: 0 },
      { slug: 'b', entryCount: 1 },
    ];
    expect(roomOf('a', index)).toBe('Room I');
    expect(roomOf('b', index)).toBe('Room II');
    expect(roomOf('empty', index)).toBe('');
    expect(roomOf('missing', index)).toBe('');
  });
});
