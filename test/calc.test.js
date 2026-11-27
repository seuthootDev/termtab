import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate } from "../lib/calc.js";

test("arithmetic and precedence", () => {
  assert.equal(evaluate("1+2*3"), 7);
  assert.equal(evaluate("(1+2)*3"), 9);
  assert.equal(evaluate("2^10"), 1024);
  assert.equal(evaluate("2^3^2"), 512);
  assert.equal(evaluate("-3+5"), 2);
  assert.equal(evaluate("10%3"), 1);
  assert.equal(evaluate("1.5*2"), 3);
  assert.equal(evaluate(" 4 / 8 "), 0.5);
});

test("sqrt and pi", () => {
  assert.ok(Math.abs(evaluate("sqrt(16)+pi") - 7.14159265) < 1e-6);
});

test("errors", () => {
  assert.throws(() => evaluate("1/0"), { message: "divide-by-zero" });
  assert.throws(() => evaluate("5%0"), { message: "divide-by-zero" });
  for (const bad of ["2^^3", "alert(1)", ")(", "", "1+", "(1", "1 2", "sqrt(", "constructor"]) {
    assert.throws(() => evaluate(bad), { message: "syntax" }, bad);
  }
  assert.throws(() => evaluate("1+".repeat(100) + "1"), { message: "too-long" });
  assert.throws(() => evaluate("9".repeat(500)), { message: "too-long" });
  assert.throws(() => evaluate("1".repeat(201)), { message: "too-long" });
});
