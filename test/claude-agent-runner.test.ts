import { test, expect } from "bun:test";
import { runClaudeQuery } from "../src/claude-agent-runner.js";
import { buildAnthropicSdkEnv } from "../src/llm-provider/anthropic-env.js";
import type { LLMProvider, ProviderCapabilities, ProviderConfig, QueryOptions, QueryResult, StreamEvent } from "../src/llm-provider/types.js";

class AnthropicProviderStub implements LLMProvider {
  readonly id = "anthropic-stub";
  readonly config: ProviderConfig = {
    id: this.id,
    type: "anthropic",
    apiKey: "provider-key",
    authToken: "provider-token",
    baseUrl: "https://anthropic-compatible.example/v1",
    env: {
      CLAUDE_CODE_USE_BEDROCK: "0",
      ANTHROPIC_AUTH_TOKEN: "provider-env-token",
    },
    model: "claude-sonnet-4-6",
  };

  async initialize(): Promise<void> {}
  async healthCheck(): Promise<boolean> { return true; }
  getCapabilities(): ProviderCapabilities {
    return {
      streaming: true,
      tokenUsageTracking: true,
      functionCalling: true,
      supportedModels: ["claude-sonnet-4-6"],
    };
  }
  async query(_options: QueryOptions): Promise<QueryResult> {
    throw new Error("query should not be called for Anthropic Agent SDK sessions");
  }
  async queryStream(
    _options: QueryOptions,
    _onEvent: (event: StreamEvent) => void,
    _signal?: AbortSignal,
  ): Promise<QueryResult> {
    throw new Error("queryStream should not be called for Anthropic Agent SDK sessions");
  }
  destroy(): void {}
}

test("runClaudeQuery preserves Agent SDK options when an Anthropic provider is active", async () => {
  const previous = globalThis.__AI_SPEC_SDK_QUERY__;
  let captured: { prompt: string; options: Record<string, unknown> } | null = null;

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* (params: {
    prompt: string;
    options: Record<string, unknown>;
  }) {
    captured = params;
    yield { result: "ok", usage: { input_tokens: 4, output_tokens: 5 } };
  } as typeof globalThis.__AI_SPEC_SDK_QUERY__;

  try {
    const tools = [{ name: "builtin_read_file", call: async () => "ok" }];
    const result = await runClaudeQuery({
      prompt: "fix the bug",
      options: {
        sessionId: "session-1",
        permissionMode: "bypassPermissions",
        allowedTools: ["Read"],
        disallowedTools: ["Bash"],
        maxTurns: 4,
        systemPrompt: "Stay within the workspace.",
        stream: true,
        resume: "sdk-session-1",
        tools,
      },
      cwd: "/tmp/workspace",
      env: { EXISTING_ENV: "1" },
      provider: new AnthropicProviderStub(),
      onEvent: () => {},
    });

    expect(result.status).toBe("completed");
    expect(result.result).toBe("ok");
    expect(captured?.prompt).toBe("fix the bug");
    expect(captured?.options["cwd"]).toBe("/tmp/workspace");
    expect((captured?.options["env"] as Record<string, unknown>)["EXISTING_ENV"]).toBe("1");
    expect((captured?.options["env"] as Record<string, unknown>)["ANTHROPIC_API_KEY"]).toBe("provider-key");
    expect((captured?.options["env"] as Record<string, unknown>)["ANTHROPIC_BASE_URL"]).toBe("https://anthropic-compatible.example/v1");
    expect((captured?.options["env"] as Record<string, unknown>)["ANTHROPIC_AUTH_TOKEN"]).toBe("provider-env-token");
    expect((captured?.options["env"] as Record<string, unknown>)["CLAUDE_CODE_USE_BEDROCK"]).toBe("0");
    expect(captured?.options["permissionMode"]).toBe("bypassPermissions");
    expect(captured?.options["allowedTools"]).toEqual(["Read"]);
    expect(captured?.options["disallowedTools"]).toEqual(["Bash"]);
    expect(captured?.options["maxTurns"]).toBe(4);
    expect(captured?.options["systemPrompt"]).toBe("Stay within the workspace.");
    expect(captured?.options["stream"]).toBe(true);
    expect(captured?.options["resume"]).toBe("sdk-session-1");
    expect(captured?.options["tools"]).toBe(tools);
    expect(captured?.options["model"]).toBe("claude-sonnet-4-6");
  } finally {
    if (previous) {
      globalThis.__AI_SPEC_SDK_QUERY__ = previous;
    } else {
      delete globalThis.__AI_SPEC_SDK_QUERY__;
    }
  }
});

test("buildAnthropicSdkEnv maps Anthropic-compatible endpoint aliases", () => {
  expect(
    buildAnthropicSdkEnv({
      id: "base-url-provider",
      type: "anthropic",
      apiKey: "api-key",
      baseURL: "https://base-url.example/v1",
      env: { CLAUDE_CODE_USE_VERTEX: "0" },
    }),
  ).toEqual({
    ANTHROPIC_API_KEY: "api-key",
    ANTHROPIC_BASE_URL: "https://base-url.example/v1",
    CLAUDE_CODE_USE_VERTEX: "0",
  });

  expect(
    buildAnthropicSdkEnv({
      id: "api-base-url-provider",
      type: "anthropic",
      authToken: "auth-token",
      apiBaseUrl: "https://api-base-url.example/v1",
    }),
  ).toEqual({
    ANTHROPIC_AUTH_TOKEN: "auth-token",
    ANTHROPIC_BASE_URL: "https://api-base-url.example/v1",
  });
});
