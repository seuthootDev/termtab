// To-do with several named lists (`todo work`, `todo home`), switched with tabs.
// Settings: { lists: { <name>: [{ t, d }] }, active: <name> }.
import { h } from "../shell/dom.js";

const MAX_TEXT = 200;
const MAX_NAME = 24;

const listNames = (s) => Object.keys(s?.lists ?? {});
/** The active list name, falling back to the first list. */
export const activeName = (s) => (s?.lists && s.active in s.lists ? s.active : listNames(s)[0]);

function withActive(s, fn) {
  const name = activeName(s);
  if (name == null) return s;
  const items = Array.isArray(s.lists[name]) ? s.lists[name] : [];
  return { ...s, active: name, lists: { ...s.lists, [name]: fn(items) } };
}

export function addItem(s, text) {
  const t = String(text ?? "").trim().slice(0, MAX_TEXT);
  if (!t) return s;
  return withActive(s, (items) => [...items, { t, d: false }]);
}

export function toggleItem(s, index) {
  const items = s?.lists?.[activeName(s)];
  if (!Array.isArray(items) || !items[index]) return s;
  return withActive(s, (list) => list.map((it, i) => (i === index ? { ...it, d: !it.d } : it)));
}

export const clearDone = (s) => withActive(s, (items) => items.filter((it) => !it.d));

/** Same reference when nothing changes (unknown or already active list), so no save. */
export const switchList = (s, name) =>
  (s?.lists && name in s.lists && name !== s.active ? { ...s, active: name } : s);

/**
 * Apply the settings form: rows [{ from: <old name> | null, to: <new name> }] in order.
 * Lists not in the rows are deleted. Returns { ok, settings } or { ok: false }.
 */
export function renameLists(s, rows) {
  const names = rows.map((r) => String(r.to ?? "").trim().slice(0, MAX_NAME));
  if (!names.length || names.some((n) => !n) || new Set(names).size !== names.length) return { ok: false };
  const lists = {};
  let active = null;
  rows.forEach((r, i) => {
    const old = r.from != null && Array.isArray(s.lists?.[r.from]) ? s.lists[r.from] : [];
    lists[names[i]] = old;
    if (r.from != null && r.from === activeName(s)) active = names[i];
  });
  return { ok: true, settings: { ...s, lists, active: active ?? names[0] } };
}

export default {
  meta: { id: "todo", category: "focus", size: "small", source: "src_extension",
    command: (s) => `todo ${activeName(s) ?? s?.active ?? ""}`.trim() },
  defaults: { lists: { work: [], home: [] }, active: "work" },
  render(el, ctx) {
    const { t } = ctx;
    let s = { ...ctx.settings, active: activeName(ctx.settings) };
    const tabs = h("div", { class: "tabs", role: "tablist", "aria-label": t("todoLists") });
    const list = h("ul", { class: "todo" });
    const input = h("input", { class: "inp", type: "text", autocomplete: "off", maxlength: MAX_TEXT,
      placeholder: t("todoPlaceholder"), "aria-label": t("todoPlaceholder") });
    const form = h("form", { style: "margin-top:8px" }, input);
    const footer = h("div", { class: "dim", style: "margin-top:6px;font-size:11.5px" });
    const clear = h("button", { type: "button", class: "sbtn" }, t("todoClearDone"));
    el.append(tabs, list, form, footer);

    function draw() {
      const names = listNames(s);
      tabs.hidden = names.length < 2;
      tabs.replaceChildren(...names.map((n) => h("button", {
        type: "button", role: "tab", class: n === s.active ? "on" : null,
        "aria-selected": String(n === s.active), "data-list": n,
      }, n)));
      const items = s.lists[s.active] ?? [];
      list.replaceChildren(...items.map((it, i) => h("li", {
        class: it.d ? "done" : null, "data-i": String(i), role: "checkbox", tabindex: "0", "aria-checked": String(!!it.d),
      }, h("span", { class: it.d ? "g" : "dim" }, it.d ? "[x]" : "[ ]"), h("span", {}, it.t))));
      footer.replaceChildren(t("todoDoneCount", items.filter((i) => i.d).length, items.length), " · ", clear);
    }

    function update(next) {
      if (next === s) return;
      s = next;
      draw();
      ctx.save(s);
    }

    tabs.addEventListener("click", (e) => {
      const name = e.target.closest("button[data-list]")?.dataset.list;
      if (name) update(switchList(s, name));
    });
    const toggleFrom = (e) => {
      const li = e.target.closest("li[data-i]");
      if (li) update(toggleItem(s, Number(li.dataset.i)));
    };
    list.addEventListener("click", toggleFrom);
    list.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        toggleFrom(e);
      }
    });
    clear.addEventListener("click", () => update(clearDone(s)));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const next = addItem(s, input.value);
      input.value = "";
      update(next);
    });
    draw();
  },
  settingsForm(settings, t) {
    const rowsEl = h("div", { class: "form" });
    const addRow = (from, value) => {
      const inp = h("input", { class: "inp", type: "text", value, maxlength: MAX_NAME, "aria-label": t("todoListName") });
      const row = h("div", { class: "row" },
        inp, h("button", { type: "button", class: "sbtn", onclick: () => row.remove() }, t("todoDeleteList")));
      row.fromName = from;
      rowsEl.append(row);
      return inp;
    };
    for (const n of listNames(settings)) addRow(n, n);
    const msg = h("div", { class: "r", role: "alert" });
    const form = h("form", { class: "form" },
      h("div", {}, t("todoLists")), rowsEl,
      h("div", {}, h("button", { type: "button", class: "sbtn", onclick: () => addRow(null, "").focus() }, t("todoAddList"))),
      msg,
      h("div", { class: "acts" }, h("button", { type: "submit", class: "sbtn" }, t("save"))));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const rows = [...rowsEl.children].map((r) => ({ from: r.fromName, to: r.querySelector("input").value }));
      const r = renameLists(settings, rows);
      if (!r.ok) {
        msg.textContent = t("todoListsBad");
        return;
      }
      form.dispatchEvent(new CustomEvent("save", { detail: r.settings }));
    });
    return form;
  },
};
