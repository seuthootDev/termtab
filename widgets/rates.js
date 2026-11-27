import { h } from "../shell/dom.js";
import { uiLanguage } from "../lib/i18n.js";
import { getJson, isObj, isNum, bad, nf, noData } from "./net.js";
import { CURRENCIES } from "./currencies.js";

// One request per target in parallel: `/latest?from=<target>&to=<base>` gives "1 <target> = x <base>" directly.
const API = "https://api.frankfurter.dev/v1/latest";
const code = (c) => String(c).trim().toUpperCase();
const isCode = (c) => /^[A-Z]{3}$/.test(c);
const round = (n) => Math.round(n * 1e6) / 1e6;

const targetsOf = (s) => {
  const base = code(s.base ?? "KRW");
  return { base, targets: (Array.isArray(s.targets) ? s.targets : []).map(code).filter((c) => isCode(c) && c !== base) };
};

/** One URL per target currency. */
export function buildUrl(s) {
  const { base, targets } = targetsOf(s);
  return targets.map((c) => `${API}?from=${c}&to=${base}`);
}

/** Pure: check the settings form input. Targets are de-duplicated and the base is dropped from them;
 *  every code must be one Frankfurter serves. */
export function validateRates(baseText, targetsText) {
  const base = code(baseText);
  const targets = [...new Set(String(targetsText).split(/[\s,]+/).filter(Boolean).map(code))].filter((c) => c !== base);
  if (!isCode(base) || !targets.length || !targets.every(isCode)) return { ok: false, error: "format" };
  const unsupported = [base, ...targets].filter((c) => !CURRENCIES.includes(c));
  if (unsupported.length) return { ok: false, error: "unsupported", codes: unsupported };
  return { ok: true, base, targets };
}

/** Pure: "1 USD = 1,380 KRW" (JPY rows read per 100); a failed row reads "1 XAU = n/a". */
export function rateText(row, base, lang, t) {
  if (row.failed) return `${row.per} ${row.code} = ${t ? t("rateNA") : "n/a"}`;
  const digits = row.value >= 100 ? 0 : row.value >= 1 ? 2 : 4;
  return `${row.per} ${row.code} = ${nf(lang, { maximumFractionDigits: digits }).format(row.value)} ${base}`;
}

export default {
  meta: { id: "rates", category: "info", size: "small", source: "src_frankfurter",
    command: (s) => `fx ${code(s?.base ?? "KRW")}` },
  defaults: { base: "KRW", targets: ["USD", "JPY", "EUR", "CNY"] },
  ttlMs: 6 * 60 * 60 * 1000,
  // One failing currency must not fail the others: its slot becomes { failed: "<code>" }.
  async fetch(settings) {
    const { targets } = targetsOf(settings);
    const res = await Promise.allSettled(buildUrl(settings).map(getJson));
    if (res.length && res.every((r) => r.status === "rejected")) throw res[0].reason;
    return res.map((r, i) => (r.status === "fulfilled" ? r.value : { failed: targets[i] }));
  },
  parse(raw) {
    if (!Array.isArray(raw) || !raw.length) throw bad("rates");
    let base = null;
    const rows = raw.map((r) => {
      if (isObj(r) && typeof r.failed === "string") return { code: r.failed, per: r.failed === "JPY" ? 100 : 1, value: null, failed: true };
      if (!isObj(r) || typeof r.base !== "string" || !isObj(r.rates)) throw bad("rates");
      const [quote, value] = Object.entries(r.rates)[0] ?? [];
      if (!isNum(value) || (base && base !== quote)) throw bad("rates");
      base = quote;
      const per = r.base === "JPY" ? 100 : 1;
      return { code: r.base, per, value: round(value * per) };
    });
    if (!base) throw bad("rates"); // every row failed
    const dated = raw.find((r) => typeof r?.date === "string");
    return { base, rows, date: dated ? dated.date : "" };
  },
  render(el, ctx) {
    const { t, data: d } = ctx;
    if (noData(el, ctx)) return;
    const lang = uiLanguage();
    el.append(
      h("ul", {}, ...d.rows.map((r) => h("li", { class: "row" }, h("span", r.failed ? { class: "dim" } : {}, rateText(r, d.base, lang, t))))),
      h("div", { class: "dim", style: "font-size:11.5px" }, t("ratesNote")));
  },
  settingsForm(settings, t) {
    const base = h("input", { class: "inp", type: "text", maxlength: 3, "aria-label": t("ratesBase") });
    base.value = settings.base ?? "KRW";
    const targets = h("input", { class: "inp", type: "text", "aria-label": t("ratesTargets") });
    targets.value = (settings.targets ?? []).join(", ");
    const msg = h("div", { class: "r", role: "alert" });
    const form = h("form", { class: "form" },
      h("label", {}, t("ratesBase"), base), h("label", {}, t("ratesTargets"), targets), msg,
      h("div", { class: "acts" }, h("button", { type: "submit", class: "sbtn" }, t("save"))));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = validateRates(base.value, targets.value);
      if (!v.ok) {
        msg.textContent = v.error === "unsupported" ? t("ratesUnsupported", v.codes.join(", ")) : t("ratesBad");
        return;
      }
      form.dispatchEvent(new CustomEvent("save", { detail: { ...settings, base: v.base, targets: v.targets.slice(0, 8) } }));
    });
    return form;
  },
};
