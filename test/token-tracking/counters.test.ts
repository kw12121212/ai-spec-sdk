import test from "node:test";
import assert from "node:assert/strict";
import { AnthropicTokenCounter, PassthroughTokenCounter, counterRegistry } from "../../src/token-tracking/counters/index.js";

test("AnthropicTokenCounter normalizes SDK format { input_tokens, output_tokens }", () => {
  const counter = new AnthropicTokenCounter();
  const result = counter.count({ input_tokens: 100, output_tokens: 200 });
  assert.ok(result);
  assert.equal(result!.inputTokens, 100);
  assert.equal(result!.outputTokens, 200);
  assert.equal(result!.totalTokens, 300);
});

test("AnthropicTokenCounter normalizes Provider format { inputTokens, outputTokens }", () => {
  const counter = new AnthropicTokenCounter();
  const result = counter.count({ inputTokens: 50, outputTokens: 75 });
  assert.ok(result);
  assert.equal(result!.inputTokens, 50);
  assert.equal(result!.outputTokens, 75);
  assert.equal(result!.totalTokens, 125);
});

test("AnthropicTokenCounter handles null usage gracefully", () => {
  const counter = new AnthropicTokenCounter();
  const result = counter.count(null);
  assert.equal(result, null);
});

test("AnthropicTokenCounter handles undefined usage gracefully", () => {
  const counter = new AnthropicTokenCounter();
  const result = counter.count(undefined);
  assert.equal(result, null);
});

test("AnthropicTokenCounter returns null for non-object usage", () => {
  const counter = new AnthropicTokenCounter();
  assert.equal(counter.count("string"), null);
  assert.equal(counter.count(42), null);
  assert.equal(counter.count(true), null);
});

test("AnthropicTokenCounter rejects negative token values in SDK format", () => {
  const counter = new AnthropicTokenCounter();
  assert.equal(counter.count({ input_tokens: -1, output_tokens: 100 }), null);
  assert.equal(counter.count({ input_tokens: 100, output_tokens: -5 }), null);
});

test("AnthropicTokenCounter rejects non-finite values", () => {
  const counter = new AnthropicTokenCounter();
  assert.equal(counter.count({ input_tokens: NaN, output_tokens: 100 }), null);
  assert.equal(counter.count({ input_tokens: Infinity, output_tokens: 100 }), null);
});

test("PassthroughTokenCounter extracts inputTokens/outputTokens", () => {
  const counter = new PassthroughTokenCounter("openai");
  const result = counter.count({ inputTokens: 200, outputTokens: 300 });
  assert.ok(result);
  assert.equal(result!.inputTokens, 200);
  assert.equal(result!.outputTokens, 300);
  assert.equal(result!.totalTokens, 500);
});

test("PassthroughTokenCounter returns null for missing fields", () => {
  const counter = new PassthroughTokenCounter("custom");
  assert.equal(counter.count({ inputTokens: 100 }), null);
  assert.equal(counter.count({ outputTokens: 100 }), null);
  assert.equal(counter.count({}), null);
});

test("CounterRegistry.register() adds counter for provider type", () => {
  const registry = (counterRegistry as unknown as { counters: Map<string, unknown> }).counters;
  const beforeSize = registry.size;
  const dummy = { providerType: "test-type", count: () => null };
  counterRegistry.register(dummy as never);
  assert.equal(registry.size, beforeSize + 1);
  registry.delete("test-type");
});

test("CounterRegistry.get() returns correct counter or default passthrough", () => {
  const anthropic = counterRegistry.get("anthropic");
  assert.equal(anthropic.providerType, "anthropic");

  const fallback = counterRegistry.get("nonexistent-type");
  assert.ok(fallback instanceof PassthroughTokenCounter);
  assert.equal(fallback.providerType, "nonexistent-type");
});

test("CounterRegistry.list() returns all registered counters with metadata", () => {
  const list = counterRegistry.list();
  assert.ok(Array.isArray(list));
  assert.ok(list.length >= 1);
  const anthropicEntry = list.find((e) => e.providerType === "anthropic");
  assert.ok(anthropicEntry);
  assert.equal(typeof anthropicEntry!.description, "string");
});

test("CounterRegistry allows overriding built-in counters", () => {
  const custom = { providerType: "anthropic" as const, count: () => null };
  counterRegistry.register(custom as never);
  const retrieved = counterRegistry.get("anthropic");
  assert.equal(retrieved, custom);

  counterRegistry.register(new AnthropicTokenCounter());
});
