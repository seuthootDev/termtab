import { h } from "../shell/dom.js";
import { getJson, isObj, isNum, bad, link, noData } from "./net.js";

// Wikipedia editions that serve the onthisday feed (ko has none: 404; ja is served but often rate limited).
export const SUPPORTED = ["en", "de", "fr", "es", "pt", "ru", "sv", "it", "ar", "uk", "zh", "ja"];

/** An explicit language is kept; "auto" follows the browser UI language when Wikimedia serves it, else en. */
export function resolveLang(lang) {
  if (lang && lang !== "auto") return SUPPORTED.includes(lang) ? lang : "en";
  const ui = globalThis.chrome?.i18n?.getUILanguage?.() ?? "";
  const base = String(ui).toLowerCase().split(/[-_]/)[0];
  return SUPPORTED.includes(base) ? base : "en";
}

const pad = (n) => String(n).padStart(2, "0");

/** Today's local MM/DD in the chosen language edition. */
export function buildUrl(s, now = new Date(), lang = resolveLang(s?.lang)) {
  return `https://api.wikimedia.org/feed/v1/wikipedia/${lang}/onthisday/events/${pad(now.getMonth() + 1)}/${pad(now.getDate())}`;
}

export default {
  meta: { id: "wiki", category: "news", size: "small", source: "src_wikimedia", command: () => "wiki onthisday" },
  defaults: { lang: "auto" },
  ttlMs: 24 * 60 * 60 * 1000,
  // The feed is per local MM/DD: a new day needs a new cache entry, not yesterday's (24 h TTL).
  cacheKey: (_settings, now = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
  async fetch(settings, now = new Date()) {
    const lang = resolveLang(settings?.lang);
    try {
      return await getJson(buildUrl(settings, now, lang));
    } catch (err) {
      if (lang === "en" || err?.status !== 404) throw err;
      return getJson(buildUrl(settings, now, "en")); // this edition has no feed: fall back to English
    }
  },
  parse(raw) {
    if (!isObj(raw) || !Array.isArray(raw.events)) throw bad("wiki");
    const events = raw.events.filter((e) => isObj(e) && isNum(e.year) && typeof e.text === "string").slice(0, 3).map((e) => {
      const url = e.pages?.[0]?.content_urls?.desktop?.page;
      return typeof url === "string" ? { year: e.year, text: e.text, url } : { year: e.year, text: e.text };
    });
    if (!events.length) throw bad("wiki");
    return events;
  },
  render(el, ctx) {
    const { t, data } = ctx;
    if (noData(el, ctx)) return;
    el.append(h("ul", {}, ...data.map((e) => h("li", {}, h("span", { class: "y" }, String(e.year)), " ", link(e.url, e.text)))));
  },
  settingsForm(settings, t) {
    const lang = h("select", { class: "inp", "aria-label": t("wikiLang") },
      h("option", { value: "auto" }, t("wikiAuto")), h("option", { value: "en" }, "English"), h("option", { value: "de" }, "Deutsch"), h("option", { value: "fr" }, "Français"), h("option", { value: "es" }, "Español"));
    lang.value = ["en", "de", "fr", "es"].includes(settings.lang) ? settings.lang : "auto";
    const form = h("form", { class: "form" }, h("label", {}, t("wikiLang"), lang),
      h("div", { class: "acts" }, h("button", { type: "submit", class: "sbtn" }, t("save"))));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      form.dispatchEvent(new CustomEvent("save", { detail: { ...settings, lang: lang.value } }));
    });
    return form;
  },
};
