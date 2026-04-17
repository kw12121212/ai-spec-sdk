import { test, expect } from "bun:test";
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
  expect(ok).toBe(true);

  const summary = store.getSessionUsage("s1");
  expect(summary).toBeTruthy();
  expect(summary!.queryCount).toBe(1);
  expect(summary!.totalInputTokens).toBe(10);
  expect(summary!.totalOutputTokens).toBe(20);
  expect(summary!.totalTokens).toBe(30);
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
  expect(ok).toBe(false);
  expect(store.getSessionUsage("s1")).toBeNull();
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
  expect(msgUsage).toBeTruthy();
  expect(msgUsage!.timestamp >= before).toBeTruthy();
  expect(msgUsage!.timestamp <= after).toBeTruthy();
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
  expect(summary).toBeTruthy();
  expect(summary!.totalTokens).toBe(579);
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
  expect(summary).toBeTruthy();
  expect(summary!.totalInputTokens).toBe(180);
  expect(summary!.totalOutputTokens).toBe(420);
  expect(summary!.totalTokens).toBe(600);
  expect(summary!.queryCount).toBe(3);
});

test("getSessionUsage() returns null for non-existent session", () => {
  const store = createFreshStore();
  expect(store.getSessionUsage("nonexistent")).toBeNull();
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
  expect(summary.providerBreakdown.length).toBe(2);

  const anthBreakdown = summary.providerBreakdown.find((b) => b.providerId === "anth-1");
  expect(anthBreakdown).toBeTruthy();
  expect(anthBreakdown!.inputTokens).toBe(200);
  expect(anthBreakdown!.outputTokens).toBe(400);

  const openaiBreakdown = summary.providerBreakdown.find((b) => b.providerId === "openai-1");
  expect(openaiBreakdown).toBeTruthy();
  expect(openaiBreakdown!.inputTokens).toBe(200);
  expect(openaiBreakdown!.outputTokens).toBe(400);
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
  expect(record).toBeTruthy();
  expect(record!.messageId).toBe("m1");
  expect(record!.inputTokens).toBe(10);
  expect(record!.outputTokens).toBe(20);
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

  expect(store.getMessageUsage("s1", "m999")).toBeNull();
  expect(store.getMessageUsage("nonexistent", "m1")).toBeNull();
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
  expect(results.length).toBe(1);
  expect(results[0].providerId).toBe("anth-prod");
  expect(results[0].totalInputTokens).toBe(300);
  expect(results[0].totalOutputTokens).toBe(600);
  expect(results[0].queryCount).toBe(3);
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
  expect(results.length).toBe(3);
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
  expect(results.length).toBe(1);
  expect(results[0].providerId).toBe("unused-provider");
  expect(results[0].totalInputTokens).toBe(0);
  expect(results[0].totalOutputTokens).toBe(0);
  expect(results[0].queryCount).toBe(0);
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
  expect(removed).toBe(2);
  expect(store.getSessionUsage("s1")).toBeNull();
  expect(store.getSessionUsage("s2")).toBeTruthy();
});

test("clearAll() removes all records and returns count", () => {
  const store = createFreshStore();
  store.record({ sessionId: "s1", providerId: "p1", providerType: "a", inputTokens: 1, outputTokens: 1 });
  store.record({ sessionId: "s2", providerId: "p1", providerType: "a", inputTokens: 2, outputTokens: 2 });
  store.record({ sessionId: "s3", providerId: "p1", providerType: "a", inputTokens: 3, outputTokens: 3 });

  const count = store.clearAll();
  expect(count).toBe(3);
  expect(store.getSessionUsage("s1")).toBeNull();
  expect(store.getSessionUsage("s2")).toBeNull();
  expect(store.getSessionUsage("s3")).toBeNull();
});

test("getTokenStore/setTokenStore singleton pattern", () => {
  setTokenStore(null);
  const a = getTokenStore();
  const b = getTokenStore();
  expect(a).toBe(b);

  const fresh = new InMemoryTokenStore();
  setTokenStore(fresh);
  expect(getTokenStore()).toBe(fresh);

  setTokenStore(null);
});
