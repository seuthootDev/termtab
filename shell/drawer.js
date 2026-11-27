// Widget drawer: every widget by category with a checkbox, description, data source and command.
import { $, h, prompt } from "./dom.js";
import { WIDGETS, CATEGORIES } from "../widgets/index.js";
import { addWidget, removeWidget } from "../lib/layout.js";

export function createDrawer({ t, getPrefs, getLayout, setLayout }) {
  const drawer = $("#drawer");
  const scrim = $("#scrim");
  const openBtn = $("#open");
  const list = $("#list");

  function draw() {
    const on = new Set(getLayout().map((i) => i.id));
    list.replaceChildren(...CATEGORIES.flatMap((cat) => {
      const ws = WIDGETS.filter((w) => w.meta.category === cat);
      if (!ws.length) return [];
      return [
        h("div", { class: "cat" }, t(`cat_${cat}`)),
        ...ws.map(({ meta, defaults }) => h("label", { class: "wi" },
          h("input", { type: "checkbox", "data-w": meta.id, checked: on.has(meta.id) }),
          h("span", {},
            h("span", { class: "n" }, t(`w_${meta.id}_name`)), " ",
            h("span", { class: "dim" }, "$ " + meta.command(defaults)), h("br"),
            h("span", { class: "d" }, t(`w_${meta.id}_desc`)), h("br"),
            h("span", { class: "src" }, t("drawerSource", t(meta.source)))))),
      ];
    }));
  }

  function count() {
    const n = getLayout().filter((i) => WIDGETS.some((w) => w.meta.id === i.id)).length;
    $("#count").textContent = t("widgetCount", n, WIDGETS.length);
  }

  list.addEventListener("change", (e) => {
    const id = e.target.dataset.w;
    if (!id) return;
    const meta = WIDGETS.find((w) => w.meta.id === id)?.meta;
    setLayout(e.target.checked ? addWidget(getLayout(), id, meta) : removeWidget(getLayout(), id));
  });

  const isOpen = () => !drawer.hidden;
  function setOpen(open) {
    drawer.hidden = !open;
    scrim.hidden = !open;
    openBtn.setAttribute("aria-expanded", String(open));
    openBtn.classList.toggle("on", open);
    if (open) {
      draw();
      $("#close").focus();
    }
  }
  openBtn.addEventListener("click", () => setOpen(!isOpen()));
  $("#close").addEventListener("click", () => {
    setOpen(false);
    openBtn.focus();
  });
  scrim.addEventListener("click", () => setOpen(false));

  return {
    open: () => setOpen(true),
    close() {
      if (!isOpen()) return false;
      setOpen(false);
      return true;
    },
    /** Layout or prefs changed. */
    refresh() {
      $("#drawer-prompt").replaceChildren(prompt(getPrefs(), "widgets --list"));
      count();
      const on = new Set(getLayout().map((i) => i.id));
      for (const box of list.querySelectorAll("input[data-w]")) box.checked = on.has(box.dataset.w);
    },
  };
}
