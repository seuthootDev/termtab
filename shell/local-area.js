// A chrome.storage-like area over localStorage, used only when the page is opened outside
// the extension (plain browser preview / headless check). Same get/set/onChanged shape.
export function localArea(prefix = "termtab:") {
  const listeners = new Set();
  const read = (k) => {
    try {
      const v = localStorage.getItem(prefix + k);
      return v == null ? undefined : JSON.parse(v);
    } catch {
      return undefined;
    }
  };
  return {
    async get(keys) {
      const out = {};
      for (const k of [keys].flat()) {
        const v = read(k);
        if (v !== undefined) out[k] = v;
      }
      return out;
    },
    async set(obj) {
      const changes = {};
      for (const [k, v] of Object.entries(obj)) {
        changes[k] = { oldValue: read(k), newValue: v };
        try {
          localStorage.setItem(prefix + k, JSON.stringify(v));
        } catch {
          // storage blocked: keep going in memory-less mode
        }
      }
      listeners.forEach((l) => l(changes, "local"));
    },
    onChanged: {
      addListener: (l) => listeners.add(l),
      removeListener: (l) => listeners.delete(l),
    },
  };
}
