// Keyboard shortcuts: / search, n notes, t timer start/pause, ? help, Esc closes overlays.
// Letters are ignored while typing in a field or with a modifier held.
import { isTyping } from "./dom.js";

export function enableShortcuts({ closeOverlay, focusSearch, openNotes, toggleTimer, help }) {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (closeOverlay()) e.preventDefault();
      else if (isTyping(document.activeElement)) document.activeElement.blur();
      return;
    }
    if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (isTyping(e.target) || isTyping(document.activeElement)) return;
    const run = { "/": focusSearch, n: openNotes, t: toggleTimer, "?": help }[e.key];
    if (!run) return;
    e.preventDefault();
    run();
  });
}
