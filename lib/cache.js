// Stale-while-revalidate cache with a cross-tab fetch lock (Web Locks). No chrome access at import time.

/**
 * @param {{ store, locks?: LockManager, now?: () => number, timeoutMs?: number }} deps
 *   store: createStore() object holding the entries. locks: Web Locks API (defaults to
 *   navigator.locks); atomic across every page of the extension origin and released
 *   automatically when a tab closes. timeoutMs: a fetcher slower than this counts as failed.
 * @returns {{
 *   get(key, ttlMs, fetcher, onUpdate, { force }?): Promise<{value, fetchedAt, error, failedAt?}|null>,
 *   pending(key): Promise<void>|undefined
 * }}
 *   get resolves at once with the stored entry (or null) and never waits for the network.
 *   If the entry is missing/stale it starts a background revalidation, guarded by an
 *   in-page in-flight map and the lock "cache:<key>" (ifAvailable: a page that loses the
 *   race skips the fetch). The winner re-reads the entry inside the lock and skips if
 *   another tab already refreshed it. A page that loses the lock race gets NO onUpdate:
 *   it must subscribe to store.onChange(key) to see the winner's result.
 *   A failed fetch stores the old value with error: true and failedAt; that entry counts as fresh
 *   for ERROR_BACKOFF_MS (60 s), so reopening the dashboard does not hammer a source that is down or rate limiting.
 *   force: true (the retry button) revalidates regardless of freshness or backoff.
 *   pending(key) returns the revalidation promise (undefined if none in flight); it never
 *   rejects. Tests await it instead of sleeping.
 */
export const ERROR_BACKOFF_MS = 60_000;

export function createCache({
  store,
  locks = globalThis.navigator?.locks,
  now = Date.now,
  timeoutMs = 20_000,
}) {
  const inflight = new Map();
  const isFresh = (e, ttlMs) =>
    !!e && (e.error ? now() - (e.failedAt ?? 0) < ERROR_BACKOFF_MS : now() - e.fetchedAt < ttlMs);

  function withTimeout(promise) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('fetch timeout')), timeoutMs);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  async function refresh(key, ttlMs, fetcher, onUpdate, force) {
    const old = await store.get(key, null);
    if (!force && isFresh(old, ttlMs)) return; // another tab refreshed it meanwhile
    let entry;
    try {
      const value = await withTimeout(Promise.resolve().then(fetcher));
      entry = { value, fetchedAt: now(), error: false };
    } catch {
      entry = old ? { ...old, error: true, failedAt: now() } : { value: null, fetchedAt: 0, error: true, failedAt: now() };
    }
    try {
      await store.set(key, entry);
    } catch {
      // keep going: callers still get the computed entry
    } finally {
      onUpdate?.(entry);
    }
  }

  async function revalidate(key, ttlMs, fetcher, onUpdate, force) {
    if (!locks) return refresh(key, ttlMs, fetcher, onUpdate, force);
    await locks.request('cache:' + key, { ifAvailable: true }, async (lock) => {
      if (!lock) return; // another tab is fetching
      await refresh(key, ttlMs, fetcher, onUpdate, force);
    });
  }

  return {
    async get(key, ttlMs, fetcher, onUpdate, { force = false } = {}) {
      const entry = await store.get(key, null);
      if ((force || !isFresh(entry, ttlMs)) && !inflight.has(key)) {
        const p = revalidate(key, ttlMs, fetcher, onUpdate, force)
          .catch(() => {})
          .finally(() => inflight.delete(key));
        inflight.set(key, p);
      }
      return entry;
    },
    pending: (key) => inflight.get(key),
  };
}
