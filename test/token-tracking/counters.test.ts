import { test, expect } from "bun:test";
import { AnthropicTokenCounter, PassthroughTokenCounter, counterRegistry } from "../../src/token-tracking/counters/index.js";

test("AnthropicTokenCounter normalizes SDK format { input_tokens, output_tokens }", () => {
  const counter = new AnthropicTokenCounter();
  const result = counter.count({ input_tokens: 100, output_tokens: 200 });
  expect(result).toBeTruthy();
  expect(result!.inputTokens).toBe(100);
  expect(result!.outputTokens).toBe(200);
  expect(result!.totalTokens).toBe(300);
});

test("AnthropicTokenCounter normalizes Provider format { inputTokens, outputTokens }", () => {
  const counter = new AnthropicTokenCounter();
  const result = counter.count({ inputTokens: 50, outputTokens: 75 });
  expect(result).toBeTruthy();
  expect(result!.inputTokens).toBe(50);
  expect(result!.outputTokens).toBe(75);
  expect(result!.totalTokens).toBe(125);
});

test("AnthropicTokenCounter handles null usage gracefully", () => {
  const counter = new AnthropicTokenCounter();
  const result = counter.count(null);
  expect(result).toBeNull();
});

test("AnthropicTokenCounter handles undefined usage gracefully", () => {
  const counter = new AnthropicTokenCounter();
  const result = counter.count(undefined);
  expect(result).toBeNull();
});

test("AnthropicTokenCounter returns null for non-object usage", () => {
  const counter = new AnthropicTokenCounter();
  expect(counter.count("string")).toBeNull();
  expect(counter.count(42)).toBeNull();
  expect(counter.count(true)).toBeNull();
});

test("AnthropicTokenCounter rejects negative token values in SDK format", () => {
  const counter = new AnthropicTokenCounter();
  expect(counter.count({ input_tokens: -1, output_tokens: 100 })).toBeNull();
  expect(counter.count({ input_tokens: 100, output_tokens: -5 })).toBeNull();
});

test("AnthropicTokenCounter rejects non-finite values", () => {
  const counter = new AnthropicTokenCounter();
  expect(counter.count({ input_tokens: NaN, output_tokens: 100 })).toBeNull();
  expect(counter.count({ input_tokens: Infinity, output_tokens: 100 })).toBeNull();
});

test("PassthroughTokenCounter extracts inputTokens/outputTokens", () => {
  const counter = new PassthroughTokenCounter("openai");
  const result = counter.count({ inputTokens: 200, outputTokens: 300 });
  expect(result).toBeTruthy();
  expect(result!.inputTokens).toBe(200);
  expect(result!.outputTokens).toBe(300);
  expect(result!.totalTokens).toBe(500);
});

test("PassthroughTokenCounter returns null for missing fields", () => {
  const counter = new PassthroughTokenCounter("custom");
  expect(counter.count({ inputTokens: 100 })).toBeNull();
  expect(counter.count({ outputTokens: 100 })).toBeNull();
  expect(counter.count({})).toBeNull();
});

test("CounterRegistry.register() adds counter for provider type", () => {
  const registry = (counterRegistry as unknown as { counters: Map<string, unknown> }).counters;
  const beforeSize = registry.size;
  const dummy = { providerType: "test-type", count: () => null };
  counterRegistry.register(dummy as never);
  expect(registry.size).toBe(beforeSize + 1);
  registry.delete("test-type");
});

test("CounterRegistry.get() returns correct counter or default passthrough", () => {
  const anthropic = counterRegistry.get("anthropic");
  expect(anthropic.providerType).toBe("anthropic");

  const fallback = counterRegistry.get("nonexistent-type");
  expect(fallback instanceof PassthroughTokenCounter).toBeTruthy();
  expect(fallback.providerType).toBe("nonexistent-type");
});

test("CounterRegistry.list() returns all registered counters with metadata", () => {
  const list = counterRegistry.list();
  expect(Array.isArray(list)).toBeTruthy();
  expect(list.length >= 1).toBeTruthy();
  const anthropicEntry = list.find((e) => e.providerType === "anthropic");
  expect(anthropicEntry).toBeTruthy();
  expect(typeof anthropicEntry!.description === "string").toBeTruthy();
});

test("CounterRegistry allows overriding built-in counters", () => {
  const custom = { providerType: "anthropic" as const, count: () => null };
  counterRegistry.register(custom as never);
  const retrieved = counterRegistry.get("anthropic");
  expect(retrieved).toBe(custom);

  counterRegistry.register(new AnthropicTokenCounter());
});
