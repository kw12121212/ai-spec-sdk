import { describe, it, expect } from "bun:test";
import type {
  LLMProvider,
  ProviderConfig,
  ProviderCapabilities,
  TokenUsage,
  QueryMessage,
  QueryOptions,
  StreamEvent,
  QueryResult,
} from "../src/llm-provider/types.js";

describe("LLM Provider Types", () => {
  describe("ProviderConfig", () => {
    it("should accept valid config with required fields", () => {
      const config: ProviderConfig = {
        id: "test-provider",
        type: "anthropic",
      };

      expect(config.id).toBe("test-provider");
      expect(config.type).toBe("anthropic");
    });

    it("should accept optional fields", () => {
      const config: ProviderConfig = {
        id: "test-provider",
        type: "anthropic",
        apiKey: "test-key",
        model: "claude-sonnet-4-20250514",
        temperature: 0.7,
        maxTokens: 1000,
      };

      expect(config.apiKey).toBe("test-key");
      expect(config.model).toBe("claude-sonnet-4-20250514");
      expect(config.temperature).toBe(0.7);
      expect(config.maxTokens).toBe(1000);
    });

    it("should allow extra fields via index signature", () => {
      const config: ProviderConfig = {
        id: "test-provider",
        type: "anthropic",
        customParam: "custom-value",
      };

      expect((config as Record<string, unknown>).customParam).toBe("custom-value");
    });
  });

  describe("ProviderCapabilities", () => {
    it("should have all required fields", () => {
      const capabilities: ProviderCapabilities = {
        streaming: true,
        tokenUsageTracking: true,
        functionCalling: true,
        supportedModels: ["model-1", "model-2"],
      };

      expect(capabilities.streaming).toBe(true);
      expect(capabilities.tokenUsageTracking).toBe(true);
      expect(capabilities.functionCalling).toBe(true);
      expect(capabilities.supportedModels).toHaveLength(2);
    });

    it("should accept optional maxContextLength", () => {
      const capabilities: ProviderCapabilities = {
        streaming: true,
        tokenUsageTracking: false,
        functionCalling: false,
        maxContextLength: 128000,
        supportedModels: ["model-1"],
      };

      expect(capabilities.maxContextLength).toBe(128000);
    });
  });

  describe("QueryMessage", () => {
    it("should support user role", () => {
      const message: QueryMessage = { role: "user", content: "Hello" };
      expect(message.role).toBe("user");
      expect(message.content).toBe("Hello");
    });

    it("should support assistant role", () => {
      const message: QueryMessage = { role: "assistant", content: "Hi there" };
      expect(message.role).toBe("assistant");
    });

    it("should support system role", () => {
      const message: QueryMessage = { role: "system", content: "You are helpful" };
      expect(message.role).toBe("system");
    });
  });

  describe("QueryOptions", () => {
    it("should work with minimal fields", () => {
      const options: QueryOptions = {
        messages: [{ role: "user", content: "Test" }],
      };

      expect(options.messages).toHaveLength(1);
      expect(options.stream).toBeUndefined();
    });

    it("should accept all optional fields", () => {
      const options: QueryOptions = {
        messages: [{ role: "user", content: "Test" }],
        stream: true,
        temperature: 0.5,
        maxTokens: 500,
        stopSequences: ["\n\n"],
      };

      expect(options.stream).toBe(true);
      expect(options.temperature).toBe(0.5);
      expect(options.maxTokens).toBe(500);
      expect(options.stopSequences).toEqual(["\n\n"]);
    });
  });

  describe("StreamEvent", () => {
    it("should support text_delta type", () => {
      const event: StreamEvent = { type: "text_delta", data: "Hello" };
      expect(event.type).toBe("text_delta");
    });

    it("should support usage_delta type", () => {
      const event: StreamEvent = { type: "usage_delta", data: { inputTokens: 10, outputTokens: 20 } };
      expect(event.type).toBe("usage_delta");
    });

    it("should support complete type", () => {
      const event: StreamEvent = { type: "complete", data: null };
      expect(event.type).toBe("complete");
    });

    it("should support error type", () => {
      const event: StreamEvent = { type: "error", data: { message: "Something went wrong" } };
      expect(event.type).toBe("error");
    });
  });

  describe("QueryResult", () => {
    it("should represent completed status", () => {
      const result: QueryResult = {
        status: "completed",
        result: { response: "Success" },
        usage: { inputTokens: 10, outputTokens: 20 },
      };

      expect(result.status).toBe("completed");
      expect(result.usage?.inputTokens).toBe(10);
    });

    it("should represent stopped status with null usage", () => {
      const result: QueryResult = {
        status: "stopped",
        result: null,
        usage: null,
      };

      expect(result.status).toBe("stopped");
      expect(result.result).toBeNull();
      expect(result.usage).toBeNull();
    });
  });

  describe("TokenUsage", () => {
    it("should have required fields", () => {
      const usage: TokenUsage = { inputTokens: 100, outputTokens: 50 };
      expect(usage.inputTokens).toBe(100);
      expect(usage.outputTokens).toBe(50);
    });
  });

  describe("LLMProvider Interface Contract", () => {
    it("should define all required methods in interface", () => {
      const providerMethods = [
        "initialize",
        "healthCheck",
        "getCapabilities",
        "query",
        "queryStream",
        "destroy",
      ];

      const mockProvider = {
        id: "test",
        config: { id: "test", type: "anthropic" as const },
        initialize: async () => {},
        healthCheck: async () => true,
        getCapabilities: () => ({
          streaming: true,
          tokenUsageTracking: true,
          functionCalling: true,
          supportedModels: [],
        }),
        query: async () => ({ status: "completed" as const, result: null, usage: null }),
        queryStream: async (_options: QueryOptions, _onEvent: (event: StreamEvent) => void) =>
          ({ status: "completed" as const, result: null, usage: null }),
        destroy: () => {},
      } satisfies LLMProvider;

      expect(mockProvider).toBeDefined();
      providerMethods.forEach((method) => {
        expect(typeof mockProvider[method]).toBe("function");
      });
    });
  });
});
