import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { AnthropicAdapter } from "../src/llm-provider/adapters/anthropic.js";
import type { QueryFunction } from "@anthropic-ai/claude-agent-sdk";

const mockQueryResult = {
  result: "Mock response",
  usage: { input_tokens: 10, output_tokens: 20 },
};

function createMockQueryGenerator() {
  return (async function* () {
    yield { type: "message", message: { content: [{ type: "text", text: "Partial" }] } };
    yield mockQueryResult;
  })();
}

describe("AnthropicAdapter", () => {
  let adapter: AnthropicAdapter;

  beforeEach(() => {
    adapter = new AnthropicAdapter({
      id: "test-anthropic",
      type: "anthropic",
      apiKey: "test-api-key",
      model: "claude-sonnet-4-20250514",
    });
  });

  afterEach(() => {
    if ((globalThis as Record<string, unknown>).__AI_SPEC_SDK_QUERY__) {
      delete (globalThis as Record<string, unknown>).__AI_SPEC_SDK_QUERY__;
    }
  });

  describe("Initialization", () => {
    it("should initialize successfully with valid config", async () => {
      await expect(adapter.initialize()).resolves.toBeUndefined();
    });

    it("should throw error when API key is missing", async () => {
      const noKeyAdapter = new AnthropicAdapter({ id: "no-key", type: "anthropic" });
      delete process.env.ANTHROPIC_API_KEY;

      await expect(noKeyAdapter.initialize()).rejects.toThrow("API key is required");
    });
  });

  describe("Health Check", () => {
    it("should return true when initialized with API key", async () => {
      await adapter.initialize();
      const isHealthy = await adapter.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it("should return false when not initialized", async () => {
      const isHealthy = await adapter.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });

  describe("Capabilities", () => {
    it("should report correct Anthropic capabilities", () => {
      const caps = adapter.getCapabilities();

      expect(caps.streaming).toBe(true);
      expect(caps.tokenUsageTracking).toBe(true);
      expect(caps.functionCalling).toBe(true);
      expect(caps.maxContextLength).toBe(200000);
      expect(caps.supportedModels).toContain("claude-sonnet-4-20250514");
      expect(caps.supportedModels).toContain("claude-opus-4-20250514");
    });
  });

  describe("Query", () => {
    it("should execute query and return result", async () => {
      (globalThis as Record<string, unknown>).__AI_SPEC_SDK_QUERY__ =
        createMockQueryGenerator as unknown as QueryFunction;

      await adapter.initialize();

      const result = await adapter.query({
        messages: [{ role: "user", content: "Hello" }],
      });

      expect(result.status).toBe("completed");
      expect(result.result).toBeDefined();
      expect(result.usage).toBeDefined();
    });

    it("should throw error if not initialized", async () => {
      await expect(
        adapter.query({ messages: [{ role: "user", content: "Test" }] })
      ).rejects.toThrow("not initialized");
    });
  });

  describe("Query Stream", () => {
    it("should emit stream events correctly", async () => {
      (globalThis as Record<string, unknown>).__AI_SPEC_SDK_QUERY__ =
        createMockQueryGenerator as unknown as QueryFunction;

      await adapter.initialize();

      const events: Array<{ type: string; data: unknown }> = [];

      const result = await adapter.queryStream(
        { messages: [{ role: "user", content: "Hello" }] },
        (event) => {
          events.push(event);
        }
      );

      expect(result.status).toBe("completed");
      expect(events.length).toBeGreaterThan(0);

      const hasCompleteEvent = events.some((e) => e.type === "complete");
      expect(hasCompleteEvent).toBe(true);
    });

    it("should accept abort signal parameter", async () => {
      (globalThis as Record<string, unknown>).__AI_SPEC_SDK_QUERY__ =
        createMockQueryGenerator as unknown as QueryFunction;

      await adapter.initialize();

      const controller = new AbortController();

      const result = await adapter.queryStream(
        { messages: [{ role: "user", content: "Test" }] },
        () => {},
        controller.signal
      );

      expect(result).toBeDefined();
      expect(result.status).toBe("completed");
    });

    it("should extract token usage from stream", async () => {
      (globalThis as Record<string, unknown>).__AI_SPEC_SDK_QUERY__ =
        createMockQueryGenerator as unknown as QueryFunction;

      await adapter.initialize();

      let capturedUsage: unknown = null;

      await adapter.queryStream(
        { messages: [{ role: "user", content: "Test" }] },
        (event) => {
          if (event.type === "usage_delta") {
            capturedUsage = event.data;
          }
        }
      );

      expect(capturedUsage).toBeDefined();
      expect((capturedUsage as Record<string, number>).inputTokens).toBe(10);
      expect((capturedUsage as Record<string, number>).outputTokens).toBe(20);
    });

    it("should throw error if not initialized", async () => {
      await expect(
        adapter.queryStream(
          { messages: [{ role: "user", content: "Test" }] },
          () => {}
        )
      ).rejects.toThrow("not initialized");
    });
  });

  describe("Lifecycle", () => {
    it("should destroy provider correctly", async () => {
      await adapter.initialize();
      adapter.destroy();

      await expect(adapter.healthCheck()).resolves.toBe(false);
    });
  });
});
