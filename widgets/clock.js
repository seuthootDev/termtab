import { h } from "../shell/dom.js";
import { isoWeek } from "../lib/dates.js";

const pad = (n) => String(n).padStart(2, "0");

/** Pure: pieces of the big clock. hm = "14:07" or "2:07 PM", sec = "09". */
export function formatClock(date, clock24, lang) {
  const hm = clock24
    ? `${pad(date.getHours())}:${pad(date.getMinutes())}`
    : new Intl.DateTimeFormat(lang, { hour: "numeric", minute: "2-digit", hour12: true }).format(date);
  return {
    hm,
    sec: pad(date.getSeconds()),
    date: new Intl.DateTimeFormat(lang, { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(date),
    week: isoWeek(date),
  };
}

export default {
  meta: { id: "clock", category: "basics", size: "small", source: "src_computer", command: () => "date", usesPrefs: true },
  defaults: {},
  render(el, ctx) {
    const lang = globalThis.navigator?.language;
    const big = h("div", { class: "big" });
    const dateEl = h("div", {});
    const weekEl = h("div", { class: "dim" });
    el.append(big, dateEl, weekEl);
    const draw = () => {
      const c = formatClock(new Date(), ctx.prefs.clock24, lang);
      big.replaceChildren(c.hm, h("span", { class: "s" }, `:${c.sec}`));
      dateEl.replaceChildren(h("span", { class: "y" }, c.date));
      weekEl.textContent = ctx.t("clockWeek", c.week);
    };
    draw();
    const id = setInterval(draw, 1000);
    return () => clearInterval(id);
  },
};
