import { query } from "@anthropic-ai/claude-agent-sdk";
import { defaultLogger as logger } from "../../logger.js";
import type {
  LLMProvider,
  ProviderConfig,
  ProviderCapabilities,
  QueryMessage,
  QueryOptions,
  StreamEvent,
  QueryResult,
  TokenUsage,
} from "../types.js";

type QueryFunction = typeof query;

declare global {
  // eslint-disable-next-line no-var
  var __AI_SPEC_SDK_QUERY__: QueryFunction | undefined;
}

function getQueryFunction(): QueryFunction {
  return globalThis.__AI_SPEC_SDK_QUERY__ ?? query;
}

export class AnthropicAdapter implements LLMProvider {
  readonly id: string;
  readonly config: ProviderConfig;
  private initialized = false;

  constructor(config: ProviderConfig) {
    this.id = config.id;
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!this.config.apiKey && !process.env.ANTHROPIC_API_KEY) {
      throw new Error("Anthropic API key is required. Set config.apiKey or ANTHROPIC_API_KEY environment variable.");
    }

    this.initialized = true;
    logger.debug("AnthropicAdapter initialized", { providerId: this.id });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const hasApiKey = !!this.config.apiKey || !!process.env.ANTHROPIC_API_KEY;
      return hasApiKey && this.initialized;
    } catch {
      return false;
    }
  }

  getCapabilities(): ProviderCapabilities {
    return {
      streaming: true,
      tokenUsageTracking: true,
      functionCalling: true,
      maxContextLength: 200000,
      supportedModels: [
        "claude-sonnet-4-20250514",
        "claude-opus-4-20250514",
        "claude-haiku-3-5-20241022",
      ],
    };
  }

  async query(options: QueryOptions): Promise<QueryResult> {
    this.ensureInitialized();

    const queryFn = getQueryFunction();
    const prompt = this.buildPrompt(options.messages);

    const sdkOptions: Record<string, unknown> = {};
    if (options.temperature !== undefined) sdkOptions["temperature"] = options.temperature;
    if (options.maxTokens !== undefined) sdkOptions["max_tokens"] = options.maxTokens;
    if (this.config.model) sdkOptions["model"] = this.config.model;

    let terminalResult: unknown = null;
    let terminalUsage: TokenUsage | null = null;

    for await (const message of queryFn({ prompt, options: sdkOptions } as Parameters<QueryFunction>[0])) {
      if (
        message !== null &&
        typeof message === "object" &&
        Object.prototype.hasOwnProperty.call(message, "result")
      ) {
        terminalResult = (message as Record<string, unknown>)["result"];

        const rawUsage = (message as Record<string, unknown>)["usage"];
        if (rawUsage !== null && typeof rawUsage === "object") {
          const u = rawUsage as Record<string, unknown>;
          if (typeof u["input_tokens"] === "number" && typeof u["output_tokens"] === "number") {
            terminalUsage = { inputTokens: u["input_tokens"], outputTokens: u["output_tokens"] };
          }
        }
      }
    }

    return {
      status: "completed",
      result: terminalResult,
      usage: terminalUsage,
    };
  }

  async queryStream(
    options: QueryOptions,
    onEvent: (event: StreamEvent) => void,
    signal?: AbortSignal
  ): Promise<QueryResult> {
    this.ensureInitialized();

    const queryFn = getQueryFunction();
    const prompt = this.buildPrompt(options.messages);

    const sdkOptions: Record<string, unknown> = {};
    if (options.temperature !== undefined) sdkOptions["temperature"] = options.temperature;
    if (options.maxTokens !== undefined) sdkOptions["max_tokens"] = options.maxTokens;
    if (this.config.model) sdkOptions["model"] = this.config.model;

    const abortController = signal ? new AbortController() : undefined;
    if (signal) {
      signal.addEventListener("abort", () => {
        abortController?.abort();
      });
    }

    let terminalResult: unknown = null;
    let terminalUsage: TokenUsage | null = null;

    try {
      for await (const message of queryFn({ prompt, options: sdkOptions } as Parameters<QueryFunction>[0])) {
        if (signal?.aborted) {
          onEvent({ type: "error", data: { message: "Query aborted by signal" } });
          return { status: "stopped", result: null, usage: null };
        }

        onEvent({ type: "text_delta", data: message });

        if (
          message !== null &&
          typeof message === "object" &&
          Object.prototype.hasOwnProperty.call(message, "result")
        ) {
          terminalResult = (message as Record<string, unknown>)["result"];

          const rawUsage = (message as Record<string, unknown>)["usage"];
          if (rawUsage !== null && typeof rawUsage === "object") {
            const u = rawUsage as Record<string, unknown>;
            if (typeof u["input_tokens"] === "number" && typeof u["output_tokens"] === "number") {
              terminalUsage = { inputTokens: u["input_tokens"], outputTokens: u["output_tokens"] };
              onEvent({ type: "usage_delta", data: terminalUsage });
            }
          }
        }
      }

      onEvent({ type: "complete", data: null });

      return {
        status: "completed",
        result: terminalResult,
        usage: terminalUsage,
      };
    } catch (err) {
      onEvent({ type: "error", data: { error: String(err) } });
      throw err;
    }
  }

  destroy(): void {
    this.initialized = false;
    logger.debug("AnthropicAdapter destroyed", { providerId: this.id });
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(`Provider ${this.id} is not initialized. Call initialize() first.`);
    }
  }

  private buildPrompt(messages: QueryMessage[]): string {
    return messages
      .map((msg) => {
        switch (msg.role) {
          case "system":
            return `[System]: ${msg.content}`;
          case "assistant":
            return `[Assistant]: ${msg.content}`;
          case "user":
          default:
            return msg.content;
        }
      })
      .join("\n\n");
  }
}
