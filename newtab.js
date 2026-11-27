// Dashboard page (opened in its own window by the toolbar button): wires the menu bar, greeting, search, window grid, drawer, drag and shortcuts.
// chrome.* is only touched through guarded accessors, so the page also opens outside the
// extension (plain browser preview: localStorage instead of chrome.storage, English strings).
import { createStore } from "./lib/store.js";
import { createCache } from "./lib/cache.js";
import { defaultLayout, addWidget, removeWidget, toggle } from "./lib/layout.js";
import * as timer from "./lib/timer.js";
import { t, initI18n, uiLanguage } from "./lib/i18n.js";
import { byId, metaById } from "./widgets/index.js";
import { $, applyI18n } from "./shell/dom.js";
import { defaultArea } from "./shell/local-area.js";
import { createOverlays } from "./shell/overlay.js";
import { createGrid } from "./shell/windows.js";
import { enableDrag } from "./shell/drag.js";
import { createDrawer } from "./shell/drawer.js";
import { createMenubar } from "./shell/menubar.js";
import { createTop } from "./shell/top.js";
import { createPanels } from "./shell/panels.js";
import { enableShortcuts } from "./shell/shortcuts.js";
import { shouldChime, playChime } from "./shell/chime.js";
import { DEFAULT_PREFS, FONT_PX, WALLPAPERS, prefsEffects } from "./lib/prefs.js";
import { announceFocusStart } from "./widgets/timer.js";

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function main() {
  await initI18n();
  const lang = uiLanguage();
  document.documentElement.lang = lang;
  document.title = t("appName");
  applyI18n(document, t);

  const area = defaultArea();
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
    const prev = prefs;
    prefs = next;
    applyPrefs(prev);
    store.set("prefs", prefs);
  }
  function applyAppearance() {
    const wp = WALLPAPERS.includes(prefs.wallpaper) ? prefs.wallpaper : 1;
    for (const c of [...document.body.classList]) if (c.startsWith("wp-")) document.body.classList.remove(c);
    document.body.classList.add(`wp-${wp}`);
    document.body.style.fontSize = `${FONT_PX[prefs.fontSize] ?? FONT_PX.medium}px`;
  }
  // Only what changed is redrawn: a search-engine change leaves every window alone, and
  // rerenderAll keeps widgets without meta.usesPrefs (ambient sound, typed input) as they are.
  function applyPrefs(prev) {
    const fx = prefsEffects(prev, prefs);
    if (fx.appearance) applyAppearance();
    if (!fx.windows) {
      top.refresh(); // the engine picker
      return;
    }
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
  const panels = createPanels({
    t, overlays, getPrefs, setPrefs, grid, byId, store, storage: area,
    resetLayout: () => setLayout(defaultLayout(metaById)),
  });
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
    const next = state.running ? timer.pause(state, now) : timer.start(state, now);
    announceFocusStart(next, prefs);
    await store.set("timer", next);
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
      const prev = prefs;
      prefs = next;
      applyPrefs(prev);
    }
  });

  // focus timer: the badge (✓) is cleared by opening the dashboard; a session that ends while
  // this page is open plays a chime, once the page has had a user gesture (autoplay rules)
  globalThis.chrome?.action?.setBadgeText?.({ text: "" })?.catch?.(() => {});
  let gesture = false;
  const onGesture = () => {
    gesture = true;
    removeEventListener("pointerdown", onGesture, true);
    removeEventListener("keydown", onGesture, true);
  };
  addEventListener("pointerdown", onGesture, true);
  addEventListener("keydown", onGesture, true);
  store.onChange("timer", (v, old) => {
    if (gesture && shouldChime(v, old)) playChime();
  });

  applyAppearance();
  grid.sync(layout);
  top.refresh();
  drawer.refresh();
}

main().catch((err) => console.error(err));
