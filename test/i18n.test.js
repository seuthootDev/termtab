import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(fileURLToPath(new URL(p, root)), "utf8");
const en = JSON.parse(read("_locales/en/messages.json"));
const ko = JSON.parse(read("_locales/ko/messages.json"));

const jsFiles = () => {
  const out = [];
  for (const dir of ["", "lib/", "widgets/", "shell/", "demo/"]) {
    const abs = fileURLToPath(new URL(dir || ".", root));
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs)) if (f.endsWith(".js")) out.push(dir + f);
  }
  return out;
};

test("en and ko have the same keys", () => {
  assert.deepEqual(Object.keys(ko).sort(), Object.keys(en).sort());
  for (const [k, v] of Object.entries(ko)) assert.ok(v.message, `ko.${k} is empty`);
});

test("keys are valid chrome.i18n names", () => {
  for (const k of Object.keys(en)) assert.match(k, /^[A-Za-z0-9_]+$/, k);
});

test('every t("…") key in the JS files exists in en', () => {
  const files = jsFiles();
  assert.ok(files.some((f) => f.startsWith("shell/")), "shell/*.js is scanned");
  for (const f of files) {
    const src = read(f);
    for (const m of src.matchAll(/\bt\(\s*["'`]([A-Za-z0-9_]+)["'`]/g)) {
      assert.ok(en[m[1]], `${f}: missing key ${m[1]}`);
    }
  }
});

test("every data-i18n key in newtab.html exists in en", () => {
  const html = read("newtab.html");
  const keys = [...html.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length > 0, "newtab.html uses data-i18n");
  for (const k of keys) assert.ok(en[k], `newtab.html: missing key ${k}`);
});

test("every widget has a name, description and source in en", async () => {
  const { WIDGETS, categoryById, CATEGORIES } = await import("../widgets/index.js");
  for (const c of CATEGORIES) assert.ok(en[`cat_${c}`], `cat_${c}`);
  assert.ok(WIDGETS.length >= 7);
  for (const w of WIDGETS) {
    assert.ok(en[`w_${w.meta.id}_name`], `w_${w.meta.id}_name`);
    assert.ok(en[`w_${w.meta.id}_desc`], `w_${w.meta.id}_desc`);
    assert.ok(en[w.meta.source], `source key ${w.meta.source}`);
    assert.ok(en[`cat_${categoryById[w.meta.id]}`], `cat_${categoryById[w.meta.id]}`);
  }
});

test("t() falls back to _locales/en in Node and fills $1", async () => {
  const { t } = await import("../lib/i18n.js");
  assert.equal(t("appName"), "termtab");
  assert.equal(t("greetMorning", "ann"), en.greetMorning.message.replace("$1", "ann"));
  assert.equal(t("noSuchKey"), "noSuchKey");
});
