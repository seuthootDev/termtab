// Above the grid: the greeting/today's-focus lines and the search window.
import { $, prompt, title, today } from "./dom.js";
import { greeting } from "../lib/dates.js";

export const ENGINES = {
  google: "https://www.google.com/search?q=",
  duckduckgo: "https://duckduckgo.com/?q=",
  naver: "https://search.naver.com/search.naver?query=",
  github: "https://github.com/search?q=",
};

export function createTop({ t, store, getPrefs, setPrefs }) {
  const echo = $("#greet-echo");
  const focus = $("#focus");
  const q = $("#q");
  const engine = $("#engine");

  // greeting: echo "Good <part>, <user>"
  function drawGreeting() {
    const user = getPrefs().user;
    const text = {
      morning: t("greetMorning", user),
      afternoon: t("greetAfternoon", user),
      evening: t("greetEvening", user),
      night: t("greetNight", user),
    }[greeting(new Date().getHours())];
    echo.replaceChildren(prompt(getPrefs(), `echo "${text}"`));
  }

  // today's focus: { day, text }, cleared when the stored day is not today
  let focusDay = today();
  async function loadFocus() {
    const f = await store.get("focus", null);
    focusDay = today();
    if (f && f.day !== focusDay) store.set("focus", { day: focusDay, text: "" });
    const text = f?.day === focusDay ? f.text : "";
    if (document.activeElement !== focus) focus.value = text;
  }
  let saveTimer;
  focus.addEventListener("input", () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => store.set("focus", { day: today(), text: focus.value }), 300);
  });
  focus.addEventListener("keydown", (e) => {
    if (e.key === "Enter") focus.blur();
  });
  focus.addEventListener("blur", () => {
    clearTimeout(saveTimer);
    store.set("focus", { day: today(), text: focus.value });
  });
  store.onChange("focus", (v) => {
    if (document.activeElement !== focus) focus.value = v?.day === today() ? v.text : "";
  });

  // search: Enter opens the results in this tab
  $("#search").addEventListener("submit", (e) => {
    e.preventDefault();
    const query = q.value.trim();
    if (!query) return;
    location.href = (ENGINES[engine.value] ?? ENGINES.google) + encodeURIComponent(query);
  });
  engine.addEventListener("change", () => setPrefs({ ...getPrefs(), searchEngine: engine.value }));

  function refresh() {
    const prefs = getPrefs();
    drawGreeting();
    $("#search-prompt").replaceChildren(prompt(prefs, "search"));
    $("#search-title").replaceChildren(...title(prefs, "search", "80×1"));
    engine.value = ENGINES[prefs.searchEngine] ? prefs.searchEngine : "google";
  }

  // every minute: greeting part and the day of the focus line can change
  setInterval(() => {
    drawGreeting();
    if (focusDay !== today()) loadFocus();
  }, 60_000);

  loadFocus();
  return { refresh, focusSearch: () => q.focus() };
}
