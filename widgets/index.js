// Widget registry. Modules must not touch the DOM or chrome at import time
// (background.js imports this file).
//
// Contract (see docs/superpowers/specs/2026-11-27-termtab-design.md, "Widget interface"):
//   meta { id, category: "basics"|"focus"|"info"|"news"|"fun", size: "small"|"wide",
//          source: <_locales key>, command(settings) → string }
//   defaults                      the widget's settings
//   render(el, ctx) → cleanup?    ctx = { settings, data, error, t, refresh(), save(settings, { rerender }?), prefs }
//                                 save() stores the settings without redrawing the window (the widget
//                                 updates its own DOM); { rerender: true } redraws it.
//                                 The shell already prints the prompt line
//                                 (`<user>@<machine> ~ % <command>`) above `el`, and a
//                                 "fetch failed · retry" status line when ctx.error is set.
//   fetch(settings) → Promise<raw>, parse(raw) → data, ttlMs     online widgets only
//   settingsForm(settings, t) → HTMLElement dispatching a "save" CustomEvent (detail = settings)
// Names and descriptions come from _locales: w_<id>_name, w_<id>_desc.

import clock from "./clock.js";
import links from "./links.js";
import calendar from "./calendar.js";
import world from "./world.js";
import countdown from "./countdown.js";
import fortune from "./fortune.js";
import calculator from "./calculator.js";
import workday from "./workday.js";
import sysinfo from "./sysinfo.js";
import timer from "./timer.js";
import todo from "./todo.js";
import notes from "./notes.js";
import habits from "./habits.js";
import ambient from "./ambient.js";
import weather from "./weather.js";
import rates from "./rates.js";
import crypto from "./crypto.js";
import hn from "./hn.js";
import devto from "./devto.js";
import trending from "./trending.js";
import wiki from "./wiki.js";

export const WIDGETS = [
  clock,
  timer,
  weather,
  todo,
  hn,
  calendar,
  links,
  world,
  countdown,
  fortune,
  calculator,
  workday,
  sysinfo,
  notes,
  habits,
  ambient,
  rates,
  crypto,
  devto,
  trending,
  wiki,
];

const index = new Map(WIDGETS.map((w) => [w.meta.id, w]));

export const byId = (id) => index.get(id);

export const categoryById = Object.fromEntries(WIDGETS.map((w) => [w.meta.id, w.meta.category]));

export const metaById = Object.fromEntries(WIDGETS.map((w) => [w.meta.id, w.meta]));

export const CATEGORIES = ["basics", "focus", "info", "news", "fun"];
