// A short two-note chime when a focus session ends while the dashboard is open. Browsers only
// let a page play sound after the user has interacted with it, so the page tracks the
// first pointerdown/keydown and calls playChime only after that.

/** Pure: did today's finished-session count go up between two stored timer states? */
export function shouldChime(next, prev) {
  if (!next || !prev) return false;
  const before = next.day === prev.day ? prev.doneToday ?? 0 : 0;
  return (next.doneToday ?? 0) > before;
}

let audio = null;

export function playChime() {
  const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!AC) return;
  audio ??= new AC();
  const t0 = audio.currentTime + 0.02;
  [880, 1318.5].forEach((freq, i) => {
    const t = t0 + i * 0.18;
    const osc = audio.createOscillator();
    const g = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    osc.connect(g).connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.65);
    osc.onended = () => g.disconnect();
  });
}
