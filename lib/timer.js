export const FOCUS_SEC = 1500;
export const BREAK_SEC = 300;

const pad = (n) => String(n).padStart(2, "0");
const dayOf = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const full = (mode) => (mode === "focus" ? FOCUS_SEC : BREAK_SEC);

export function initial(now) {
  return { mode: "focus", running: false, endsAt: null, remaining: FOCUS_SEC, doneToday: 0, day: dayOf(now) };
}

export function remainingSeconds(s, now) {
  if (!s.running) return s.remaining;
  return Math.max(0, Math.ceil((s.endsAt - now) / 1000));
}

export function start(s, now) {
  if (s.running) return s;
  return { ...s, running: true, endsAt: now + s.remaining * 1000 };
}

export function pause(s, now) {
  if (!s.running) return s;
  return { ...s, running: false, endsAt: null, remaining: remainingSeconds(s, now) };
}

export function reset(s, now) {
  return { ...s, mode: "focus", running: false, endsAt: null, remaining: FOCUS_SEC, day: dayOf(now) };
}

export function tick(s, now) {
  let state = s;
  const today = dayOf(now);
  if (state.day !== today) state = { ...state, day: today, doneToday: 0 };
  if (!state.running || now < state.endsAt) return { state, finished: false };
  const mode = state.mode === "focus" ? "break" : "focus";
  return {
    state: {
      ...state,
      mode,
      running: false,
      endsAt: null,
      remaining: full(mode),
      doneToday: state.mode === "focus" ? state.doneToday + 1 : state.doneToday,
    },
    finished: true,
  };
}
