import { test } from "node:test";
import assert from "node:assert/strict";
import { exportSettings, importSettings, collectExportable, applyImport, DEFAULT_PREFS, validName, MAX_IMPORT_BYTES } from "../lib/prefs.js";

const proc = (kernel, user, idle) => ({ usage: { kernel, user, idle, total: kernel + user + idle } });
const err = (fn, msg) => assert.throws(fn, (e) => e instanceof Error && e.message === msg);

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

const doc = (data) => JSON.stringify({ app: "termtab", version: 1, data });

test("importSettings validates values field by field and rejects the whole file", () => {
  const bad = [
    { prefs: { user: {}, machine: [], clock24: "x" } },
    { prefs: { user: "   " } },
    { prefs: { user: "a".repeat(25) } },
    { prefs: { searchEngine: "bing" } },
    { prefs: { wallpaper: 4 } },
    { prefs: { fontSize: "huge" } },
    { prefs: { focusMode: 1 } },
    { prefs: { extra: 1 } },
    { prefs: [] },
    { layout: [{ id: "nope" }] },
    { layout: [{ id: "clock", wide: "yes" }] },
    { layout: [null] },
    { focus: { day: 1, text: "x" } },
    { focus: { day: "d" } },
    { "settings:weather": [] },
  ];
  for (const data of bad) err(() => importSettings(doc(data)), "bad-data");
  const ok = { prefs: { ...DEFAULT_PREFS }, layout: [{ id: "clock", wide: false, minimized: false }], focus: { day: "d", text: "" } };
  assert.deepEqual(importSettings(doc(ok)), ok);
});

test("importSettings rejects oversized input with too-large", () => {
  err(() => importSettings("x".repeat(MAX_IMPORT_BYTES + 1)), "too-large");
  err(() => importSettings(42), "bad-json");
});

test("prefsEffects: a search-engine change touches no window; user/clock changes do", async () => {
  const { prefsEffects } = await import("../lib/prefs.js");
  const base = { ...DEFAULT_PREFS };
  assert.deepEqual(prefsEffects(base, { ...base, searchEngine: "naver" }), { appearance: false, windows: false });
  assert.deepEqual(prefsEffects(base, { ...base }), { appearance: false, windows: false });
  assert.equal(prefsEffects(base, { ...base, user: "ann" }).windows, true);
  assert.equal(prefsEffects(base, { ...base, clock24: false }).windows, true);
  assert.equal(prefsEffects(base, { ...base, ambientWithTimer: true }).windows, true);
  assert.deepEqual(prefsEffects(base, { ...base, wallpaper: 2 }), { appearance: true, windows: false });
  assert.deepEqual(prefsEffects(base, { ...base, fontSize: "large", searchEngine: "github" }), { appearance: true, windows: false });
});

test("newtab: the search-engine path does not go through applyPrefs/rerenderAll", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../newtab.js", import.meta.url), "utf8");
  assert.match(src, /prefsEffects\(/, "newtab.js decides what a prefs change touches");
  assert.doesNotMatch(src, /applyPrefs\(\);\s*\n?\s*store\.set\("prefs"/, "setPrefs no longer re-renders unconditionally");
});

test("importSettings rejects a layout with duplicate ids and junk calculator history", () => {
  const doc = (data) => JSON.stringify({ app: "termtab", version: 1, data });
  err(() => importSettings(doc({ layout: [{ id: "clock" }, { id: "hn" }, { id: "clock" }] })), "bad-data");
  for (const history of [
    "1+1", [null], [{ expr: "1+1" }], [{ expr: 2, result: "2" }], [{ expr: "1+1", result: {} }], [{ expr: "1+1", result: ["2"] }],
  ]) err(() => importSettings(doc({ "settings:calculator": { history } })), "bad-data");
  const ok = importSettings(doc({ "settings:calculator": { history: [{ expr: "1+1", result: "2" }, { expr: "2*3", result: 6 }] } }));
  assert.equal(ok["settings:calculator"].history.length, 2);
  assert.ok(importSettings(doc({ "settings:calculator": {} })));
});
