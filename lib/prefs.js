// Preference defaults and settings backup/restore. Pure: no DOM, no chrome access at import time.
import { WIDGETS } from "../widgets/index.js";

export const DEFAULT_PREFS = {
  user: "you", machine: "MacBook", clock24: true, searchEngine: "google",
  wallpaper: 1, fontSize: "medium", focusMode: true, ambientWithTimer: false,
};

export const FONT_PX = { small: 11.5, medium: 12.5, large: 14 };
export const WALLPAPERS = [1, 2, 3];

const APP = "termtab";
const VERSION = 1;
const WIDGET_IDS = new Set(WIDGETS.map((w) => w.meta.id));

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** 1 to 24 characters, not only whitespace. */
export const validName = (s) => typeof s === "string" && s.length <= 24 && s.trim().length > 0;

/** Keys that belong in a backup: layout, prefs, focus and settings:<known widget>. */
export function isExportableKey(key) {
  if (key === "layout" || key === "prefs" || key === "focus") return true;
  return key.startsWith("settings:") && WIDGET_IDS.has(key.slice(9));
}

/** Storage keys to read for an export. */
export const exportKeys = () => ["layout", "prefs", "focus", ...[...WIDGET_IDS].map((id) => "settings:" + id)];

/** Pick the exportable keys from a full storage dump (cache, timer and lock keys are left out). */
export function collectExportable(dump = {}) {
  const out = {};
  for (const [k, v] of Object.entries(dump)) if (isExportableKey(k)) out[k] = v;
  return out;
}

export function exportSettings(all, now = Date.now()) {
  return JSON.stringify({ app: APP, version: VERSION, exportedAt: new Date(now).toISOString(), data: collectExportable(all) }, null, 2);
}

const shapeOk = (key, v) => (key === "layout" ? Array.isArray(v) : isObj(v));

/** Parse and validate a backup. Throws Error("bad-json" | "not-termtab" | "newer-version" | "bad-data"). */
export function importSettings(json) {
  let doc;
  try {
    doc = JSON.parse(json);
  } catch {
    throw new Error("bad-json");
  }
  if (!isObj(doc) || doc.app !== APP) throw new Error("not-termtab");
  if (typeof doc.version !== "number") throw new Error("bad-data");
  if (doc.version > VERSION) throw new Error("newer-version");
  const { data } = doc;
  if (!isObj(data)) throw new Error("bad-data");
  for (const [k, v] of Object.entries(data)) {
    if (!isExportableKey(k) || !shapeOk(k, v)) throw new Error("bad-data");
  }
  return data;
}

/** Validate first; only then write everything in one call and reload. Nothing is touched on failure. */
export async function applyImport(text, { set, reload }) {
  const data = importSettings(text);
  await set(data);
  reload();
  return data;
}
