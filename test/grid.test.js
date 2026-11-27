// Grid-level behaviour of shell/windows.js, run against a tiny fake DOM (just what dom.js and the
// widgets used here need): refresh while a tab stays open, the cacheKey hook, prefs changes.
import { test, mock } from "node:test";
import assert from "node:assert/strict";

// ---------- a minimal DOM ----------
class Node {
  constructor() {
    this.parentNode = null;
    this.childNodes = [];
  }
  get textContent() {
    return this.childNodes.map((c) => c.textContent).join("");
  }
  set textContent(v) {
    this.replaceChildren(String(v));
  }
  remove() {
    if (!this.parentNode) return;
    const kids = this.parentNode.childNodes;
    kids.splice(kids.indexOf(this), 1);
    this.parentNode = null;
  }
}
class Text extends Node {
  constructor(s) {
    super();
    this.data = s;
  }
  get textContent() {
    return this.data;
  }
}
const asNode = (c) => (c instanceof Node ? c : new Text(String(c)));
class Element extends Node {
  constructor(tag) {
    super();
    this.tagName = tag.toUpperCase();
    this.attrs = {};
    this.listeners = {};
    this.style = {};
    this.className = "";
    this.hidden = false;
    const el = this;
    this.classList = {
      toggle(c, on) {
        const set = new Set(el.className.split(" ").filter(Boolean));
        if (on ?? !set.has(c)) set.add(c);
        else set.delete(c);
        el.className = [...set].join(" ");
      },
      contains: (c) => el.className.split(" ").includes(c),
    };
  }
  get children() {
    return this.childNodes.filter((c) => c instanceof Element);
  }
  get dataset() {
    const out = {};
    for (const [k, v] of Object.entries(this.attrs)) if (k.startsWith("data-")) out[k.slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = v;
    return out;
  }
  setAttribute(k, v) {
    this.attrs[k] = String(v);
  }
  getAttribute(k) {
    return this.attrs[k] ?? null;
  }
  addEventListener(type, fn) {
    (this.listeners[type] ??= new Set()).add(fn);
  }
  removeEventListener(type, fn) {
    this.listeners[type]?.delete(fn);
  }
  append(...kids) {
    for (const k of kids) {
      const n = asNode(k);
      n.remove();
      n.parentNode = this;
      this.childNodes.push(n);
    }
  }
  replaceChildren(...kids) {
    for (const c of [...this.childNodes]) c.remove();
    this.append(...kids);
  }
  insertBefore(n, ref) {
    n.remove();
    const i = ref ? this.childNodes.indexOf(ref) : -1;
    n.parentNode = this;
    if (i < 0) this.childNodes.push(n);
    else this.childNodes.splice(i, 0, n);
  }
  closest() {
    return null;
  }
  focus() {}
}

function fakeDocument() {
  const listeners = {};
  return {
    visibilityState: "visible",
    createElement: (tag) => new Element(tag),
    addEventListener(type, fn) {
      (listeners[type] ??= new Set()).add(fn);
    },
    removeEventListener(type, fn) {
      listeners[type]?.delete(fn);
    },
    listenerCount: (type) => listeners[type]?.size ?? 0,
    fire(type) {
      for (const fn of [...(listeners[type] ?? [])]) fn({ type });
    },
  };
}

globalThis.document = fakeDocument();

const { createGrid, cacheKeyFor } = await import("../shell/windows.js");
const { byId } = await import("../widgets/index.js");
const { DEFAULT_PREFS } = await import("../lib/prefs.js");

function fakeStore() {
  return {
    get: async (_k, def) => def,
    set: async () => {},
    onChange: () => () => {},
  };
}

function setup({ prefs = { ...DEFAULT_PREFS }, demo = false } = {}) {
  const doc = fakeDocument();
  globalThis.document = doc;
  const gets = [];
  const cache = { get: async (key, ttl, fetcher, onUpdate, opts) => (gets.push({ key, opts }), null) };
  const state = { prefs };
  const gridEl = new Element("div");
  const grid = createGrid({
    grid: gridEl, store: fakeStore(), cache, demo, t: (k) => k, getPrefs: () => state.prefs,
    actions: { windowAction() {}, openSettings() {} }, doc,
  });
  return { doc, gets, grid, gridEl, state };
}

const flush = () => new Promise((r) => setImmediate(r));
const win = (id) => ({ id, wide: false, minimized: false });

// ---------- 1. refresh while a tab stays open ----------
test("grid: online widgets reload when the tab becomes visible and every 60 s while visible", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  const { doc, gets, grid } = setup();
  grid.sync([win("hn"), win("calendar"), win("wiki")]);
  await grid.ready("hn");
  await grid.ready("wiki");
  const count = () => gets.length;
  const start = count();
  assert.equal(start, 2, "hn and wiki load once on mount");

  t.mock.timers.tick(60_000);
  await flush();
  assert.equal(count(), start + 2, "one reload per online widget after 60 s");

  doc.visibilityState = "hidden";
  doc.fire("visibilitychange");
  t.mock.timers.tick(120_000);
  await flush();
  assert.equal(count(), start + 2, "no reloads while hidden");

  doc.visibilityState = "visible";
  doc.fire("visibilitychange");
  await flush();
  assert.equal(count(), start + 4, "reload at once when visible again");
  t.mock.timers.tick(60_000);
  await flush();
  assert.equal(count(), start + 6);

  grid.destroy();
  assert.equal(doc.listenerCount("visibilitychange"), 0, "listener removed");
  t.mock.timers.tick(600_000);
  await flush();
  assert.equal(count(), start + 6, "interval cleared");
});

