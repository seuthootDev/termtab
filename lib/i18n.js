// t(key, ...subs): chrome.i18n.getMessage in the extension. Without chrome.i18n it uses
// _locales/en: read synchronously in Node, or loaded by initI18n() (fetch) in a plain browser.
// No chrome access at import time.
let fallback = null;

const chromeI18n = () => globalThis.chrome?.i18n?.getMessage ? globalThis.chrome.i18n : null;

function nodeMessages() {
  const fs = globalThis.process?.getBuiltinModule?.("node:fs");
  if (!fs) return null;
  try {
    return JSON.parse(fs.readFileSync(new URL("../_locales/en/messages.json", import.meta.url), "utf8"));
  } catch {
    return null;
  }
}

function fill(entry, subs) {
  let msg = entry.message;
  for (const [name, p] of Object.entries(entry.placeholders ?? {})) {
    msg = msg.replace(new RegExp("\$" + name + "\$", "gi"), p.content);
  }
  return msg.replace(/\$([1-9])/g, (_, i) => String(subs[i - 1] ?? ""));
}

/** Load the English fallback in a page without chrome.i18n (plain browser preview). */
export async function initI18n() {
  if (chromeI18n() || fallback) return;
  try {
    const res = await fetch(new URL("../_locales/en/messages.json", import.meta.url));
    fallback = await res.json();
  } catch {
    fallback = {};
  }
}

export function t(key, ...subs) {
  const api = chromeI18n();
  if (api) return api.getMessage(key, subs.map(String)) || key;
  fallback ??= nodeMessages();
  const entry = fallback?.[key];
  return entry ? fill(entry, subs) : key;
}

/** UI language for <html lang> and Intl formatting. */
export function uiLanguage() {
  return globalThis.chrome?.i18n?.getUILanguage?.() || globalThis.navigator?.language || "en";
}
