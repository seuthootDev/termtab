// Menu bar: the Terminal menu (Widgets…, Preferences…, About) and the date/time on the right.
import { $ } from "./dom.js";
import { menuClockParts } from "../lib/menuclock.js";

export function createMenubar({ t, lang, getPrefs, actions }) {
  const btn = $("#menu-terminal");
  const dd = $("#menu-dd");
  const clock = $("#menuclock");

  const isOpen = () => !dd.hidden;
  function setOpen(open) {
    dd.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    if (open) dd.querySelector("button")?.focus();
  }
  btn.addEventListener("click", () => setOpen(!isOpen()));
  dd.addEventListener("click", (e) => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    setOpen(false);
    actions[action]?.();
  });
  dd.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...dd.querySelectorAll("button")];
    const i = items.indexOf(document.activeElement);
    items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus();
  });
  document.addEventListener("pointerdown", (e) => {
    if (isOpen() && !e.target.closest(".menu")) setOpen(false);
  });

  function tick() {
    const p = menuClockParts(new Date(), lang, getPrefs().clock24);
    clock.textContent = t("menuClock", p.weekday, p.day, p.month, p.time);
  }
  let timer;
  function schedule() {
    tick();
    timer = setTimeout(schedule, 60_000 - (Date.now() % 60_000) + 50); // on the minute
  }
  schedule();

  return {
    refresh: tick,
    close() {
      if (!isOpen()) return false;
      setOpen(false);
      btn.focus();
      return true;
    },
    stop: () => clearTimeout(timer),
  };
}
