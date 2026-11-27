// Drag a window by its title bar (pointer events: mouse, pen, touch), or move it one slot
// with Alt+←/→ while the title bar has focus.
import { insertionIndex } from "../lib/drag.js";
import { moveWidget } from "../lib/layout.js";
import { h } from "./dom.js";

const THRESHOLD = 5; // px before a press becomes a drag

export function enableDrag({ grid, getLayout, setLayout }) {
  const indexOf = (id) => getLayout().findIndex((i) => i.id === id);

  grid.addEventListener("pointerdown", (e) => {
    const ph = e.target.closest(".win[data-id] > .ph");
    if (!ph || e.target.closest("button") || (e.pointerType === "mouse" && e.button !== 0)) return;
    const win = ph.parentElement;
    const start = { x: e.clientX, y: e.clientY };
    let drag = null;

    const others = () => [...grid.querySelectorAll(".win[data-id]")].filter((w) => w !== win);
    const slotFor = (x, y) => {
      const list = others();
      return { list, index: insertionIndex(list.map((w) => w.getBoundingClientRect()), x, y) };
    };

    function begin(ev) {
      const r = win.getBoundingClientRect();
      const floating = win.cloneNode(true);
      floating.classList.add("floating");
      floating.removeAttribute("data-id");
      floating.setAttribute("aria-hidden", "true");
      floating.inert = true;
      Object.assign(floating.style, { width: r.width + "px", height: r.height + "px", left: r.left + "px", top: r.top + "px" });
      const slot = h("div", { class: "slot" + (win.classList.contains("wide") ? " wide" : "") });
      slot.style.height = r.height + "px";
      grid.insertBefore(slot, win);
      win.classList.add("dragging");
      document.body.append(floating);
      document.body.classList.add("drag-active");
      return { floating, slot, dx: ev.clientX - r.left, dy: ev.clientY - r.top, index: indexOf(win.dataset.id) };
    }

    function move(ev) {
      if (!drag) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < THRESHOLD) return;
        drag = begin(ev);
      }
      drag.floating.style.left = ev.clientX - drag.dx + "px";
      drag.floating.style.top = ev.clientY - drag.dy + "px";
      const { list, index } = slotFor(ev.clientX, ev.clientY);
      drag.index = index;
      const before = list[index] ?? null;
      if (before ? drag.slot.nextElementSibling !== before : grid.lastElementChild !== drag.slot) {
        grid.insertBefore(drag.slot, before);
      }
    }

    function end(commit) {
      ph.removeEventListener("pointermove", move);
      ph.removeEventListener("pointerup", up);
      ph.removeEventListener("pointercancel", cancel);
      if (!drag) return;
      drag.floating.remove();
      drag.slot.remove();
      win.classList.remove("dragging");
      document.body.classList.remove("drag-active");
      const from = indexOf(win.dataset.id);
      if (commit && from >= 0 && drag.index !== from) setLayout(moveWidget(getLayout(), from, drag.index));
      drag = null;
    }
    const up = () => end(true);
    const cancel = () => end(false);

    ph.setPointerCapture(e.pointerId);
    ph.addEventListener("pointermove", move);
    ph.addEventListener("pointerup", up);
    ph.addEventListener("pointercancel", cancel);
  });

  grid.addEventListener("keydown", (e) => {
    if (!e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    const ph = e.target.closest?.(".win[data-id] > .ph");
    if (!ph || e.target !== ph) return;
    e.preventDefault();
    const id = ph.parentElement.dataset.id;
    const from = indexOf(id);
    const to = from + (e.key === "ArrowLeft" ? -1 : 1);
    if (from < 0 || to < 0 || to >= getLayout().length) return;
    setLayout(moveWidget(getLayout(), from, to));
    grid.querySelector(`.win[data-id="${CSS.escape(id)}"] > .ph`)?.focus();
  });
}
