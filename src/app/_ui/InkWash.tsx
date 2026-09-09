'use client';

/**
 * The hero ink. The engine is `src/lib/ink-wash.ts`, shared with the Astro build.
 *
 * Starts `hidden`, and only the engine reveals it — so a reader with reduced motion, or with
 * JavaScript off, gets no canvas at all rather than an empty one. That is why `hidden` is in the
 * markup rather than in state: the correct thing to render before any script runs is nothing.
 */
import { useEffect } from 'react';
import { startInkWash } from '@/lib/ink-wash';

export default function InkWash() {
  useEffect(() => startInkWash(), []);
  return <canvas className="ink-wash" aria-hidden="true" hidden />;
}
