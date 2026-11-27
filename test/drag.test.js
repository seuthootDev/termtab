import { test } from "node:test";
import assert from "node:assert/strict";
import { dropIndex } from "../lib/drag.js";

const row = [0, 1, 2].map((i) => ({ left: i * 100, top: 0, width: 90, height: 50 }));

test("single row", () => {
  assert.equal(dropIndex(row, 70, 25), 1); // right half of box 0
  assert.equal(dropIndex(row, 20, 25), 0); // left half of box 0
  assert.equal(dropIndex(row, 900, 25), 2); // far right
  assert.equal(dropIndex(row, -50, 25), 0); // left of everything
});

test("second row works by row then column", () => {
  const r = [...row, ...row.map((b) => ({ ...b, top: 100 }))];
  assert.equal(dropIndex(r, 20, 125), 3);
  assert.equal(dropIndex(r, 70, 125), 4);
  assert.equal(dropIndex(r, 170, 125), 5);
  assert.equal(dropIndex(r, 20, 25), 0);
  assert.equal(dropIndex(r, 250, 95), 5); // in the gap, closer to row 2
});

test("empty list", () => {
  assert.equal(dropIndex([], 5, 5), 0);
});
