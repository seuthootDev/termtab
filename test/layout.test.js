import { test } from "node:test";
import assert from "node:assert/strict";
import * as L from "../lib/layout.js";

const meta = { clock: { size: "small" }, hn: { size: "wide" }, todo: { size: "small" } };
const ids = (l) => l.map((i) => i.id);

test("defaultLayout uses meta size and skips unknown ids", () => {
  const l = L.defaultLayout(meta);
  assert.deepEqual(ids(l), L.DEFAULT_IDS.filter((id) => id in meta));
  assert.equal(l.find((i) => i.id === "hn").wide, true);
  assert.equal(l.find((i) => i.id === "clock").wide, false);
  assert.ok(l.every((i) => i.minimized === false));
  assert.equal(L.DEFAULT_IDS.length, 7);
});

test("addWidget appends; existing id is a no-op", () => {
  const l = L.defaultLayout(meta);
  const a = L.addWidget(l, "notes", { size: "wide" });
  assert.equal(ids(a).at(-1), "notes");
  assert.equal(a.at(-1).wide, true);
  assert.notEqual(a, l);
  assert.deepEqual(ids(L.addWidget(a, "notes", { size: "small" })), ids(a));
});

test("removeWidget", () => {
  const l = L.defaultLayout(meta);
  assert.equal(L.removeWidget(l, "hn").length, 2);
  assert.equal(l.length, 3);
});

test("moveWidget", () => {
  const l = ["a", "b", "c"].map((id) => ({ id, wide: false, minimized: false }));
  assert.deepEqual(ids(L.moveWidget(l, 0, 2)), ["b", "c", "a"]);
  assert.deepEqual(ids(L.moveWidget(l, 2, 0)), ["c", "a", "b"]);
  assert.deepEqual(ids(l), ["a", "b", "c"]);
});

test("toggle wide / minimized", () => {
  const l = L.defaultLayout(meta);
  const t = L.toggle(l, "clock", "wide");
  assert.equal(t.find((i) => i.id === "clock").wide, true);
  assert.equal(l.find((i) => i.id === "clock").wide, false);
  assert.equal(L.toggle(t, "clock", "minimized").find((i) => i.id === "clock").minimized, true);
});

test("applyFocusMode minimizes only news and restores only byFocus", () => {
  const cat = { clock: "time", hn: "news", todo: "productivity" };
  let l = L.defaultLayout(meta);
  l = L.toggle(l, "todo", "minimized");
  const get = (arr, id) => arr.find((i) => i.id === id);
  const on = L.applyFocusMode(l, true, cat);
  assert.equal(get(on, "hn").minimized, true);
  assert.equal(get(on, "hn").byFocus, true);
  assert.equal(get(on, "clock").minimized, false);
  assert.equal(get(on, "todo").byFocus, undefined);
  const off = L.applyFocusMode(on, false, cat);
  assert.equal(get(off, "hn").minimized, false);
  assert.equal(get(off, "hn").byFocus, undefined);
  assert.equal(get(off, "todo").minimized, true);
});

test("applyFocusMode off keeps a news widget the user minimized", () => {
  const cat = { hn: "news" };
  const l = L.toggle(L.defaultLayout(meta), "hn", "minimized");
  const on = L.applyFocusMode(l, true, cat);
  const hn = (arr) => arr.find((i) => i.id === "hn");
  assert.equal(hn(on).byFocus, undefined);
  assert.equal(hn(L.applyFocusMode(on, false, cat)).minimized, true);
});
