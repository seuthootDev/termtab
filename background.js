// Service worker: focus-timer alarm, toolbar badge and focus mode. All listeners are
// registered at the top level so Chrome can wake the worker for them.
import { createBackground } from "./lib/bg.js";
import { defaultLayout } from "./lib/layout.js";
import { categoryById, metaById } from "./widgets/index.js";

const bg = createBackground({ chrome, categoryById, defaultLayout: () => defaultLayout(metaById) });
const log = (p) => p.catch((err) => console.error(err));

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.timer) log(bg.onTimerChange(changes.timer.newValue, changes.timer.oldValue));
});
chrome.alarms.onAlarm.addListener((alarm) => log(bg.onAlarm(alarm)));
chrome.runtime.onStartup.addListener(() => log(bg.onStartup()));
chrome.runtime.onInstalled.addListener(() => log(bg.onStartup()));
