import { test, expect, beforeEach } from "bun:test";
import { BudgetRegistry, setBudgetRegistry } from "../../src/budget/registry.js";
import { setTokenStore } from "../../src/token-tracking/store.js";
import { InMemoryTokenStore } from "../../src/token-tracking/store.js";

let registry: BudgetRegistry;
let tokenStore: InMemoryTokenStore;

beforeEach(() => {
  registry = new BudgetRegistry();
  setBudgetRegistry(registry);
  tokenStore = new InMemoryTokenStore();
  setTokenStore(tokenStore);
});

test("budget.create: valid session-scoped budget", () => {
  const ok = registry.create({
    budgetId: "b1",
    scope: "session",
    scopeId: "s1",
    allocated: 50000,
    thresholds: [0.5, 0.8],
    depletionAction: "block",
  });
  expect(ok).toBe(true);
});

test("budget.create: rejects duplicate budgetId", () => {
  registry.create({
    budgetId: "b1",
    scope: "session",
    scopeId: "s1",
    allocated: 50000,
    thresholds: [0.8],
    depletionAction: "block",
  });
  const ok = registry.create({
    budgetId: "b1",
    scope: "global",
    allocated: 100000,
    thresholds: [0.8],
    depletionAction: "notify",
  });
  expect(ok).toBe(false);
});

test("budget.get: returns pool for existing budget", () => {
  registry.create({
    budgetId: "b1",
    scope: "session",
    scopeId: "s1",
    allocated: 50000,
    thresholds: [0.8],
    depletionAction: "block",
  });
  const pool = registry.get("b1");
  expect(pool).toBeTruthy();
  expect(pool!.budgetId).toBe("b1");
  expect(pool!.allocated).toBe(50000);
});

test("budget.get: returns null for non-existent", () => {
  expect(registry.get("nonexistent")).toBe(null);
});

test("budget.list: returns empty array when no pools", () => {
  expect(registry.list()).toEqual([]);
});

test("budget.list: returns all pools without filter", () => {
  registry.create({ budgetId: "b1", scope: "session", scopeId: "s1", allocated: 1000, thresholds: [0.8], depletionAction: "block" });
  registry.create({ budgetId: "b2", scope: "global", allocated: 5000, thresholds: [0.8], depletionAction: "notify" });
  expect(registry.list().length).toBe(2);
});

test("budget.list: filters by scope", () => {
  registry.create({ budgetId: "b1", scope: "session", scopeId: "s1", allocated: 1000, thresholds: [0.8], depletionAction: "block" });
  registry.create({ budgetId: "b2", scope: "global", allocated: 5000, thresholds: [0.8], depletionAction: "notify" });
  expect(registry.list("session").length).toBe(1);
  expect(registry.list("session")[0].budgetId).toBe("b1");
});

test("budget.adjust: updates allocated amount", () => {
  registry.create({ budgetId: "b1", scope: "session", scopeId: "s1", allocated: 50000, thresholds: [0.8], depletionAction: "block" });
  const adjusted = registry.adjust("b1", 80000);
  expect(adjusted).toBeTruthy();
  expect(adjusted!.allocated).toBe(80000);
});

test("budget.adjust: returns null for non-existent", () => {
  expect(registry.adjust("nonexistent", 10000)).toBe(null);
});

test("budget.remove: deletes existing pool", () => {
  registry.create({ budgetId: "b1", scope: "session", scopeId: "s1", allocated: 1000, thresholds: [0.8], depletionAction: "block" });
  expect(registry.remove("b1")).toBe(true);
  expect(registry.get("b1")).toBe(null);
});

test("budget.remove: returns false for non-existent", () => {
  expect(registry.remove("nonexistent")).toBe(false);
});

test("session cleanup removes session-scoped budgets", () => {
  registry.create({ budgetId: "b1", scope: "session", scopeId: "s1", allocated: 1000, thresholds: [0.8], depletionAction: "block" });
  registry.create({ budgetId: "b2", scope: "global", allocated: 5000, thresholds: [0.8], depletionAction: "notify" });

  const removed = registry.removeBySession("s1");
  expect(removed).toBe(1);
  expect(registry.get("b1")).toBe(null);
  expect(registry.get("b2")).toBeTruthy();
});
