import { h } from "../shell/dom.js";
import { workdayProgress } from "../lib/dates.js";

const DEF = { start: "09:00", end: "18:00", days: [1, 2, 3, 4, 5] };
const isTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const toMin = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));

/** Pure: coerce settings into a valid { start, end, days }. */
export function validateWorkday(s = {}) {
  let { start, end } = s;
  if (!isTime(start) || !isTime(end) || toMin(start) >= toMin(end)) ({ start, end } = DEF);
  const days = [...new Set((Array.isArray(s.days) ? s.days : []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))];
  return { start, end, days: days.length ? days : [...DEF.days] };
}

const fmtMin = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;

export default {
  meta: { id: "workday", category: "focus", size: "small", source: "src_computer", command: () => "workday" },
  defaults: DEF,
  render(el, ctx) {
    const cfg = validateWorkday(ctx.settings);
    const bar = h("i", {});
    const line = h("div", { class: "row" });
    const sub = h("div", { class: "dim" });
    el.append(line, h("div", { class: "bar", style: "margin:6px 0" }, bar), sub);
    const draw = () => {
      const p = workdayProgress(new Date(), cfg);
      const pct = Math.round(p.ratio * 100);
      bar.style.width = `${pct}%`;
      const label = { during: ctx.t("wdLeft", fmtMin(p.minutesLeft)), before: ctx.t("wdBefore", cfg.start),
        after: ctx.t("wdAfter"), off: ctx.t("wdOff") }[p.state];
      line.replaceChildren(h("span", { class: "tm y" }, `${pct}%`), h("span", { class: p.state === "during" ? "g" : "dim" }, label));
      sub.textContent = `${cfg.start} - ${cfg.end}`;
    };
    draw();
    const id = setInterval(draw, 30000);
    return () => clearInterval(id);
  },
  settingsForm(settings, t) {
    const cfg = validateWorkday(settings);
    const start = h("input", { class: "inp", type: "time", value: cfg.start });
    const end = h("input", { class: "inp", type: "time", value: cfg.end });
    const lang = globalThis.navigator?.language;
    const boxes = [1, 2, 3, 4, 5, 6, 0].map((d) => {
      const cb = h("input", { type: "checkbox", checked: cfg.days.includes(d) });
      return { d, cb, el: h("label", { class: "chk" }, cb,
        new Intl.DateTimeFormat(lang, { weekday: "short" }).format(new Date(2024, 0, 7 + d))) };
    });
    const form = h("form", { class: "form" },
      h("label", {}, t("wdStart"), start), h("label", {}, t("wdEnd"), end),
      h("div", {}, t("wdDays")), ...boxes.map((b) => b.el),
      h("div", { class: "acts" }, h("button", { type: "submit", class: "sbtn" }, t("save"))));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const next = validateWorkday({ start: start.value, end: end.value, days: boxes.filter((b) => b.cb.checked).map((b) => b.d) });
      form.dispatchEvent(new CustomEvent("save", { detail: { ...settings, ...next } }));
    });
    return form;
  },
};
