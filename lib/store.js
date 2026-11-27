// Thin promise wrapper over a chrome.storage area. No chrome access at import time.
export function createStore(area) {
  const resolve = () => area ?? globalThis.chrome.storage.local;

  return {
    async get(key, fallback) {
      const result = await resolve().get(key);
      return key in result && result[key] !== undefined ? result[key] : fallback;
    },
    async set(key, value) {
      await resolve().set({ [key]: value });
    },
    onChange(key, cb) {
      const target = resolve();
      const listener = (changes) => {
        if (key in changes) cb(changes[key].newValue, changes[key].oldValue);
      };
      target.onChanged.addListener(listener);
      return () => target.onChanged.removeListener(listener);
    },
  };
}
