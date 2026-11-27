// Habits: tick each habit for each day of this week (Monday first).
// Settings: { names: [..], marks: { "<name>|YYYY-MM-DD": true } }.
import { h, today } from "../shell/dom.js";
import { weekDays } from "../lib/dates.js";

const MAX_HABITS = 8;
const MAX_NAME = 24;

export const markKey = (name, day) => `${name}|${day}`;

export function toggleMark(s, name, day) {
  const key = markKey(name, day);
  const marks = { ...(s?.marks ?? {}) };
  if (marks[key]) delete marks[key];
  else marks[key] = true;
  return { ...s, marks };
}

/** The seven ISO dates of the week containing `date`, Monday first. */
export const weekColumns = (date) => weekDays(date);

export function parseHabitNames(text) {
  const names = String(text ?? "").split("\n").map((l) => l.trim().slice(0, MAX_NAME)).filter(Boolean);
  return [...new Set(names)].slice(0, MAX_HABITS);
}

const dayInitial = (iso, lang) =>
  new Intl.DateTimeFormat(lang, { weekday: "narrow" }).format(new Date(`${iso}T12:00:00`));

export default {
  meta: { id: "habits", category: "focus", size: "small", source: "src_extension", command: () => "habits --week" },
  defaults: { names: ["exercise", "read", "commit"], marks: {} },
  render(el, ctx) {
    const { t } = ctx;
    const lang = globalThis.navigator?.language;
    let s = ctx.settings;
    const grid = h("div", { class: "hab" });
    el.append(grid);
    let shownDay = null;

    function draw() {
      const now = new Date();
      shownDay = today(now);
      const days = weekColumns(now);
      const names = Array.isArray(s.names) ? s.names : [];
      if (!names.length) {
        grid.replaceChildren(h("span", { class: "dim", style: "grid-column:1/-1" }, t("habitsEmpty")));
        return;
      }
      grid.replaceChildren(
        h("span", {}),
        ...days.map((d) => h("span", { class: d === shownDay ? "y" : "dim", style: "text-align:center;font-size:11px" }, dayInitial(d, lang))),
        ...names.flatMap((n) => [
          h("span", {}, n),
          ...days.map((d) => {
            const on = !!s.marks?.[markKey(n, d)];
            return h("button", { type: "button", class: on ? "on" : null, "aria-pressed": String(on),
              "aria-label": t("habitsCell", n, d), "data-n": n, "data-d": d });
          }),
        ]));
    }

    grid.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-n]");
      if (!b) return;
      s = toggleMark(s, b.dataset.n, b.dataset.d);
      const on = !!s.marks[markKey(b.dataset.n, b.dataset.d)];
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
      ctx.save(s);
    });
    draw();
    // a new day (and on Monday a new week) while the tab stays open
    const id = setInterval(() => {
      if (today() !== shownDay) draw();
    }, 60000);
    return () => clearInterval(id);
  },
  settingsForm(settings, t) {
    const area = h("textarea", { class: "inp", rows: 6, "aria-label": t("habitsLabel") });
    area.value = (settings.names ?? []).join("\n");
    const form = h("form", { class: "form" },
      h("label", {}, t("habitsLabel"), area),
      h("div", { class: "acts" }, h("button", { type: "submit", class: "sbtn" }, t("save"))));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      form.dispatchEvent(new CustomEvent("save", { detail: { ...settings, names: parseHabitNames(area.value) } }));
    });
    return form;
  },
};
