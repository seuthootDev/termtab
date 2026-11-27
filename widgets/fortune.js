import { h } from "../shell/dom.js";
import { FORTUNES } from "../data/fortunes.js";

const COW = [
  "        \\   ^__^",
  "         \\  (oo)\\_______",
  "            (__)\\       )\\/\\",
  "                ||----w |",
  "                ||     ||",
];

/** Pure: a cowsay balloon around the text (wrapped at 34 columns). */
export function cowsay(text, width = 34) {
  const lines = [];
  let cur = "";
  for (const w of String(text).split(/\s+/)) {
    if (cur && (cur + " " + w).length > width) {
      lines.push(cur);
      cur = w;
    } else cur = cur ? cur + " " + w : w;
  }
  if (cur) lines.push(cur);
  const len = Math.max(...lines.map((l) => l.length));
  const body = lines.length === 1
    ? [`< ${lines[0]} >`]
    : lines.map((l, i) => {
      const [a, b] = i === 0 ? ["/", "\\"] : i === lines.length - 1 ? ["\\", "/"] : ["|", "|"];
      return `${a} ${l.padEnd(len)} ${b}`;
    });
  return [` ${"_".repeat(len + 2)}`, ...body, ` ${"-".repeat(len + 2)}`, ...COW].join("\n");
}

const pick = () => FORTUNES[Math.floor(Math.random() * FORTUNES.length)];

export default {
  meta: { id: "fortune", category: "fun", size: "small", source: "src_computer", command: () => "fortune | cowsay" },
  defaults: {},
  render(el, ctx) {
    const pre = h("pre", { style: "margin:0;white-space:pre;overflow:auto" });
    const draw = () => { pre.textContent = cowsay(pick()); };
    draw();
    el.append(pre, h("div", { style: "margin-top:6px" },
      h("button", { type: "button", class: "sbtn", onclick: draw }, ctx.t("fortuneAnother"))));
  },
};
