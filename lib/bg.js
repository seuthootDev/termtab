// Background logic for the focus timer, kept free of chrome globals so it can be tested
// with a fake: one alarm at endsAt, the toolbar badge when a session ends, and focus mode
// (news windows minimized while a focus session runs, when prefs.focusMode is on).
import * as timer from "./timer.js";
import { applyFocusMode } from "./layout.js";

export const ALARM = "timer";

const focusOn = (s) => !!s && s.running === true && s.mode === "focus";
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function createBackground({ chrome, now = Date.now, categoryById, defaultLayout = () => null }) {
  const area = chrome.storage.local;
  const read = async (key) => (await area.get(key))[key];

  async function applyFocus(on) {
    const prefs = (await read("prefs")) ?? {};
    if (prefs.focusMode === false) return;
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
