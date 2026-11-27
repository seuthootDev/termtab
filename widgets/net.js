// Shared bits of the online widgets: JSON fetch, parse guards, safe links.
import { h } from "../shell/dom.js";
import { isSafeUrl } from "./links.js";

/** GET a public JSON API: no credentials, throws Error("http <status>") on a non-2xx answer. */
export async function getJson(url) {
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) throw Object.assign(new Error("http " + res.status), { status: res.status });
  return res.json();
}

export const isNum = (v) => typeof v === "number" && Number.isFinite(v);
export const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Throws a parse Error unless every value is a finite number. */
export function needNums(what, ...vals) {
  if (!vals.every(isNum)) throw new Error(`bad ${what} data`);
}

export const bad = (what) => new Error(`bad ${what} data`);

/** An http(s) link that opens in the same tab, or plain text for any other url. Text only, never HTML. */
export function link(url, text, props = {}) {
  return isSafeUrl(url)
    ? h("a", { href: url, rel: "noopener noreferrer", ...props }, text)
    : h("span", props, text);
}

/** True (and draws a dim "loading…" line) while there is no data yet. Nothing is drawn when the fetch
 *  failed: the shell already prints "fetch failed · retry" then. */
export function noData(el, ctx) {
  if (ctx.data) return false;
  if (!ctx.error) el.append(h("span", { class: "dim" }, ctx.t("loading")));
  return true;
}

export const nf = (lang, opts) => {
  try {
    return new Intl.NumberFormat(lang, opts);
  } catch {
    return new Intl.NumberFormat("en", opts);
  }
};
