import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createBackground } from "../lib/bg.js";
import * as timer from "../lib/timer.js";
import { createNoise } from "../lib/noise.js";
import { createSaveTracker } from "../shell/save-tracker.js";
import { shouldChime } from "../shell/chime.js";
import { WIDGETS, byId, categoryById } from "../widgets/index.js";
import { addItem, toggleItem, clearDone, switchList, renameLists } from "../widgets/todo.js";
import { markKey, toggleMark, weekColumns, parseHabitNames } from "../widgets/habits.js";
import { clampNotes, NOTES_MAX } from "../widgets/notes.js";

// ---------- fake chrome for the background ----------
function fakeChrome(initial = {}) {
  const data = structuredClone(initial);
  const calls = { create: [], clear: [], badge: [], sets: [] };
  return {
    data,
    calls,
    storage: {
      local: {
        async get(keys) {
          const out = {};
          for (const k of [keys].flat()) if (k in data) out[k] = structuredClone(data[k]);
          return out;
        },
        async set(obj) {
          calls.sets.push(Object.keys(obj));
          Object.assign(data, structuredClone(obj));
        },
      },
    },
    alarms: {
      create: (name, info) => calls.create.push([name, info]),
      clear: (name) => calls.clear.push(name),
    },
    action: { setBadgeText: (o) => calls.badge.push(o.text) },
  };
}

const T0 = new Date(2026, 10, 27, 10, 0, 0).getTime();
const LAYOUT = [
  { id: "clock", wide: false, minimized: false },
  { id: "hn", wide: true, minimized: false },
];
const running = () => timer.start(timer.initial(T0), T0); // focus, ends at T0 + 25 min

test("bg: alarm finishes a focus session, counts it, sets the badge and restores news", async () => {
  const chrome = fakeChrome({
    timer: running(),
    layout: [LAYOUT[0], { id: "hn", wide: true, minimized: true, byFocus: true }],
  });
  const bg = createBackground({ chrome, now: () => T0 + 1500 * 1000, categoryById });
  await bg.onAlarm({ name: "timer" });
  assert.equal(chrome.data.timer.mode, "break");
  assert.equal(chrome.data.timer.running, false);
  assert.equal(chrome.data.timer.doneToday, 1);
  assert.deepEqual(chrome.calls.badge, ["✓"]);
  assert.deepEqual(chrome.data.layout[1], { id: "hn", wide: true, minimized: false });
});

test("bg: alarm before endsAt or for another name does nothing", async () => {
  const chrome = fakeChrome({ timer: running(), layout: LAYOUT });
  const bg = createBackground({ chrome, now: () => T0 + 1000, categoryById });
  await bg.onAlarm({ name: "timer" });
  await bg.onAlarm({ name: "other" });
  assert.equal(chrome.data.timer.running, true);
  assert.deepEqual(chrome.calls.badge, []);
});

test("bg: focus mode is applied only when the pref is on", async () => {
  const on = fakeChrome({ layout: LAYOUT, prefs: {} });
  const bgOn = createBackground({ chrome: on, now: () => T0, categoryById });
  const s = running();
  await bgOn.onTimerChange(s, timer.initial(T0));
  assert.deepEqual(on.calls.create, [["timer", { when: s.endsAt }]]);
  assert.equal(on.data.layout[1].minimized, true);
  assert.equal(on.data.layout[1].byFocus, true);

  const off = fakeChrome({ layout: LAYOUT, prefs: { focusMode: false } });
  const bgOff = createBackground({ chrome: off, now: () => T0, categoryById });
  await bgOff.onTimerChange(s, timer.initial(T0));
  assert.deepEqual(off.data.layout, LAYOUT);
  assert.equal(off.calls.create.length, 1);

  const offAlarm = fakeChrome({ timer: s, layout: LAYOUT, prefs: { focusMode: false } });
  await createBackground({ chrome: offAlarm, now: () => T0 + 1500 * 1000, categoryById }).onAlarm({ name: "timer" });
  assert.equal(offAlarm.data.timer.doneToday, 1);
  assert.deepEqual(offAlarm.data.layout, LAYOUT);
});

