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

function setup(t0 = 1_000_000) {
  const local = fakeArea();
  const sess = fakeArea();
  const clock = { t: t0 };
  const store = createStore(local);
  const session = createStore(sess);
  const cache = createCache({ store, session, now: () => clock.t });
  return { local, sess, clock, store, session, cache };
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
  const { cache, store, session, clock } = setup();
  await store.set(K, { value: 'old', fetchedAt: clock.t - 100_000, error: false });
  let calls = 0;
  const updates = [];
  const entry = await cache.get(K, 60_000, async () => { calls++; return 'new'; }, (e) => updates.push(e));
  assert.equal(entry.value, 'old');
  await cache.pending(K);
  assert.equal(calls, 1);
  assert.deepEqual(updates, [{ value: 'new', fetchedAt: clock.t, error: false }]);
  assert.equal(await session.get('lock:' + K, null), null);
});

test('cache keeps the old value when the fetch fails', async () => {
  const { cache, store, session, clock } = setup();
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
  assert.equal(await session.get('lock:' + K, null), null);
});

test('failure with no old entry stores an empty error entry', async () => {
  const { cache, store } = setup();
  await cache.get(K, 1000, async () => { throw new Error('x'); }, () => {});
  await cache.pending(K);
  assert.deepEqual(await store.get(K), { value: null, fetchedAt: 0, error: true });
});

test('concurrent gets share one fetch (same page)', async () => {
  const { cache } = setup();
  let calls = 0;
  let release;
  const gate = new Promise((r) => { release = r; });
  const fetcher = async () => { calls++; await gate; return 'v'; };
  const updates = [];
  const p1 = cache.get(K, 1000, fetcher, (e) => updates.push(e));
  const p2 = cache.get(K, 1000, fetcher, (e) => updates.push(e));
  await Promise.all([p1, p2]);
  release();
  await cache.pending(K);
  assert.equal(calls, 1);
  assert.ok(updates.length >= 1);
});

test('concurrent gets share one fetch (two tabs, session lock)', async () => {
  const { store, session, clock } = setup();
  const tabA = createCache({ store, session, now: () => clock.t });
  const tabB = createCache({ store, session, now: () => clock.t });
  let calls = 0;
  let release;
  const gate = new Promise((r) => { release = r; });
  const fetcher = async () => { calls++; await gate; return 'v'; };
  await tabA.get(K, 1000, fetcher, () => {});
  await tabB.get(K, 1000, fetcher, () => {});
  release();
  await tabA.pending(K);
  await tabB.pending(K);
  assert.equal(calls, 1);
});

test('a lock older than 30 s is ignored; younger one blocks', async () => {
  const { cache, session, clock } = setup();
  let calls = 0;
  const fetcher = async () => { calls++; return 'v'; };
  await session.set('lock:' + K, clock.t - 29_999);
  await cache.get(K, 1000, fetcher, () => {});
  await cache.pending(K);
  assert.equal(calls, 0);
  await session.set('lock:' + K, clock.t - 30_001);
  await cache.get(K, 1000, fetcher, () => {});
  await cache.pending(K);
  assert.equal(calls, 1);
});

test('pending is cleared after settle', async () => {
  const { cache } = setup();
  await cache.get(K, 1000, async () => 'v', () => {});
  await cache.pending(K);
  assert.equal(cache.pending(K), undefined);
});
