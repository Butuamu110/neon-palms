// NEON PALMS sound: everything is synthesised with WebAudio — no samples, no files. A lazy
// AudioContext wakes on the first user gesture (browsers refuse sound before one); in the
// screenshot scenes the engine stays silent. Layers: engine hum tied to speed, a two-tone
// siren while the heat is on, one-shot effects (gunfire, glass, cash, UI) and a tiny
// generative radio that plays each station's groove from its bpm.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenFlip = null;
  let radioTimer = null;
  let radioStep = 0;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    return true;
  }

  function noiseBuffer(seconds) {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
  let sharedNoise = null;
  function noise() {
    if (!sharedNoise) sharedNoise = noiseBuffer(1);
    return sharedNoise;
  }

  function blip(freq, seconds, type, gain, slideTo) {
    if (!ensure()) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + seconds);
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
    osc.connect(g).connect(master);
    osc.start();
    osc.stop(ctx.currentTime + seconds);
  }

  function burst(seconds, gain, filterFreq, type = 'lowpass') {
    if (!ensure()) return;
    const src = ctx.createBufferSource();
    src.buffer = noise();
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
    src.connect(filter).connect(g).connect(master);
    src.start();
    src.stop(ctx.currentTime + seconds);
  }

  /** Engine loop: a saw under a lowpass, pitch following the car's speed. */
  function engine(speedRatio, inCar) {
    if (!ensure()) return;
    if (!engineOsc) {
      engineOsc = ctx.createOscillator();
      engineGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineOsc.type = 'sawtooth';
      engineGain.gain.value = 0;
      engineOsc.connect(filter).connect(engineGain).connect(master);
      engineOsc.start();
    }
    const target = inCar ? 0.05 + Math.abs(speedRatio) * 0.05 : 0;
    engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
    engineOsc.frequency.setTargetAtTime(55 + Math.abs(speedRatio) * 165, ctx.currentTime, 0.05);
  }

  /** Two-tone siren while wanted; rate quickens with the star count. */
  function siren(stars) {
    if (!ensure()) return;
    if (stars <= 0) {
      if (sirenGain) sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      return;
    }
    if (!sirenOsc) {
      sirenOsc = ctx.createOscillator();
      sirenGain = ctx.createGain();
      sirenOsc.type = 'triangle';
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain).connect(master);
      sirenOsc.start();
      let high = false;
      sirenFlip = window.setInterval(() => {
        if (!sirenOsc) return;
        high = !high;
        sirenOsc.frequency.setValueAtTime(high ? 960 : 720, ctx.currentTime);
      }, 380);
    }
    sirenGain.gain.setTargetAtTime(0.018 + stars * 0.004, ctx.currentTime, 0.2);
    if (sirenFlip) { /* interval keeps its pace; gain carries the urgency */ }
  }

  const NOTE = { A1: 55, C2: 65.41, D2: 73.42, E2: 82.41, G2: 98, A2: 110, C3: 130.81, D3: 146.83, E3: 164.81, G3: 196, A3: 220 };
  const GROOVES = [
    [NOTE.A1, 0, NOTE.A1, NOTE.C2, 0, NOTE.E2, 0, NOTE.G2, NOTE.A1, 0, NOTE.A1, NOTE.C2, 0, NOTE.D2, NOTE.E2, 0],
    [NOTE.A1, NOTE.A1, 0, NOTE.A1, NOTE.C3, 0, NOTE.A2, 0, NOTE.G2, 0, NOTE.E2, 0, NOTE.D2, NOTE.E2, NOTE.G2, 0],
    [],
    [NOTE.A1, 0, 0, NOTE.E2, 0, 0, NOTE.G2, 0, NOTE.A1, 0, 0, NOTE.E2, 0, NOTE.D2, 0, 0],
  ];

  /** Generative radio: a bass step every beat fraction plus a noise hat on the off-beats. */
  function radio(stationIndex, playing) {
    if (!ensure()) return;
    if (radioTimer) {
      window.clearInterval(radioTimer);
      radioTimer = null;
    }
    if (!playing) return;
    const station = [96, 104, 0, 72][stationIndex] || 96;
    if (station === 0) {
      // Talk radio: soft murmur bursts, no groove.
      radioTimer = window.setInterval(() => blip(140 + Math.random() * 60, 0.09, 'sine', 0.012), 210);
      return;
    }
    const groove = GROOVES[stationIndex] || GROOVES[0];
    const stepMs = (60000 / station) / 2;
    radioTimer = window.setInterval(() => {
      const note = groove[radioStep % groove.length];
      if (note) blip(note, 0.16, 'triangle', 0.05);
      if (radioStep % 2 === 1) burst(0.03, 0.012, 6000, 'highpass');
      radioStep += 1;
    }, stepMs);
  }

  return {
    unlock() { ensure(); },
    engine,
    siren,
    radio,
    shot(heavy) { burst(heavy ? 0.22 : 0.1, heavy ? 0.35 : 0.2, heavy ? 900 : 2400); blip(heavy ? 90 : 160, 0.08, 'square', 0.1, 40); },
    dryFire() { blip(1200, 0.03, 'square', 0.05); },
    hit() { burst(0.08, 0.18, 1200); },
    glass() { burst(0.3, 0.2, 5200, 'highpass'); blip(2400, 0.2, 'sine', 0.05, 900); },
    cash() { blip(880, 0.07, 'square', 0.06); window.setTimeout(() => blip(1320, 0.1, 'square', 0.06), 60); },
    pickup() { blip(660, 0.08, 'sine', 0.08, 990); },
    uiMove() { blip(520, 0.04, 'sine', 0.04); },
    uiPick() { blip(760, 0.07, 'sine', 0.07, 1040); },
    success() { [523, 659, 784, 1046].forEach((f, i) => window.setTimeout(() => blip(f, 0.16, 'triangle', 0.09), i * 85)); },
    fail() { blip(220, 0.3, 'sawtooth', 0.08, 110); },
    horn() { blip(370, 0.18, 'square', 0.06); blip(466, 0.18, 'square', 0.05); },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = value ? 0 : 0.5;
    },
    get muted() { return muted; },
  };
}