test("bg: pausing clears the alarm and restores news; no layout write when focus state is unchanged", async () => {
  const chrome = fakeChrome({ layout: [LAYOUT[0], { id: "hn", wide: true, minimized: true, byFocus: true }] });
  const bg = createBackground({ chrome, now: () => T0, categoryById });
  const s = running();
  await bg.onTimerChange(timer.pause(s, T0 + 60000), s);
  assert.deepEqual(chrome.calls.clear, ["timer"]);
  assert.equal(chrome.data.layout[1].minimized, false);
  chrome.calls.sets.length = 0;
  const brk = { ...timer.initial(T0), mode: "break" };
  await bg.onTimerChange(timer.start(brk, T0), brk); // running break: focus stays off
  assert.deepEqual(chrome.calls.sets, []);
});

test("bg: no stored layout falls back to the given default layout", async () => {
  const chrome = fakeChrome({});
  const bg = createBackground({ chrome, now: () => T0, categoryById, defaultLayout: () => LAYOUT });
  await bg.onTimerChange(running(), null);
  assert.equal(chrome.data.layout[1].minimized, true);
});

test("bg: startup processes a timer that ended while the browser was closed, re-arms a future one", async () => {
  const stale = fakeChrome({ timer: running(), layout: LAYOUT });
  await createBackground({ chrome: stale, now: () => T0 + 3 * 3600 * 1000, categoryById }).onStartup();
  assert.equal(stale.data.timer.doneToday, 1);
  assert.deepEqual(stale.calls.badge, ["✓"]);

  const future = fakeChrome({ timer: running(), layout: LAYOUT });
  await createBackground({ chrome: future, now: () => T0 + 60000, categoryById }).onStartup();
  assert.deepEqual(future.calls.create, [["timer", { when: T0 + 1500 * 1000 }]]);
  assert.equal(future.data.timer.doneToday, 0);

  const none = fakeChrome({});
  await createBackground({ chrome: none, now: () => T0, categoryById }).onStartup();
  assert.deepEqual(none.calls.create, []);
});

test("bg: a session that ends after midnight counts for the new day", async () => {
  const late = new Date(2026, 10, 27, 23, 50).getTime();
  const s = { ...timer.start(timer.initial(late), late), doneToday: 4 };
  const chrome = fakeChrome({ timer: s, layout: LAYOUT });
  await createBackground({ chrome, now: () => late + 1500 * 1000, categoryById }).onAlarm({ name: "timer" });
  assert.equal(chrome.data.timer.doneToday, 1);
  assert.equal(chrome.data.timer.day, "2026-11-28");
});

// ---------- registry ----------
test("registry: focus widgets with ids, categories and commands", () => {
  for (const id of ["timer", "todo", "notes", "habits", "ambient"]) {
    assert.equal(byId(id)?.meta.category, "focus", id);
    assert.equal(typeof byId(id).render, "function", id);
  }
  assert.equal(byId("timer").meta.command({}), "focus 25m");
  assert.equal(byId("todo").meta.command({ active: "home" }), "todo home");
  assert.equal(byId("todo").meta.command(byId("todo").defaults), "todo work");
  assert.equal(byId("notes").meta.command({}), "vim notes.md");
  assert.equal(byId("habits").meta.command({}), "habits --week");
  assert.equal(byId("ambient").meta.command({ kind: "cafe" }), "play cafe.wav");
  assert.deepEqual(byId("todo").defaults, { lists: { work: [], home: [] }, active: "work" });
  assert.deepEqual(byId("habits").defaults, { names: ["exercise", "read", "commit"], marks: {} });
  assert.deepEqual(byId("ambient").defaults, { kind: "rain", volume: 0.5 });
  assert.equal(new Set(WIDGETS.map((w) => w.meta.id)).size, WIDGETS.length);
});

