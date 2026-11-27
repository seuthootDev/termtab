import { h } from "../shell/dom.js";

const MAX_CORES = 16;
const GIB = 2 ** 30;
const clamp01 = (n) => (n > 0 ? Math.min(1, n) : 0);

/** Pure: usage between two chrome.system.cpu.getInfo() snapshots. */
export function cpuUsage(prev, next) {
  const a = prev?.processors ?? [];
  const b = next?.processors ?? [];
  let busy = 0;
  let all = 0;
  const cores = [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const p = a[i].usage;
    const n = b[i].usage;
    const dBusy = n.kernel + n.user - (p.kernel + p.user);
    const dTotal = n.total - p.total;
    cores.push(dTotal > 0 ? clamp01(dBusy / dTotal) : 0);
    if (dTotal > 0) {
      busy += Math.max(0, dBusy);
      all += dTotal;
    }
  }
  return { total: all > 0 ? clamp01(busy / all) : 0, cores };
}

export const memoryUsed = (m) => Math.max(0, m.capacity - m.availableCapacity);

const color = (r) => (r >= 0.85 ? "r" : r >= 0.6 ? "y" : "g");
const gib = (n) => (n / GIB).toFixed(1);
const pct = (r) => `${Math.round(r * 100)}%`;

function bar(label, ratio, tail) {
  const w = 20;
  const on = Math.round(clamp01(ratio) * w);
  return h("div", { class: "row htop" },
    h("span", { class: "c" }, label.padEnd(4)), "[",
    h("span", { class: color(ratio) }, "|".repeat(on)),
    h("span", { class: "dim" }, " ".repeat(w - on)), "] ", tail);
}

const getCpu = () => globalThis.chrome.system.cpu.getInfo();
const getMem = () => globalThis.chrome.system.memory.getInfo();

export default {
  meta: { id: "sysmon", category: "fun", size: "small", source: "src_computer", command: () => "htop" },
  defaults: {},
  render(el, ctx) {
    if (!globalThis.chrome?.system?.cpu?.getInfo || !globalThis.chrome?.system?.memory?.getInfo) {
      el.append(h("div", { class: "dim" }, ctx.t("smUnavailable")));
      return;
    }
    const out = h("div", {}, h("div", { class: "dim" }, ctx.t("smSampling")));
    el.append(out);
    let prev = null;
    let alive = true;
    const sample = async () => {
      try {
        const [cpu, mem] = await Promise.all([getCpu(), getMem()]);
        if (!alive) return;
        const last = prev;
        prev = cpu;
        if (!last) return; // the first draw needs two samples
        const u = cpuUsage(last, cpu);
        const shown = u.cores.slice(0, MAX_CORES);
        const rows = shown.map((r, i) => bar(String(i + 1), r, pct(r)));
        if (u.cores.length > MAX_CORES) rows.push(h("div", { class: "dim" }, `+${u.cores.length - MAX_CORES}`));
        const used = memoryUsed(mem);
        rows.push(bar(ctx.t("smMem"), mem.capacity ? used / mem.capacity : 0, `${gib(used)}/${gib(mem.capacity)}G`));
        out.replaceChildren(...rows);
      } catch {
        if (alive) out.replaceChildren(h("div", { class: "dim" }, ctx.t("smUnavailable")));
      }
    };
    sample();
    const id = setInterval(sample, 2000);
    return () => { alive = false; clearInterval(id); };
  },
};
