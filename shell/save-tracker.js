// Remembers the settings this tab saved per widget, so the storage echo of its own save
// does not re-render the window (which would drop the caret in notes and to-do inputs).
//
// Chrome fires storage.onChanged only when a value really changes, and delivers changes
// in order. So: a save that changes nothing is neither written nor marked (it would get no
// echo and its entry would linger), and a foreign change clears the id's pending entries
// (every earlier own echo has already arrived by then).
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function createSaveTracker(max = 20) {
  const pending = new Map(); // id → [json]
  const tracker = {
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
    clear(id) {
      pending.delete(id);
    },
    pendingCount: (id) => pending.get(id)?.length ?? 0,

    /** Before writing `next` over the shown `current`: false means skip the write. */
    beforeSave(id, current, next) {
      if (same(current, next)) return false;
      tracker.mark(id, next);
      return true;
    },
    /** A storage change arrived: true means apply (re-render) it. */
    onIncoming(id, current, next) {
      if (tracker.isOwn(id, next)) return false;
      tracker.clear(id);
      return !same(current, next);
    },
  };
  return tracker;
}
