import { test } from "node:test";
import assert from "node:assert/strict";
import { dropIndex, insertionIndex } from "../lib/drag.js";

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

test("insertionIndex: same row before and after a box", () => {
  assert.equal(insertionIndex(row, 20, 25), 0); // left half of box 0
  assert.equal(insertionIndex(row, 70, 25), 1); // right half of box 0
  assert.equal(insertionIndex(row, 120, 25), 1); // left half of box 1
  assert.equal(insertionIndex(row, -50, 25), 0);
});

test("insertionIndex: past the last box gives rects.length", () => {
  assert.equal(insertionIndex(row, 260, 25), 3);
  assert.equal(insertionIndex(row, 900, 25), 3);
  assert.equal(insertionIndex(row, 20, 400), 3); // below everything
  assert.equal(insertionIndex([], 5, 5), 0);
});

test("insertionIndex: second row, short and tall boxes", () => {
  const r = [
    { left: 0, top: 0, width: 90, height: 120 }, // tall
    { left: 100, top: 0, width: 90, height: 50 }, // short
    { left: 0, top: 140, width: 90, height: 50 },
    { left: 100, top: 140, width: 90, height: 50 },
  ];
  assert.equal(insertionIndex(r, 120, 100), 1); // below the short box but still row 1
  assert.equal(insertionIndex(r, 20, 130), 2); // gap between rows
  assert.equal(insertionIndex(r, 20, 160), 2);
  assert.equal(insertionIndex(r, 70, 160), 3);
  assert.equal(insertionIndex(r, 170, 160), 4);
});
