import { test } from "node:test";
import assert from "node:assert/strict";
import { t } from "../lib/i18n.js";
import { WIDGETS, byId } from "../widgets/index.js";
import { formatClock } from "../widgets/clock.js";
import { faviconUrl, isSafeUrl, sanitizeLinks, parseLinks } from "../widgets/links.js";
import { formatZone, zoneLabel } from "../widgets/world.js";
import { countdownLabel } from "../widgets/countdown.js";
import { pushHistory, runCalc, validHistory } from "../widgets/calculator.js";
import { FORTUNES } from "../data/fortunes.js";
import { cowsay } from "../widgets/fortune.js";
import { countTabs, osName, browserName, sysFacts, SYS_LABEL_STYLE } from "../widgets/sysinfo.js";
import { validateWorkday } from "../widgets/workday.js";
import { calendarCells } from "../widgets/calendar.js";

test("registry has the nine offline widgets with the agreed categories", () => {
  const want = { clock: "basics", links: "basics", calculator: "basics", calendar: "info", world: "info",
    countdown: "focus", workday: "focus", fortune: "fun", sysinfo: "fun" };
  for (const [id, cat] of Object.entries(want)) {
    const w = byId(id);
    assert.ok(w, id);
    assert.equal(w.meta.category, cat, id);
    assert.equal(typeof w.render, "function", id);
  }
  assert.equal(new Set(WIDGETS.map((w) => w.meta.id)).size, WIDGETS.length);
  assert.equal(byId("links").defaults.links.length, 6);
  assert.deepEqual(byId("workday").defaults, { start: "09:00", end: "18:00", days: [1, 2, 3, 4, 5] });
  assert.equal(byId("world").defaults.zones.length, 5);
});

test("clock formats 24h and 12h", () => {
  const d = new Date(2026, 10, 27, 14, 7, 9);
  const c24 = formatClock(d, true, "en");
  assert.equal(c24.hm, "14:07");
  assert.equal(c24.sec, "09");
  const c12 = formatClock(d, false, "en");
  assert.match(c12.hm, /^2:07/);
  assert.equal(c12.week, 48);
});

test("links: favicon url and safe urls", () => {
  assert.equal(faviconUrl("https://github.com/a"), "https://www.google.com/s2/favicons?domain=github.com&sz=32");
  assert.ok(isSafeUrl("https://a.com"));
  assert.ok(isSafeUrl("http://a.com/x"));
  for (const bad of ["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd", "chrome://settings", "", "not a url", null])
    assert.equal(isSafeUrl(bad), false, String(bad));
  const out = sanitizeLinks([{ title: "ok", url: "https://a.com" }, { title: "x", url: "javascript:alert(1)" }, { title: "", url: "https://b.com" }]);
  assert.deepEqual(out.map((l) => l.url), ["https://a.com", "https://b.com"]);
  assert.equal(out[1].title, "b.com");
  const parsed = parseLinks("gh https://github.com\njavascript:alert(1)\nhttps://x.org");
  assert.deepEqual(parsed.links.map((l) => l.title), ["gh", "x.org"]);
  assert.equal(parsed.rejected, 1);
});

test("world: formats a fixed instant and marks working hours", () => {
  const at = new Date("2026-11-27T00:30:00Z");
  const seoul = formatZone(at, "Asia/Seoul", true);
  assert.equal(seoul.time, "09:30");
  assert.equal(seoul.working, true);
  const la = formatZone(at, "America/Los_Angeles", true);
  assert.equal(la.time, "16:30");
  assert.equal(la.working, true);
  const ny = formatZone(new Date("2026-11-27T10:00:00Z"), "America/New_York", true);
  assert.equal(ny.working, false);
  assert.equal(formatZone(new Date("2026-11-27T09:00:00Z"), "Asia/Seoul", true).working, false);
  assert.equal(formatZone(at, "Asia/Seoul", false).time, "9:30 AM");
  assert.equal(formatZone(at, "Not/AZone", true), null);
  assert.equal(zoneLabel("America/Los_Angeles"), "Los Angeles");
});

test("countdown label", () => {
  assert.equal(countdownLabel(35), "D-35");
  assert.equal(countdownLabel(0), "D-0");
  assert.equal(countdownLabel(-3), "D+3");
});

