// New tab page: wires the menu bar, greeting, search, window grid, drawer, drag and shortcuts.
// chrome.* is only touched through guarded accessors, so the page also opens outside the
// extension (plain browser preview: localStorage instead of chrome.storage, English strings).
import { createStore } from "./lib/store.js";
import { createCache } from "./lib/cache.js";
import { defaultLayout, addWidget, removeWidget, toggle } from "./lib/layout.js";
import * as timer from "./lib/timer.js";
import { t, initI18n, uiLanguage } from "./lib/i18n.js";
import { byId, metaById } from "./widgets/index.js";
import { $, applyI18n } from "./shell/dom.js";
import { localArea } from "./shell/local-area.js";
import { createOverlays } from "./shell/overlay.js";
import { createGrid } from "./shell/windows.js";
import { enableDrag } from "./shell/drag.js";
import { createDrawer } from "./shell/drawer.js";
import { createMenubar } from "./shell/menubar.js";
import { createTop } from "./shell/top.js";
import { createPanels } from "./shell/panels.js";
import { enableShortcuts } from "./shell/shortcuts.js";

const DEFAULT_PREFS = { user: "you", machine: "MacBook", clock24: true, searchEngine: "google" };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function main() {
  await initI18n();
  const lang = uiLanguage();
  document.documentElement.lang = lang;
  document.title = t("appName");
  applyI18n(document, t);

  const area = globalThis.chrome?.storage?.local ?? localArea();
  const store = createStore(area);
  const cache = createCache({ store });
  const demo = new URLSearchParams(location.search).get("demo") === "1";

  let prefs = { ...DEFAULT_PREFS, ...(await store.get("prefs", {})) };
  const clean = (l) => (Array.isArray(l) ? l.filter((i) => i && byId(i.id)) : null);
  let layout = clean(await store.get("layout", null)) ?? defaultLayout(metaById);

  const getPrefs = () => prefs;
  const getLayout = () => layout;

  function setLayout(next) {
    layout = next;
    grid.sync(layout);
    drawer.refresh();
    store.set("layout", layout);
  }
  function setPrefs(next) {
    prefs = next;
    applyPrefs();
    store.set("prefs", prefs);
  }
  function applyPrefs() {
    grid.rerenderAll(layout);
    top.refresh();
    menubar.refresh();
    drawer.refresh();
  }

  const overlays = createOverlays({ host: $("#modals"), t, getPrefs });
  const grid = createGrid({
    grid: $("#grid"), store, cache, demo, t, getPrefs,
    actions: {
      windowAction(id, act) {
        if (act === "remove") setLayout(removeWidget(layout, id));
        else setLayout(toggle(layout, id, act));
      },
      openSettings: (id) => panels.settings(id),
    },
  });
  const panels = createPanels({ t, overlays, getPrefs, setPrefs, grid, byId });
  const drawer = createDrawer({ t, getPrefs, getLayout, setLayout });
  const top = createTop({ t, store, getPrefs, setPrefs });
  const menubar = createMenubar({
    t, lang, getPrefs,
    actions: { widgets: () => drawer.open(), prefs: panels.preferences, about: panels.about },
  });
  enableDrag({ grid: $("#grid"), getLayout, setLayout });

  async function openNotes() {
    if (!layout.some((i) => i.id === "notes")) setLayout(addWidget(layout, "notes", metaById.notes));
    await grid.ready("notes");
    const win = grid.windowEl("notes");
    if (!win) return;
    if (win.classList.contains("min")) setLayout(toggle(layout, "notes", "minimized"));
    win.scrollIntoView({ block: "nearest" });
    (win.querySelector(".pb textarea, .pb input") ?? win.querySelector(".ph")).focus();
  }

  async function toggleTimer() {
    const now = Date.now();
    const state = timer.tick(await store.get("timer", timer.initial(now)), now).state;
    await store.set("timer", state.running ? timer.pause(state, now) : timer.start(state, now));
  }

  enableShortcuts({
    closeOverlay: () => overlays.closeTop() || drawer.close() || menubar.close(),
    focusSearch: top.focusSearch,
    openNotes,
    toggleTimer,
    help: panels.help,
  });

  // other tabs (or the background) changed layout or prefs
  store.onChange("layout", (v) => {
    const next = clean(v);
    if (next && !same(next, layout)) {
      layout = next;
      grid.sync(layout);
      drawer.refresh();
    }
  });
  store.onChange("prefs", (v) => {
    const next = { ...DEFAULT_PREFS, ...v };
    if (!same(next, prefs)) {
      prefs = next;
      applyPrefs();
    }
  });

  grid.sync(layout);
  top.refresh();
  drawer.refresh();
}

main().catch((err) => console.error(err));
