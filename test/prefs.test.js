import { test } from "node:test";
import assert from "node:assert/strict";
import { exportSettings, importSettings, collectExportable, applyImport, DEFAULT_PREFS, validName } from "../lib/prefs.js";
import { cpuUsage, memoryUsed } from "../widgets/sysmon.js";

const proc = (kernel, user, idle) => ({ usage: { kernel, user, idle, total: kernel + user + idle } });
const err = (fn, msg) => assert.throws(fn, (e) => e instanceof Error && e.message === msg);

test("cpuUsage: per-core and total from two snapshots", () => {
  const prev = { processors: [proc(10, 10, 80), proc(0, 0, 100)] };
  const next = { processors: [proc(30, 30, 140), proc(0, 0, 200)] };
  const u = cpuUsage(prev, next);
  assert.deepEqual(u.cores, [0.4, 0]);
  assert.ok(Math.abs(u.total - 0.2) < 1e-9);
});

test("cpuUsage: zero delta, clamping and mismatched core counts", () => {
  const same = { processors: [proc(5, 5, 5)] };
  assert.deepEqual(cpuUsage(same, same), { total: 0, cores: [0] });
  const odd = cpuUsage({ processors: [proc(10, 0, 0)] }, { processors: [{ usage: { kernel: 50, user: 0, idle: 0, total: 20 } }] });
  assert.equal(odd.cores[0], 1);
  assert.deepEqual(cpuUsage({ processors: [] }, { processors: [proc(1, 1, 1)] }), { total: 0, cores: [] });
});

test("memoryUsed is capacity minus available", () => {
  assert.equal(memoryUsed({ capacity: 16 * 2 ** 30, availableCapacity: 6 * 2 ** 30 }), 10 * 2 ** 30);
});

test("importSettings rejects bad JSON, wrong app, newer version and bad data", () => {
  err(() => importSettings("{nope"), "bad-json");
  err(() => importSettings("null"), "not-termtab");
  err(() => importSettings(JSON.stringify({ app: "other", version: 1, data: {} })), "not-termtab");
  err(() => importSettings(JSON.stringify({ app: "termtab", version: 2, data: {} })), "newer-version");
  err(() => importSettings(JSON.stringify({ app: "termtab", version: 1, data: [] })), "bad-data");
  err(() => importSettings(JSON.stringify({ app: "termtab", version: 1, data: null })), "bad-data");
  err(() => importSettings(JSON.stringify({ app: "termtab", version: 1, data: { "cache:hn:1": {} } })), "bad-data");
  err(() => importSettings(JSON.stringify({ app: "termtab", version: 1, data: { timer: {} } })), "bad-data");
  err(() => importSettings(JSON.stringify({ app: "termtab", version: 1, data: { "settings:nope": {} } })), "bad-data");
  err(() => importSettings('{"app":"termtab","version":1,"data":{"__proto__":{"x":1}}}'), "bad-data");
});

test("export then import round-trips the data", () => {
  const data = {
    layout: [{ id: "clock", wide: false, minimized: false }],
    prefs: { ...DEFAULT_PREFS, user: "ann" },
    focus: { day: "2026-11-27", text: "ship" },
    "settings:weather": { city: "Seoul", unit: "f" },
    "settings:workday": { start: "08:00", end: "17:00", days: [1, 2] },
  };
  const json = exportSettings(data, Date.UTC(2026, 10, 27));
  const parsed = JSON.parse(json);
  assert.equal(parsed.app, "termtab");
  assert.equal(parsed.version, 1);
  assert.equal(parsed.exportedAt, "2026-11-27T00:00:00.000Z");
  assert.deepEqual(importSettings(json), data);
});

test("collectExportable drops cache, timer and lock keys", () => {
  const dump = {
    layout: [], prefs: {}, focus: {}, timer: { running: true }, "cache:hn:1": {}, "lock:hn": 1,
    "settings:weather": {}, "settings:unknown": {}, other: 1,
  };
  assert.deepEqual(Object.keys(collectExportable(dump)).sort(), ["focus", "layout", "prefs", "settings:weather"]);
});

test("applyImport writes nothing on failure and reloads only after success", async () => {
  const calls = [];
  const io = { set: async (o) => calls.push(["set", o]), reload: () => calls.push(["reload"]) };
  for (const bad of ["{x", JSON.stringify({ app: "x", version: 1, data: {} }), JSON.stringify({ app: "termtab", version: 9, data: {} }),
    JSON.stringify({ app: "termtab", version: 1, data: { "cache:a": 1 } })]) {
    await assert.rejects(applyImport(bad, io));
  }
  assert.deepEqual(calls, []);
  const good = exportSettings({ prefs: { user: "bo" } });
  await applyImport(good, io);
  assert.deepEqual(calls, [["set", { prefs: { user: "bo" } }], ["reload"]]);
});

test("validName: 1-24 chars, not whitespace-only", () => {
  assert.equal(validName("ann"), true);
  assert.equal(validName("   "), false);
  assert.equal(validName(""), false);
  assert.equal(validName("a".repeat(24)), true);
  assert.equal(validName("a".repeat(25)), false);
});