// ---------- todo ----------
test("todo: add, toggle and clear done on the active list only", () => {
  let s = byId("todo").defaults;
  s = addItem(s, "  write tests ");
  s = addItem(s, "ship");
  s = addItem(s, "   ");
  assert.deepEqual(s.lists.work, [{ t: "write tests", d: false }, { t: "ship", d: false }]);
  assert.deepEqual(s.lists.home, []);
  s = toggleItem(s, 0);
  assert.equal(s.lists.work[0].d, true);
  s = switchList(s, "home");
  assert.equal(s.active, "home");
  s = addItem(s, "groceries");
  s = toggleItem(s, 0);
  s = clearDone(s);
  assert.deepEqual(s.lists.home, []);
  assert.equal(s.lists.work.length, 2, "work list untouched by clearing home");
  s = switchList(s, "work");
  s = clearDone(s);
  assert.deepEqual(s.lists.work, [{ t: "ship", d: false }]);
  assert.equal(switchList(s, "nope").active, "work");
  assert.equal(toggleItem(s, 9), s);
  assert.deepEqual(byId("todo").defaults.lists, { work: [], home: [] }, "defaults not mutated");
});

test("todo: an unknown active list falls back to the first list", () => {
  const s = addItem({ lists: { a: [], b: [] }, active: "gone" }, "x");
  assert.equal(s.active, "a");
  assert.deepEqual(s.lists.a, [{ t: "x", d: false }]);
});

test("todo: rename, add and delete lists from the settings rows", () => {
  const s = { lists: { work: [{ t: "a", d: false }], home: [{ t: "b", d: true }] }, active: "home" };
  const r = renameLists(s, [{ from: "work", to: "job" }, { from: null, to: "side" }]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.settings.lists, { job: [{ t: "a", d: false }], side: [] });
  assert.equal(r.settings.active, "job", "deleted active list falls back to the first");
  const keep = renameLists(s, [{ from: "home", to: "house" }]);
  assert.equal(keep.settings.active, "house");
  assert.equal(renameLists(s, [{ from: "work", to: "x" }, { from: "home", to: "x" }]).ok, false);
  assert.equal(renameLists(s, [{ from: "work", to: "  " }]).ok, false);
  assert.equal(renameLists(s, []).ok, false);
});

// ---------- habits ----------
test("habits: key format, toggling and a Monday-first week", () => {
  assert.equal(markKey("read", "2026-11-27"), "read|2026-11-27");
  let s = byId("habits").defaults;
  s = toggleMark(s, "read", "2026-11-27");
  assert.deepEqual(s.marks, { "read|2026-11-27": true });
  s = toggleMark(s, "read", "2026-11-27");
  assert.deepEqual(s.marks, {});
  // Sunday 2026-11-29 still belongs to the week of Monday 2026-11-23; Monday 30th starts a new one
  const sun = weekColumns(new Date(2026, 10, 29));
  assert.equal(sun[0], "2026-11-23");
  assert.equal(sun[6], "2026-11-29");
  assert.equal(weekColumns(new Date(2026, 10, 30))[0], "2026-11-30");
  assert.deepEqual(parseHabitNames(" run \n\nread\nrun\n"), ["run", "read"]);
});

// ---------- notes ----------
test("notes: text is capped", () => {
  assert.equal(NOTES_MAX, 20000);
  assert.equal(clampNotes("x".repeat(25000)).length, 20000);
  assert.equal(clampNotes(null), "");
});

// ---------- noise ----------
function fakeAudio() {
  const nodes = [];
  const param = (value = 0) => ({
    value,
    setValueAtTime(v) { this.value = v; },
    linearRampToValueAtTime(v) { this.value = v; },
    exponentialRampToValueAtTime(v) { this.value = v; },
    setTargetAtTime(v) { this.value = v; },
    cancelScheduledValues() {},
  });
  const node = (kind, extra = {}) => {
    const n = {
      kind, out: [], started: false, stopped: false, disconnected: false,
      connect(to) { this.out.push(to); return to; },
      disconnect() { this.disconnected = true; this.out = []; },
      ...extra,
    };
    nodes.push(n);
    return n;
  };
  const ctx = {
    nodes,
    sampleRate: 8000,
    currentTime: 0,
    destination: { kind: "destination" },
    createBuffer: (ch, len, rate) => {
      const data = new Float32Array(len);
      return { length: len, sampleRate: rate, numberOfChannels: ch, getChannelData: () => data };
    },
    createBufferSource: () => node("source", { buffer: null, loop: false, start() { this.started = true; }, stop() { this.stopped = true; } }),
    createGain: () => node("gain", { gain: param(1) }),
    createBiquadFilter: () => node("filter", { type: "lowpass", frequency: param(350), Q: param(1) }),
    createOscillator: () => node("osc", { type: "sine", frequency: param(440), start() { this.started = true; }, stop() { this.stopped = true; } }),
  };
  return ctx;
}