// ---------- 2. cacheKey hook ----------
test("cacheKeyFor: wiki's key changes across local midnight, others ignore the date", () => {
  const wiki = byId("wiki");
  const before = cacheKeyFor(wiki, "wiki", wiki.defaults, new Date(2026, 10, 27, 23, 59, 59));
  const after = cacheKeyFor(wiki, "wiki", wiki.defaults, new Date(2026, 10, 28, 0, 0, 1));
  assert.notEqual(before, after);
  assert.ok(before.endsWith(":2026-11-27"), before);
  assert.ok(after.endsWith(":2026-11-28"), after);
  assert.equal(wiki.cacheKey(wiki.defaults, new Date(2026, 0, 5, 12)), "2026-01-05");
  const hn = byId("hn");
  assert.equal(cacheKeyFor(hn, "hn", hn.defaults, new Date(2026, 10, 27)), cacheKeyFor(hn, "hn", hn.defaults, new Date(2026, 10, 28)));
});

test("calendar redraws when the local day changes", (t) => {
  t.mock.timers.enable({ apis: ["setInterval", "Date"], now: new Date(2026, 10, 30, 23, 59, 30).getTime() });
  const cal = byId("calendar");
  const el = new Element("div");
  const cleanup = cal.render(el, { settings: {}, t: (k) => k, prefs: DEFAULT_PREFS });
  const today = () => el.childNodes[1].children.find((c) => c.className === "td")?.textContent;
  assert.equal(today(), "30");
  t.mock.timers.tick(60_000);
  assert.equal(today(), "1", "December 1st after midnight");
  assert.equal(typeof cleanup, "function");
  cleanup();
});

// ---------- 4. prefs changes ----------
test("grid: a prefs change redraws prompts and titles but renders only usesPrefs widgets", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  const { grid, state, gridEl } = setup();
  const layout = [win("calendar"), win("clock"), win("ambient")];
  grid.sync(layout);
  await Promise.all(layout.map((i) => grid.ready(i.id)));
  const calls = { calendar: 0, clock: 0, ambient: 0 };
  const restore = [];
  for (const id of Object.keys(calls)) {
    const mod = byId(id);
    const real = mod.render;
    mod.render = function (...a) {
      calls[id]++;
      return real.apply(this, a);
    };
    restore.push(() => (mod.render = real));
  }
  try {
    state.prefs = { ...state.prefs, user: "ann", clock24: false };
    grid.rerenderAll(layout);
    assert.deepEqual(calls, { calendar: 0, clock: 1, ambient: 0 });
    for (const w of gridEl.children) {
      assert.match(w.textContent, /ann@MacBook ~ %/, `prompt of ${w.attrs["data-id"]}`);
      assert.match(w.textContent, /^ann\s— /, `title of ${w.attrs["data-id"]}`);
    }
  } finally {
    restore.forEach((f) => f());
    grid.destroy();
  }
});

test("widgets that read ctx.prefs declare meta.usesPrefs", async () => {
  const { readFileSync } = await import("node:fs");
  const { WIDGETS } = await import("../widgets/index.js");
  for (const w of WIDGETS) {
    const src = readFileSync(new URL(`../widgets/${w.meta.id}.js`, import.meta.url), "utf8");
    assert.equal(!!w.meta.usesPrefs, /ctx\.prefs/.test(src), w.meta.id);
  }
});
