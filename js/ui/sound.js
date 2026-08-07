// Lightweight sound effects. Uses the WebAudio API to generate a short
// gated sine envelope. Sound is gated behind a user toggle (no autoplay).

export function createSound() {
  let enabled = false;
  let ctx = null;

  function ensureCtx() {
    if (ctx == null) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch { /* unsupported */ }
    }
    return ctx;
  }

  function blip(frequency, durationMs = 60, gain = 0.05) {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    g.gain.value = gain;
    osc.connect(g);
    g.connect(c.destination);
    const now = c.currentTime;
    osc.start(now);
    osc.stop(now + durationMs / 1000);
  }

  return {
    enable(value) {
      enabled = !!value;
      if (enabled) ensureCtx();
    },
    isEnabled: () => enabled,
    fetch: () => blip(440, 50, 0.04),
    decode: () => blip(660, 50, 0.04),
    execute: () => blip(880, 60, 0.05),
    tick: () => blip(330, 30, 0.03),
    halt: () => { blip(523, 100, 0.06); setTimeout(() => blip(392, 150, 0.06), 120); },
  };
}
