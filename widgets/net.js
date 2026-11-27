// Shared bits of the online widgets: JSON fetch, parse guards, safe links.
import { h } from "../shell/dom.js";
import { isSafeUrl } from "./links.js";

/** GET a public JSON API: no credentials, throws Error("http <status>") on a non-2xx answer. */
export async function getJson(url) {
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) throw new Error("http " + res.status);
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

export const loadingLine = (t) => h("span", { class: "dim" }, t("loading"));

export const nf = (lang, opts) => {
  try {
    return new Intl.NumberFormat(lang, opts);
  } catch {
    return new Intl.NumberFormat("en", opts);
  }
};
