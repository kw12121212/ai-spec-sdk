import { test, expect } from "bun:test";
import { BridgeServer } from "../../src/bridge.js";
import { getQuotaRegistry, setQuotaRegistry } from "../../src/quota/registry.js";
import { InMemoryTokenStore, setTokenStore } from "../../src/token-tracking/store.js";

function createBridge(): BridgeServer {
  return new BridgeServer({ transport: "stdio" });
}

function makeRequest(method: string, params?: Record<string, unknown>) {
  return { jsonrpc: "2.0" as const, id: 1, method, params };
}

async function send(bridge: BridgeServer, method: string, params?: Record<string, unknown>) {
  return bridge.handleMessage(makeRequest(method, params));
}

function setupIntegrationEnv() {
  const tokenStore = new InMemoryTokenStore();
  setTokenStore(tokenStore);
  setQuotaRegistry(null);

  tokenStore.record({
    sessionId: "s-integ",
    providerId: "p1",
    providerType: "anthropic",
    inputTokens: 100,
    outputTokens: 100,
  });

  return { tokenStore };
}

test("full flow: quota.set → check status → record more tokens → status updates", async () => {
  const { tokenStore } = setupIntegrationEnv();
  const bridge = createBridge();

  await send(bridge, "quota.set", {
    quotaId: "q-integ",
    scope: "session",
    scopeId: "s-integ",
    limit: 500,
    action: "warn+block",
    warnThreshold: 0.8,
  });

  const statusRes = await send(bridge, "quota.getStatus", { sessionId: "s-integ" });
  expect(statusRes.error).toBe(undefined);
  const statuses = statusRes.result as Array<Record<string, unknown>>;
  expect(statuses.length).toBe(1);
  expect(statuses[0].status).toBe("ok");

  tokenStore.record({
    sessionId: "s-integ",
    providerId: "p1",
    providerType: "anthropic",
    inputTokens: 300,
    outputTokens: 100,
  });

  const statusRes2 = await send(bridge, "quota.getStatus", { sessionId: "s-integ" });
  const statuses2 = statusRes2.result as Array<Record<string, unknown>>;
  expect(statuses2[0].status).toBe("exceeded");
});

test("registry.removeBySession cleans up session-scoped rules", () => {
  const registry = getQuotaRegistry();
  registry.clear();

  registry.set({
    quotaId: "q-session-cleanup",
    scope: "session",
    scopeId: "s-to-delete",
    limit: 1000,
    action: "warn+block",
    warnThreshold: 0.8,
  });
  registry.set({
    quotaId: "q-global-keep",
    scope: "global",
    limit: 99999,
    action: "warn+block",
    warnThreshold: 0.9,
  });

  expect(registry.size).toBe(2);

  const removed = registry.removeBySession("s-to-delete");
  expect(removed).toBe(1);
  expect(registry.size).toBe(1);
  expect(registry.get("q-global-keep")).toBeTruthy();
  expect(registry.get("q-session-cleanup")).toBe(null);
});

test("global rule persists after session-scoped cleanup", () => {
  const registry = getQuotaRegistry();
  registry.clear();

  registry.set({ quotaId: "q-g1", scope: "global", limit: 99999, action: "warn+block", warnThreshold: 0.9 });
  registry.set({ quotaId: "q-s1", scope: "session", scopeId: "s-x", limit: 100, action: "block", warnThreshold: 0.5 });

  registry.removeBySession("s-x");

  expect(registry.size).toBe(1);
  expect(registry.list()[0].quotaId).toBe("q-g1");
});

test("quota.getViolations returns empty when no violations recorded", async () => {
  setupIntegrationEnv();
  const bridge = createBridge();

  await send(bridge, "quota.set", {
    quotaId: "q-no-violation",
    scope: "session",
    scopeId: "s-nv",
    limit: 99999,
    action: "warn+block",
  });

  const res = await send(bridge, "quota.getViolations");
  expect(res.error).toBe(undefined);
  const violations = res.result as unknown[];
  expect(violations.length).toBe(0);
});

test("capabilities include all quota.* methods", async () => {
  const bridge = createBridge();
  const res = await send(bridge, "bridge.capabilities");
  expect(res.error).toBe(undefined);
  const caps = res.result as Record<string, unknown>;
  const methods = caps.methods as string[];

  const expectedMethods = [
    "quota.set", "quota.get", "quota.list", "quota.remove",
    "quota.clear", "quota.getStatus", "quota.getViolations",
  ];
  for (const m of expectedMethods) {
    expect(methods.includes(m)).toBeTruthy();
  }
});
