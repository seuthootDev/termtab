// Parts of the macOS menu-bar clock ("Fri 27 Nov  14:07"); the shell joins them with t("menuClock").
const pad = (n) => String(n).padStart(2, "0");

export function menuClockParts(date, lang, clock24) {
  const fmt = (opts) => new Intl.DateTimeFormat(lang, opts).format(date);
  const time = clock24
    ? `${pad(date.getHours())}:${pad(date.getMinutes())}`
    : fmt({ hour: "numeric", minute: "2-digit", hour12: true });
  return { weekday: fmt({ weekday: "short" }), day: String(date.getDate()), month: fmt({ month: "short" }), time };
}
