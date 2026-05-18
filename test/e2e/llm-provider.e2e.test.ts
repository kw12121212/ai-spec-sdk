import { test, expect } from "bun:test";
import { loadE2EConfig } from "./config-loader.js";
import { providerRegistry } from "../../src/llm-provider/provider-registry.js";
import type { ProviderConfig } from "../../src/llm-provider/types.js";

// Determine if we should run or skip the E2E tests based on config presence.
let config: ReturnType<typeof loadE2EConfig> | null = null;
try {
  config = loadE2EConfig();
} catch (e) {
  // Config missing, we will skip the test
}

const testFn = config ? test : test.skip;

testFn("E2E: Real LLM Provider Integration", async () => {
  if (!config) return;

  const providerConfig: ProviderConfig = {
    id: "e2e-test-provider",
    type: config.provider as "anthropic" | "openai" | "deepseek" | "local",
    apiKey: config.apiKey,
    model: config.model,
    ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
  };

  // Register the provider
  await providerRegistry.register(providerConfig);
  const provider = providerRegistry.getProvider("e2e-test-provider");
  expect(provider).toBeDefined();

  if (!provider) return;

  // Simple query test
  const result = await provider.query({
    messages: [
      { role: "user", content: "Reply exactly with the word 'E2E_SUCCESS' and nothing else." }
    ],
    temperature: 0,
    maxTokens: 50,
  });

  expect(result.status).toBe("completed");
  expect(result.usage).toBeTruthy();
  expect(result.usage?.inputTokens).toBeGreaterThan(0);
  expect(result.usage?.outputTokens).toBeGreaterThan(0);
  
  // Verify the content
  // Since result format varies by provider type, we do a loose check
  const resultStr = JSON.stringify(result.result);
  expect(resultStr).toContain("E2E_SUCCESS");

  // Stream query test
  const events: any[] = [];
  const streamResult = await provider.queryStream(
    {
      messages: [
        { role: "user", content: "Count from 1 to 3." }
      ],
      temperature: 0,
      maxTokens: 50,
    },
    (event) => events.push(event)
  );

  expect(streamResult.status).toBe("completed");
  expect(events.length).toBeGreaterThan(0);
  const textEvents = events.filter(e => e.type === "text_delta");
  expect(textEvents.length).toBeGreaterThan(0);

  // Clean up
  providerRegistry.deregister("e2e-test-provider");
});
