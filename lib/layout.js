export const DEFAULT_IDS = ["clock", "timer", "weather", "todo", "hn", "calendar", "notes"];

const item = (id, meta) => ({ id, wide: meta?.size === "wide", minimized: false });

export function defaultLayout(metaById) {
  return DEFAULT_IDS.filter((id) => metaById[id]).map((id) => item(id, metaById[id]));
}

export function addWidget(layout, id, meta) {
  if (layout.some((i) => i.id === id)) return layout.slice();
  return [...layout, item(id, meta)];
}

export function removeWidget(layout, id) {
  return layout.filter((i) => i.id !== id);
}

export function moveWidget(layout, from, to) {
  const out = layout.slice();
  if (from < 0 || from >= out.length) return out;
  const [it] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(to, out.length)), 0, it);
  return out;
}

export function toggle(layout, id, key) {
  if (key !== "wide" && key !== "minimized") return layout.slice();
  return layout.map((i) => {
    if (i.id !== id) return i;
    const next = { ...i, [key]: !i[key] };
    if (key === "minimized") delete next.byFocus; // a manual change takes over
    return next;
  });
}

export function applyFocusMode(layout, on, categoryById) {
  return layout.map((i) => {
    if (on) {
      if (categoryById[i.id] === "news" && !i.minimized) return { ...i, minimized: true, byFocus: true };
      return i;
    }
    if (i.byFocus) {
      const { byFocus, ...rest } = i;
      return { ...rest, minimized: false };
    }
    return i;
  });
}
