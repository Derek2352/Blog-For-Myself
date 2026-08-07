import { describe, it, expect } from 'vitest';
import {
  COMMIT_MS,
  FLOOD_MS,
  HOLD_FLOOR_MS,
  REVEAL_MS,
  REVERSE_MS,
  WALL_MS,
  FORWARD_MS,
  FRAME_MS,
  DISSOLVE_MS,
  beatAt,
  curtainAlpha,
  pourPoints,
} from '@/lib/curtain';

describe('the beats (§14.3)', () => {
  it('runs commit → flood → hold → reveal → done, in that order', () => {
    expect(beatAt(0)).toBe('commit');
    expect(beatAt(COMMIT_MS)).toBe('flood');
    expect(beatAt(COMMIT_MS + FLOOD_MS)).toBe('hold');
    expect(beatAt(COMMIT_MS + FLOOD_MS + HOLD_FLOOR_MS)).toBe('reveal');
    expect(beatAt(FORWARD_MS)).toBe('done');
  });

  it('never skips a beat, however coarse the sampling', () => {
    // The hold is where the arena is actually built, so a frame long enough to step over it
    // would open a fight with nothing in front of it.
    const seen: string[] = [];
    for (let t = 0; t <= FORWARD_MS + 50; t += 7) {
      const b = beatAt(t);
      if (seen.at(-1) !== b) seen.push(b);
    }
    expect(seen).toEqual(['commit', 'flood', 'hold', 'reveal', 'done']);
  });

  it('gives the hold real time in it, not a frame', () => {
    expect(HOLD_FLOOR_MS).toBeGreaterThan(FRAME_MS * 4);
  });
});

describe('coverage over time (§14.3, §14.4)', () => {
  it('shows nothing during the commit — the beat is a pause, not a fade', () => {
    expect(curtainAlpha(0)).toBe(0);
    expect(curtainAlpha(COMMIT_MS - 1)).toBe(0);
  });

  it('covers the screen completely by the hold', () => {
    expect(curtainAlpha(COMMIT_MS + FLOOD_MS)).toBe(1);
    expect(curtainAlpha(COMMIT_MS + FLOOD_MS + HOLD_FLOOR_MS - 1)).toBe(1);
  });

  it('is gone by the end', () => {
    expect(curtainAlpha(FORWARD_MS)).toBeCloseTo(0, 6);
    expect(curtainAlpha(FORWARD_MS + 500)).toBeCloseTo(0, 6);
  });

  it('rises once and falls once — the photosensitivity rule, as arithmetic', () => {
    /*
     * §11 allows at most one luminance reversal per direction. The curtain only darkens
     * (see `curtainColour`), so "reversals" here means changes in the *direction* of the
     * alpha curve: up, flat, down. Anything more is a flicker.
     */
    let ups = 0;
    let downs = 0;
    let prev = curtainAlpha(0);
    let dirn = 0;
    for (let t = 1; t <= FORWARD_MS; t++) {
      const a = curtainAlpha(t);
      const d = a > prev + 1e-9 ? 1 : a < prev - 1e-9 ? -1 : 0;
      if (d !== 0 && d !== dirn) {
        if (d > 0) ups++;
        else downs++;
        dirn = d;
      }
      prev = a;
    }
    expect(ups).toBe(1);
    expect(downs).toBe(1);
  });

  it('leaves by the same shape, compressed, with no hold', () => {
    // Not a fade from an already-covered screen: that would snap the whole viewport dark on
    // one frame, and the page has to go behind something before it can be put back.
    expect(curtainAlpha(0, 'out')).toBe(0);
    expect(curtainAlpha(REVERSE_MS * 0.45, 'out')).toBeCloseTo(1, 6);
    expect(curtainAlpha(REVERSE_MS, 'out')).toBeCloseTo(0, 6);
  });

  it('and still only reverses once on the way out', () => {
    let changes = 0;
    let prev = curtainAlpha(0, 'out');
    let dirn = 0;
    for (let t = 1; t <= REVERSE_MS; t++) {
      const a = curtainAlpha(t, 'out');
      const d = a > prev + 1e-9 ? 1 : a < prev - 1e-9 ? -1 : 0;
      if (d !== 0 && d !== dirn) {
        changes++;
        dirn = d;
      }
      prev = a;
    }
    expect(changes).toBe(2); // one up, one down — the same as going in
  });

  it('covers on the way out fast enough to feel like an exit', () => {
    // Pillar 2's "instantly" is about not being trapped. The state changes at the peak.
    expect(REVERSE_MS * 0.45).toBeLessThan(350);
  });

  it('eases rather than snapping, at both ends of the flood', () => {
    // A full-screen change arriving on one frame is exactly what the easing exists to avoid.
    const early = curtainAlpha(COMMIT_MS + FLOOD_MS * 0.05);
    const late = curtainAlpha(COMMIT_MS + FLOOD_MS * 0.95);
    expect(early).toBeLessThan(0.05);
    expect(late).toBeGreaterThan(0.95);
    expect(curtainAlpha(COMMIT_MS + FLOOD_MS * 0.5)).toBeCloseTo(0.5, 2);
  });
});

describe('the coupling §14.8 asks for a spreadsheet about', () => {
  it('fits the whole way in inside the wall clock', () => {
    expect(FLOOD_MS + HOLD_FLOOR_MS + REVEAL_MS).toBeLessThanOrEqual(WALL_MS);
    expect(FORWARD_MS).toBeLessThanOrEqual(WALL_MS);
  });

  it('leaves faster than it arrives', () => {
    expect(REVERSE_MS).toBeLessThan(FORWARD_MS);
  });

  it('keeps every beat inside the range its rationale claims', () => {
    expect(COMMIT_MS).toBeLessThanOrEqual(250); // >250 and the button feels broken
    expect(FLOOD_MS).toBeGreaterThanOrEqual(350); // <350 is a cut with extra steps
    expect(FLOOD_MS).toBeLessThanOrEqual(1200); // >1200 and the visitor is waiting
    expect(HOLD_FLOOR_MS).toBeLessThanOrEqual(600); // >600 reads as a slow site
    expect(REVEAL_MS).toBeGreaterThanOrEqual(400); // <400 and the claims are missed
    expect(WALL_MS).toBeLessThanOrEqual(3000);
  });

  it('runs hotter than the hero wash, because it is over in two seconds', () => {
    expect(FRAME_MS).toBeLessThan(1000 / 20); // under 20fps a full-screen wipe reads as a crash
  });

  it('keeps the fallback dissolve short enough not to be a slow flood', () => {
    expect(DISSOLVE_MS).toBeLessThanOrEqual(200);
  });
});

describe('where the flood comes from (§14.3)', () => {
  it('pours from below the bottom edge, so the ink arrives from off-screen', () => {
    for (const p of pourPoints(160, 100, 4242)) {
      expect(p.y).toBeGreaterThanOrEqual(100);
    }
  });

  it('aims upward — the cat pushes up from its own edge', () => {
    for (const p of pourPoints(160, 100, 7)) {
      expect(Math.sin(p.angle)).toBeLessThan(0);
    }
  });

  it('fans across the width rather than stacking in one place', () => {
    const xs = pourPoints(160, 100, 99).map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(160 * 0.5);
  });

  it('is deterministic, so a curtain can be replayed', () => {
    expect(pourPoints(160, 100, 5)).toEqual(pourPoints(160, 100, 5));
  });

  it('differs between seeds, so no two floods match', () => {
    expect(JSON.stringify(pourPoints(160, 100, 1))).not.toBe(
      JSON.stringify(pourPoints(160, 100, 2)),
    );
  });
});
