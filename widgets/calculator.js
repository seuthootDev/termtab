import { h } from "../shell/dom.js";
import { evaluate } from "../lib/calc.js";

const KEYS = { syntax: "calcErrSyntax", "divide-by-zero": "calcErrDivide", "too-long": "calcErrTooLong" };

export const pushHistory = (history, entry, max = 5) => [...(Array.isArray(history) ? history : []), entry].slice(-max);

/** Pure: evaluate, never throws. */
export function runCalc(expr, t) {
  try {
    const v = evaluate(expr);
    return { ok: true, text: String(Number.isInteger(v) ? v : Number(v.toPrecision(12))) };
  } catch (err) {
    return { ok: false, text: t(KEYS[err?.message] ?? "calcErrSyntax") };
  }
}

let refocus = false;

export default {
  meta: { id: "calculator", category: "basics", size: "small", source: "src_extension", command: () => "bc" },
  defaults: { history: [] },
  render(el, ctx) {
    const history = Array.isArray(ctx.settings.history) ? ctx.settings.history : [];
    const input = h("input", { class: "inp", type: "text", autocomplete: "off", spellcheck: "false",
      placeholder: ctx.t("calcPlaceholder"), "aria-label": ctx.t("calcPlaceholder") });
    const out = h("div", {});
    const form = h("form", {}, input);
    el.append(
      h("ul", {}, ...history.map((e) => h("li", { class: "row" }, h("span", { class: "dim" }, `${e.expr} =`), h("span", { class: "num g" }, e.result)))),
      form, out);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const expr = input.value.trim();
      if (!expr) return;
      const r = runCalc(expr, ctx.t);
      if (!r.ok) {
        out.replaceChildren(h("span", { class: "r" }, r.text));
        return;
      }
      refocus = true;
      ctx.save({ ...ctx.settings, history: pushHistory(history, { expr, result: r.text }) });
    });
    if (refocus) {
      refocus = false;
      input.focus();
    }
  },
};
