import { test } from "node:test";
import assert from "node:assert/strict";
import { cpuUsage, memoryUsed } from "../widgets/sysmon.js";

const proc = (kernel, user, idle) => ({ usage: { kernel, user, idle, total: kernel + user + idle } });

test("cpuUsage: per-core and total from two snapshots", () => {
  const prev = { processors: [proc(10, 10, 80), proc(0, 0, 100)] };
  const next = { processors: [proc(30, 30, 140), proc(0, 0, 200)] };
  const u = cpuUsage(prev, next);
  assert.deepEqual(u.cores, [0.4, 0]);
  assert.ok(Math.abs(u.total - 0.2) < 1e-9);
});

test("cpuUsage: zero delta, clamping and mismatched core counts", () => {
  const same = { processors: [proc(5, 5, 5)] };
  assert.deepEqual(cpuUsage(same, same), { total: 0, cores: [0] });
  const odd = cpuUsage({ processors: [proc(10, 0, 0)] }, { processors: [{ usage: { kernel: 50, user: 0, idle: 0, total: 20 } }] });
  assert.equal(odd.cores[0], 1);
  assert.deepEqual(cpuUsage({ processors: [] }, { processors: [proc(1, 1, 1)] }), { total: 0, cores: [] });
});

test("memoryUsed is capacity minus available", () => {
  assert.equal(memoryUsed({ capacity: 16 * 2 ** 30, availableCapacity: 6 * 2 ** 30 }), 10 * 2 ** 30);
});

