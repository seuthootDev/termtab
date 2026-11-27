import { h } from "../shell/dom.js";
import { monthGrid } from "../lib/dates.js";

/** Pure: cells of the month grid, Monday first. */
export function calendarCells(now) {
  return monthGrid(now.getFullYear(), now.getMonth()).map((day) =>
    ({ day, today: day === now.getDate() }));
}

export default {
  meta: { id: "calendar", category: "info", size: "small", source: "src_computer", command: () => "cal" },
  defaults: {},
  render(el) {
    const lang = globalThis.navigator?.language;
    const fmt = (o, d) => new Intl.DateTimeFormat(lang, o).format(d);
    let day = "";
    const draw = () => {
      const now = new Date();
      day = now.toDateString();
      // 2024-01-01 was a Monday
      const heads = Array.from({ length: 7 }, (_, i) =>
        h("span", { class: "h" }, fmt({ weekday: "narrow" }, new Date(2024, 0, 1 + i))));
      const cells = calendarCells(now).map((c) =>
        h("span", { class: c.today ? "td" : "" }, c.day ? String(c.day) : ""));
      el.replaceChildren(
        h("div", { class: "row" }, h("span", { class: "y" }, fmt({ month: "long", year: "numeric" }, now))),
        h("div", { class: "cal" }, ...heads, ...cells),
      );
    };
    draw();
    // a tab left open past midnight moves the highlight (and maybe the month) to the new day
    const id = setInterval(() => {
      if (new Date().toDateString() !== day) draw();
    }, 60_000);
    return () => clearInterval(id);
  },
};
