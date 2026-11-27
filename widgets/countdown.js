import { h } from "../shell/dom.js";
import { daysUntil } from "../lib/dates.js";

export const countdownLabel = (days) => (days >= 0 ? `D-${days}` : `D+${-days}`);

const validDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));

export default {
  meta: { id: "countdown", category: "focus", size: "small", source: "src_extension", command: () => "countdown" },
  defaults: { name: "New Year", date: `${new Date().getFullYear() + 1}-01-01` },
  render(el, ctx) {
    const { name, date } = ctx.settings;
    const big = h("div", { class: "tm y" });
    el.append(h("div", { class: "row" }, h("span", {}, name), h("span", { class: "dim" }, date)), big);
    const draw = () => {
      big.textContent = validDate(date) ? countdownLabel(daysUntil(date, new Date())) : "--";
    };
    draw();
    const id = setInterval(draw, 60000);
    return () => clearInterval(id);
  },
  settingsForm(settings, t) {
    const name = h("input", { class: "inp", type: "text", value: settings.name ?? "", maxlength: 60 });
    const date = h("input", { class: "inp", type: "date", value: settings.date ?? "" });
    const form = h("form", { class: "form" },
      h("label", {}, t("countdownName"), name), h("label", {}, t("countdownDate"), date),
      h("div", { class: "acts" }, h("button", { type: "submit", class: "sbtn" }, t("save"))));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!validDate(date.value)) return;
      form.dispatchEvent(new CustomEvent("save", { detail: { ...settings, name: name.value.trim() || date.value, date: date.value } }));
    });
    return form;
  },
};
