import { test, expect } from "bun:test";
import { BudgetRegistry, setBudgetRegistry } from "../../src/budget/registry.js";

function createFreshRegistry(): BudgetRegistry {
  const reg = new BudgetRegistry();
  setBudgetRegistry(reg);
  return reg;
}

const validPool = {
  budgetId: "b1",
  scope: "session" as const,
  scopeId: "s1",
  allocated: 50000,
  thresholds: [0.5, 0.8],
  depletionAction: "block" as const,
};

test("create() stores a valid pool", () => {
  const reg = createFreshRegistry();
  const ok = reg.create(validPool);
  expect(ok).toBe(true);
  expect(reg.size).toBe(1);
});

test("create() rejects duplicate budgetId", () => {
  const reg = createFreshRegistry();
  reg.create(validPool);
  const ok2 = reg.create(validPool);
  expect(ok2).toBe(false);
  expect(reg.size).toBe(1);
});

test("get() returns existing pool or null", () => {
  const reg = createFreshRegistry();
  reg.create(validPool);
  const got = reg.get("b1");
  expect(got).toBeTruthy();
  expect(got!.budgetId).toBe("b1");

  const missing = reg.get("nonexistent");
  expect(missing).toBe(null);
});

test("list() returns all pools when no scope filter", () => {
  const reg = createFreshRegistry();
  reg.create(validPool);
  reg.create({ ...validPool, budgetId: "b2", scope: "global" });
  const all = reg.list();
  expect(all.length).toBe(2);
});

test("list() filters by scope", () => {
  const reg = createFreshRegistry();
  reg.create({ ...validPool, budgetId: "b1", scope: "session", scopeId: "s1" });
  reg.create({ ...validPool, budgetId: "b2", scope: "global" });
  reg.create({ ...validPool, budgetId: "b3", scope: "provider", scopeId: "p1" });

  const sessionPools = reg.list("session");
  expect(sessionPools.length).toBe(1);
  expect(sessionPools[0].budgetId).toBe("b1");

  const all = reg.list();
  expect(all.length).toBe(3);
});

test("adjust() updates allocated and resets triggered thresholds", () => {
  const reg = createFreshRegistry();
  reg.create(validPool);
  reg.recordTriggeredThreshold("b1", 0.5);

  const adjusted = reg.adjust("b1", 80000);
  expect(adjusted).toBeTruthy();
  expect(adjusted!.allocated).toBe(80000);
  expect(reg.isThresholdTriggered("b1", 0.5)).toBe(false);
});

test("adjust() returns null for non-existent pool", () => {
  const reg = createFreshRegistry();
  const result = reg.adjust("nonexistent", 10000);
  expect(result).toBe(null);
});

test("remove() deletes a pool and returns true/false", () => {
  const reg = createFreshRegistry();
  reg.create(validPool);
  const removed = reg.remove("b1");
  expect(removed).toBe(true);
  expect(reg.get("b1")).toBe(null);

  const removedAgain = reg.remove("b1");
  expect(removedAgain).toBe(false);
});

test("clear() removes all pools and returns count", () => {
  const reg = createFreshRegistry();
  reg.create(validPool);
  reg.create({ ...validPool, budgetId: "b2" });
  const count = reg.clear();
  expect(count).toBe(2);
  expect(reg.size).toBe(0);
});

test("removeBySession() removes only session-scoped pools for that session", () => {
  const reg = createFreshRegistry();
  reg.create({ ...validPool, budgetId: "b1", scope: "session", scopeId: "s1" });
  reg.create({ ...validPool, budgetId: "b2", scope: "session", scopeId: "s2" });
  reg.create({ ...validPool, budgetId: "b3", scope: "global" });
  reg.create({ ...validPool, budgetId: "b4", scope: "provider", scopeId: "p1" });

  const removed = reg.removeBySession("s1");
  expect(removed).toBe(1);
  expect(reg.get("b1")).toBe(null);
  expect(reg.get("b2")?.budgetId).toBe("b2");
  expect(reg.size).toBe(3);
});

test("getMatchingPools() matches by scope and scopeId", () => {
  const reg = createFreshRegistry();
  reg.create({ ...validPool, budgetId: "b-session-s1", scope: "session", scopeId: "s1" });
  reg.create({ ...validPool, budgetId: "b-session-s2", scope: "session", scopeId: "s2" });
  reg.create({ ...validPool, budgetId: "b-provider-p1", scope: "provider", scopeId: "p1" });
  reg.create({ ...validPool, budgetId: "b-global", scope: "global" });

  const matched = reg.getMatchingPools("s1", "p1");
  expect(matched.length).toBe(3);
  const ids = matched.map((p) => p.budgetId).sort();
  expect(ids).toEqual(["b-global", "b-provider-p1", "b-session-s1"]);
});

test("threshold deduplication: recordTriggeredThreshold and isThresholdTriggered", () => {
  const reg = createFreshRegistry();
  reg.create(validPool);

  expect(reg.isThresholdTriggered("b1", 0.5)).toBe(false);

  reg.recordTriggeredThreshold("b1", 0.5);
  expect(reg.isThresholdTriggered("b1", 0.5)).toBe(true);
  expect(reg.isThresholdTriggered("b1", 0.8)).toBe(false);

  const triggered = reg.getTriggeredThresholds("b1");
  expect(triggered).toEqual([0.5]);
});
