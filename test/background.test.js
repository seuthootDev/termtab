// background.js registers its listeners at import time: load it against a fake chrome.
import { test } from "node:test";
import assert from "node:assert/strict";

const ev = () => {
  const fns = [];
  return { fns, addListener: (fn) => fns.push(fn) };
};

function fakeChrome({ action = true } = {}) {
  const created = [];
  const chrome = {
    created,
    storage: { onChanged: ev(), local: { get: async () => ({}), set: async () => {} } },
    alarms: { onAlarm: ev(), create() {}, clear() {} },
    runtime: { onStartup: ev(), onInstalled: ev() },
    tabs: { create: async (props) => (created.push(props), { id: 1 }) },
  };
  if (action) chrome.action = { onClicked: ev(), setBadgeText: async () => {} };
  return chrome;
}

test("background: clicking the toolbar icon opens a new tab", async () => {
  const chrome = fakeChrome();
  globalThis.chrome = chrome;
  try {
    await import("../background.js?click");
    assert.equal(chrome.action.onClicked.fns.length, 1, "onClicked registered at top level");
    await chrome.action.onClicked.fns[0]({ id: 7 });
    assert.deepEqual(chrome.created, [{}]);
    assert.equal(chrome.storage.onChanged.fns.length, 1);
    assert.equal(chrome.alarms.onAlarm.fns.length, 1);
  } finally {
    delete globalThis.chrome;
  }
});

test("background: loads without chrome.action (guarded)", async () => {
  globalThis.chrome = fakeChrome({ action: false });
  try {
    await import("../background.js?noaction");
  } finally {
    delete globalThis.chrome;
  }
});
