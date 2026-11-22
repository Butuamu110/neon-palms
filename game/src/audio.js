// NEON PALMS — WebAudio synth: engine, siren, shots, beeps, UI clicks. No audio files.
import { G } from './config.js';
import { clamp } from './rng.js';

let ctx = null, engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null, master = null;

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth';
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    engineOsc.connect(lp); lp.connect(engineGain); engineGain.connect(master); engineOsc.start();
    sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle';
    sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain); sirenGain.connect(master); sirenOsc.start();
  } catch (e) { ctx = null; }
}
function beep(freq, dur, type = 'square', vol = 0.15, when = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
export function sfx(name) {
  if (!ctx) return;
  if (name === 'shot') { beep(180, 0.09, 'square', 0.22); beep(90, 0.12, 'sawtooth', 0.18); }
  else if (name === 'hit') beep(320, 0.06, 'square', 0.12);
  else if (name === 'coin') { beep(880, 0.08, 'sine', 0.16); beep(1320, 0.12, 'sine', 0.16, 0.07); }
  else if (name === 'beepLow') beep(440, 0.16, 'square', 0.18);
  else if (name === 'beepGo') beep(880, 0.34, 'square', 0.22);
  else if (name === 'ui') beep(660, 0.05, 'sine', 0.1);
  else if (name === 'steal') { beep(220, 0.1, 'square', 0.15); beep(330, 0.14, 'square', 0.15, 0.09); }
  else if (name === 'passed') { [523, 659, 784, 1046].forEach((f, i) => beep(f, 0.22, 'triangle', 0.18, i * 0.11)); }
  else if (name === 'alarm') { beep(1200, 0.12, 'square', 0.14); beep(1200, 0.12, 'square', 0.14, 0.18); }
}
export function updateAudio(dt) {
  if (!ctx) return;
  const car = G.player.inCar;
  const spd = car ? Math.abs(car.speed) : 0;
  engineGain.gain.value += ((car ? 0.05 + spd * 0.0016 : 0) - engineGain.gain.value) * 0.2;
  if (car) engineOsc.frequency.value = 55 + spd * 2.6 + (car.nitro > 0 ? 26 : 0);
  const sirenOn = G.wanted >= 2 && G.cops.length > 0;
  sirenGain.gain.value += ((sirenOn ? 0.028 : 0) - sirenGain.gain.value) * 0.1;
  if (sirenOn) sirenOsc.frequency.value = 700 + Math.sin(G.time * 6.2) * 220;
  engineGain.gain.value = clamp(engineGain.gain.value, 0, 0.2);
}
