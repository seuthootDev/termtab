import { h } from "../shell/dom.js";
import { getJson, isObj, isNum, bad, link, noData } from "./net.js";

export const buildUrl = () => "https://dev.to/api/articles?top=7&per_page=5";

export default {
  meta: { id: "devto", category: "news", size: "small", source: "src_devto", command: () => "devto --top week" },
  defaults: {},
  ttlMs: 60 * 60 * 1000,
  fetch: () => getJson(buildUrl()),
  parse(raw) {
    if (!Array.isArray(raw)) throw bad("devto");
    const list = raw.filter((a) => isObj(a) && typeof a.title === "string" && typeof a.url === "string").map((a) => ({
      title: a.title, url: a.url,
      reactions: isNum(a.public_reactions_count) ? a.public_reactions_count : 0,
    }));
    if (!list.length) throw bad("devto");
    return list;
  },
  render(el, ctx) {
    const { t, data } = ctx;
    if (noData(el, ctx)) return;
    el.append(h("ol", {}, ...data.map((a) => h("li", { class: "row" },
      h("span", {}, link(a.url, a.title)), h("span", { class: "num dim" }, `♥${a.reactions}`)))));
  },
};
