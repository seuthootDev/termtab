// Focus timer: 25/5 pomodoro whose state lives in storage (`timer`), shared by every tab and
// the background. The background alarm decides when a session ends; this window only shows
// the countdown and, once endsAt has passed, may apply the same tick() (idempotent).
import { h } from "../shell/dom.js";
import { createStore } from "../lib/store.js";
import { defaultArea } from "../shell/local-area.js";
import * as timer from "../lib/timer.js";

export const FOCUS_START = "termtab:focus-start";

const pad = (n) => String(n).padStart(2, "0");
export const mmss = (sec) => `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;

/** Text progress bar: filled █ in green, rest ░ dim. */
export function blocks(ratio, n = 22) {
  const f = Math.max(0, Math.min(n, Math.round(ratio * n)));
  return [h("span", { class: "g" }, "█".repeat(f)), h("span", { class: "dim" }, "░".repeat(n - f))];
}

/** Starting a focus session may start ambient sound (prefs.ambientWithTimer). */
export function announceFocusStart(state, prefs) {
  if (prefs?.ambientWithTimer && state?.running && state.mode === "focus") {
    globalThis.document?.dispatchEvent(new CustomEvent(FOCUS_START));
  }
}

export default {
  meta: { id: "timer", category: "focus", size: "small", source: "src_computer", command: () => "focus 25m", usesPrefs: true },
  defaults: {},
  render(el, ctx) {
    const { t } = ctx;
    const store = createStore(defaultArea());
    let state = timer.initial(Date.now());
    let alive = true;

    const tm = h("span", { class: "tm y num", role: "timer" });
    const modeEl = h("span", { class: "dim" });
    const bar = h("div", { class: "blocks", "aria-hidden": "true" });
    const count = h("span", { class: "dim" });
    const go = h("button", { type: "button", class: "sbtn" });
    const resetBtn = h("button", { type: "button", class: "sbtn" }, t("timerReset"));
    el.append(
      h("div", { class: "row" }, tm, modeEl),
      bar,
      h("div", { class: "row", style: "margin-top:8px" }, count, h("span", {}, go, " ", resetBtn)));

    function draw() {
      const now = Date.now();
      const view = timer.tick(state, now).state; // day rollover for display, no write
      const rem = timer.remainingSeconds(state, now);
      const full = state.mode === "focus" ? timer.FOCUS_SEC : timer.BREAK_SEC;
      tm.textContent = mmss(rem);
      tm.className = `tm num ${state.mode === "focus" ? "y" : "c"}`;
      modeEl.textContent = state.mode === "focus" ? t("timerFocus") : t("timerBreak");
      bar.replaceChildren(...blocks(1 - rem / full));
      const [before, after = ""] = t("timerToday", "§", view.doneToday * 25).split("§");
      count.replaceChildren(before, h("span", { class: "g num" }, String(view.doneToday)), after);
      go.textContent = state.running ? t("timerPause") : t("timerStart");
    }

    async function save(next) {
      state = next;
      draw();
      await store.set("timer", next);
    }

    go.addEventListener("click", () => {
      const now = Date.now();
      const cur = timer.tick(state, now).state;
      const next = cur.running ? timer.pause(cur, now) : timer.start(cur, now);
      announceFocusStart(next, ctx.prefs);
      save(next).catch((err) => console.error(err));
    });
    resetBtn.addEventListener("click", () => {
      save(timer.reset(timer.tick(state, Date.now()).state, Date.now())).catch((err) => console.error(err));
    });

    const unsub = store.onChange("timer", (v) => {
      if (!v) return;
      state = v;
      draw();
    });
    store.get("timer", null).then((s) => {
      if (alive && s) state = s;
      if (alive) draw();
    }).catch((err) => console.error(err));

    const id = setInterval(() => {
      const now = Date.now();
      if (state.running && now >= state.endsAt) {
        const r = timer.tick(state, now);
        if (r.finished) save(r.state).catch((err) => console.error(err));
      }
      draw();
    }, 1000);
    draw();

    return () => {
      alive = false;
      clearInterval(id);
      unsub();
    };
  },
};
