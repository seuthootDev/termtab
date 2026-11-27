// Small DOM helpers shared by the shell. Text always goes in as text nodes, never as HTML.

export const $ = (sel, root = document) => root.querySelector(sel);

/** h("button", { class: "x", type: "button", onclick }, "label", child) */
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (typeof v === "boolean" || k === "value") el[k] = v;
    else el.setAttribute(k, v);
  }
  el.append(...kids.flat().filter((c) => c != null && c !== false));
  return el;
}

/** `<user>@<machine> ~ % <command>` */
export function prompt(prefs, command = "") {
  return h("span", { class: "nw" },
    h("span", { class: "g" }, `${prefs.user}@${prefs.machine}`), " ",
    h("span", { class: "b" }, "~"), ` % ${command}`);
}

/** Window title: `<user> — <name> — zsh — <cols>×<rows>` */
export function title(prefs, name, size) {
  return [h("b", {}, prefs.user), ` — ${name} — zsh — ${size}`];
}

/** Fill data-i18n (text) and data-i18n-<attr> (attribute) elements under root. */
export function applyI18n(root, t) {
  for (const el of root.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
  for (const attr of ["placeholder", "aria-label", "title"]) {
    for (const el of root.querySelectorAll(`[data-i18n-${attr}]`)) {
      el.setAttribute(attr, t(el.getAttribute(`data-i18n-${attr}`)));
    }
  }
}

export const isTyping = (el) =>
  !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

const pad = (n) => String(n).padStart(2, "0");
export const today = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
