// Stale-while-revalidate cache with a cross-tab fetch lock. No chrome access at import time.
const LOCK_MS = 30_000;

/**
 * @param {{ store, session, now?: () => number }} deps
 *   store/session: createStore() objects (local entries; session-scoped locks).
 * @returns {{
 *   get(key, ttlMs, fetcher, onUpdate): Promise<{value, fetchedAt, error}|null>,
 *   pending(key): Promise<void>|undefined
 * }}
 *   get resolves at once with the stored entry (or null) and never waits for the network.
 *   If the entry is missing/stale it starts a background revalidation, guarded by an
 *   in-page in-flight map and a session lock "lock:<key>" (timestamp, ignored after 30 s).
 *   pending(key) returns that revalidation promise (undefined if none is in flight); it
 *   never rejects. Tests await it instead of sleeping.
 */
export function createCache({ store, session, now = Date.now }) {
  const inflight = new Map();

  async function revalidate(key, fetcher, onUpdate) {
    const lockKey = 'lock:' + key;
    const lock = await session.get(lockKey, null);
    if (typeof lock === 'number' && now() - lock <= LOCK_MS) return; // another tab is fetching
    await session.set(lockKey, now());
    let entry;
    try {
      const value = await fetcher();
      entry = { value, fetchedAt: now(), error: false };
    } catch {
      const old = await store.get(key, null);
      entry = old ? { ...old, error: true } : { value: null, fetchedAt: 0, error: true };
    }
    await store.set(key, entry);
    await session.set(lockKey, null);
    onUpdate?.(entry);
  }

  return {
    async get(key, ttlMs, fetcher, onUpdate) {
      const entry = await store.get(key, null);
      const fresh = entry && !entry.error && now() - entry.fetchedAt < ttlMs;
      if (!fresh && !inflight.has(key)) {
        const p = revalidate(key, fetcher, onUpdate)
          .catch(() => {})
          .finally(() => inflight.delete(key));
        inflight.set(key, p);
      }
      return entry;
    },
    pending: (key) => inflight.get(key),
  };
}
