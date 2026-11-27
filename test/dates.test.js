import { test } from "node:test";
import assert from "node:assert/strict";
import * as D from "../lib/dates.js";

test("isoWeek", () => {
  assert.equal(D.isoWeek(new Date(2026, 0, 1)), 1);
  assert.equal(D.isoWeek(new Date(2026, 11, 31)), 53);
  assert.equal(D.isoWeek(new Date(2027, 0, 3)), 53);
  assert.equal(D.isoWeek(new Date(2027, 0, 4)), 1);
});

test("monthGrid Nov 2026 is Monday-first, 42 cells", () => {
  const g = D.monthGrid(2026, 10);
  assert.equal(g.length, 42);
  assert.deepEqual(g.slice(0, 6), Array(6).fill(null));
  assert.equal(g[6], 1);
  assert.equal(g[35], 30);
  assert.equal(g[36], null);
  assert.equal(D.monthGrid(2026, 1).length % 7, 0);
});

test("weekDays is Monday-first across a month boundary", () => {
  assert.deepEqual(D.weekDays(new Date(2026, 11, 1)), [
    "2026-11-30", "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05", "2026-12-06",
  ]);
  assert.equal(D.weekDays(new Date(2026, 10, 29))[0], "2026-11-23"); // a Sunday
});

test("daysUntil rounds up to local midnight", () => {
  assert.equal(D.daysUntil("2027-01-01", new Date(2026, 10, 27, 10, 0)), 35);
  assert.equal(D.daysUntil("2026-11-28", new Date(2026, 10, 27, 23, 59)), 1);
  assert.equal(D.daysUntil("2026-11-27", new Date(2026, 10, 27, 10, 0)), 0);
});

test("workdayProgress", () => {
  const cfg = { start: "09:00", end: "18:00", days: [1, 2, 3, 4, 5] };
  const fri = (h, m = 0) => new Date(2026, 10, 27, h, m);
  assert.equal(D.workdayProgress(fri(8), cfg).state, "before");
  const d = D.workdayProgress(fri(13, 30), cfg);
  assert.equal(d.state, "during");
  assert.equal(d.ratio, 0.5);
  assert.equal(d.minutesLeft, 270);
  assert.equal(D.workdayProgress(fri(19), cfg).state, "after");
  assert.equal(D.workdayProgress(new Date(2026, 10, 28, 13), cfg).state, "off");
});

test("greeting boundaries", () => {
  assert.deepEqual(
    [4, 5, 11, 12, 17, 18, 21, 22, 0].map(D.greeting),
    ["night", "morning", "morning", "afternoon", "afternoon", "evening", "evening", "night", "night"],
  );
});
