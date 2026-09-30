/**
 * The harness fleet's stance budgets, held to the game's own roll.
 *
 * `dealsFor(stanceOdds(...))` in scratchpad/lib/fixture.mjs decides how many times a harness re-deals
 * a fight while it waits for the cat it needs. The odds it uses are a copy of `pickStance`'s, because
 * the fleet is plain .mjs and the game is TypeScript, and a copy can drift: a drifted copy would size
 * every budget wrong and nothing would say so until a nightly went red on the dice. So these roll the
 * real `pickStance` and hold the copy to what it produces.
 */
import { describe, expect, it } from 'vitest';
import { SLEEPY_CHANCE, pickStance, type Stance } from '../src/lib/arena';
import { DEAL_MISS, SLEEPY_CHANCE as MIRRORED_SLEEPY, dealsFor, stanceOdds } from '../scratchpad/lib/fixture.mjs';

const STANCES: Stance[] = ['sleepy', 'ambush', 'siege', 'trickster'];

describe('stance fixture budgets', () => {
  it('mirror the sleepy chance the game rolls with', () => {
    expect(MIRRORED_SLEEPY).toBe(SLEEPY_CHANCE);
  });

  it('price each stance at the rate pickStance actually rolls it', () => {
    const N = 200_000;
    const seen = new Map<Stance, number>(STANCES.map((s) => [s, 0]));
    for (let i = 1; i <= N; i++) {
      // Spread across the whole 32-bit range, as the game's clock-and-random seeds are.
      const stance = pickStance(Math.imul(i, 0x9e3779b1) >>> 0);
      seen.set(stance, (seen.get(stance) ?? 0) + 1);
    }
    for (const stance of STANCES) {
      const p = stanceOdds([stance]);
      const se = Math.sqrt((p * (1 - p)) / N);
      // Four standard errors. The seeds are fixed, so this passes every time or never does.
      expect(Math.abs((seen.get(stance) ?? 0) / N - p), stance).toBeLessThan(4 * se);
    }
    expect(stanceOdds(STANCES)).toBeCloseTo(1, 12);
  });

  it('give a fixture the smallest budget the dice run out of less than once in DEAL_MISS', () => {
    for (const want of [['ambush'], ['siege'], ['trickster'], ['sleepy'], ['ambush', 'trickster']]) {
      const p = stanceOdds(want);
      const n = dealsFor(p);
      expect((1 - p) ** n, want.join('/')).toBeLessThanOrEqual(DEAL_MISS);
      expect((1 - p) ** (n - 1), want.join('/')).toBeGreaterThan(DEAL_MISS);
    }
  });

  it('count a stance once, however many times a harness names it', () => {
    expect(stanceOdds(['ambush', 'ambush'])).toBe(stanceOdds(['ambush']));
  });
});
