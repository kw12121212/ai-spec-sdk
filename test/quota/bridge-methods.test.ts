import test from "node:test";
import assert from "node:assert/strict";
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
  assert.equal(res.error, undefined);
  const result = res.result as Record<string, unknown>;
  assert.equal(result.success, true);
  assert.equal(result.quotaId, "q-test");
});

test("quota.set rejects duplicate quotaId with -32602", async () => {
  setQuotaRegistry(null);
  const bridge = createBridge();
  await send(bridge, "quota.set", validQuotaParams);
  const res = await send(bridge, "quota.set", validQuotaParams);
  assert.ok(res.error);
  assert.equal((res.error as Record<string, unknown>).code, -32602);
});

test("quota.set rejects invalid parameters with -32602", async () => {
  setQuotaRegistry(null);
  const bridge = createBridge();
  const res = await send(bridge, "quota.set", { quotaId: "", scope: "bad" });
  assert.ok(res.error);
  assert.equal((res.error as Record<string, unknown>).code, -32602);
});

test("quota.get returns existing rule", async () => {
  setQuotaRegistry(null);
  const bridge = createBridge();
  await send(bridge, "quota.set", validQuotaParams);
  const res = await send(bridge, "quota.get", { quotaId: "q-test" });
  assert.equal(res.error, undefined);
  const result = res.result as Record<string, unknown>;
  assert.equal(result.quotaId, "q-test");
  assert.equal(result.scope, "session");
  assert.equal(result.limit, 1000);
});

test("quota.get returns -32061 for non-existent rule", async () => {
  setQuotaRegistry(null);
  const bridge = createBridge();
  const res = await send(bridge, "quota.get", { quotaId: "nonexistent" });
  assert.ok(res.error);
  assert.equal((res.error as Record<string, unknown>).code, -32061);
});

test("quota.get rejects missing quotaId with -32602", async () => {
  const bridge = createBridge();
  const res = await send(bridge, "quota.get", {});
  assert.ok(res.error);
  assert.equal((res.error as Record<string, unknown>).code, -32602);
});

test("quota.list returns all rules when no scope filter", async () => {
  setQuotaRegistry(null);
  const bridge = createBridge();
  await send(bridge, "quota.set", validQuotaParams);
  await send(bridge, "quota.set", { ...validQuotaParams, quotaId: "q2", scope: "global" });
  const res = await send(bridge, "quota.list");
  assert.equal(res.error, undefined);
  const result = res.result as Array<Record<string, unknown>>;
  assert.equal(result.length, 2);
});

test("quota.list filters by scope parameter", async () => {
  setQuotaRegistry(null);
  const bridge = createBridge();
  await send(bridge, "quota.set", { ...validQuotaParams, quotaId: "q-session", scope: "session" });
  await send(bridge, "quota.set", { ...validQuotaParams, quotaId: "q-global", scope: "global" });
  const res = await send(bridge, "quota.list", { scope: "session" });
  assert.equal(res.error, undefined);
  const result = res.result as Array<Record<string, unknown>>;
  assert.equal(result.length, 1);
  assert.equal(result[0].scope, "session");
});

test("quota.remove deletes a rule and returns success", async () => {
  setQuotaRegistry(null);
  const bridge = createBridge();
  await send(bridge, "quota.set", validQuotaParams);
  const res = await send(bridge, "quota.remove", { quotaId: "q-test" });
  assert.equal(res.error, undefined);
  const result = res.result as Record<string, unknown>;
  assert.equal(result.success, true);

  const getRes = await send(bridge, "quota.get", { quotaId: "q-test" });
  assert.ok(getRes.error);
  assert.equal((getRes.error as Record<string, unknown>).code, -32061);
});

test("quota.remove returns -32061 for non-existent rule", async () => {
  setQuotaRegistry(null);
  const bridge = createBridge();
  const res = await send(bridge, "quota.remove", { quotaId: "ghost" });
  assert.ok(res.error);
  assert.equal((res.error as Record<string, unknown>).code, -32061);
});

test("quota.clear removes all rules and returns count", async () => {
  setQuotaRegistry(null);
  const bridge = createBridge();
  await send(bridge, "quota.set", validQuotaParams);
  await send(bridge, "quota.set", { ...validQuotaParams, quotaId: "q2" });
  const res = await send(bridge, "quota.clear");
  assert.equal(res.error, undefined);
  const result = res.result as Record<string, unknown>;
  assert.equal(result.success, true);
  assert.equal(result.clearedCount, 2);
});

test("quota.getStatus returns array of status objects", async () => {
  setQuotaRegistry(null);
  const bridge = createBridge();
  await send(bridge, "quota.set", validQuotaParams);
  const res = await send(bridge, "quota.getStatus", { sessionId: "s1" });
  assert.equal(res.error, undefined);
  const result = res.result as Array<Record<string, unknown>>;
  assert.equal(result.length, 1);
  assert.equal(result[0].quotaId, "q-test");
  assert.equal(typeof result[0].status, "string");
  assert.equal(typeof result[0].percentage, "number");
});

test("quota.getStatus returns empty array when no rules exist", async () => {
  setQuotaRegistry(null);
  const bridge = createBridge();
  const res = await send(bridge, "quota.getStatus");
  assert.equal(res.error, undefined);
  const result = res.result as unknown[];
  assert.equal(result.length, 0);
});

test("quota.getViolations returns violations list", async () => {
  setQuotaRegistry(null);
  const bridge = createBridge();
  await send(bridge, "quota.set", validQuotaParams);
  const res = await send(bridge, "quota.getViolations");
  assert.equal(res.error, undefined);
  assert(Array.isArray(res.result));
});
