// Notes: a scratchpad that saves itself 500 ms after the last keystroke.
import { h } from "../shell/dom.js";

export const NOTES_MAX = 20000;
const DEBOUNCE_MS = 500;

export const clampNotes = (text) => String(text ?? "").slice(0, NOTES_MAX);

/** Call flush when the page goes away (pagehide, or hidden); returns the unbind function. */
export function bindPageFlush(flush, { win = globalThis, doc = globalThis.document } = {}) {
  const onHide = () => flush();
  const onVisibility = () => {
    if (doc?.visibilityState === "hidden") flush();
  };
  win?.addEventListener?.("pagehide", onHide);
  doc?.addEventListener?.("visibilitychange", onVisibility);
  return () => {
    win?.removeEventListener?.("pagehide", onHide);
    doc?.removeEventListener?.("visibilitychange", onVisibility);
  };
}

export default {
  meta: { id: "notes", category: "focus", size: "small", source: "src_extension", command: () => "vim notes.md" },
  defaults: { text: "" },
  render(el, ctx) {
    const { t } = ctx;
    const area = h("textarea", { class: "inp", maxlength: NOTES_MAX, spellcheck: "false",
      placeholder: t("notesPlaceholder"), "aria-label": t("w_notes_name") });
    area.value = clampNotes(ctx.settings.text);
    const status = h("div", { class: "dim", style: "font-size:11.5px", "aria-live": "polite" }, t("notesSaved"));
    el.append(area, status);

    let timer = null;
    const flush = () => {
      clearTimeout(timer);
      timer = null;
      ctx.save({ ...ctx.settings, text: clampNotes(area.value) });
      status.textContent = t("notesSaved");
    };
    area.addEventListener("input", () => {
      status.textContent = t("notesEditing");
      clearTimeout(timer);
      timer = setTimeout(flush, DEBOUNCE_MS);
    });
    // keep what was typed in the last half second when the tab closes or is hidden
    const unbind = bindPageFlush(() => {
      if (timer) flush();
    });
    return () => {
      unbind();
      if (timer) flush();
    };
  },
};