const reaches = (n, target, seen = new Set()) =>
  n === target || (!seen.has(n) && (seen.add(n), (n.out ?? []).some((o) => reaches(o, target, seen))));

for (const kind of ["white", "brown", "rain", "cafe"]) {
  test(`noise: ${kind} builds a graph to the speakers and stop() tears it down`, () => {
    const ctx = fakeAudio();
    const n = createNoise(ctx, kind);
    n.start();
    n.start(); // idempotent
    const sources = ctx.nodes.filter((x) => x.kind === "source");
    assert.ok(sources.length >= 1);
    assert.ok(sources.every((s) => s.started && s.buffer && s.loop));
    assert.ok(sources.every((s) => reaches(s, ctx.destination)), "every source reaches the destination");
    const filled = sources[0].buffer.getChannelData(0);
    assert.ok(filled.some((v) => v !== 0), "buffer has noise");
    assert.ok(filled.every((v) => v >= -1 && v <= 1), "samples in range");
    n.setVolume(2);
    n.setVolume(-1);
    n.setVolume(0.3);
    n.stop();
    assert.ok(sources.every((s) => s.stopped));
    assert.ok(ctx.nodes.every((x) => x.disconnected), "every node disconnected");
    n.stop(); // safe twice
  });
}

test("noise: volume is clamped to 0..1 on the master gain", () => {
  const ctx = fakeAudio();
  const n = createNoise(ctx, "white");
  n.start();
  const master = ctx.nodes.find((x) => x.kind === "gain" && x.out.includes(ctx.destination));
  n.setVolume(5);
  assert.equal(master.gain.value, 1);
  n.setVolume(-3);
  assert.equal(master.gain.value, 0);
  n.stop();
  assert.throws(() => createNoise(ctx, "jazz"));
});

// ---------- shell helpers ----------
test("save tracker: own saves are recognized once, in any order; others are not", () => {
  const tr = createSaveTracker();
  tr.mark("notes", { text: "a" });
  tr.mark("notes", { text: "ab" });
  assert.equal(tr.isOwn("notes", { text: "a" }), true); // late echo of the first save
  assert.equal(tr.isOwn("notes", { text: "ab" }), true);
  assert.equal(tr.isOwn("notes", { text: "ab" }), false, "consumed");
  assert.equal(tr.isOwn("notes", { text: "other tab" }), false);
  assert.equal(tr.isOwn("todo", { text: "a" }), false);
  for (let i = 0; i < 50; i++) tr.mark("x", { i });
  assert.equal(tr.isOwn("x", { i: 0 }), false, "old entries are dropped");
  assert.equal(tr.isOwn("x", { i: 49 }), true);
});

test("chime: only when today's count goes up", () => {
  const a = { day: "2026-11-27", doneToday: 1 };
  assert.equal(shouldChime({ ...a, doneToday: 2 }, a), true);
  assert.equal(shouldChime(a, a), false);
  assert.equal(shouldChime({ day: "2026-11-28", doneToday: 0 }, { ...a, doneToday: 5 }), false);
  assert.equal(shouldChime({ day: "2026-11-28", doneToday: 1 }, { ...a, doneToday: 5 }), true);
  assert.equal(shouldChime(a, undefined), false);
  assert.equal(shouldChime(undefined, a), false);
});

test("manifest: an action (for the badge) without a popup", () => {
  const m = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
  assert.equal(m.action?.default_title, "__MSG_appName__");
  assert.equal("default_popup" in m.action, false);
});

// ---------- fix round 1: echo suppression, todo no-op, notes flush on page close ----------
import { bindPageFlush } from "../widgets/notes.js";

