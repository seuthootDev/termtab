// Background logic, kept free of chrome globals so it can be tested with a fake: the focus
// timer (one alarm at endsAt, the toolbar badge when a session ends, and focus mode: news
// windows minimized while a focus session runs, when prefs.focusMode is on) and the dashboard
// window (opened or focused from the toolbar button, its position remembered).
import * as timer from "./timer.js";
import { applyFocusMode } from "./layout.js";

export const ALARM = "timer";
export const DASH_PAGE = "newtab.html";
export const DASH_DEFAULT = { width: 1280, height: 860 };
const BOUNDS_DELAY = 500;

const focusOn = (s) => !!s && s.running === true && s.mode === "focus";
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function createBackground({
  chrome,
  now = Date.now,
  categoryById,
  defaultLayout = () => null,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  const area = chrome.storage.local;
  const read = async (key) => (await area.get(key))[key];
  // The open dashboard window's id lives in session storage: it survives the worker being
  // stopped but not a browser restart, when window ids change anyway.
  const session = chrome.storage?.session;
  const dashId = async () => (session ? (await session.get("dashWindow")).dashWindow : undefined);
  let boundsTimer = null;

  // With the pref off only the restore path runs, so windows minimized before it was
  // switched off still come back.
  async function applyFocus(on) {
    const prefs = (await read("prefs")) ?? {};
    if (prefs.focusMode === false) on = false;
    const layout = (await read("layout")) ?? defaultLayout();
    if (!Array.isArray(layout)) return;
    const next = applyFocusMode(layout, on, categoryById);
    if (!same(next, layout)) await area.set({ layout: next });
  }

  /** Bring the stored timer up to date; end the session if endsAt has passed. */
  async function processTimer() {
    const stored = await read("timer");
    if (!stored) return;
    const { state, finished } = timer.tick(stored, now());
    if (!same(state, stored)) await area.set({ timer: state });
    if (finished) await chrome.action?.setBadgeText?.({ text: "✓" });
    await applyFocus(focusOn(state));
  }

  return {
    /** Toolbar button / Alt+Shift+T: focus the dashboard window if it is open, else open it. */
    async openDashboard() {
      const win = chrome.windows;
      if (!win?.create) return;
      const id = await dashId();
      if (Number.isInteger(id) && win.get) {
        try {
          await win.get(id);
          await win.update?.(id, { focused: true });
          return;
        } catch {
          // Closed while the worker was asleep (onRemoved missed): open a new one.
        }
      }
      // Off-screen saved bounds (a monitor unplugged) are clamped by Chrome itself.
      const saved = await read("dashBounds");
      const bounds = saved && typeof saved === "object" ? saved : DASH_DEFAULT;
      const created = await win.create({ url: DASH_PAGE, type: "popup", focused: true, ...bounds });
      if (Number.isInteger(created?.id)) await session?.set({ dashWindow: created.id });
    },

    /** chrome.windows.onBoundsChanged: remember where our window is, debounced. */
    async onBoundsChanged(w) {
      if (!w || !Number.isInteger(w.id) || w.id !== (await dashId())) return;
      const { left, top, width, height } = w;
      if (![left, top, width, height].every(Number.isFinite)) return;
      if (boundsTimer !== null) clearTimer(boundsTimer);
      boundsTimer = setTimer(() => {
        boundsTimer = null;
        return area.set({ dashBounds: { left, top, width, height } });
      }, BOUNDS_DELAY);
    },

    /** chrome.windows.onRemoved: forget our window once it is closed. */
    async onWindowRemoved(id) {
      if (id === (await dashId())) await session?.remove?.("dashWindow");
    },

    /** chrome.storage.onChanged for the `prefs` key: focus mode switched on or off mid-session. */
    async onPrefsChange(next, prev) {
      if ((next?.focusMode !== false) === (prev?.focusMode !== false)) return;
      const stored = await read("timer");
      await applyFocus(!!stored && focusOn(timer.tick(stored, now()).state));
    },

    /** chrome.storage.onChanged for the `timer` key (local area). */
    async onTimerChange(next, prev) {
      if (next?.running && Number.isFinite(next.endsAt)) await chrome.alarms.create(ALARM, { when: next.endsAt });
      else await chrome.alarms.clear(ALARM);
      if (focusOn(next) !== focusOn(prev)) await applyFocus(focusOn(next));
    },

    async onAlarm(alarm) {
      if (alarm?.name !== ALARM) return;
      await processTimer();
    },

    /** onStartup / onInstalled: alarms may be gone and endsAt may have passed meanwhile. */
    async onStartup() {
      const s = await read("timer");
      if (!s?.running) return;
      if (s.endsAt <= now()) await processTimer();
      else await chrome.alarms.create(ALARM, { when: s.endsAt });
    },
  };
}
