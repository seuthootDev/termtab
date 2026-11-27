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

// ?demo=1 (store screenshots): the same machine everywhere, whatever runs the capture.
const DEMO_FACTS = { os: "macOS", browser: "Chrome", screen: "2560×1600", cores: "10", tabs: 12 };

/** Pure: the values shown. tabs is a number in demo mode, otherwise null (counted async). */
export function sysFacts({ nav = {}, scr, demo = false } = {}) {
  const lang = nav.language ?? "-";
  if (demo) return { ...DEMO_FACTS, lang };
  return {
    os: osName(nav), browser: browserName(nav), lang,
    screen: scr ? `${scr.width}×${scr.height}` : "-",
    cores: String(nav.hardwareConcurrency || "-"), tabs: null,
  };
}

// The labels are padEnd()-ed; without pre the padding collapses and the values don't line up.
export const SYS_LABEL_STYLE = "white-space:pre";

const LOGO = "  _  _\n | \\| |\n | .` |\n |_|\\_|";

export function createSysinfo({ queryTabs = defaultQuery } = {}) {
  return {
    meta: { id: "sysinfo", category: "fun", size: "small", source: "src_computer", command: () => "neofetch", usesPrefs: true },
    defaults: {},
    render(el, ctx) {
      const f = sysFacts({ nav: globalThis.navigator ?? {}, scr: globalThis.screen, demo: !!ctx.demo });
      const list = h("ul", {});
      const tabsVal = h("span", {}, f.tabs == null ? "..." : String(f.tabs));
      const upVal = h("span", {});
      const row = (k, v) => h("li", {}, h("span", { class: "y", style: SYS_LABEL_STYLE }, `${k}`.padEnd(8)), v);
      list.append(
        h("li", {}, h("span", { class: "g" }, ctx.prefs.user), "@", h("span", { class: "g" }, ctx.prefs.machine)),
        row(ctx.t("siOs"), f.os),
        row(ctx.t("siBrowser"), f.browser),
        row(ctx.t("siLang"), f.lang),
        row(ctx.t("siScreen"), f.screen),
        row(ctx.t("siCores"), f.cores),
        row(ctx.t("siTabs"), tabsVal),
        row(ctx.t("siUptime"), upVal));
      const drawUp = () => {
        const s = Math.floor((Date.now() - openedAt) / 1000);
        upVal.textContent = ctx.t("siUptimeVal", Math.floor(s / 60), s % 60);
      };
      drawUp();
      let alive = true;
      if (f.tabs == null) countTabs(queryTabs).then((n) => { if (alive) tabsVal.textContent = n == null ? "-" : String(n); });
      el.append(h("div", { style: "display:flex;gap:14px" }, h("pre", { class: "g", style: "margin:0;line-height:1.2" }, LOGO), list));
      const id = setInterval(drawUp, 1000);
      return () => { alive = false; clearInterval(id); };
    },
  };
}

export default createSysinfo();
