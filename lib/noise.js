// Ambient sound synthesized with Web Audio, no audio files.
//   white  looped white-noise buffer
//   brown  looped brown (integrated) noise buffer
//   rain   white noise through a band of filters, plus random drops (short bursts)
//   cafe   brown noise plus a slowly swelling band-passed "murmur"
// createNoise(audioCtx, kind) → { start(), stop(), setVolume(0..1) }. Nothing is created
// until start(); stop() stops and disconnects every node it made.
export const KINDS = ["rain", "cafe", "white", "brown"];

const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));

function noiseBuffer(ctx, type, seconds = 2) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    if (type === "brown") {
      last = (last + 0.02 * white) / 1.02;
      data[i] = Math.max(-1, Math.min(1, last * 3.5));
    } else {
      data[i] = white;
    }
  }
  return buf;
}

export function createNoise(ctx, kind, { setTimer = globalThis.setInterval, clearTimer = globalThis.clearInterval } = {}) {
  if (!KINDS.includes(kind)) throw new Error(`unknown noise: ${kind}`);
  let volume = 0.5;
  let nodes = [];
  let master = null;
  let timer = null;

  const track = (n) => (nodes.push(n), n);
  const source = (type) => {
    const s = track(ctx.createBufferSource());
    s.buffer = noiseBuffer(ctx, type);
    s.loop = true;
    return s;
  };
  const gain = (v) => {
    const g = track(ctx.createGain());
    g.gain.value = v;
    return g;
  };
  const filter = (type, freq, q = 1) => {
    const f = track(ctx.createBiquadFilter());
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  };
  const chain = (...ns) => ns.reduce((a, b) => (a.connect(b), b));

  function build() {
    master = gain(volume);
    master.connect(ctx.destination);
    const sources = [];
    if (kind === "white" || kind === "brown") {
      const s = source(kind);
      chain(s, gain(kind === "white" ? 0.35 : 1), master);
      sources.push(s);
    } else if (kind === "rain") {
      const bed = source("white");
      chain(bed, filter("highpass", 400), filter("lowpass", 6000), gain(0.35), master);
      const dropSrc = source("white");
      const drops = gain(0);
      chain(dropSrc, filter("bandpass", 2500, 2), drops, master);
      sources.push(bed, dropSrc);
      timer = setTimer(() => {
        if (Math.random() > 0.35) return;
        const t = ctx.currentTime;
        drops.gain.cancelScheduledValues?.(t);
        drops.gain.setValueAtTime(0.2 + Math.random() * 0.5, t);
        drops.gain.exponentialRampToValueAtTime(0.001, t + 0.04 + Math.random() * 0.06);
      }, 60);
    } else {
      const bed = source("brown");
      chain(bed, gain(0.7), master);
      const voices = source("brown");
      const murmur = gain(0.25);
      chain(voices, filter("bandpass", 450, 0.8), murmur, master);
      const lfo = track(ctx.createOscillator());
      lfo.frequency.value = 0.2;
      chain(lfo, gain(0.15), murmur.gain);
      sources.push(bed, voices, lfo);
    }
    return sources;
  }

  let sources = null;
  return {
    start() {
      if (sources) return;
      sources = build();
      for (const s of sources) s.start();
    },
    stop() {
      if (!sources) return;
      if (timer != null) clearTimer(timer);
      timer = null;
      for (const s of sources) {
        try {
          s.stop();
        } catch {
          // already stopped
        }
      }
      for (const n of nodes) n.disconnect();
      nodes = [];
      sources = null;
      master = null;
    },
    setVolume(v) {
      volume = clamp01(v);
      if (master) master.gain.value = volume;
    },
  };
}
