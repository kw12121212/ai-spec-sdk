import { test, expect } from "bun:test";
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
  expect(res.error).toBeUndefined();
  const result = res.result as Record<string, unknown>;
  expect(result.sessionId).toBe("s-active");
  expect(result.totalInputTokens).toBe(350);
  expect(result.totalOutputTokens).toBe(700);
  expect(result.queryCount).toBe(2);
});

test("token.getUsage returns error -32051 for invalid session", async () => {
  const bridge = createBridge();
  const res = await send(bridge, "token.getUsage", { sessionId: "nonexistent" });
  expect(res.error).toBeTruthy();
  expect((res.error as Record<string, unknown>).code).toBe(-32051);
});

test("token.getSessionSummary returns correct aggregation", async () => {
  setTokenStore(null);
  seedData();
  const bridge = createBridge();
  const res = await send(bridge, "token.getSessionSummary", { sessionId: "s-active" });
  expect(res.error).toBeUndefined();
  const result = res.result as Record<string, unknown>;
  expect(result.sessionId).toBe("s-active");
  expect(result.totalInputTokens).toBe(350);
  expect(result.totalOutputTokens).toBe(700);
  expect(result.totalTokens).toBe(1050);
  expect(result.queryCount).toBe(2);
});

test("token.getSessionSummary provider breakdown accuracy", async () => {
  setTokenStore(null);
  seedData();
  const bridge = createBridge();
  const res = await send(bridge, "token.getSessionSummary", { sessionId: "s-active" });
  const result = res.result as Record<string, unknown>;
  const breakdown = result.providerBreakdown as Array<Record<string, unknown>>;
  expect(breakdown.length).toBe(2);

  const anthEntry = breakdown.find((b) => b.providerId === "anth-prod")!;
  expect(anthEntry.inputTokens).toBe(150);
  expect(anthEntry.outputTokens).toBe(300);

  const openaiEntry = breakdown.find((b) => b.providerId === "openai-dev")!;
  expect(openaiEntry.inputTokens).toBe(200);
  expect(openaiEntry.outputTokens).toBe(400);
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
  expect(res.error).toBeUndefined();
  const result = res.result as Record<string, unknown>;
  expect(result.messageId).toBe("m1");
  expect(result.inputTokens).toBe(42);
  expect(result.outputTokens).toBe(84);
});

test("token.getMessageUsage returns error -32052 for invalid message", async () => {
  const bridge = createBridge();
  const res = await send(bridge, "token.getMessageUsage", { sessionId: "s-msg", messageId: "bad-msg" });
  expect(res.error).toBeTruthy();
  expect((res.error as Record<string, unknown>).code).toBe(-32052);
});

test("token.getProviderUsage with filter", async () => {
  setTokenStore(null);
  seedData();
  const bridge = createBridge();
  const res = await send(bridge, "token.getProviderUsage", { providerId: "anth-prod" });
  expect(res.error).toBeUndefined();
  const results = res.result as Array<Record<string, unknown>>;
  expect(results.length).toBe(1);
  expect(results[0].providerId).toBe("anth-prod");
  expect(results[0].totalInputTokens).toBe(200);
  expect(results[0].queryCount).toBe(2);
});

test("token.getProviderUsage without filter returns all", async () => {
  setTokenStore(null);
  seedData();
  const bridge = createBridge();
  const res = await send(bridge, "token.getProviderUsage");
  expect(res.error).toBeUndefined();
  const results = res.result as Array<Record<string, unknown>>;
  expect(results.length >= 2).toBeTruthy();
});

test("token.clearAll clears and returns count", async () => {
  setTokenStore(null);
  seedData();
  const bridge = createBridge();
  const res = await send(bridge, "token.clearAll");
  expect(res.error).toBeUndefined();
  const result = res.result as Record<string, unknown>;
  expect(result.success).toBe(true);
  expect(typeof result.clearedCount === "number").toBeTruthy();
  expect((result.clearedCount as number) > 0).toBeTruthy();

  const summary = getTokenStore().getSessionUsage("s-active");
  expect(summary).toBeNull();
});
