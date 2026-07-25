import { describe, it, expect } from 'vitest';
import { A11Y_PREFS, A11Y_KEYS, a11yGroups } from '@/lib/a11y-prefs';

describe('a11y preference declarations', () => {
  it('exposes a key for every declared pref, in order', () => {
    expect(A11Y_KEYS).toEqual(A11Y_PREFS.map((p) => p.key));
  });

  it('has unique keys (each maps to one storage key + one html class)', () => {
    expect(new Set(A11Y_KEYS).size).toBe(A11Y_KEYS.length);
  });

  it('uses class-safe kebab-case keys', () => {
    for (const key of A11Y_KEYS) expect(key).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it('gives every pref a visible label and a group', () => {
    for (const pref of A11Y_PREFS) {
      expect(pref.label.trim().length).toBeGreaterThan(0);
      expect(pref.group.trim().length).toBeGreaterThan(0);
    }
  });

  it('still declares the toggles the stylesheet and scripts rely on', () => {
    // global.css styles .a11y-large/-contrast/-underline/-motion, and the
    // shortcut guards read .a11y-noshortcuts — dropping one silently would
    // leave dead CSS or an unreachable guard.
    expect(A11Y_KEYS).toEqual(
      expect.arrayContaining(['large', 'contrast', 'underline', 'motion', 'noshortcuts']),
    );
  });
});

describe('a11yGroups', () => {
  it('buckets prefs by group without losing or duplicating any', () => {
    const flattened = a11yGroups().flatMap((g) => g.prefs);
    expect(flattened).toEqual([...A11Y_PREFS]);
  });

  it('emits each group exactly once, in first-appearance order', () => {
    const names = a11yGroups().map((g) => g.group);
    expect(new Set(names).size).toBe(names.length);
    expect(names[0]).toBe(A11Y_PREFS[0]!.group);
  });
});
