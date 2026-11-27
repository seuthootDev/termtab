import { h } from "../shell/dom.js";
import { getJson, isObj, isNum, bad, link, loadingLine } from "./net.js";

const day = (d) => d.toISOString().slice(0, 10);

/** Repos created in the last 7 days (UTC date), most starred first. */
export function buildUrl(_settings, now = new Date()) {
  const since = day(new Date(now.getTime() - 7 * 864e5));
  return `https://api.github.com/search/repositories?q=created:>${since}&sort=stars&order=desc&per_page=5`;
}

const short = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));

export default {
  meta: { id: "trending", category: "news", size: "small", source: "src_github", command: () => "gh trending --week" },
  defaults: {},
  ttlMs: 6 * 60 * 60 * 1000,
  fetch: (settings) => getJson(buildUrl(settings)),
  parse(raw) {
    if (!isObj(raw) || !Array.isArray(raw.items)) throw bad("trending");
    const list = raw.items.filter((r) => isObj(r) && typeof r.full_name === "string" && isNum(r.stargazers_count)).map((r) => ({
      name: r.full_name,
      desc: typeof r.description === "string" ? r.description : "",
      stars: r.stargazers_count,
      lang: typeof r.language === "string" ? r.language : "",
      url: typeof r.html_url === "string" ? r.html_url : `https://github.com/${r.full_name}`,
    }));
    if (!list.length) throw bad("trending");
    return list;
  },
  render(el, ctx) {
    const { t, data } = ctx;
    if (!data) return void el.append(loadingLine(t));
    el.append(h("ul", {}, ...data.map((r) => h("li", { class: "row", title: r.desc || null },
      h("span", {}, link(r.url, r.name), " ", h("span", { class: "dim" }, r.lang)),
      h("span", { class: "num y" }, `★${short(r.stars)}`)))));
  },
};
