import { describe, expect, it, mock } from "bun:test";
import { CachingProviderWrapper } from "../../src/llm-provider/cache-interceptor.js";
import { MemoryStorageBackend } from "../../src/llm-provider/memory-cache.js";
import { LLMProvider, QueryOptions, QueryResult, StreamEvent, ProviderConfig, ProviderCapabilities } from "../../src/llm-provider/types.js";

class MockProvider implements LLMProvider {
  public queryCount = 0;
  
  get id(): string { return "mock-provider"; }
  get config(): ProviderConfig { return { id: "mock", type: "local", model: "test-model" }; }
  
  async initialize(): Promise<void> {}
  async healthCheck(): Promise<boolean> { return true; }
  getCapabilities(): ProviderCapabilities {
    return { streaming: true, tokenUsageTracking: true, functionCalling: false, supportedModels: ["test-model"] };
  }
  
  async query(options: QueryOptions): Promise<QueryResult> {
    this.queryCount++;
    return {
      status: "completed",
      result: `Mock response ${this.queryCount}`,
      usage: { inputTokens: 10, outputTokens: 5 }
    };
  }
  
  async queryStream(options: QueryOptions, onEvent: (event: StreamEvent) => void): Promise<QueryResult> {
    this.queryCount++;
    onEvent({ type: "text_delta", data: `Stream response ${this.queryCount}` });
    onEvent({ type: "complete", data: null });
    return {
      status: "completed",
      result: `Stream response ${this.queryCount}`,
      usage: { inputTokens: 10, outputTokens: 5 }
    };
  }
  
  destroy(): void {}
}

describe("CachingProviderWrapper", () => {
  it("should cache query responses for identical requests", async () => {
    const mockProvider = new MockProvider();
    const storage = new MemoryStorageBackend();
    const wrapper = new CachingProviderWrapper(mockProvider, storage);

    const options: QueryOptions = { messages: [{ role: "user", content: "Hello" }] };

    const res1 = await wrapper.query(options);
    expect(res1.result).toBe("Mock response 1");
    expect(mockProvider.queryCount).toBe(1);

    // Identical request should hit cache
    const res2 = await wrapper.query(options);
    expect(res2.result).toBe("Mock response 1");
    expect(mockProvider.queryCount).toBe(1); // Should not increment

    // Different request should miss cache
    const optionsDifferent: QueryOptions = { messages: [{ role: "user", content: "World" }] };
    const res3 = await wrapper.query(optionsDifferent);
    expect(res3.result).toBe("Mock response 2");
    expect(mockProvider.queryCount).toBe(2);
  });

  it("should synthesize stream events from cached responses", async () => {
    const mockProvider = new MockProvider();
    const storage = new MemoryStorageBackend();
    const wrapper = new CachingProviderWrapper(mockProvider, storage);

    const options: QueryOptions = { messages: [{ role: "user", content: "Stream me" }] };

    const events1: StreamEvent[] = [];
    const res1 = await wrapper.queryStream(options, e => events1.push(e));
    expect(res1.result).toBe("Stream response 1");
    expect(mockProvider.queryCount).toBe(1);
    expect(events1.length).toBe(2);
    expect(events1[0].type).toBe("text_delta");
    expect(events1[0].data).toBe("Stream response 1");

    const events2: StreamEvent[] = [];
    const res2 = await wrapper.queryStream(options, e => events2.push(e));
    expect(res2.result).toBe("Stream response 1"); // Cached
    expect(mockProvider.queryCount).toBe(1); // Should not increment
    expect(events2.length).toBe(2);
    expect(events2[0].type).toBe("text_delta");
    expect(events2[0].data).toBe("Stream response 1");
  });
});