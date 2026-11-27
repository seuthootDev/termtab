// The toolbar button / Alt+Shift+T opens the dashboard as a popup window, focuses it when it is
// already open, and remembers where it was on screen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createBackground } from "../lib/bg.js";

function area(initial = {}) {
  const data = structuredClone(initial);
  return {
    data,
    async get(keys) {
      const out = {};
      for (const k of [keys].flat()) if (k in data) out[k] = structuredClone(data[k]);
      return out;
    },
    async set(obj) {
      Object.assign(data, structuredClone(obj));
    },
    async remove(keys) {
      for (const k of [keys].flat()) delete data[k];
    },
  };
}

function fakeChrome({ local = {}, session = {}, existing = [] } = {}) {
  const open = new Set(existing);
  const calls = { create: [], update: [], get: [] };
  let nextId = 100;
  return {
    calls,
    open,
    storage: { local: area(local), session: area(session) },
    windows: {
      async get(id) {
        calls.get.push(id);
        if (!open.has(id)) throw new Error(`No window with id: ${id}.`);
        return { id };
      },
      async create(props) {
        calls.create.push(props);
        const id = nextId++;
        open.add(id);
        return { id, ...props };
      },
      async update(id, props) {
        calls.update.push([id, props]);
        return { id };
      },
    },
  };
}

// A manual timer so the debounce can be driven from the test.
function fakeTimers() {
  let pending = null;
  return {
    setTimer: (fn) => ((pending = fn), 1),
    clearTimer: () => (pending = null),
    flush: async () => {
      const fn = pending;
      pending = null;
      await fn?.();
    },
    get pending() {
      return pending;
    },
  };
}

const make = (chrome, timers = fakeTimers()) =>
  createBackground({ chrome, categoryById: {}, setTimer: timers.setTimer, clearTimer: timers.clearTimer });

test("dashboard: creates a popup window with default size when none is open", async () => {
  const chrome = fakeChrome();
  await make(chrome).openDashboard();
  assert.deepEqual(chrome.calls.create, [{ url: "newtab.html", type: "popup", focused: true, width: 1280, height: 860 }]);
  assert.equal(chrome.storage.session.data.dashWindow, 100);
  assert.deepEqual(chrome.calls.update, []);
});

test("dashboard: uses the saved bounds when creating", async () => {
  const bounds = { left: 1920, top: 0, width: 1600, height: 1000 };
  const chrome = fakeChrome({ local: { dashBounds: bounds } });
  await make(chrome).openDashboard();
  assert.deepEqual(chrome.calls.create, [{ url: "newtab.html", type: "popup", focused: true, ...bounds }]);
});

test("dashboard: focuses the open window instead of creating another", async () => {
  const chrome = fakeChrome({ session: { dashWindow: 42 }, existing: [42] });
  await make(chrome).openDashboard();
  assert.deepEqual(chrome.calls.get, [42]);
  assert.deepEqual(chrome.calls.update, [[42, { focused: true }]]);
  assert.deepEqual(chrome.calls.create, []);
});

test("dashboard: recreates when the stored window no longer exists", async () => {
  const chrome = fakeChrome({ session: { dashWindow: 42 } });
  await make(chrome).openDashboard();
  assert.equal(chrome.calls.create.length, 1);
  assert.deepEqual(chrome.calls.update, []);
  assert.equal(chrome.storage.session.data.dashWindow, 100);
});

test("dashboard: saves bounds (debounced) only for our window", async () => {
  const timers = fakeTimers();
  const chrome = fakeChrome({ session: { dashWindow: 42 }, existing: [42, 7] });
  const bg = make(chrome, timers);
  await bg.onBoundsChanged({ id: 7, left: 1, top: 2, width: 3, height: 4 });
  assert.equal(timers.pending, null, "other windows are ignored");
  await bg.onBoundsChanged({ id: 42, left: 10, top: 20, width: 800, height: 600 });
  await bg.onBoundsChanged({ id: 42, left: 1920, top: 0, width: 1500, height: 900, state: "normal" });
  assert.equal(chrome.storage.local.data.dashBounds, undefined, "not saved before the debounce fires");
  await timers.flush();
  assert.deepEqual(chrome.storage.local.data.dashBounds, { left: 1920, top: 0, width: 1500, height: 900 });
});

test("dashboard: forgets the window id when it is closed", async () => {
  const chrome = fakeChrome({ session: { dashWindow: 42 }, existing: [42] });
  const bg = make(chrome);
  await bg.onWindowRemoved(7);
  assert.equal(chrome.storage.session.data.dashWindow, 42, "other windows leave it alone");
  await bg.onWindowRemoved(42);
  assert.equal(chrome.storage.session.data.dashWindow, undefined);
});

test("dashboard: does nothing without chrome.windows (guarded)", async () => {
  const chrome = fakeChrome();
  delete chrome.windows;
  delete chrome.storage.session;
  const bg = make(chrome);
  await bg.openDashboard();
  await bg.onBoundsChanged({ id: 1, left: 0, top: 0, width: 1, height: 1 });
  await bg.onWindowRemoved(1);
});
