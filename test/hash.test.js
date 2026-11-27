import { test } from "node:test";
import assert from "node:assert/strict";
import { hash } from "../lib/hash.js";

test("hash is a stable short string", () => {
  const a = hash({ city: "Seoul", unit: "c" });
  assert.equal(typeof a, "string");
  assert.match(a, /^[0-9a-z]{1,8}$/);
  assert.equal(hash({ city: "Seoul", unit: "c" }), a);
});

test("hash ignores key order but not values", () => {
  assert.equal(hash({ a: 1, b: { c: 2, d: 3 } }), hash({ b: { d: 3, c: 2 }, a: 1 }));
  assert.notEqual(hash({ city: "Seoul" }), hash({ city: "Busan" }));
  assert.notEqual(hash({ n: [1, 2] }), hash({ n: [2, 1] }));
});

test("hash handles empty and missing settings", () => {
  assert.equal(hash(undefined), hash(undefined));
  assert.equal(hash({}), hash({}));
});
