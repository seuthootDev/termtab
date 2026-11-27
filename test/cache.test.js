import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../lib/store.js';
import { createCache } from '../lib/cache.js';

function fakeArea() {
  const data = {};
  const listeners = new Set();
  return {
    data,
    async get(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      const out = {};
      for (const k of list) if (k in data) out[k] = data[k];
      return out;
    },
    async set(obj) {
      const changes = {};
      for (const [k, v] of Object.entries(obj)) {
        changes[k] = { oldValue: data[k], newValue: v };
        data[k] = v;
      }
      for (const fn of [...listeners]) fn(changes);
    },
    onChanged: {
      addListener: (fn) => listeners.add(fn),
      removeListener: (fn) => listeners.delete(fn),
    },
  };
}


function fakeLocks() {
  const held = new Set();
  return {
    async request(name, opts, cb) {
      if (opts.ifAvailable && held.has(name)) return cb(null);
      held.add(name);
      try { return await cb({ name }); } finally { held.delete(name); }
    },
  };
}

function setup(t0 = 1_000_000, extra = {}) {
  const local = fakeArea();
  const clock = { t: t0 };
  const store = createStore(local);
  const locks = fakeLocks();
  const cache = createCache({ store, locks, now: () => clock.t, ...extra });
  return { local, clock, store, locks, cache };
}

const K = 'cache:weather:abc';

test('fresh entry: returned, fetcher not called', async () => {
  const { cache, store, clock } = setup();
  await store.set(K, { value: 'old', fetchedAt: clock.t - 1000, error: false });
  let calls = 0;
  const entry = await cache.get(K, 60_000, async () => { calls++; return 'new'; }, () => {});
  assert.equal(entry.value, 'old');
  assert.equal(cache.pending(K), undefined);
  assert.equal(calls, 0);
});

test('missing entry returns null and fetches in background', async () => {
  const { cache, store } = setup();
  const updates = [];
  const entry = await cache.get(K, 1000, async () => 'v', (e) => updates.push(e));
  assert.equal(entry, null);
  await cache.pending(K);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].value, 'v');
  assert.deepEqual(await store.get(K), updates[0]);
});

test('stale entry: old value first, fetcher once, onUpdate gets new value', async () => {
  const { cache, store, clock } = setup();
  await store.set(K, { value: 'old', fetchedAt: clock.t - 100_000, error: false });
  let calls = 0;
  const updates = [];
  const entry = await cache.get(K, 60_000, async () => { calls++; return 'new'; }, (e) => updates.push(e));
  assert.equal(entry.value, 'old');
  await cache.pending(K);
  assert.equal(calls, 1);
  assert.deepEqual(updates, [{ value: 'new', fetchedAt: clock.t, error: false }]);
});

test('cache keeps the old value when the fetch fails', async () => {
  const { cache, store, clock } = setup();
  const old = { value: 'old', fetchedAt: clock.t - 100_000, error: false };
  await store.set(K, old);
  const updates = [];
  const entry = await cache.get(K, 60_000, async () => { throw new Error('down'); }, (e) => updates.push(e));
  assert.equal(entry.value, 'old');
  await cache.pending(K);
  const stored = await store.get(K);
  assert.equal(stored.value, 'old');
  assert.equal(stored.fetchedAt, old.fetchedAt);
  assert.equal(stored.error, true);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].error, true);
});

test('failure with no old entry stores an empty error entry', async () => {
  const { cache, store } = setup();
  await cache.get(K, 1000, async () => { throw new Error('x'); }, () => {});
  await cache.pending(K);
  assert.deepEqual(await store.get(K), { value: null, fetchedAt: 0, error: true });
});

test('concurrent gets share one fetch', async () => {
  const { cache } = setup();
  let calls = 0;
  let release;
  const gate = new Promise((r) => { release = r; });
  const fetcher = async () => { calls++; await gate; return 'v'; };
  const p1 = cache.get(K, 1000, fetcher, () => {});
  const p2 = cache.get(K, 1000, fetcher, () => {});
  await Promise.all([p1, p2]);
  release();
  await cache.pending(K);
  assert.equal(calls, 1);
});

test('ten caches (tabs) get in the same tick: fetcher called once', async () => {
  const store = createStore(fakeArea());
  const locks = fakeLocks();
  const caches = Array.from({ length: 10 }, () => createCache({ store, locks }));
  let calls = 0;
  let release;
  const gate = new Promise((r) => { release = r; });
  const fetcher = async () => { calls++; await gate; return 'v'; };
  const gets = caches.map((c) => c.get(K, 1000, fetcher, () => {}));
  await Promise.all(gets);
  release();
  await Promise.all(caches.map((c) => c.pending(K)));
  assert.equal(calls, 1);
  assert.equal((await store.get(K)).value, 'v');
});

test('a fetcher that never settles times out, keeps old value, can retry', async () => {
  const { cache, store, clock } = setup(1_000_000, { timeoutMs: 50 });
  await store.set(K, { value: 'old', fetchedAt: clock.t - 100_000, error: false });
  const updates = [];
  await cache.get(K, 1000, () => new Promise(() => {}), (e) => updates.push(e));
  await cache.pending(K);
  const stored = await store.get(K);
  assert.equal(stored.value, 'old');
  assert.equal(stored.error, true);
  assert.equal(updates.length, 1);
  assert.equal(cache.pending(K), undefined);
  let calls = 0;
  await cache.get(K, 1000, async () => { calls++; return 'new'; }, () => {});
  await cache.pending(K);
  assert.equal(calls, 1);
  assert.equal((await store.get(K)).value, 'new');
});

test('store.set rejecting still calls onUpdate, resolves pending, clears inflight', async () => {
  const real = createStore(fakeArea());
  let failSet = true;
  const store = {
    get: real.get,
    set: async (k, v) => { if (failSet) throw new Error('quota'); return real.set(k, v); },
  };
  const cache = createCache({ store, locks: fakeLocks() });
  const updates = [];
  await cache.get(K, 1000, async () => 'v', (e) => updates.push(e));
  await cache.pending(K);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].value, 'v');
  assert.equal(cache.pending(K), undefined);
  failSet = false;
  let calls = 0;
  await cache.get(K, 1000, async () => { calls++; return 'w'; }, () => {});
  await cache.pending(K);
  assert.equal(calls, 1);
});

test('an entry refreshed by another tab before the lock is acquired: no fetch', async () => {
  const store = createStore(fakeArea());
  const inner = fakeLocks();
  const clock = { t: 1_000_000 };
  const locks = {
    async request(name, opts, cb) {
      await store.set(K, { value: 'other', fetchedAt: clock.t, error: false });
      return inner.request(name, opts, cb);
    },
  };
  const cache = createCache({ store, locks, now: () => clock.t });
  let calls = 0;
  await cache.get(K, 60_000, async () => { calls++; return 'mine'; }, () => {});
  await cache.pending(K);
  assert.equal(calls, 0);
  assert.equal((await store.get(K)).value, 'other');
});

test('pending is cleared after settle', async () => {
  const { cache } = setup();
  await cache.get(K, 1000, async () => 'v', () => {});
  await cache.pending(K);
  assert.equal(cache.pending(K), undefined);
});
