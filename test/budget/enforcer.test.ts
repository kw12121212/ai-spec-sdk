import { test, expect, beforeEach } from "bun:test";
import { BudgetRegistry, setBudgetRegistry } from "../../src/budget/registry.js";
import { setTokenStore } from "../../src/token-tracking/store.js";
import { InMemoryTokenStore } from "../../src/token-tracking/store.js";
import { preQueryBudgetCheck, postQueryBudgetCheck, buildBudgetStatuses } from "../../src/budget/enforcer.js";
import type { BudgetAlertPayload } from "../../src/budget/types.js";

let registry: BudgetRegistry;
let tokenStore: InMemoryTokenStore;

beforeEach(() => {
  registry = new BudgetRegistry();
  setBudgetRegistry(registry);
  tokenStore = new InMemoryTokenStore();
  setTokenStore(tokenStore);
});

test("preQueryBudgetCheck: allowed when no pools exist", () => {
  const result = preQueryBudgetCheck("s1");
  expect(result.allowed).toBe(true);
  expect(result.alerts).toEqual([]);
});

test("preQueryBudgetCheck: allowed when budget has remaining", () => {
  registry.create({
    budgetId: "b1",
    scope: "session",
    scopeId: "s1",
    allocated: 50000,
    thresholds: [0.8],
    depletionAction: "block",
  });
  tokenStore.record({
    sessionId: "s1",
    providerId: "anthropic",
    providerType: "anthropic",
    inputTokens: 100,
    outputTokens: 200,
    timestamp: Date.now(),
  });

  const result = preQueryBudgetCheck("s1");
  expect(result.allowed).toBe(true);
});

test("preQueryBudgetCheck: blocked when budget exhausted with block action", () => {
  registry.create({
    budgetId: "b1",
    scope: "session",
    scopeId: "s1",
    allocated: 300,
    thresholds: [0.8],
    depletionAction: "block",
  });
  tokenStore.record({
    sessionId: "s1",
    providerId: "anthropic",
    providerType: "anthropic",
    inputTokens: 100,
    outputTokens: 200,
    timestamp: Date.now(),
  });

  const result = preQueryBudgetCheck("s1");
  expect(result.allowed).toBe(false);
  expect(result.alerts.length).toBe(1);
  expect(result.alerts[0].depletionAction).toBe("block");
});

test("preQueryBudgetCheck: notify action allows query when exhausted", () => {
  const alerts: BudgetAlertPayload[] = [];
  registry.create({
    budgetId: "b1",
    scope: "session",
    scopeId: "s1",
    allocated: 300,
    thresholds: [0.8],
    depletionAction: "notify",
  });
  tokenStore.record({
    sessionId: "s1",
    providerId: "anthropic",
    providerType: "anthropic",
    inputTokens: 100,
    outputTokens: 200,
    timestamp: Date.now(),
  });

  const result = preQueryBudgetCheck("s1", undefined, {
    onAlert: (a) => alerts.push(a),
  });
  expect(result.allowed).toBe(true);
  expect(alerts.length).toBe(1);
  expect(alerts[0].depletionAction).toBe("notify");
});

test("preQueryBudgetCheck: throttle action calls onThrottle", () => {
  let throttledSession: string | null = null;
  registry.create({
    budgetId: "b1",
    scope: "session",
    scopeId: "s1",
    allocated: 300,
    thresholds: [0.8],
    depletionAction: "throttle",
  });
  tokenStore.record({
    sessionId: "s1",
    providerId: "anthropic",
    providerType: "anthropic",
    inputTokens: 100,
    outputTokens: 200,
    timestamp: Date.now(),
  });

  const result = preQueryBudgetCheck("s1", undefined, {
    onThrottle: (sid) => { throttledSession = sid; },
  });
  expect(result.allowed).toBe(true);
  expect(throttledSession).toBe("s1");
});

