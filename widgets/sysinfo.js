import { h } from "../shell/dom.js";

const openedAt = Date.now();

export function osName(nav = {}) {
  const p = nav.userAgentData?.platform;
  if (p) return p;
  const ua = nav.userAgent ?? "";
  return /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /CrOS/.test(ua) ? "ChromeOS"
    : /Mac/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "-";
}

export function browserName(nav = {}) {
  const ua = nav.userAgent ?? "";
  return /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : "Browser";
}

/** Tab count or null when unavailable. Works without the "tabs" permission (urls are just hidden). */
export async function countTabs(queryTabs) {
  try {
    const tabs = await queryTabs();
    return Array.isArray(tabs) ? tabs.length : null;
  } catch {
    return null;
  }
}

const defaultQuery = () =>
  (globalThis.chrome?.tabs?.query ? globalThis.chrome.tabs.query({}) : Promise.reject(new Error("no chrome")));

const LOGO = "  _  _\n | \\| |\n | .` |\n |_|\\_|";

export function createSysinfo({ queryTabs = defaultQuery } = {}) {
  return {
    meta: { id: "sysinfo", category: "fun", size: "small", source: "src_computer", command: () => "neofetch" },
    defaults: {},
    render(el, ctx) {
      const nav = globalThis.navigator ?? {};
      const list = h("ul", {});
      const tabsVal = h("span", {}, "...");
      const upVal = h("span", {});
      const row = (k, v) => h("li", {}, h("span", { class: "y" }, `${k}`.padEnd(8)), v);
      const scr = globalThis.screen;
      list.append(
        h("li", {}, h("span", { class: "g" }, ctx.prefs.user), "@", h("span", { class: "g" }, ctx.prefs.machine)),
        row(ctx.t("siOs"), osName(nav)),
        row(ctx.t("siBrowser"), browserName(nav)),
        row(ctx.t("siLang"), nav.language ?? "-"),
        row(ctx.t("siScreen"), scr ? `${scr.width}×${scr.height}` : "-"),
        row(ctx.t("siCores"), String(nav.hardwareConcurrency || "-")),
        row(ctx.t("siTabs"), tabsVal),
        row(ctx.t("siUptime"), upVal));
      const drawUp = () => {
        const s = Math.floor((Date.now() - openedAt) / 1000);
        upVal.textContent = ctx.t("siUptimeVal", Math.floor(s / 60), s % 60);
      };
      drawUp();
      let alive = true;
      countTabs(queryTabs).then((n) => { if (alive) tabsVal.textContent = n == null ? "-" : String(n); });
      el.append(h("div", { style: "display:flex;gap:14px" }, h("pre", { class: "g", style: "margin:0;line-height:1.2" }, LOGO), list));
      const id = setInterval(drawUp, 1000);
      return () => { alive = false; clearInterval(id); };
    },
  };
}

export default createSysinfo();
