import { test, expect } from "bun:test";
import { getTokenStore, setTokenStore } from "../../src/token-tracking/store.js";

declare global {
  // eslint-disable-next-line no-var
  var __AI_SPEC_SDK_QUERY__: unknown;
}

function createMockQueryFn(usage: unknown) {
  return async function* () {
    yield {
      result: "test-result",
      usage,
    };
  };
}

test("runClaudeQuery records tokens after successful SDK query", async () => {
  setTokenStore(null);
  globalThis.__AI_SPEC_SDK_QUERY__ = createMockQueryFn({
    input_tokens: 100,
    output_tokens: 200,
  });

  const { runClaudeQuery } = await import("../../src/claude-agent-runner.js");
  const events: unknown[] = [];
  const result = await runClaudeQuery({
    prompt: "hello",
    options: { sessionId: "test-session-1" },
    onEvent: (msg) => events.push(msg),
  });

  expect(result.status).toBe("completed");
  expect(result.usage).toBeTruthy();
  expect(result.usage!.inputTokens).toBe(100);
  expect(result.usage!.outputTokens).toBe(200);

  const summary = getTokenStore().getSessionUsage("test-session-1");
  expect(summary).toBeTruthy();
  expect(summary!.totalInputTokens).toBe(100);
  expect(summary!.totalOutputTokens).toBe(200);

  delete globalThis.__AI_SPEC_SDK_QUERY__;
});

test("runClaudeQuery does NOT record when usage is null", async () => {
  setTokenStore(null);
  globalThis.__AI_SPEC_SDK_QUERY__ = createMockQueryFn(null);

  const { runClaudeQuery } = await import("../../src/claude-agent-runner.js");
  const events: unknown[] = [];
  const result = await runClaudeQuery({
    prompt: "hello",
    options: { sessionId: "test-null-usage" },
    onEvent: (msg) => events.push(msg),
  });

  expect(result.status).toBe("completed");
  expect(result.usage).toBeNull();

  const summary = getTokenStore().getSessionUsage("test-null-usage");
  expect(summary).toBeNull();

  delete globalThis.__AI_SPEC_SDK_QUERY__;
});

test("runClaudeQuery handles recording failure gracefully (no throw)", async () => {
  setTokenStore(null);
  globalThis.__AI_SPEC_SDK_QUERY__ = createMockQueryFn({
    input_tokens: 50,
    output_tokens: 25,
  });

  let recordCalled = false;
  const originalRecord = getTokenStore().record;
  getTokenStore().record = (() => {
    recordCalled = true;
    throw new Error("intentional store failure");
  }) as never;

  try {
    const { runClaudeQuery } = await import("../../src/claude-agent-runner.js");
    const result = await runClaudeQuery({
      prompt: "hello",
      options: { sessionId: "fail-test" },
      onEvent: () => {},
    });

    expect(result.status).toBe("completed");
    expect(recordCalled).toBeTruthy();
  } finally {
    getTokenStore().record = originalRecord;
    delete globalThis.__AI_SPEC_SDK_QUERY__;
    setTokenStore(null);
  }
});

test("sessionId extraction from options context", async () => {
  setTokenStore(null);
  globalThis.__AI_SPEC_SDK_QUERY__ = createMockQueryFn({
    input_tokens: 10,
    output_tokens: 20,
  });

  const { runClaudeQuery } = await import("../../src/claude-agent-runner.js");
  await runClaudeQuery({
    prompt: "test",
    options: { sessionId: "my-custom-session-id" },
    onEvent: () => {},
  });

  const summary = getTokenStore().getSessionUsage("my-custom-session-id");
  expect(summary).toBeTruthy();
  expect(summary!.sessionId).toBe("my-custom-session-id");

  delete globalThis.__AI_SPEC_SDK_QUERY__;
});

test("messageId optional inclusion in TokenRecord", async () => {
  setTokenStore(null);
  globalThis.__AI_SPEC_SDK_QUERY__ = createMockQueryFn({
    input_tokens: 5,
    output_tokens: 10,
  });

  const { runClaudeQuery } = await import("../../src/claude-agent-runner.js");
  await runClaudeQuery({
    prompt: "test",
    options: { sessionId: "msg-test", messageId: "msg-abc" },
    onEvent: () => {},
  });

  const record = getTokenStore().getMessageUsage("msg-test", "msg-abc");
  expect(record).toBeTruthy();
  expect(record!.messageId).toBe("msg-abc");

  delete globalThis.__AI_SPEC_SDK_QUERY__;
});