test("postQueryBudgetCheck: fires alert when threshold crossed", () => {
  const alerts: BudgetAlertPayload[] = [];
  registry.create({
    budgetId: "b1",
    scope: "session",
    scopeId: "s1",
    allocated: 1000,
    thresholds: [0.5, 0.8],
    depletionAction: "notify",
  });
  tokenStore.record({
    sessionId: "s1",
    providerId: "anthropic",
    providerType: "anthropic",
    inputTokens: 450,
    outputTokens: 350,
    timestamp: Date.now(),
  });

  postQueryBudgetCheck("s1", undefined, {
    onAlert: (a) => alerts.push(a),
  });
  // 800/1000 = 0.8, both 0.5 and 0.8 should fire
  expect(alerts.length).toBe(2);
  expect(alerts[0].threshold).toBe(0.5);
  expect(alerts[1].threshold).toBe(0.8);
});

test("postQueryBudgetCheck: threshold deduplication — no re-fire", () => {
  registry.create({
    budgetId: "b1",
    scope: "session",
    scopeId: "s1",
    allocated: 1000,
    thresholds: [0.8],
    depletionAction: "notify",
  });
  tokenStore.record({
    sessionId: "s1",
    providerId: "anthropic",
    providerType: "anthropic",
    inputTokens: 450,
    outputTokens: 350,
    timestamp: Date.now(),
  });

  const alerts1 = postQueryBudgetCheck("s1");
  expect(alerts1.length).toBe(1);

  const alerts2 = postQueryBudgetCheck("s1");
  expect(alerts2.length).toBe(0);
});

test("postQueryBudgetCheck: threshold fires again after adjust resets it", () => {
  registry.create({
    budgetId: "b1",
    scope: "session",
    scopeId: "s1",
    allocated: 1000,
    thresholds: [0.8],
    depletionAction: "notify",
  });
  tokenStore.record({
    sessionId: "s1",
    providerId: "anthropic",
    providerType: "anthropic",
    inputTokens: 450,
    outputTokens: 350,
    timestamp: Date.now(),
  });

  // First fire
  const alerts1 = postQueryBudgetCheck("s1");
  expect(alerts1.length).toBe(1);

  // Adjust resets triggered thresholds
  registry.adjust("b1", 2000);

  // Now 800/2000 = 0.4, below threshold, should not fire
  const alerts2 = postQueryBudgetCheck("s1");
  expect(alerts2.length).toBe(0);

  // Add more tokens to cross 0.8 of 2000 = 1600
  tokenStore.record({
    sessionId: "s1",
    providerId: "anthropic",
    providerType: "anthropic",
    inputTokens: 400,
    outputTokens: 400,
    timestamp: Date.now(),
  });

  // Now 1600/2000 = 0.8, should fire again
  const alerts3 = postQueryBudgetCheck("s1");
  expect(alerts3.length).toBe(1);
});

test("buildBudgetStatuses: computes consumed, remaining, percentage", () => {
  registry.create({
    budgetId: "b1",
    scope: "session",
    scopeId: "s1",
    allocated: 1000,
    thresholds: [0.8],
    depletionAction: "block",
  });
  tokenStore.record({
    sessionId: "s1",
    providerId: "anthropic",
    providerType: "anthropic",
    inputTokens: 300,
    outputTokens: 200,
    timestamp: Date.now(),
  });

  const pools = registry.list();
  const statuses = buildBudgetStatuses(pools, "s1");
  expect(statuses.length).toBe(1);
  expect(statuses[0].consumed).toBe(500);
  expect(statuses[0].remaining).toBe(500);
  expect(statuses[0].percentage).toBe(0.5);
  expect(statuses[0].triggeredThresholds).toEqual([]);
});

test("buildBudgetStatuses: remaining clamped to 0 when consumed > allocated", () => {
  registry.create({
    budgetId: "b1",
    scope: "session",
    scopeId: "s1",
    allocated: 300,
    thresholds: [0.8],
    depletionAction: "block",
  });
  tokenStore.record({
    sessionId: "s1",
    providerId: "anthropic",
    providerType: "anthropic",
    inputTokens: 200,
    outputTokens: 200,
    timestamp: Date.now(),
  });

  const pools = registry.list();
  const statuses = buildBudgetStatuses(pools, "s1");
  expect(statuses[0].consumed).toBe(400);
  expect(statuses[0].remaining).toBe(0);
});
