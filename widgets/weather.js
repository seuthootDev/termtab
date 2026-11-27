import { h } from "../shell/dom.js";
import { uiLanguage } from "../lib/i18n.js";
import { getJson, isObj, isNum, needNums, bad, noData } from "./net.js";

const FORECAST = "https://api.open-meteo.com/v1/forecast";
const GEOCODE = "https://geocoding-api.open-meteo.com/v1/search";

// WMO weather code → i18n key + symbol. First row whose max is >= the code wins.
const WMO = [
  [1, "wxClear", "☀"],
  [2, "wxPartly", "⛅"],
  [3, "wxCloudy", "☁"],
  [48, "wxFog", "🌫"],
  [67, "wxRain", "🌧"],
  [77, "wxSnow", "❄"],
  [82, "wxRain", "🌧"],
  [86, "wxSnow", "❄"],
  [99, "wxStorm", "⛈"],
];

/** Pure: { key, sym } for a WMO code (unknown codes read as cloudy). */
export function wmo(code) {
  const row = WMO.find(([max]) => code <= max) ?? WMO[2];
  return { key: row[1], sym: row[2] };
}

export function buildUrl(s) {
  const unit = s.unit === "f" ? "&temperature_unit=fahrenheit" : "";
  return `${FORECAST}?latitude=${s.lat}&longitude=${s.lon}` +
    "&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m" +
    "&hourly=temperature_2m&daily=temperature_2m_max,temperature_2m_min,weather_code" +
    `&timezone=auto&forecast_days=2${unit}`;
}

export const geocodeUrl = (q, lang) =>
  `${GEOCODE}?name=${encodeURIComponent(q)}&count=5&language=${encodeURIComponent(lang)}`;

const SPARK = "▁▂▃▄▅▆▇█";
export function sparkline(values) {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return values.map((v) => SPARK[hi === lo ? 3 : Math.round(((v - lo) / (hi - lo)) * 7)]).join("");
}

const deg = (n) => `${Math.round(n)}°`;

export default {
  meta: { id: "weather", category: "info", size: "small", source: "src_openMeteo",
    command: (s) => `weather ${String(s?.city ?? "seoul").toLowerCase()}` },
  defaults: { city: "Seoul", lat: 37.57, lon: 126.98, unit: "c" },
  ttlMs: 30 * 60 * 1000,
  fetch: (settings) => getJson(buildUrl(settings)),
  parse(raw) {
    if (!isObj(raw) || !isObj(raw.current) || !isObj(raw.hourly) || !isObj(raw.daily)) throw bad("weather");
    const { current: c, hourly, daily } = raw;
    if (!Array.isArray(hourly.time) || !Array.isArray(hourly.temperature_2m)) throw bad("weather");
    if (typeof c.time !== "string") throw bad("weather");
    const at = hourly.time.findIndex((t) => t.startsWith(c.time.slice(0, 13)));
    const next12 = at < 0 ? [] : hourly.temperature_2m.slice(at, at + 12);
    if (next12.length !== 12) throw bad("weather");
    const { temperature_2m_max: hi, temperature_2m_min: lo, weather_code: code } = daily;
    if (![hi, lo, code].every((a) => Array.isArray(a) && a.length >= 2)) throw bad("weather");
    const out = {
      temp: c.temperature_2m, code: c.weather_code, wind: c.wind_speed_10m, humidity: c.relative_humidity_2m,
      hi: hi[0], lo: lo[0], next12, tomorrow: { code: code[1], hi: hi[1], lo: lo[1] },
    };
    needNums("weather", out.temp, out.code, out.wind, out.humidity, out.hi, out.lo, ...next12,
      out.tomorrow.code, out.tomorrow.hi, out.tomorrow.lo);
    return out;
  },
  render(el, ctx) {
    const { t, data: d } = ctx;
    if (noData(el, ctx)) return;
    const w = wmo(d.code);
    const tm = wmo(d.tomorrow.code);
    el.append(
      h("div", { class: "row" },
        h("span", { class: "tm b" }, `${Math.round(d.temp)}°${ctx.settings.unit === "f" ? "F" : "C"}`),
        h("span", {}, `${t(w.key)} ${w.sym}`)),
      h("div", { class: "dim" }, t("wxHi"), " ", h("span", { class: "r" }, deg(d.hi)), " · ", t("wxLo"), " ",
        h("span", { class: "b" }, deg(d.lo)), " · ", t("wxWind"), ` ${Math.round(d.wind)} km/h · `,
        t("wxHumidity"), ` ${Math.round(d.humidity)}%`),
      h("div", { style: "margin-top:6px" }, h("span", { class: "y" }, sparkline(d.next12)), " ",
        h("span", { class: "dim" }, t("wxNext12"))),
      h("div", { class: "dim", style: "font-size:11.5px" },
        `${t("wxTomorrow")}: ${t(tm.key)}, ${deg(d.tomorrow.lo)} / ${deg(d.tomorrow.hi)}`));
  },
  settingsForm(settings, t) {
    const city = h("input", { class: "inp", type: "text", "aria-label": t("wxCity") });
    city.value = settings.city ?? "";
    const unit = h("select", { class: "inp", "aria-label": t("wxUnit") },
      h("option", { value: "c" }, "°C"), h("option", { value: "f" }, "°F"));
    unit.value = settings.unit === "f" ? "f" : "c";
    const results = h("ul", {});
    const msg = h("div", { class: "dim", role: "status" });
    const form = h("form", { class: "form" },
      h("label", {}, t("wxCity"), city), h("label", {}, t("wxUnit"), unit), msg, results,
      h("div", { class: "acts" },
        // keeps the current place and applies only the unit
        h("button", { type: "button", class: "sbtn", onclick: () => settings.lat != null && done({ name: settings.city, latitude: settings.lat, longitude: settings.lon }) }, t("save")),
        h("button", { type: "submit", class: "sbtn" }, t("wxSearch"))));
    const done = (place) => form.dispatchEvent(new CustomEvent("save", {
      detail: { ...settings, city: place.name, lat: place.latitude, lon: place.longitude, unit: unit.value },
    }));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const q = city.value.trim();
      if (!q) return;
      msg.textContent = t("loading");
      results.replaceChildren();
      try {
        const res = await getJson(geocodeUrl(q, uiLanguage().split("-")[0]));
        const found = (Array.isArray(res?.results) ? res.results : []).filter((p) => p && isNum(p.latitude) && isNum(p.longitude)).slice(0, 5);
        msg.textContent = found.length ? "" : t("wxNoResults");
        results.replaceChildren(...found.map((p) => h("li", {},
          h("button", { type: "button", class: "sbtn", onclick: () => done(p) },
            [p.name, p.admin1, p.country].filter(Boolean).join(", ")))));
      } catch {
        msg.textContent = t("wxSearchFailed");
      }
    });
    return form;
  },
};