test("calculator keeps the last 5 results and reports errors", () => {
  let h = [];
  for (let i = 1; i <= 7; i++) h = pushHistory(h, { expr: `${i}+1`, result: String(i + 1) });
  assert.equal(h.length, 5);
  assert.equal(h[0].expr, "3+1");
  assert.equal(h.at(-1).expr, "7+1");
  assert.deepEqual(runCalc("1+2", t), { ok: true, text: "3" });
  assert.equal(runCalc("2^^3", t).text, "error: syntax");
  assert.equal(runCalc("1/0", t).ok, false);
  assert.equal(runCalc("alert(1)", t).ok, false);
  assert.equal(runCalc("1".repeat(500), t).ok, false);
});

test("fortunes are short and non-empty", () => {
  assert.ok(FORTUNES.length >= 40 && FORTUNES.length <= 80);
  for (const f of FORTUNES) assert.ok(f.length > 0 && f.length < 140, f);
  assert.equal(new Set(FORTUNES).size, FORTUNES.length);
  const c = cowsay("hello");
  assert.match(c, /< hello >/);
  assert.match(c, /\(oo\)/);
});

test("sysinfo counts tabs through the injected queryTabs", async () => {
  assert.equal(await countTabs(async () => new Array(23).fill({})), 23);
  assert.equal(await countTabs(async () => { throw new Error("x"); }), null);
  assert.equal(await countTabs(undefined), null);
  assert.equal(osName({ userAgentData: { platform: "macOS" } }), "macOS");
  assert.equal(osName({ userAgent: "Mozilla/5.0 (Windows NT 10.0)" }), "Windows");
  assert.equal(browserName({ userAgent: "x Chrome/120 Edg/120" }), "Edge");
});

test("workday settings validation", () => {
  assert.deepEqual(validateWorkday({ start: "08:30", end: "17:00", days: [1, 2, 9, "x"] }),
    { start: "08:30", end: "17:00", days: [1, 2] });
  assert.deepEqual(validateWorkday({ start: "bad", end: "25:00", days: [] }),
    { start: "09:00", end: "18:00", days: [1, 2, 3, 4, 5] });
  assert.deepEqual(validateWorkday({ start: "18:00", end: "09:00", days: [1] }),
    { start: "09:00", end: "18:00", days: [1] });
});

test("calendar cells mark today", () => {
  const cells = calendarCells(new Date(2026, 10, 27));
  assert.equal(cells.filter((c) => c.today).length, 1);
  assert.equal(cells.find((c) => c.today).day, 27);
  assert.equal(cells.filter((c) => c.day).length, 30);
});

test("newtab.css gives pre/code the mono stack (no browser default monospace, which draws \ as a won sign in ko)", async () => {
  const { readFileSync } = await import("node:fs");
  const css = readFileSync(new URL("../newtab.css", import.meta.url), "utf8");
  const rule = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].find(([, sel, body]) =>
    /(^|,)\s*pre\s*(,|$)/.test(sel.trim()) && /font-family:\s*var\(--mono\)|font:\s*inherit/.test(body));
  assert.ok(rule, "a rule for pre with font-family: var(--mono) or font: inherit");
});

test("calculator drops invalid stored history entries at render", () => {
  assert.deepEqual(validHistory([{ expr: "1+1", result: "2" }, null, { expr: "x" }, { expr: 3, result: "3" }, { expr: "2*3", result: 6 }, "junk"]),
    [{ expr: "1+1", result: "2" }, { expr: "2*3", result: 6 }]);
  assert.deepEqual(validHistory("not an array"), []);
  assert.deepEqual(validHistory(undefined), []);
});

test("sysinfo: ?demo=1 shows fixed values (store screenshots), labels keep their padding", () => {
  const nav = { userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/131 Edg/131", language: "en-US", hardwareConcurrency: 16 };
  const scr = { width: 1600, height: 1000 };
  assert.deepEqual(sysFacts({ nav, scr, demo: true }), { os: "macOS", browser: "Chrome", lang: "en-US", screen: "2560×1600", cores: "10", tabs: 12 });
  const real = sysFacts({ nav, scr, demo: false });
  assert.deepEqual(real, { os: "Windows", browser: "Edge", lang: "en-US", screen: "1600×1000", cores: "16", tabs: null });
  assert.match(SYS_LABEL_STYLE, /white-space:\s*pre/);
});
