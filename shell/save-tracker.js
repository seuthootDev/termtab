// Remembers the settings this tab saved per widget, so the storage echo of its own save
// does not re-render the window (which would drop the caret in notes and to-do inputs).
// Echoes may arrive late or out of order, so every pending save is kept until it is seen.
export function createSaveTracker(max = 20) {
  const pending = new Map(); // id → [json]
  return {
    mark(id, value) {
      const list = pending.get(id) ?? [];
      list.push(JSON.stringify(value));
      if (list.length > max) list.splice(0, list.length - max);
      pending.set(id, list);
    },
    /** True (once) when `value` is one of this tab's own pending saves for `id`. */
    isOwn(id, value) {
      const list = pending.get(id);
      const i = list ? list.indexOf(JSON.stringify(value)) : -1;
      if (i < 0) return false;
      list.splice(i, 1);
      return true;
    },
  };
}
