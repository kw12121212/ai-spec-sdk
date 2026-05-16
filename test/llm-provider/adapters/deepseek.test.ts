import { test, expect, describe, mock, afterEach } from "bun:test";
import { DeepSeekAdapter } from "../../../src/llm-provider/adapters/deepseek.js";
import type { ProviderConfig, QueryOptions } from "../../../src/llm-provider/types.js";

describe("DeepSeekAdapter", () => {
  afterEach(() => {
    globalThis.__AI_SPEC_SDK_FETCH__ = undefined;
    delete process.env.DEEPSEEK_API_KEY;
  });

  test("initialize throws if no API key", async () => {
    const config: ProviderConfig = { id: "test", type: "deepseek" };
    const adapter = new DeepSeekAdapter(config);
    expect(adapter.initialize()).rejects.toThrow("DeepSeek API key is required");
  });

  test("healthCheck returns true when API key exists", async () => {
    const config: ProviderConfig = { id: "test", type: "deepseek", apiKey: "test-key" };
    const adapter = new DeepSeekAdapter(config);
    await adapter.initialize();
    expect(await adapter.healthCheck()).toBe(true);
  });

  test("query maps messages correctly and calls fetch", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const config: ProviderConfig = { id: "test", type: "deepseek" };
    const adapter = new DeepSeekAdapter(config);
    await adapter.initialize();

    const fetchMock = mock(async (url: string | URL | Request, init?: RequestInit) => {
      return new Response(JSON.stringify({
        choices: [{ message: { content: "deepseek response" } }],
        usage: { prompt_tokens: 15, completion_tokens: 25 }
      }));
    });
    globalThis.__AI_SPEC_SDK_FETCH__ = fetchMock as typeof fetch;

    const options: QueryOptions = {
      messages: [{ role: "user", content: "hi" }],
    };

    const result = await adapter.query(options);

    expect(result.status).toBe("completed");
    expect(result.result).toBe("deepseek response");
    expect(result.usage).toEqual({ inputTokens: 15, outputTokens: 25 });
    expect(fetchMock).toHaveBeenCalled();
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[0]).toBe("https://api.deepseek.com/v1/chat/completions");
    const body = JSON.parse(callArgs[1].body as string);
    expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
    expect(body.model).toBe("deepseek-chat");
  });
});