import { test, expect, describe, mock, afterEach } from "bun:test";
import { OpenAIAdapter } from "../../../src/llm-provider/adapters/openai.js";
import type { ProviderConfig, QueryOptions } from "../../../src/llm-provider/types.js";

describe("OpenAIAdapter", () => {
  afterEach(() => {
    globalThis.__AI_SPEC_SDK_FETCH__ = undefined;
    delete process.env.OPENAI_API_KEY;
  });

  test("initialize throws if no API key", async () => {
    const config: ProviderConfig = { id: "test", type: "openai" };
    const adapter = new OpenAIAdapter(config);
    expect(adapter.initialize()).rejects.toThrow("OpenAI API key is required");
  });

  test("healthCheck returns true when API key exists", async () => {
    const config: ProviderConfig = { id: "test", type: "openai", apiKey: "test-key" };
    const adapter = new OpenAIAdapter(config);
    await adapter.initialize();
    expect(await adapter.healthCheck()).toBe(true);
  });

  test("query maps messages correctly and calls fetch", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const config: ProviderConfig = { id: "test", type: "openai" };
    const adapter = new OpenAIAdapter(config);
    await adapter.initialize();

    const fetchMock = mock(async (url: string | URL | Request, init?: RequestInit) => {
      return new Response(JSON.stringify({
        choices: [{ message: { content: "test response" } }],
        usage: { prompt_tokens: 10, completion_tokens: 20 }
      }));
    });
    globalThis.__AI_SPEC_SDK_FETCH__ = fetchMock as typeof fetch;

    const options: QueryOptions = {
      messages: [{ role: "user", content: "hello" }],
      temperature: 0.5,
    };

    const result = await adapter.query(options);

    expect(result.status).toBe("completed");
    expect(result.result).toBe("test response");
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 20 });
    expect(fetchMock).toHaveBeenCalled();
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[0]).toBe("https://api.openai.com/v1/chat/completions");
    const body = JSON.parse(callArgs[1].body as string);
    expect(body.messages).toEqual([{ role: "user", content: "hello" }]);
    expect(body.temperature).toBe(0.5);
  });
});