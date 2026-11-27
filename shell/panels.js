// Content of the modal windows: help (man termtab), about, preferences (basic; Task 8
// extends it) and a widget's settings form.
import { h } from "./dom.js";

export function createPanels({ t, overlays, getPrefs, setPrefs, grid, byId }) {
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
    overlays.open({
      key: "about",
      name: t("menuAbout"),
      size: "80×8",
      body: h("div", {},
        h("div", { class: "y" }, `termtab ${version}`),
        h("div", {}, t("appDescription")),
        h("div", { class: "dim" }, t("aboutFree"))),
    });
  }

  function preferences() {
    const prefs = getPrefs();
    const user = h("input", { class: "inp", value: prefs.user, maxlength: "32", autocomplete: "off" });
    const machine = h("input", { class: "inp", value: prefs.machine, maxlength: "32", autocomplete: "off" });
    const clock24 = h("input", { type: "checkbox", checked: !!prefs.clock24 });
    let close;
    const form = h("form", { class: "form", onsubmit: (e) => {
      e.preventDefault();
      setPrefs({
        ...getPrefs(),
        user: user.value.trim() || "you",
        machine: machine.value.trim() || "MacBook",
        clock24: clock24.checked,
      });
      close();
    } },
      h("label", {}, t("prefsUser"), user),
      h("label", {}, t("prefsMachine"), machine),
      h("label", { class: "chk" }, clock24, t("prefsClock24")),
      h("div", { class: "acts" }, h("button", { class: "sbtn", type: "submit" }, t("save"))));
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
