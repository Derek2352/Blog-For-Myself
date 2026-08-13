/**
 * Arena sound — the cat's game, audible. Added in 1.3 (§11 gains a sound row).
 *
 * Everything here is **WebAudio synthesis**: short oscillator/noise envelopes, no audio
 * files, no assets, no network. The cues map one-to-one onto events that already have a
 * visual — the telegraph, the landing, a reclaim, and each ending — so the sound never
 * carries information the picture lacks; it underlines it.
 *
 * **On by default since 2.1, and the chip is a mute rather than an opt-in.**
 *
 * 1.3 shipped it off by default and argued the case at length — but the argument was about a
 * *page* making noise at a reader, and this is not that. Sound here can only happen inside a
 * fight, a fight can only start by pressing "cat takes the screen", and nobody presses that
 * button by accident. Asking a second time, in a second control, for permission to make the
 * thing you just started audible is asking the visitor to opt into their own decision — and
 * 2.0's whole finding was that this game asks too much before anything good happens.
 *
 * **Consent is the arena toggle, and it has not moved.** The cat is silent on every page of
 * this site until somebody chooses to play. What the chip does now is turn sound *off*, which
 * §11 still requires: a visitor who wants the game without the noise presses it once, and
 * anyone on a shared desk or a quiet carriage can silence it in one tap without leaving the
 * fight. Removing the control entirely would have left no way to do that, so it stays — the
 * request was that sound need no option to *start*, and it does not.
 *
 * The browser's autoplay gate lines up with this rather than against it: audio needs a user
 * gesture, the arena toggle *is* one, and `primeSfx()` is called inside that click so the
 * context is unlocked before the first cue rather than at some later moment. Still
 * session-only, still nothing stored (§13.4/§7.2) — a refresh comes back with sound on,
 * because that is the default now.
 *
 * The client half is marked like `a11y-prefs.ts`: the module itself is import-safe at
 * build time (no top-level `window` access), and the browser-only functions create the
 * AudioContext lazily on first use.
 */

/**
 * Every cue the fight can sound, one per visual event — the rule §11 sets, which is why this list
 * grows only when something new is visible. 1.4 added `swat` (§5.4's counter connecting, which has
 * the squash) and `laststand` (§7.3's tier turning, which has the mood tell).
 */
export type SfxCue =
  | 'telegraph'
  | 'land'
  | 'reclaim'
  | 'swat'
  | 'laststand'
  | 'order'
  | 'win'
  | 'lose';

/* ------------------------------------------------------------------ *
 * Session state — the toggle's only memory
 * ------------------------------------------------------------------ */

let enabled = true;

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

/**
 * Unlock the audio context from inside a user gesture.
 *
 * Sound is on by default now, so there is no toggle click to create the `AudioContext` in — and a
 * context created outside a gesture starts `suspended`, which would silence the first cues of the
 * first fight and then mysteriously fix itself. The arena toggle's own click is the gesture, so this
 * is called there: it is the same "consent and capability arrive together" the opt-in version had,
 * moved to the button the visitor actually presses.
 */
export function primeSfx(): void {
  if (enabled) audio();
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
    /*
     * §5.4's counter connecting (1.4). A noise thud with a bright tick over it — the thump says
     * *contact* and borrows the landing's vocabulary, and the tick above it is the only rising
     * note in the set that the player causes to happen *to the cat*. Louder than `reclaim`
     * because it is rarer and deliberate; still under the win.
     */
    case 'swat':
      thud(ac, 0.1, 0.08);
      blip(ac, 880, 1180, 0.1, 'square', 0.045, 0.02);
      break;
    /*
     * §7.3's last stand beginning (1.4). Two low notes *rising* — the only ascending figure the
     * cat plays about itself, and pitched under everything else so it reads as a threat rather
     * than a fanfare. It is the audio half of "the walls come in now": the player should hear the
     * fight change gear at the moment the regrow clock does.
     */
    case 'laststand':
      blip(ac, 110, 130, 0.3, 'sawtooth', 0.05);
      blip(ac, 146, 174, 0.4, 'sawtooth', 0.05, 0.16);
      break;
    /*
     * §15's order landing (2.0). One short, high, quiet tick — the sound of being *acknowledged*
     * rather than the sound of something happening.
     *
     * The quietest cue in the set on purpose. Everything else here belongs to the fight; this one
     * belongs to the interface, and an interface that chirps as loudly as the game does teaches the
     * visitor that clicking is the point. It is not: the mode works if they never click at all, so
     * the confirmation should be the smallest thing that still says "heard you".
     */
    case 'order':
      blip(ac, 1180, 1480, 0.06, 'triangle', 0.03);
      break;
    // lose: two descending notes, no drama
    case 'lose':
      blip(ac, 392, 392, 0.16, 'sine', 0.06);
      blip(ac, 262, 262, 0.24, 'sine', 0.06, 0.14);
      break;
  }
}
