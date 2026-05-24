/**
 * Sound system — muted by default, opt-in.
 * Wire up actual AudioBuffers here when adding ambient loops or SFX.
 */

let enabled = false;

export const SoundSystem = {
  enable() { enabled = true; },
  disable() { enabled = false; },
  toggle() { enabled = !enabled; return enabled; },
  isEnabled() { return enabled; },

  /** Play a short click tone (future: load from /public/sounds/click.mp3) */
  click() {
    if (!enabled || typeof window === 'undefined') return;
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'square';
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    } catch {
      // AudioContext not available — silent fail
    }
  },

  /** Play a soft hover tone */
  hover() {
    if (!enabled || typeof window === 'undefined') return;
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 440;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.02, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.05);
    } catch {
      // silent fail
    }
  },

  /**
   * Future ambient loop support.
   * When ready, load a looping audio file:
   *   const audio = new Audio('/sounds/ambient.mp3');
   *   audio.loop = true;
   *   audio.volume = 0.08;
   *   if (enabled) audio.play();
   */
  startAmbient() { /* placeholder */ },
  stopAmbient() { /* placeholder */ },
};
