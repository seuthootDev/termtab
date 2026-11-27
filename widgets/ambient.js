// Ambient sound: rain, café, white or brown noise, synthesized (lib/noise.js). The
// AudioContext is created on the first click (autoplay rules) and closed on unmount.
import { h } from "../shell/dom.js";
import { createNoise, KINDS } from "../lib/noise.js";
import { FOCUS_START } from "./timer.js";

const LABEL = { rain: "ambRain", cafe: "ambCafe", white: "ambWhite", brown: "ambBrown" };
const validKind = (k) => (KINDS.includes(k) ? k : "rain");
const validVolume = (v) => (Number.isFinite(Number(v)) ? Math.min(1, Math.max(0, Number(v))) : 0.5);

export default {
  meta: { id: "ambient", category: "focus", size: "small", source: "src_computer",
    command: (s) => `play ${validKind(s?.kind)}.wav` },
  defaults: { kind: "rain", volume: 0.5 },
  render(el, ctx) {
    const { t } = ctx;
    let s = { ...ctx.settings, kind: validKind(ctx.settings.kind), volume: validVolume(ctx.settings.volume) };
    let audio = null;
    let noise = null;

    const kinds = h("div", { class: "tabs", role: "group", "aria-label": t("w_ambient_name") },
      ...KINDS.map((k) => h("button", { type: "button", "data-kind": k }, t(LABEL[k]))));
    const play = h("button", { type: "button", class: "sbtn" });
    const vol = h("input", { type: "range", min: "0", max: "1", step: "0.05", value: String(s.volume),
      "aria-label": t("ambVolume"), style: "flex:1;min-width:0" });
    const status = h("span", { class: "dim" });
    el.append(kinds,
      h("div", { class: "row", style: "margin-top:8px;align-items:center" }, status, play),
      h("div", { class: "row", style: "margin-top:6px;align-items:center" }, h("span", { class: "dim" }, t("ambVolume")), vol));

    function draw() {
      for (const b of kinds.children) {
        const on = b.dataset.kind === s.kind;
        b.classList.toggle("on", on);
        b.setAttribute("aria-pressed", String(on));
      }
      play.textContent = noise ? t("ambStop") : t("ambPlay");
      status.replaceChildren(noise ? h("span", { class: "g" }, "▶ ") : "■ ", `${s.kind}.wav`);
    }

    function start() {
      if (noise) return;
      const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      if (!AC) return;
      audio ??= new AC();
      audio.resume?.();
      noise = createNoise(audio, s.kind);
      noise.setVolume(s.volume);
      noise.start();
      draw();
    }
    function stop() {
      noise?.stop();
      noise = null;
      draw();
    }

    play.addEventListener("click", () => (noise ? stop() : start()));
    kinds.addEventListener("click", (e) => {
      const k = e.target.closest("button[data-kind]")?.dataset.kind;
      if (!k || k === s.kind) return;
      const wasPlaying = !!noise;
      if (wasPlaying) stop();
      s = { ...s, kind: k };
      if (wasPlaying) start();
      draw();
      ctx.save(s);
    });
    vol.addEventListener("input", () => noise?.setVolume(Number(vol.value)));
    vol.addEventListener("change", () => {
      s = { ...s, volume: validVolume(vol.value) };
      ctx.save(s);
    });
    const onFocusStart = () => start();
    globalThis.document?.addEventListener(FOCUS_START, onFocusStart);
    draw();

    return () => {
      globalThis.document?.removeEventListener(FOCUS_START, onFocusStart);
      noise?.stop();
      noise = null;
      audio?.close?.().catch?.(() => {});
      audio = null;
    };
  },
};
