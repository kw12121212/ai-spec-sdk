import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryTokenStore, getTokenStore, setTokenStore } from "../../src/token-tracking/store.js";

function createFreshStore(): InMemoryTokenStore {
  return new InMemoryTokenStore();
}

test("record() stores entry with correct structure", () => {
  const store = createFreshStore();
  const ok = store.record({
    sessionId: "s1",
    messageId: "m1",
    providerId: "p1",
    providerType: "anthropic",
    timestamp: 1000,
    inputTokens: 10,
    outputTokens: 20,
  });
  assert.equal(ok, true);

  const summary = store.getSessionUsage("s1");
  assert.ok(summary);
  assert.equal(summary!.queryCount, 1);
  assert.equal(summary!.totalInputTokens, 10);
  assert.equal(summary!.totalOutputTokens, 20);
  assert.equal(summary!.totalTokens, 30);
});

test("record() rejects negative token values", () => {
  const store = createFreshStore();
  const ok = store.record({
    sessionId: "s1",
    providerId: "p1",
    providerType: "anthropic",
    inputTokens: -5,
    outputTokens: 10,
  });
  assert.equal(ok, false);
  assert.equal(store.getSessionUsage("s1"), null);
});

test("record() auto-generates timestamp when missing", () => {
  const store = createFreshStore();
  const before = Date.now();
  store.record({
    sessionId: "s1",
    providerId: "p1",
    providerType: "anthropic",
    inputTokens: 1,
    outputTokens: 1,
  });
  const after = Date.now();

  const msgUsage = store.getMessageUsage("s1", undefined!);
  assert.ok(msgUsage);
  assert.ok(msgUsage!.timestamp >= before);
  assert.ok(msgUsage!.timestamp <= after);
});

test("record() auto-computes totalTokens", () => {
  const store = createFreshStore();
  store.record({
    sessionId: "s1",
    providerId: "p1",
    providerType: "anthropic",
    inputTokens: 123,
    outputTokens: 456,
  });

  const summary = store.getSessionUsage("s1");
  assert.ok(summary);
  assert.equal(summary!.totalTokens, 579);
});

test("getSessionUsage() aggregates multiple records correctly", () => {
  const store = createFreshStore();
  store.record({
    sessionId: "s1",
    providerId: "p1",
    providerType: "anthropic",
    inputTokens: 100,
    outputTokens: 200,
  });
  store.record({
    sessionId: "s1",
    providerId: "p1",
    providerType: "anthropic",
    inputTokens: 50,
    outputTokens: 150,
  });
  store.record({
    sessionId: "s1",
    providerId: "p2",
    providerType: "openai",
    inputTokens: 30,
    outputTokens: 70,
  });

  const summary = store.getSessionUsage("s1");
  assert.ok(summary);
  assert.equal(summary!.totalInputTokens, 180);
  assert.equal(summary!.totalOutputTokens, 420);
  assert.equal(summary!.totalTokens, 600);
  assert.equal(summary!.queryCount, 3);
});

test("getSessionUsage() returns null for non-existent session", () => {
  const store = createFreshStore();
  assert.equal(store.getSessionUsage("nonexistent"), null);
});

test("getSessionUsage() includes correct providerBreakdown", () => {
  const store = createFreshStore();
  store.record({
    sessionId: "s1",
    providerId: "anth-1",
    providerType: "anthropic",
    inputTokens: 150,
    outputTokens: 300,
  });
  store.record({
    sessionId: "s1",
    providerId: "anth-1",
    providerType: "anthropic",
    inputTokens: 50,
    outputTokens: 100,
  });
  store.record({
    sessionId: "s1",
    providerId: "openai-1",
    providerType: "openai",
    inputTokens: 200,
    outputTokens: 400,
  });

  const summary = store.getSessionUsage("s1")!;
  assert.equal(summary.providerBreakdown.length, 2);

  const anthBreakdown = summary.providerBreakdown.find((b) => b.providerId === "anth-1");
  assert.ok(anthBreakdown);
  assert.equal(anthBreakdown!.inputTokens, 200);
  assert.equal(anthBreakdown!.outputTokens, 400);

  const openaiBreakdown = summary.providerBreakdown.find((b) => b.providerId === "openai-1");
  assert.ok(openaiBreakdown);
  assert.equal(openaiBreakdown!.inputTokens, 200);
  assert.equal(openaiBreakdown!.outputTokens, 400);
});

