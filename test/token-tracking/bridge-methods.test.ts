import test from "node:test";
import assert from "node:assert/strict";
import { BridgeServer } from "../../src/bridge.js";
import { getTokenStore, setTokenStore } from "../../src/token-tracking/store.js";
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

function seedData() {
  const store = getTokenStore();
  store.record({
    sessionId: "s-active",
    providerId: "anth-prod",
    providerType: "anthropic",
    inputTokens: 150,
    outputTokens: 300,
  });
  store.record({
    sessionId: "s-active",
    providerId: "openai-dev",
    providerType: "openai",
    inputTokens: 200,
    outputTokens: 400,
  });
  store.record({
    sessionId: "s-other",
    providerId: "anth-prod",
    providerType: "anthropic",
    inputTokens: 50,
    outputTokens: 100,
  });
}

test("token.getUsage returns raw records array for valid session", async () => {
  setTokenStore(null);
  seedData();
  const bridge = createBridge();
  const res = await send(bridge, "token.getUsage", { sessionId: "s-active" });
  assert.equal(res.error, undefined);
  const result = res.result as Record<string, unknown>;
  assert.equal(result.sessionId, "s-active");
  assert.equal(result.totalInputTokens, 350);
  assert.equal(result.totalOutputTokens, 700);
  assert.equal(result.queryCount, 2);
});

test("token.getUsage returns error -32051 for invalid session", async () => {
  const bridge = createBridge();
  const res = await send(bridge, "token.getUsage", { sessionId: "nonexistent" });
  assert.ok(res.error);
  assert.equal((res.error as Record<string, unknown>).code, -32051);
});

test("token.getSessionSummary returns correct aggregation", async () => {
  setTokenStore(null);
  seedData();
  const bridge = createBridge();
  const res = await send(bridge, "token.getSessionSummary", { sessionId: "s-active" });
  assert.equal(res.error, undefined);
  const result = res.result as Record<string, unknown>;
  assert.equal(result.sessionId, "s-active");
  assert.equal(result.totalInputTokens, 350);
  assert.equal(result.totalOutputTokens, 700);
  assert.equal(result.totalTokens, 1050);
  assert.equal(result.queryCount, 2);
});

test("token.getSessionSummary provider breakdown accuracy", async () => {
  setTokenStore(null);
  seedData();
  const bridge = createBridge();
  const res = await send(bridge, "token.getSessionSummary", { sessionId: "s-active" });
  const result = res.result as Record<string, unknown>;
  const breakdown = result.providerBreakdown as Array<Record<string, unknown>>;
  assert.equal(breakdown.length, 2);

  const anthEntry = breakdown.find((b) => b.providerId === "anth-prod")!;
  assert.equal(anthEntry.inputTokens, 150);
  assert.equal(anthEntry.outputTokens, 300);

  const openaiEntry = breakdown.find((b) => b.providerId === "openai-dev")!;
  assert.equal(openaiEntry.inputTokens, 200);
  assert.equal(openaiEntry.outputTokens, 400);
});

test("token.getMessageUsage returns single record", async () => {
  setTokenStore(null);
  const store = getTokenStore();
  store.record({
    sessionId: "s-msg",
    messageId: "m1",
    providerId: "p1",
    providerType: "anthropic",
    inputTokens: 42,
    outputTokens: 84,
  });

  const bridge = createBridge();
  const res = await send(bridge, "token.getMessageUsage", { sessionId: "s-msg", messageId: "m1" });
  assert.equal(res.error, undefined);
  const result = res.result as Record<string, unknown>;
  assert.equal(result.messageId, "m1");
  assert.equal(result.inputTokens, 42);
  assert.equal(result.outputTokens, 84);
});

test("token.getMessageUsage returns error -32052 for invalid message", async () => {
  const bridge = createBridge();
  const res = await send(bridge, "token.getMessageUsage", { sessionId: "s-msg", messageId: "bad-msg" });
  assert.ok(res.error);
  assert.equal((res.error as Record<string, unknown>).code, -32052);
});

test("token.getProviderUsage with filter", async () => {
  setTokenStore(null);
  seedData();
  const bridge = createBridge();
  const res = await send(bridge, "token.getProviderUsage", { providerId: "anth-prod" });
  assert.equal(res.error, undefined);
  const results = res.result as Array<Record<string, unknown>>;
  assert.equal(results.length, 1);
  assert.equal(results[0].providerId, "anth-prod");
  assert.equal(results[0].totalInputTokens, 200);
  assert.equal(results[0].queryCount, 2);
});

test("token.getProviderUsage without filter returns all", async () => {
  setTokenStore(null);
  seedData();
  const bridge = createBridge();
  const res = await send(bridge, "token.getProviderUsage");
  assert.equal(res.error, undefined);
  const results = res.result as Array<Record<string, unknown>>;
  assert.ok(results.length >= 2);
});

test("token.clearAll clears and returns count", async () => {
  setTokenStore(null);
  seedData();
  const bridge = createBridge();
  const res = await send(bridge, "token.clearAll");
  assert.equal(res.error, undefined);
  const result = res.result as Record<string, unknown>;
  assert.equal(result.success, true);
  assert.ok(typeof result.clearedCount === "number");
  assert.ok((result.clearedCount as number) > 0);

  const summary = getTokenStore().getSessionUsage("s-active");
  assert.equal(summary, null);
});
