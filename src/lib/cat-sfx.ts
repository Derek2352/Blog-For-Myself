/**
 * Arena sound — the cat's game, audible. Added in 1.3 (§11 gains a sound row).
 *
 * Everything here is **WebAudio synthesis**: short oscillator/noise envelopes, no audio
 * files, no assets, no network. The cues map one-to-one onto events that already have a
 * visual — the telegraph, the landing, a reclaim, and each ending — so the sound never
 * carries information the picture lacks; it underlines it.
 *
 * **Off by default, opt-in, session-only.** The toggle lives in the cat's HUD beside the
 * arena toggle (§13's second control). It deliberately does *not* live in A11Y_PREFS:
 * §13.1 already settled the placement — "a game is not a reading preference" — and game
 * sound is the same category. And per §13.4/§7.2 nothing here is stored: you opt into
 * the game and its sound together, and both die on a refresh. The browser's autoplay
 * gate happens to align with the design: audio unlocks on a user gesture, and the toggle
 * click is one, so consent and capability arrive at the same moment.
 *
 * The client half is marked like `a11y-prefs.ts`: the module itself is import-safe at
 * build time (no top-level `window` access), and the browser-only functions create the
 * AudioContext lazily on first use.
 */

/** The five cues the fight can sound, one per visual event. */
export type SfxCue = 'telegraph' | 'land' | 'reclaim' | 'win' | 'lose';

/* ------------------------------------------------------------------ *
 * Session state — the toggle's only memory
 * ------------------------------------------------------------------ */

let enabled = false;

/** Is sound on for this visit? */
export function sfxEnabled(): boolean {
  return enabled;
}

/* ------------------------------------------------------------------ *
 * Client-side helpers — browser only, like a11y-prefs.ts's DOM half
 * ------------------------------------------------------------------ */

let ctx: AudioContext | null = null;

/** Lazily-created shared context. Created on first play, not at toggle. */
function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Turn the cat's sound on or off for this session. */
export function setSfxEnabled(on: boolean): void {
  enabled = on;
  if (on) audio();
}

/** A short oscillator blip with an exponential decay. */
function blip(
  ac: AudioContext,
  freq: number,
  endFreq: number,
  duration: number,
  type: OscillatorType,
  gain: number,
  when = 0,
): void {
  const t = ac.currentTime + when;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t + duration);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

/** A short filtered-noise thud (the landing). */
function thud(ac: AudioContext, duration: number, gain: number): void {
  const t = ac.currentTime;
  const len = Math.max(1, Math.floor(ac.sampleRate * duration));
  const buffer = ac.createBuffer(1, len, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(320, t);
  lp.frequency.exponentialRampToValueAtTime(60, t + duration);
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  src.connect(lp).connect(g).connect(ac.destination);
  src.start(t);
}

/** Play a cue, if sound is on. Quiet by design — it is an easter egg, not a soundtrack. */
export function playCue(cue: SfxCue): void {
  if (!enabled) return;
  const ac = audio();
  if (!ac) return;
  switch (cue) {
    // wind-up: a low gathering tone that thins as the telegraph resolves
    case 'telegraph':
      blip(ac, 140, 220, 0.32, 'sawtooth', 0.05);
      break;
    // touchdown: a soft noise thud
    case 'land':
      thud(ac, 0.18, 0.09);
      break;
    // a claim comes back: a small ascending blip, the fight's reward sound
    case 'reclaim':
      blip(ac, 440, 660, 0.14, 'triangle', 0.06);
      blip(ac, 660, 880, 0.12, 'triangle', 0.05, 0.08);
      break;
    // win: a short rising arpeggio
    case 'win':
      blip(ac, 523, 523, 0.12, 'triangle', 0.06);
      blip(ac, 659, 659, 0.12, 'triangle', 0.06, 0.1);
      blip(ac, 784, 784, 0.2, 'triangle', 0.06, 0.2);
      break;
    // lose: two descending notes, no drama
    case 'lose':
      blip(ac, 392, 392, 0.16, 'sine', 0.06);
      blip(ac, 262, 262, 0.24, 'sine', 0.06, 0.14);
      break;
  }
}
