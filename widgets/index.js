// Widget registry. Modules must not touch the DOM or chrome at import time
// (background.js imports this file).
//
// Contract (see docs/superpowers/specs/2026-11-27-termtab-design.md, "Widget interface"):
//   meta { id, category: "basics"|"focus"|"info"|"news"|"fun", size: "small"|"wide",
//          source: <_locales key>, command(settings) → string }
//   defaults                      the widget's settings
//   render(el, ctx) → cleanup?    ctx = { settings, data, error, t, refresh(), save(settings), prefs }
//                                 The shell already prints the prompt line
//                                 (`<user>@<machine> ~ % <command>`) above `el`, and a
//                                 "fetch failed · retry" status line when ctx.error is set.
//   fetch(settings) → Promise<raw>, parse(raw) → data, ttlMs     online widgets only
//   settingsForm(settings, t) → HTMLElement dispatching a "save" CustomEvent (detail = settings)
// Names and descriptions come from _locales: w_<id>_name, w_<id>_desc.

// Placeholder modules for the default layout; Tasks 5–7 replace them (same ids and meta).
const placeholder = (meta, defaults = {}) => ({
  meta,
  defaults,
  render(el) {
    const cursor = el.ownerDocument.createElement("span");
    cursor.className = "cursor";
    el.append(cursor);
  },
});

export const WIDGETS = [
  placeholder({ id: "clock", category: "basics", size: "small", source: "src_computer", command: () => "date" }),
  placeholder({ id: "timer", category: "focus", size: "small", source: "src_computer", command: () => "focus 25m" }),
  placeholder(
    { id: "weather", category: "info", size: "small", source: "src_openMeteo",
      command: (s) => `weather ${String(s?.city ?? "seoul").toLowerCase()}` },
    { city: "Seoul" },
  ),
  placeholder({ id: "todo", category: "focus", size: "small", source: "src_extension", command: () => "todo" }),
  placeholder(
    { id: "hn", category: "news", size: "wide", source: "src_hn", command: (s) => `hn top ${s?.count ?? 6}` },
    { count: 6 },
  ),
  placeholder({ id: "calendar", category: "info", size: "small", source: "src_computer", command: () => "cal" }),
  placeholder({ id: "notes", category: "focus", size: "small", source: "src_extension", command: () => "vim notes.md" }),
];

const index = new Map(WIDGETS.map((w) => [w.meta.id, w]));

export const byId = (id) => index.get(id);

export const categoryById = Object.fromEntries(WIDGETS.map((w) => [w.meta.id, w.meta.category]));

export const metaById = Object.fromEntries(WIDGETS.map((w) => [w.meta.id, w.meta]));

export const CATEGORIES = ["basics", "focus", "info", "news", "fun"];
