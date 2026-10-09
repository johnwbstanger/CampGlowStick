// All sounds are synthesised with Web Audio - no audio files.
let ctx: AudioContext | null = null;
let noiseBuf: AudioBuffer | null = null;

export function audio(): AudioContext | null {
  if (!ctx) {
    try { ctx = new AudioContext(); } catch { return null; }
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  return ctx;
}

function tone(type: OscillatorType, f0: number, f1: number, dur: number, gain: number, delay = 0): void {
  const a = audio(); if (!a) return;
  const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
function hiss(dur: number, gain: number, freq: number, type: BiquadFilterType = 'highpass'): void {
  const a = audio(); if (!a || !noiseBuf) return;
  const t = a.currentTime, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(a.destination); s.start(t); s.stop(t + dur);
}

/** Distinct sounds per material: metal CLANG, plastic THUMP, enamel CLINK, glass CRASH, wood THUD, cans TING. */
export function playMaterial(mat: string, volume: number): void {
  const v = Math.min(1, volume / 8) * 0.5;
  if (v < 0.02) return;
  switch (mat) {
    case 'metal': tone('square', 520, 380, 0.5, v * 0.5); tone('sine', 1040, 900, 0.6, v * 0.5); break;
    case 'plastic': tone('sine', 180, 60, 0.18, v * 1.2); break;
    case 'enamel': tone('sine', 2100, 1900, 0.25, v * 0.6); break;
    case 'glass': hiss(0.5, v, 3000); tone('sine', 3200, 2400, 0.3, v * 0.4); break;
    case 'wood': tone('triangle', 140, 70, 0.14, v * 1.4); break;
    case 'can': tone('sine', 2800, 2600, 0.12, v * 0.5); break;
    case 'cloth': hiss(0.12, v * 0.4, 400, 'lowpass'); break;
    case 'glow': tone('square', 900, 500, 0.04, 0.12); tone('sine', 1500, 1500, 0.08, 0.08, 0.04); break;
    default: hiss(0.06, v * 0.5, 800, 'lowpass');
  }
}
export const click = (): void => { tone('square', 1200, 300, 0.03, 0.15); hiss(0.03, 0.1, 2000); };
export function growl(): void { tone('sawtooth', 70, 40, 0.8, 0.12); }
