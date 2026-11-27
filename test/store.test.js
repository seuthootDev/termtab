import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../lib/store.js';

function fakeArea() {
  const data = {};
  const listeners = new Set();
  return {
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

test('get returns the fallback for a missing key', async () => {
  const store = createStore(fakeArea());
  assert.equal(await store.get('nope', 42), 42);
  assert.equal(await store.get('nope'), undefined);
});

test('set then get returns the value', async () => {
  const store = createStore(fakeArea());
  await store.set('prefs', { a: 1 });
  assert.deepEqual(await store.get('prefs', null), { a: 1 });
});

test('onChange fires for that key only and unsubscribes', async () => {
  const store = createStore(fakeArea());
  const seen = [];
  const off = store.onChange('layout', (v) => seen.push(v));
  await store.set('other', 1);
  await store.set('layout', 'a');
  assert.deepEqual(seen, ['a']);
  off();
  await store.set('layout', 'b');
  assert.deepEqual(seen, ['a']);
});
