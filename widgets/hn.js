import { h } from "../shell/dom.js";
import { getJson, isObj, isNum, bad, link, noData } from "./net.js";

const API = "https://hacker-news.firebaseio.com/v0";
const MAX = 10;
const count = (s) => Math.min(MAX, Math.max(1, Math.round(Number(s?.count)) || 6));

export const buildUrl = () => `${API}/topstories.json`;
export const itemUrl = (id) => `${API}/item/${id}.json`;

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

export default {
  meta: { id: "hn", category: "news", size: "wide", source: "src_hn", command: (s) => `hn top ${s?.count ?? 6}` },
  defaults: { count: 6 },
  ttlMs: 15 * 60 * 1000,
  async fetch(settings) {
    const all = await getJson(buildUrl());
    if (!Array.isArray(all)) throw bad("hn");
    const ids = all.slice(0, count(settings));
    // one failing story is skipped; all of them failing fails the fetch
    const res = await Promise.allSettled(ids.map((id) => getJson(itemUrl(id))));
    if (res.length && res.every((r) => r.status === "rejected")) throw res[0].reason;
    return { ids, items: res.map((r) => (r.status === "fulfilled" ? r.value : null)) };
  },
  parse(raw) {
    if (!isObj(raw) || !Array.isArray(raw.items)) throw bad("hn");
    const stories = raw.items
      .filter((i) => isObj(i) && isNum(i.id) && typeof i.title === "string" && !i.dead && !i.deleted)
      .map((i) => {
        const url = typeof i.url === "string" && i.url ? i.url : `https://news.ycombinator.com/item?id=${i.id}`;
        return {
          id: i.id, title: i.title, url, host: hostOf(url),
          score: isNum(i.score) ? i.score : 0, comments: isNum(i.descendants) ? i.descendants : 0,
        };
      });
    if (!stories.length) throw bad("hn");
    return stories;
  },
  render(el, ctx) {
    const { t, data } = ctx;
    if (noData(el, ctx)) return;
    el.append(h("ol", {}, ...data.map((s, i) => h("li", { class: "row" },
      h("span", {}, h("span", { class: "dim" }, `${String(i + 1).padStart(2, "0")}. `), link(s.url, s.title),
        " ", h("span", { class: "dim" }, `(${s.host})`)),
      h("span", { class: "num dim", style: "white-space:nowrap;flex:none" }, `${s.score}▲ ${s.comments}c`)))));
  },
  settingsForm(settings, t) {
    const n = h("input", { class: "inp", type: "number", min: 1, max: MAX, "aria-label": t("hnCount") });
    n.value = String(count(settings));
    const form = h("form", { class: "form" }, h("label", {}, t("hnCount"), n),
      h("div", { class: "acts" }, h("button", { type: "submit", class: "sbtn" }, t("save"))));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      form.dispatchEvent(new CustomEvent("save", { detail: { ...settings, count: count({ count: n.value }) } }));
    });
    return form;
  },
};
