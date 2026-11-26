// WebAudio synth sounds: an engine drone pitched by throttle, wind, ring
// chimes, warnings, a crash thud and a landing fanfare. Everything is made
// here; no audio file is loaded. Created lazily on the first user gesture,
// so a page that never hears a click stays silent.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let windGain = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Engine: two detuned saws through a low-pass, pitched by throttle.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'sawtooth';
      engineOsc2.frequency.value = 55.7;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      engineOsc2.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();
      engineOsc._mate = engineOsc2;
      engineOsc._filter = filter;
      // Wind: looped filtered noise.
      const len = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 500;
      windFilter.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      noise.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(master);
      noise.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  /** Call every frame with the flight state: throttle 0..1, speed fraction 0..1, stalled. */
  function update(throttle, speedFraction, stalled) {
    if (!ensure() || muted) {
      if (engineGain) engineGain.gain.value = 0;
      if (windGain) windGain.gain.value = 0;
      return;
    }
    if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime;
    const rpm = 42 + throttle * 58 + (stalled ? -8 : 0);
    engineOsc.frequency.setTargetAtTime(rpm, t, 0.08);
    engineOsc._mate.frequency.setTargetAtTime(rpm * 1.013, t, 0.08);
    engineOsc._filter.frequency.setTargetAtTime(220 + throttle * 420, t, 0.1);
    engineGain.gain.setTargetAtTime(0.05 + throttle * 0.075, t, 0.1);
    windGain.gain.setTargetAtTime(speedFraction * speedFraction * 0.12, t, 0.15);
  }

  function tone(freq, when, dur, type, vol) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  return {
    unlock() { ensure(); },
    update,
    ring(perfect) {
      tone(880, 0, 0.18, 'sine', 0.22);
      tone(1318, 0.07, 0.22, 'sine', 0.18);
      if (perfect) tone(1760, 0.14, 0.3, 'sine', 0.16);
    },
    repair() {
      tone(523, 0, 0.15, 'triangle', 0.2);
      tone(784, 0.09, 0.2, 'triangle', 0.18);
    },
    warn() { tone(220, 0, 0.12, 'square', 0.1); },
    crash() {
      tone(90, 0, 0.5, 'sawtooth', 0.3);
      tone(55, 0.05, 0.6, 'triangle', 0.28);
    },
    fanfare() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.11, 0.35, 'triangle', 0.2));
    },
    click() { tone(660, 0, 0.06, 'sine', 0.12); },
    toggleMute() {
      muted = !muted;
      if (muted && engineGain) engineGain.gain.value = 0;
      if (muted && windGain) windGain.gain.value = 0;
      return muted;
    },
    isMuted() { return muted; },
  };
}
