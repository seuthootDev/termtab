import { h } from "../shell/dom.js";

export const DEFAULT_ZONES = ["Asia/Seoul", "America/Los_Angeles", "America/New_York", "Europe/London", "Europe/Berlin"];

export const zoneLabel = (tz) => String(tz).split("/").pop().replace(/_/g, " ");

/** Pure: { time, working, hour } for an instant in a zone, or null for an unknown zone. working = 09:00-17:59. */
export function formatZone(date, tz, clock24) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).formatToParts(date);
    const hour = Number(parts.find((p) => p.type === "hour").value) % 24;
    const time = clock24
      ? new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(date)
      : new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(date);
    return { time, working: hour >= 9 && hour < 18, hour };
  } catch {
    return null;
  }
}

const isZone = (tz) => !!formatZone(new Date(0), tz, true);

export default {
  meta: { id: "world", category: "info", size: "small", source: "src_computer", command: () => "tz --list" },
  defaults: { zones: DEFAULT_ZONES },
  render(el, ctx) {
    const list = h("ul", {});
    el.append(list);
    const draw = () => {
      const now = new Date();
      list.replaceChildren(...(ctx.settings.zones ?? []).map((tz) => {
        const f = formatZone(now, tz, ctx.prefs.clock24);
        return f && h("li", { class: "row" }, h("span", {}, zoneLabel(tz)),
          h("span", { class: `num ${f.working ? "g" : "dim"}` }, f.time));
      }));
    };
    draw();
    const id = setInterval(draw, 1000);
    return () => clearInterval(id);
  },
  settingsForm(settings, t) {
    const area = h("textarea", { class: "inp", rows: 6, "aria-label": t("worldLabel") });
    area.value = (settings.zones ?? []).join("\n");
    const msg = h("div", { class: "r", role: "alert" });
    const form = h("form", { class: "form" },
      h("label", {}, t("worldLabel"), area), msg,
      h("div", { class: "acts" }, h("button", { type: "submit", class: "sbtn" }, t("save"))));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const zones = area.value.split("\n").map((z) => z.trim()).filter(Boolean);
      const bad = zones.find((z) => !isZone(z));
      if (bad) {
        msg.textContent = t("worldBad", bad);
        return;
      }
      form.dispatchEvent(new CustomEvent("save", { detail: { ...settings, zones } }));
    });
    return form;
  },
};
