import { h } from "../shell/dom.js";
import { uiLanguage } from "../lib/i18n.js";
import { getJson, isObj, isNum, bad, nf, loadingLine } from "./net.js";

const API = "https://api.coingecko.com/api/v3/simple/price";
const TICKER = { bitcoin: "BTC", ethereum: "ETH", solana: "SOL", dogecoin: "DOGE", ripple: "XRP", cardano: "ADA", litecoin: "LTC", tether: "USDT" };
const ids = (s) => (Array.isArray(s.coins) ? s.coins : []).map((c) => String(c).trim().toLowerCase()).filter((c) => /^[a-z0-9-]+$/.test(c));
const vsOf = (s) => (/^[a-z]{3,5}$/i.test(s.vs ?? "") ? s.vs.toLowerCase() : "usd");

export function buildUrl(s) {
  return `${API}?ids=${ids(s).join(",")}&vs_currencies=${vsOf(s)}&include_24hr_change=true`;
}

/** Pure: "$96,410" style price for any magnitude (small coins keep more digits). */
export function formatPrice(price, vs, lang) {
  const digits = price >= 100 ? 0 : price >= 1 ? 2 : 4;
  const opts = { maximumFractionDigits: digits, minimumFractionDigits: price >= 1 && price < 100 ? 2 : 0 };
  try {
    return nf(lang, { style: "currency", currency: vs.toUpperCase(), ...opts }).format(price);
  } catch {
    return `${nf(lang, opts).format(price)} ${vs.toUpperCase()}`;
  }
}

export default {
  meta: { id: "crypto", category: "info", size: "small", source: "src_coingecko", command: () => "coins" },
  defaults: { coins: ["bitcoin", "ethereum", "solana", "dogecoin"], vs: "usd" },
  ttlMs: 5 * 60 * 1000,
  fetch: (settings) => getJson(buildUrl(settings)),
  parse(raw) {
    if (!isObj(raw)) throw bad("crypto");
    let vs = null;
    const coins = Object.entries(raw).map(([id, v]) => {
      if (!isObj(v)) throw bad("crypto");
      const priceKey = Object.keys(v).find((k) => !k.endsWith("_24h_change"));
      if (!priceKey || !isNum(v[priceKey])) throw bad("crypto");
      vs = priceKey;
      const change = v[`${priceKey}_24h_change`];
      return { id, price: v[priceKey], change: isNum(change) ? change : 0 };
    });
    if (!coins.length) throw bad("crypto");
    return { vs, coins };
  },
  render(el, ctx) {
    const { t, data: d } = ctx;
    if (!d) return void el.append(loadingLine(t));
    const lang = uiLanguage();
    const order = ids(ctx.settings);
    const coins = [...d.coins].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    el.append(h("ul", {}, ...coins.map((c) => h("li", { class: "row" },
      h("span", { class: "y" }, TICKER[c.id] ?? c.id.toUpperCase()),
      h("span", { class: "num" }, formatPrice(c.price, d.vs, lang), " ",
        h("span", { class: c.change >= 0 ? "g" : "r" },
          `${c.change >= 0 ? "+" : ""}${c.change.toFixed(1)}%`))))));
  },
  settingsForm(settings, t) {
    const coins = h("input", { class: "inp", type: "text", "aria-label": t("cryptoCoins") });
    coins.value = (settings.coins ?? []).join(", ");
    const vs = h("input", { class: "inp", type: "text", maxlength: 5, "aria-label": t("cryptoVs") });
    vs.value = settings.vs ?? "usd";
    const msg = h("div", { class: "r", role: "alert" });
    const form = h("form", { class: "form" },
      h("label", {}, t("cryptoCoins"), coins), h("label", {}, t("cryptoVs"), vs), msg,
      h("div", { class: "acts" }, h("button", { type: "submit", class: "sbtn" }, t("save"))));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const next = { ...settings, coins: coins.value.split(/[\s,]+/).filter(Boolean), vs: vs.value.trim() };
      if (!ids(next).length || ids(next).length !== next.coins.length || !/^[a-z]{3,5}$/i.test(next.vs)) {
        msg.textContent = t("cryptoBad");
        return;
      }
      form.dispatchEvent(new CustomEvent("save", { detail: { ...next, coins: ids(next).slice(0, 10), vs: vsOf(next) } }));
    });
    return form;
  },
};
