// Modal Terminal windows (help, about, preferences, widget settings) and the overlay stack
// that Esc closes from the top.
import { h, title } from "./dom.js";

export function createOverlays({ host, t, getPrefs }) {
  const stack = []; // { key, close, focus }

  /** Open (or re-focus) a modal window. Returns its close function. */
  function open({ key, name, body, size = "80×24" }) {
    const existing = stack.find((o) => o.key === key);
    if (existing) {
      existing.focus();
      return existing.close;
    }
    const before = document.activeElement;
    const close = () => {
      const i = stack.indexOf(entry);
      if (i < 0) return;
      stack.splice(i, 1);
      wrap.remove();
      before?.focus?.();
    };
    const win = h("section", { class: "win modal", role: "dialog", "aria-modal": "true", "aria-label": name },
      h("div", { class: "ph" },
        h("div", { class: "tl" },
          h("button", { type: "button", class: "r", "aria-label": t("winClose", name), onclick: close }),
          h("i", { class: "yb" }), h("i", { class: "gb" })),
        h("span", { class: "t" }, ...title(getPrefs(), name, size))),
      h("div", { class: "pb" }, body));
    const wrap = h("div", { class: "modal-wrap", onclick: (e) => { if (e.target === wrap) close(); } }, win);
    const focus = () => (win.querySelector("input,textarea,select,button:not(.r)") ?? win.querySelector("button"))?.focus();
    const entry = { key, close, focus };
    stack.push(entry);
    host.append(wrap);
    focus();
    return close;
  }

  return {
    open,
    /** Close the top-most modal; false when none is open. */
    closeTop() {
      const top = stack.at(-1);
      if (!top) return false;
      top.close();
      return true;
    },
  };
}
