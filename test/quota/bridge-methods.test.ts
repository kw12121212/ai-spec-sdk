import { test, expect } from "bun:test";
import { BridgeServer } from "../../src/bridge.js";
import { getQuotaRegistry, setQuotaRegistry } from "../../src/quota/registry.js";
import type { JsonRpcRequest } from "../../src/bridge.js";

function createBridge(): BridgeServer {
  return new BridgeServer({ transport: "stdio" });
}

function makeRequest(method: string, params?: Record<string, unknown>): JsonRpcRequest {
  return { jsonrpc: "2.0", id: 1, method, params };
}

async function send(bridge: BridgeServer, method: string, params?: Record<string, unknown>) {
  return bridge.handleMessage(makeRequest(method, params));
}

const validQuotaParams = {
  quotaId: "q-test",
  scope: "session",
  scopeId: "s1",
  limit: 1000,
  action: "warn+block",
  warnThreshold: 0.8,
};

test("quota.set creates a rule and returns success", async () => {
  setQuotaRegistry(null);
  const bridge = createBridge();
  const res = await send(bridge, "quota.set", validQuotaParams);
  expect(res.error).toBe(undefined);
  const result = res.result as Record<string, unknown>;
  expect(result.success).toBe(true);
  expect(result.quotaId).toBe("q-test");
});

test("quota.set rejects duplicate quotaId with -32602", async () => {
  setQuotaRegistry(null);
  const bridge = createBridge();
  await send(bridge, "quota.set", validQuotaParams);
  const res = await send(bridge, "quota.set", validQuotaParams);
  expect(res.error).toBeTruthy();
  expect((res.error as Record<string, unknown>).code).toBe(-32602);
});

test("quota.set rejects invalid parameters with -32602", async () => {
  setQuotaRegistry(null);
  const bridge = createBridge();
  const res = await send(bridge, "quota.set", { quotaId: "", scope: "bad" });
  expect(res.error).toBeTruthy();
  expect((res.error as Record<string, unknown>).code).toBe(-32602);
});

test("quota.get returns existing rule", async () => {
  setQuotaRegistry(null);
  const bridge = createBridge();
  await send(bridge, "quota.set", validQuotaParams);
  const res = await send(bridge, "quota.get", { quotaId: "q-test" });
  expect(res.error).toBe(undefined);
  const result = res.result as Record<string, unknown>;
  expect(result.quotaId).toBe("q-test");
  expect(result.scope).toBe("session");
  expect(result.limit).toBe(1000);
});

test("quota.get returns -32061 for non-existent rule", async () => {
  setQuotaRegistry(null);
  const bridge = createBridge();
  const res = await send(bridge, "quota.get", { quotaId: "nonexistent" });
  expect(res.error).toBeTruthy();
  expect((res.error as Record<string, unknown>).code).toBe(-32061);
});

test("quota.get rejects missing quotaId with -32602", async () => {
  const bridge = createBridge();
  const res = await send(bridge, "quota.get", {});
  expect(res.error).toBeTruthy();
  expect((res.error as Record<string, unknown>).code).toBe(-32602);
});

test("quota.list returns all rules when no scope filter", async () => {
  setQuotaRegistry(null);
  const bridge = createBridge();
  await send(bridge, "quota.set", validQuotaParams);
  await send(bridge, "quota.set", { ...validQuotaParams, quotaId: "q2", scope: "global" });
  const res = await send(bridge, "quota.list");
  expect(res.error).toBe(undefined);
  const result = res.result as Array<Record<string, unknown>>;
  expect(result.length).toBe(2);
});

test("quota.list filters by scope parameter", async () => {
  setQuotaRegistry(null);
  const bridge = createBridge();
  await send(bridge, "quota.set", { ...validQuotaParams, quotaId: "q-session", scope: "session" });
  await send(bridge, "quota.set", { ...validQuotaParams, quotaId: "q-global", scope: "global" });
  const res = await send(bridge, "quota.list", { scope: "session" });
  expect(res.error).toBe(undefined);
  const result = res.result as Array<Record<string, unknown>>;
  expect(result.length).toBe(1);
  expect(result[0].scope).toBe("session");
});

test("quota.remove deletes a rule and returns success", async () => {
  setQuotaRegistry(null);
  const bridge = createBridge();
  await send(bridge, "quota.set", validQuotaParams);
  const res = await send(bridge, "quota.remove", { quotaId: "q-test" });
  expect(res.error).toBe(undefined);
  const result = res.result as Record<string, unknown>;
  expect(result.success).toBe(true);

  const getRes = await send(bridge, "quota.get", { quotaId: "q-test" });
  expect(getRes.error).toBeTruthy();
  expect((getRes.error as Record<string, unknown>).code).toBe(-32061);
});

test("quota.remove returns -32061 for non-existent rule", async () => {
  setQuotaRegistry(null);
  const bridge = createBridge();
  const res = await send(bridge, "quota.remove", { quotaId: "ghost" });
  expect(res.error).toBeTruthy();
  expect((res.error as Record<string, unknown>).code).toBe(-32061);
});

test("quota.clear removes all rules and returns count", async () => {
  setQuotaRegistry(null);
  const bridge = createBridge();
  await send(bridge, "quota.set", validQuotaParams);
  await send(bridge, "quota.set", { ...validQuotaParams, quotaId: "q2" });
  const res = await send(bridge, "quota.clear");
  expect(res.error).toBe(undefined);
  const result = res.result as Record<string, unknown>;
  expect(result.success).toBe(true);
  expect(result.clearedCount).toBe(2);
});

test("quota.getStatus returns array of status objects", async () => {
  setQuotaRegistry(null);
  const bridge = createBridge();
  await send(bridge, "quota.set", validQuotaParams);
  const res = await send(bridge, "quota.getStatus", { sessionId: "s1" });
  expect(res.error).toBe(undefined);
  const result = res.result as Array<Record<string, unknown>>;
  expect(result.length).toBe(1);
  expect(result[0].quotaId).toBe("q-test");
  expect(typeof result[0].status).toBe("string");
  expect(typeof result[0].percentage).toBe("number");
});

test("quota.getStatus returns empty array when no rules exist", async () => {
  setQuotaRegistry(null);
  const bridge = createBridge();
  const res = await send(bridge, "quota.getStatus");
  expect(res.error).toBe(undefined);
  const result = res.result as unknown[];
  expect(result.length).toBe(0);
});

test("quota.getViolations returns violations list", async () => {
  setQuotaRegistry(null);
  const bridge = createBridge();
  await send(bridge, "quota.set", validQuotaParams);
  const res = await send(bridge, "quota.getViolations");
  expect(res.error).toBe(undefined);
  expect(Array.isArray(res.result)).toBeTruthy();
});
