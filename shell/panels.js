// Content of the modal windows: help (man termtab), about, preferences and a widget's settings form.
import { h, today } from "./dom.js";
import { WIDGETS } from "../widgets/index.js";
import { validateWorkday } from "../widgets/workday.js";
import { DEFAULT_PREFS, WALLPAPERS, validName, exportSettings, applyImport, exportKeys, MAX_IMPORT_BYTES } from "../lib/prefs.js";

const IMPORT_ERRORS = {
  "bad-json": "importBadJson",
  "too-large": "importTooLarge",
  "not-termtab": "importNotTermtab",
  "newer-version": "importNewer",
  "bad-data": "importBadData",
};

export function createPanels({ t, overlays, getPrefs, setPrefs, grid, byId, storage, store, resetLayout }) {
  function help() {
    const rows = [
      ["/", t("helpSearch")],
      ["n", t("helpNotes")],
      ["t", t("helpTimer")],
      ["?", t("helpHelp")],
      ["Esc", t("helpEsc")],
      ["Alt+← →", t("helpMove")],
    ];
    const text = [
      `TERMTAB(1)\n`,
      t("helpNameHead"),
      `    termtab — ${t("appDescription")}\n`,
      t("helpShortcutsHead"),
      ...rows.map(([k, d]) => `    ${k.padEnd(9)}${d}`),
    ].join("\n");
    overlays.open({ key: "help", name: "man termtab", body: h("pre", { class: "man" }, text) });
  }

  function about() {
    const version = globalThis.chrome?.runtime?.getManifest?.().version ?? "";
    const sources = [...new Set(WIDGETS.map((w) => w.meta.source))];
    overlays.open({
      key: "about",
      name: t("menuAbout"),
      size: "80×14",
      body: h("div", {},
        h("div", { class: "y" }, `termtab ${version}`),
        h("div", {}, t("appDescription")),
        h("div", { class: "dim" }, t("aboutFree")),
        h("div", { class: "y", style: "margin-top:8px" }, t("aboutData")),
        h("ul", {}, ...sources.map((k) => h("li", { class: "dim" }, t(k))))),
    });
  }

  // Unit and workday hours live in the widgets' own settings (single source of truth).
  const readSettings = async (id) => ({
    ...byId(id).defaults,
    ...(grid.settingsOf(id) ?? (await store.get("settings:" + id, {}))),
  });

  async function doExport(say) {
    try {
      const dump = await storage.get(exportKeys());
      const blob = new Blob([exportSettings(dump)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = h("a", { href: url, download: `termtab-settings-${today()}.json` });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      say(t("importFailed"));
    }
  }

  function resetButton() {
    let armed = false;
    const btn = h("button", { class: "sbtn", type: "button", onclick: () => {
      if (!armed) {
        armed = true;
        btn.textContent = t("prefsResetConfirm");
        return;
      }
      resetLayout();
    } }, t("prefsResetLayout"));
    return btn;
  }

  async function preferences() {
    const prefs = { ...DEFAULT_PREFS, ...getPrefs() };
    const weather = await readSettings("weather");
    const workday = validateWorkday(await readSettings("workday"));
    const text = (v) => h("input", { class: "inp", value: v, maxlength: "24", autocomplete: "off" });
    const check = (v) => h("input", { type: "checkbox", checked: !!v });
    const select = (opts, v) => {
      const el = h("select", { class: "inp" }, ...opts.map(([val, label]) => h("option", { value: val }, label)));
      el.value = String(v);
      return el;
    };
    const user = text(prefs.user);
    const machine = text(prefs.machine);
    const clock24 = check(prefs.clock24);
    const focusMode = check(prefs.focusMode);
    const ambient = check(prefs.ambientWithTimer);
    const unit = select([["c", "°C"], ["f", "°F"]], weather.unit === "f" ? "f" : "c");
    const wallpaper = select(WALLPAPERS.map((n) => [n, `${t("prefsWallpaper")} ${n}`]), prefs.wallpaper);
    const fontSize = select([["small", t("fontSmall")], ["medium", t("fontMedium")], ["large", t("fontLarge")]], prefs.fontSize);
    const start = h("input", { class: "inp", type: "time", value: workday.start });
    const end = h("input", { class: "inp", type: "time", value: workday.end });
    const msg = h("div", { class: "prefs-msg r", role: "status" });
    const say = (line) => { msg.textContent = line; };
    const picker = h("input", { type: "file", accept: "application/json", hidden: true });
    let close;

    picker.addEventListener("change", async () => {
      const file = picker.files?.[0];
      picker.value = "";
      if (!file) return;
      try {
        if (file.size > MAX_IMPORT_BYTES) throw new Error("too-large");
        await applyImport(await file.text(), { set: (data) => storage.set(data), reload: () => location.reload() });
      } catch (err) {
        say(t(IMPORT_ERRORS[err?.message] ?? "importFailed"));
      }
    });

    const form = h("form", { class: "form", onsubmit: async (e) => {
      e.preventDefault();
      if (!validName(user.value) || !validName(machine.value)) return say(t("prefsNameInvalid"));
      if (!start.value || !end.value || start.value >= end.value) return say(t("prefsWorkInvalid"));
      await grid.saveSettings("weather", { ...weather, unit: unit.value });
      await grid.saveSettings("workday", { ...(await readSettings("workday")), start: start.value, end: end.value });
      setPrefs({
        ...getPrefs(),
        user: user.value.trim(),
        machine: machine.value.trim(),
        clock24: clock24.checked,
        wallpaper: Number(wallpaper.value),
        fontSize: fontSize.value,
        focusMode: focusMode.checked,
        ambientWithTimer: ambient.checked,
      });
      close();
    } },
      h("label", {}, t("prefsUser"), user),
      h("label", {}, t("prefsMachine"), machine),
      h("label", { class: "chk" }, clock24, t("prefsClock24")),
      h("label", {}, t("prefsTemp"), unit),
      h("label", {}, t("prefsWallpaper"), wallpaper),
      h("label", {}, t("prefsFontSize"), fontSize),
      h("label", { class: "chk" }, focusMode, t("prefsFocusMode")),
      h("label", { class: "chk" }, ambient, t("prefsAmbient")),
      h("label", {}, t("prefsWorkStart"), start),
      h("label", {}, t("prefsWorkEnd"), end),
      msg,
      h("hr", { class: "prefs-sep" }),
      h("div", { class: "acts" },
        h("button", { class: "sbtn", type: "button", onclick: () => doExport(say) }, t("prefsExport")),
        h("button", { class: "sbtn", type: "button", onclick: () => picker.click() }, t("prefsImport")),
        resetButton(),
        h("button", { class: "sbtn", type: "button", onclick: () => close() }, t("prefsClose")),
        h("button", { class: "sbtn", type: "submit" }, t("save"))),
      picker);
    close = overlays.open({ key: "prefs", name: t("menuPreferences"), body: form });
  }

  function settings(id) {
    const mod = byId(id);
    if (!mod?.settingsForm) return;
    const form = mod.settingsForm({ ...(grid.settingsOf(id) ?? mod.defaults) }, t);
    const close = overlays.open({ key: "settings:" + id, name: `${id} — ${t("winSettingsTitle")}`, body: form });
    form.addEventListener("save", (e) => {
      grid.saveSettings(id, e.detail);
      close();
    });
  }

  return { help, about, preferences, settings };
}
