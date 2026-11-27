// The grid of Terminal windows: keyed by widget id, so a layout change moves windows
// instead of re-rendering them. Each window owns its settings, cache entry and subscriptions.
import { h, prompt, title } from "./dom.js";
import { byId } from "../widgets/index.js";
import { hash } from "../lib/hash.js";
import { DEMO } from "../demo/data.js";
import { createSaveTracker } from "./save-tracker.js";

const DEFAULT_TTL = 15 * 60 * 1000;
const REFRESH_MS = 60 * 1000;

/** Storage key of a widget's cache entry: its settings hash, plus the module's cacheKey(settings, now)
 *  when it has one (wiki: the local date, so "on this day" turns over at midnight). */
export function cacheKeyFor(mod, id, settings, now = new Date()) {
  const extra = typeof mod.cacheKey === "function" ? mod.cacheKey(settings, now) : "";
  return `cache:${id}:${hash(settings)}${extra ? ":" + extra : ""}`;
}

export function createGrid({ grid, store, cache, demo, t, getPrefs, actions, doc = globalThis.document }) {
  const mounted = new Map(); // id → window state
  const name = (id) => t(`w_${id}_name`);
  const ownSaves = createSaveTracker();

  function mount(item) {
    const mod = byId(item.id);
    const id = item.id;
    const m = { id, mod, settings: { ...mod.defaults }, entry: null, cleanup: null, unsub: [], cacheKey: null };
    const red = h("button", { type: "button", class: "r", "data-act": "remove" });
    const yellow = h("button", { type: "button", class: "yb", "data-act": "minimized" });
    const green = h("button", { type: "button", class: "gb", "data-act": "wide" });
    m.lights = { red, yellow, green };
    m.titleEl = h("span", { class: "t" });
    m.more = mod.settingsForm
      ? h("button", { type: "button", class: "more", "data-act": "settings", "aria-label": t("winSettings", name(id)) }, "⋯")
      : null;
    m.ph = h("div", { class: "ph", tabindex: "0" }, h("div", { class: "tl" }, red, yellow, green), m.titleEl, m.more);
    m.cmd = h("div", { class: "cmd" });
    m.content = h("div", { class: "content" });
    m.status = h("div", { class: "status dim", hidden: true });
    m.win = h("section", { class: "win", "data-id": id, "aria-label": name(id) },
      m.ph, h("div", { class: "pb" }, m.cmd, m.content, m.status));
    m.ph.addEventListener("click", (e) => {
      const act = e.target.closest("button")?.dataset.act;
      if (act === "settings") actions.openSettings(id);
      else if (act) actions.windowAction(id, act);
    });
    m.unsub.push(store.onChange("settings:" + id, (v) => {
      const next = { ...mod.defaults, ...v };
      // skips the echo of this tab's own save; a foreign change drops pending own saves
      if (ownSaves.onIncoming(id, m.settings, next)) applySettings(m, next);
    }));
    mounted.set(id, m);
    m.ready = store.get("settings:" + id, {}).then((s) => {
      if (mounted.get(id) !== m) return;
      m.settings = { ...mod.defaults, ...s };
      return load(m);
    }).catch((err) => console.error(err));
    return m;
  }

  function unmount(m) {
    runCleanup(m);
    m.unsub.forEach((u) => u());
    m.unsubCache?.();
    m.win.remove();
    mounted.delete(m.id);
  }

  function runCleanup(m) {
    try {
      m.cleanup?.();
    } catch (err) {
      console.error(err);
    }
    m.cleanup = null;
  }

  function applySettings(m, settings) {
    m.settings = settings;
    load(m);
  }

  // Data flow: stored entry first (render at once), revalidate in the background.
  // quiet: a background refresh that redraws only when the entry actually changed.
  async function load(m, { force = false, quiet = false } = {}) {
    const { mod } = m;
    if (!mod.fetch) return render(m);
    if (demo) {
      m.entry = { value: DEMO[m.id] ?? null, fetchedAt: Date.now(), error: false };
      return render(m);
    }
    const key = cacheKeyFor(mod, m.id, m.settings);
    if (m.cacheKey !== key) {
      m.unsubCache?.();
      m.cacheKey = key;
      m.entry = null;
      // Another tab may win the fetch lock; its result reaches us only through storage.
      m.unsubCache = store.onChange(key, (v) => update(m, key, v));
    }
    const settings = m.settings;
    const fetcher = () => mod.fetch(settings).then((raw) => mod.parse(raw, settings));
    const entry = await cache.get(key, mod.ttlMs ?? DEFAULT_TTL, fetcher, (e) => update(m, key, e), { force });
    if (m.cacheKey === key && mounted.get(m.id) === m) {
      const before = m.entry;
      // keep a newer entry that already arrived through onChange/onUpdate
      if (!m.entry || (entry && entry.fetchedAt >= m.entry.fetchedAt)) m.entry = entry;
      if (quiet && before && m.entry && before.fetchedAt === m.entry.fetchedAt && before.error === m.entry.error) return;
      render(m);
    }
  }

  function update(m, key, entry) {
    if (mounted.get(m.id) !== m || m.cacheKey !== key || !entry) return;
    if (m.entry && m.entry.fetchedAt === entry.fetchedAt && m.entry.error === entry.error) return;
    m.entry = entry;
    render(m);
  }

  function render(m) {
    if (mounted.get(m.id) !== m) return;
    const { mod } = m;
    const prefs = getPrefs();
    runCleanup(m);
    m.cmd.replaceChildren(prompt(prefs, mod.meta.command(m.settings)));
    m.content.replaceChildren();
    const error = !!m.entry?.error;
    m.status.hidden = !error;
    m.status.replaceChildren(...(error
      ? [t("fetchFailed"), " · ", h("button", { type: "button", onclick: () => load(m, { force: true }) }, t("retry"))]
      : []));
    const ctx = {
      settings: m.settings,
      data: m.entry?.value ?? null,
      error,
      t,
      prefs,
      demo: !!demo,
      refresh: () => load(m, { force: true }),
      // The widget already shows what it saves, so its own save does not re-render it
      // (that would drop the caret); pass { rerender: true } to redraw anyway.
      save: (settings, opts) => saveSettings(m.id, settings, { rerender: !!opts?.rerender }),
    };
    try {
      const cleanup = mod.render(m.content, ctx);
      if (typeof cleanup === "function") m.cleanup = cleanup;
    } catch (err) {
      console.error(err);
      m.content.replaceChildren(h("span", { class: "r" }, t("widgetError")));
    }
  }

  function decorate(m, item) {
    const prefs = getPrefs();
    const n = name(m.id);
    m.win.classList.toggle("wide", !!item.wide);
    m.win.classList.toggle("min", !!item.minimized);
    m.titleEl.replaceChildren(...title(prefs, m.id, item.wide ? "120×24" : "80×24"));
    m.ph.setAttribute("aria-label", t("winTitleBar", n));
    m.lights.red.setAttribute("aria-label", t("winClose", n));
    m.lights.yellow.setAttribute("aria-label", item.minimized ? t("winRestore", n) : t("winMinimize", n));
    m.lights.yellow.setAttribute("aria-pressed", String(!!item.minimized));
    m.lights.green.setAttribute("aria-label", item.wide ? t("winNarrow", n) : t("winWiden", n));
    m.lights.green.setAttribute("aria-pressed", String(!!item.wide));
  }

  let empty = null;
  function emptyWindow() {
    const prefs = getPrefs();
    return h("section", { class: "win empty" },
      h("div", { class: "ph" }, h("div", { class: "tl", "aria-hidden": "true" }, h("i", { class: "r" }), h("i", { class: "yb" }), h("i", { class: "gb" })),
        h("span", { class: "t" }, h("b", {}, prefs.user), "\u00a0— zsh — 80×24")),
      h("div", { class: "pb" }, h("div", { class: "cmd" }, prompt(prefs, "widgets --list")), t("emptyGrid"), " ", h("span", { class: "cursor" })));
  }

  // A tab left open keeps its online data current: reload on becoming visible and every minute
  // while visible. cache.get only hits the network when the entry is stale, so this stays cheap.
  function refreshOnline() {
    if (demo) return;
    for (const m of mounted.values()) if (m.mod.fetch) load(m, { quiet: true }).catch((err) => console.error(err));
  }
  let timer = null;
  const startTimer = () => (timer ??= setInterval(refreshOnline, REFRESH_MS));
  const stopTimer = () => {
    clearInterval(timer);
    timer = null;
  };
  function onVisibility() {
    if (doc.visibilityState === "visible") {
      refreshOnline();
      startTimer();
    } else stopTimer();
  }
  doc?.addEventListener?.("visibilitychange", onVisibility);
  if (doc?.visibilityState !== "hidden") startTimer();

  function promptLine(m) {
    m.cmd.replaceChildren(prompt(getPrefs(), m.mod.meta.command(m.settings)));
  }

  async function saveSettings(id, settings, { rerender = true } = {}) {
    const m = mounted.get(id);
    const next = { ...(m?.mod.defaults ?? byId(id)?.defaults), ...settings };
    if (m) {
      // nothing changed: no write (Chrome would send no echo to match the pending entry)
      if (!ownSaves.beforeSave(id, m.settings, next)) return;
      if (rerender) applySettings(m, next);
      else {
        m.settings = next;
        promptLine(m); // e.g. `todo home`
      }
    }
    await store.set("settings:" + id, next);
  }

  return {
    /** Bring the grid in line with the layout (mount, unmount, reorder, decorate). */
    sync(layout) {
      const items = layout.filter((i) => byId(i.id));
      const ids = new Set(items.map((i) => i.id));
      for (const m of [...mounted.values()]) if (!ids.has(m.id)) unmount(m);
      empty?.remove();
      empty = null;
      items.forEach((item, i) => {
        const m = mounted.get(item.id) ?? mount(item);
        decorate(m, item);
        const at = grid.children[i];
        if (at !== m.win) grid.insertBefore(m.win, at ?? null);
      });
      if (!items.length) grid.append((empty = emptyWindow()));
    },
    /** Prefs changed (user, machine, clock): redraw every title and prompt line; fully re-render
     *  only widgets whose meta.usesPrefs is set (the others keep their state: sound, typed input). */
    rerenderAll(layout) {
      this.sync(layout); // also redraws the titles and the empty window
      for (const m of mounted.values()) {
        if (m.mod.meta.usesPrefs) render(m);
        else promptLine(m);
      }
    },
    /** Remove the refresh listener and interval. */
    destroy() {
      doc?.removeEventListener?.("visibilitychange", onVisibility);
      stopTimer();
    },
    /** Resolves when the window's first render is done. */
    ready: (id) => mounted.get(id)?.ready ?? Promise.resolve(),
    windowEl: (id) => mounted.get(id)?.win ?? null,
    settingsOf: (id) => mounted.get(id)?.settings,
    saveSettings,
  };
}