test("getMessageUsage() returns correct single record", () => {
  const store = createFreshStore();
  store.record({
    sessionId: "s1",
    messageId: "m1",
    providerId: "p1",
    providerType: "anthropic",
    inputTokens: 10,
    outputTokens: 20,
  });
  store.record({
    sessionId: "s1",
    messageId: "m2",
    providerId: "p1",
    providerType: "anthropic",
    inputTokens: 30,
    outputTokens: 40,
  });

  const record = store.getMessageUsage("s1", "m1");
  assert.ok(record);
  assert.equal(record!.messageId, "m1");
  assert.equal(record!.inputTokens, 10);
  assert.equal(record!.outputTokens, 20);
});

test("getMessageUsage() returns null for non-existent message", () => {
  const store = createFreshStore();
  store.record({
    sessionId: "s1",
    messageId: "m1",
    providerId: "p1",
    providerType: "anthropic",
    inputTokens: 10,
    outputTokens: 20,
  });

  assert.equal(store.getMessageUsage("s1", "m999"), null);
  assert.equal(store.getMessageUsage("nonexistent", "m1"), null);
});

test("getProviderUsage() filters by providerId when specified", () => {
  const store = createFreshStore();
  for (let i = 0; i < 3; i++) {
    store.record({
      sessionId: `s${i}`,
      providerId: "anth-prod",
      providerType: "anthropic",
      inputTokens: 100,
      outputTokens: 200,
    });
  }
  store.record({
    sessionId: "s3",
    providerId: "other-p",
    providerType: "openai",
    inputTokens: 500,
    outputTokens: 500,
  });

  const results = store.getProviderUsage("anth-prod");
  assert.equal(results.length, 1);
  assert.equal(results[0].providerId, "anth-prod");
  assert.equal(results[0].totalInputTokens, 300);
  assert.equal(results[0].totalOutputTokens, 600);
  assert.equal(results[0].queryCount, 3);
});

test("getProviderUsage() returns all providers when no filter", () => {
  const store = createFreshStore();
  store.record({
    sessionId: "s1",
    providerId: "anth-1",
    providerType: "anthropic",
    inputTokens: 100,
    outputTokens: 200,
  });
  store.record({
    sessionId: "s2",
    providerId: "openai-1",
    providerType: "openai",
    inputTokens: 300,
    outputTokens: 400,
  });
  store.record({
    sessionId: "s3",
    providerId: "local-1",
    providerType: "local",
    inputTokens: 50,
    outputTokens: 50,
  });

  const results = store.getProviderUsage();
  assert.equal(results.length, 3);
});

test("getProviderUsage() returns zero-entry for unused provider", () => {
  const store = createFreshStore();
  store.record({
    sessionId: "s1",
    providerId: "used-p",
    providerType: "anthropic",
    inputTokens: 10,
    outputTokens: 20,
  });

  const results = store.getProviderUsage("unused-provider");
  assert.equal(results.length, 1);
  assert.equal(results[0].providerId, "unused-provider");
  assert.equal(results[0].totalInputTokens, 0);
  assert.equal(results[0].totalOutputTokens, 0);
  assert.equal(results[0].queryCount, 0);
});

test("clearSession() removes only target session's records", () => {
  const store = createFreshStore();
  store.record({
    sessionId: "s1",
    providerId: "p1",
    providerType: "anthropic",
    inputTokens: 10,
    outputTokens: 20,
  });
  store.record({
    sessionId: "s1",
    providerId: "p1",
    providerType: "anthropic",
    inputTokens: 5,
    outputTokens: 15,
  });
  store.record({
    sessionId: "s2",
    providerId: "p1",
    providerType: "anthropic",
    inputTokens: 99,
    outputTokens: 99,
  });

  const removed = store.clearSession("s1");
  assert.equal(removed, 2);
  assert.equal(store.getSessionUsage("s1"), null);
  assert.ok(store.getSessionUsage("s2"));
});

test("clearAll() removes all records and returns count", () => {
  const store = createFreshStore();
  store.record({ sessionId: "s1", providerId: "p1", providerType: "a", inputTokens: 1, outputTokens: 1 });
  store.record({ sessionId: "s2", providerId: "p1", providerType: "a", inputTokens: 2, outputTokens: 2 });
  store.record({ sessionId: "s3", providerId: "p1", providerType: "a", inputTokens: 3, outputTokens: 3 });

  const count = store.clearAll();
  assert.equal(count, 3);
  assert.equal(store.getSessionUsage("s1"), null);
  assert.equal(store.getSessionUsage("s2"), null);
  assert.equal(store.getSessionUsage("s3"), null);
});

test("getTokenStore/setTokenStore singleton pattern", () => {
  setTokenStore(null);
  const a = getTokenStore();
  const b = getTokenStore();
  assert.equal(a, b);

  const fresh = new InMemoryTokenStore();
  setTokenStore(fresh);
  assert.equal(getTokenStore(), fresh);

  setTokenStore(null);
});
