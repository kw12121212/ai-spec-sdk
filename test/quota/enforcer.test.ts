import { test, expect } from "bun:test";
import { preQueryCheck, postQueryCheck, buildQuotaStatuses } from "../../src/quota/enforcer.js";
import { QuotaRegistry, setQuotaRegistry } from "../../src/quota/registry.js";
import { InMemoryTokenStore, setTokenStore } from "../../src/token-tracking/store.js";
import type { QuotaRule } from "../../src/quota/types.js";

function setupTestEnv() {
  const tokenStore = new InMemoryTokenStore();
  setTokenStore(tokenStore);
  const registry = new QuotaRegistry();
  setQuotaRegistry(registry);
  return { tokenStore, registry };
}

const sessionRule: QuotaRule = {
  quotaId: "q-session",
  scope: "session",
  scopeId: "s1",
  limit: 1000,
  action: "warn+block",
  warnThreshold: 0.8,
};

test("preQueryCheck allows when no rules exist", () => {
  setupTestEnv();
  const result = preQueryCheck("s1", "p1");
  expect(result.allowed).toBe(true);
  expect(result.warnings.length).toBe(0);
  expect(result.violation).toBe(undefined);
});

test("preQueryCheck allows when usage is below threshold", () => {
  const { tokenStore, registry } = setupTestEnv();
  registry.set(sessionRule);

  tokenStore.record({
    sessionId: "s1",
    providerId: "p1",
    providerType: "anthropic",
    inputTokens: 100,
    outputTokens: 100,
  });

  const result = preQueryCheck("s1", "p1");
  expect(result.allowed).toBe(true);
  expect(result.warnings.length).toBe(0);
});

test("preQueryCheck warns when usage exceeds warnThreshold but not limit (warn action)", () => {
  const { tokenStore, registry } = setupTestEnv();
  registry.set({ ...sessionRule, quotaId: "q-warn-only", action: "warn" });

  tokenStore.record({
    sessionId: "s1",
    providerId: "p1",
    providerType: "anthropic",
    inputTokens: 500,
    outputTokens: 400,
  });

  const warnings: unknown[] = [];
  const result = preQueryCheck("s1", "p1", {
    onWarning: (w) => warnings.push(w),
  });
  expect(result.allowed).toBe(true);
  expect(result.warnings.length).toBe(1);
  expect(warnings.length).toBe(1);
  expect((warnings[0] as Record<string, unknown>).quotaId).toBe("q-warn-only");
});

test("preQueryCheck blocks when usage exceeds limit with block action", () => {
  const { tokenStore, registry } = setupTestEnv();
  registry.set(sessionRule);

  tokenStore.record({
    sessionId: "s1",
    providerId: "p1",
    providerType: "anthropic",
    inputTokens: 600,
    outputTokens: 500,
  });

  const blockedNotifications: unknown[] = [];
  const result = preQueryCheck("s1", "p1", {
    onBlocked: (n) => blockedNotifications.push(n),
  });
  expect(result.allowed).toBe(false);
  expect(result.violation).toBeTruthy();
  expect(result.violation!.blocked).toBe(true);
  expect(blockedNotifications.length).toBe(1);
});

test("preQueryCheck does not block when action is warn only even at limit", () => {
  const { tokenStore, registry } = setupTestEnv();
  registry.set({ ...sessionRule, quotaId: "q-warn-no-block", action: "warn" });

  tokenStore.record({
    sessionId: "s1",
    providerId: "p1",
    providerType: "anthropic",
    inputTokens: 1000,
    outputTokens: 100,
  });

  const result = preQueryCheck("s1", "p1");
  expect(result.allowed).toBe(true);
  expect(result.warnings.length).toBe(1);
});

test("postQueryCheck returns warnings after recording tokens", () => {
  const { tokenStore, registry } = setupTestEnv();
  registry.set({ ...sessionRule, action: "warn" });

  tokenStore.record({
    sessionId: "s1",
    providerId: "p1",
    providerType: "anthropic",
    inputTokens: 850,
    outputTokens: 50,
  });

  const warnings = postQueryCheck("s1", "p1");
  expect(warnings.length).toBe(1);
  expect(warnings[0].percentage >= 0.8).toBeTruthy();
});

test("postQueryCheck returns empty when no rules match", () => {
  setupTestEnv();
  const warnings = postQueryCheck("s1", "p1");
  expect(warnings.length).toBe(0);
});

test("global scope rule matches any session/provider", () => {
  const { tokenStore, registry } = setupTestEnv();
  registry.set({ ...sessionRule, quotaId: "q-global", scope: "global" });

  tokenStore.record({
    sessionId: "any-session",
    providerId: "any-provider",
    providerType: "anthropic",
    inputTokens: 1100,
    outputTokens: 100,
  });

  const result = preQueryCheck("any-session", "any-provider");
  expect(result.allowed).toBe(false);
});

test("provider scope rule matches only that providerId", () => {
  const { tokenStore, registry } = setupTestEnv();
  registry.set({ ...sessionRule, quotaId: "q-provider", scope: "provider", scopeId: "p1", limit: 500 });

  tokenStore.record({
    sessionId: "s1",
    providerId: "p1",
    providerType: "anthropic",
    inputTokens: 300,
    outputTokens: 300,
  });

  const resultForP1 = preQueryCheck("s1", "p1");
  expect(resultForP1.allowed).toBe(false);

  const resultForP2 = preQueryCheck("s1", "p2");
  expect(resultForP2.allowed).toBe(true);
});

test("buildQuotaStatuses computes correct status for each rule", () => {
  const { tokenStore, registry } = setupTestEnv();
  registry.set({ ...sessionRule, quotaId: "q-ok", limit: 10000 });
  registry.set({ ...sessionRule, quotaId: "q-warn", warnThreshold: 0.5 });
  registry.set({ ...sessionRule, quotaId: "q-exceeded", limit: 200 });

  tokenStore.record({
    sessionId: "s1",
    providerId: "p1",
    providerType: "anthropic",
    inputTokens: 300,
    outputTokens: 300,
  });

  const statuses = buildQuotaStatuses(registry.list(), "s1", "p1");

  const okStatus = statuses.find((s) => s.quotaId === "q-ok");
  expect(okStatus).toBeTruthy();
  expect(okStatus!.status).toBe("ok");

  const warnStatus = statuses.find((s) => s.quotaId === "q-warn");
  expect(warnStatus).toBeTruthy();
  expect(warnStatus!.status).toBe("warning");

  const exceededStatus = statuses.find((s) => s.quotaId === "q-exceeded");
  expect(exceededStatus).toBeTruthy();
  expect(exceededStatus!.status).toBe("exceeded");
});
