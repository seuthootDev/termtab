import { test } from "node:test";
import assert from "node:assert/strict";
import { menuClockParts } from "../lib/menuclock.js";

const d = new Date(2026, 10, 27, 14, 7);

test("english parts, 24 h", () => {
  assert.deepEqual(menuClockParts(d, "en", true), { weekday: "Fri", day: "27", month: "Nov", time: "14:07" });
});

test("12 h clock and early hours", () => {
  assert.equal(menuClockParts(d, "en", false).time.replace(/\s/g, " "), "2:07 PM");
  assert.equal(menuClockParts(new Date(2026, 0, 2, 3, 5), "en", true).time, "03:05");
});

test("korean names", () => {
  const p = menuClockParts(d, "ko", true);
  assert.equal(p.weekday, "금");
  assert.equal(p.month, "11월");
});
