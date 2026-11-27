const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

export function monthGrid(year, month0) {
  const lead = (new Date(year, month0, 1).getDay() + 6) % 7;
  const days = new Date(year, month0 + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function weekDays(date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - ((date.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) =>
    iso(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)));
}

export function daysUntil(isoDate, now) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const target = new Date(y, m - 1, d).getTime();
  return Math.ceil((target - now.getTime()) / 86400000) || 0; // || 0 normalises -0
}

const toMin = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export function workdayProgress(now, { start, end, days }) {
  if (!days.includes(now.getDay())) return { state: "off", ratio: 0, minutesLeft: 0 };
  const s = toMin(start);
  const e = toMin(end);
  const cur = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  if (cur < s) return { state: "before", ratio: 0, minutesLeft: e - s };
  if (cur >= e) return { state: "after", ratio: 1, minutesLeft: 0 };
  return { state: "during", ratio: (cur - s) / (e - s), minutesLeft: Math.ceil(e - cur) };
}

export function greeting(hour) {
  if (hour >= 5 && hour <= 11) return "morning";
  if (hour >= 12 && hour <= 17) return "afternoon";
  if (hour >= 18 && hour <= 21) return "evening";
  return "night";
}
