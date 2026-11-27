import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "../lib/timer.js";

const t0 = new Date(2026, 10, 27, 10, 0, 0).getTime();

test("initial", () => {
  const s = T.initial(t0);
  assert.equal(s.mode, "focus");
  assert.equal(s.running, false);
  assert.equal(s.remaining, T.FOCUS_SEC);
  assert.equal(s.day, "2026-11-27");
  assert.equal(s.doneToday, 0);
});

test("start sets endsAt; pause keeps remaining", () => {
  const s = T.start(T.initial(t0), t0);
  assert.equal(s.running, true);
  assert.equal(s.endsAt, t0 + 1500 * 1000);
  const p = T.pause(s, t0 + 100 * 1000);
  assert.equal(p.running, false);
  assert.equal(p.endsAt, null);
  assert.equal(p.remaining, 1400);
  assert.equal(T.remainingSeconds(s, t0 + 100 * 1000), 1400);
  assert.equal(T.remainingSeconds(p, t0 + 999999), 1400);
});

test("tick past endsAt in focus finishes into break", () => {
  const s = T.start(T.initial(t0), t0);
  assert.equal(T.tick(s, t0 + 1000).finished, false);
  const { state, finished } = T.tick(s, t0 + 1500 * 1000 + 1);
  assert.equal(finished, true);
  assert.equal(state.mode, "break");
  assert.equal(state.doneToday, 1);
  assert.equal(state.running, false);
  assert.equal(state.remaining, T.BREAK_SEC);
});

test("tick resets doneToday on a new day", () => {
  const s = { ...T.initial(t0), doneToday: 4 };
  const next = new Date(2026, 10, 28, 0, 0, 5).getTime();
  const r = T.tick(s, next);
  assert.equal(r.state.doneToday, 0);
  assert.equal(r.state.day, "2026-11-28");
  // running across midnight, finishing on the new day, counts for the new day
  const run = T.start({ ...T.initial(t0), doneToday: 4 }, new Date(2026, 10, 27, 23, 50).getTime());
  const f = T.tick(run, new Date(2026, 10, 28, 0, 20).getTime());
  assert.equal(f.finished, true);
  assert.equal(f.state.doneToday, 1);
});

test("break finishing does not count a session", () => {
  let s = { ...T.initial(t0), mode: "break", remaining: T.BREAK_SEC };
  s = T.start(s, t0);
  const r = T.tick(s, t0 + 301 * 1000);
  assert.equal(r.finished, true);
  assert.equal(r.state.mode, "focus");
  assert.equal(r.state.doneToday, 0);
  assert.equal(r.state.remaining, T.FOCUS_SEC);
});

test("reset returns focus/1500", () => {
  const s = T.start({ ...T.initial(t0), mode: "break", doneToday: 2 }, t0);
  const r = T.reset(s, t0 + 5000);
  assert.equal(r.mode, "focus");
  assert.equal(r.remaining, 1500);
  assert.equal(r.running, false);
  assert.equal(r.doneToday, 2);
});