// Two tabs over one storage that, like chrome.storage, fires onChanged only for real
// changes and delivers it to every tab in order. Each tab follows the shell's logic.
function twoTabs(initial) {
  let stored = initial;
  const tabs = {};
  const mk = (name) => ({ name, shown: initial, tracker: createSaveTracker(), renders: 0, writes: 0 });
  tabs.A = mk("A");
  tabs.B = mk("B");
  const save = (tab, next) => {
    if (!tab.tracker.beforeSave("todo", tab.shown, next)) return;
    tab.shown = next;
    tab.writes++;
    if (JSON.stringify(stored) === JSON.stringify(next)) return; // no onChanged
    stored = next;
    for (const t of Object.values(tabs)) {
      if (t.tracker.onIncoming("todo", t.shown, next)) {
        t.shown = next;
        t.renders++;
      }
    }
  };
  return { tabs, save, stored: () => stored };
}

test("save tracker: a no-op save is not written and leaves no pending entry", () => {
  const tr = createSaveTracker();
  const X = { lists: { work: [] }, active: "work" };
  assert.equal(tr.beforeSave("todo", X, structuredClone(X)), false);
  assert.equal(tr.pendingCount("todo"), 0);
  assert.equal(tr.beforeSave("todo", X, { ...X, active: "home" }), true);
  assert.equal(tr.pendingCount("todo"), 1);
});

test("save tracker: a foreign change clears the pending entries", () => {
  const tr = createSaveTracker();
  tr.mark("todo", { v: 1 });
  tr.mark("todo", { v: 2 });
  assert.equal(tr.onIncoming("todo", { v: 2 }, { v: 9 }), true, "foreign change is applied");
  assert.equal(tr.pendingCount("todo"), 0);
  assert.equal(tr.onIncoming("todo", { v: 9 }, { v: 2 }), true, "old own value is no longer swallowed");
  tr.mark("todo", { v: 3 });
  assert.equal(tr.onIncoming("todo", { v: 3 }, { v: 3 }), false, "own echo skipped");
});

test("two tabs: A no-op saves X, B changes to Y and back to X, A ends up showing X", () => {
  const X = { lists: { work: [{ t: "a", d: false }], home: [] }, active: "work" };
  const Y = { ...X, active: "home" };
  const { tabs, save, stored } = twoTabs(X);
  save(tabs.A, structuredClone(X)); // e.g. clicking the already active tab, or Save unchanged
  assert.equal(tabs.A.writes, 0);
  save(tabs.B, Y);
  assert.deepEqual(tabs.A.shown, Y);
  save(tabs.B, X);
  assert.deepEqual(tabs.A.shown, X, "A follows B back to X");
  assert.deepEqual(stored(), X);
  // A's next edit builds on X, not on a stale Y
  save(tabs.A, addItem(tabs.A.shown, "b"));
  assert.deepEqual(stored().lists.work.map((i) => i.t), ["a", "b"]);
  assert.equal(stored().active, "work");
  assert.equal(tabs.A.renders, 2, "A re-rendered for B's two changes, not for its own save");
  assert.deepEqual(tabs.B.shown, stored());
});

test("todo: switching to the active list returns the same object, so nothing is saved", () => {
  const s = { lists: { work: [], home: [] }, active: "work" };
  assert.equal(switchList(s, "work"), s);
  assert.equal(switchList(s, "nope"), s);
  assert.notEqual(switchList(s, "home"), s);
});

test("notes: pagehide and hidden visibility flush pending text; cleanup removes the listeners", () => {
  const win = new EventTarget();
  const doc = new EventTarget();
  doc.visibilityState = "visible";
  let flushed = 0;
  const unbind = bindPageFlush(() => flushed++, { win, doc });
  win.dispatchEvent(new Event("pagehide"));
  assert.equal(flushed, 1);
  doc.dispatchEvent(new Event("visibilitychange")); // still visible
  assert.equal(flushed, 1);
  doc.visibilityState = "hidden";
  doc.dispatchEvent(new Event("visibilitychange"));
  assert.equal(flushed, 2);
  unbind();
  win.dispatchEvent(new Event("pagehide"));
  doc.dispatchEvent(new Event("visibilitychange"));
  assert.equal(flushed, 2, "no flush after cleanup");
});
