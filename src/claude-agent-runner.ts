import { query } from "@anthropic-ai/claude-agent-sdk";
import { defaultLogger as logger } from "./logger.js";
import { AnthropicAdapter } from "./llm-provider/adapters/anthropic.js";
import type { LLMProvider, ProviderConfig } from "./llm-provider/types.js";

type QueryFunction = typeof query;

declare global {
  // eslint-disable-next-line no-var
  var __AI_SPEC_SDK_QUERY__: QueryFunction | undefined;
}

function getQueryFunction(): QueryFunction {
  return globalThis.__AI_SPEC_SDK_QUERY__ ?? query;
}

export interface RunClaudeQueryOptions {
  prompt: string;
  options: Record<string, unknown>;
  cwd?: string;
  env?: Record<string, string | undefined>;
  onEvent: (message: unknown) => void;
  shouldStop?: () => boolean;
  signal?: AbortSignal;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface QueryResult {
  status: "completed" | "stopped";
  result: unknown;
  usage: TokenUsage | null;
}

export async function runClaudeQuery({
  prompt,
  options,
  cwd,
  env,
  onEvent,
  shouldStop = () => false,
  signal,
}: RunClaudeQueryOptions): Promise<QueryResult> {
  const queryFn = getQueryFunction();
  logger.debug("query started", { promptLength: prompt.length });

  try {
    let terminalResult: unknown = null;
    let terminalUsage: TokenUsage | null = null;

    const sdkOptions: Record<string, unknown> = { ...options };
    if (cwd !== undefined) sdkOptions["cwd"] = cwd;
    if (env !== undefined) sdkOptions["env"] = env;

    const abortController = signal ? new AbortController() : undefined;
    if (signal) {
      signal.addEventListener("abort", () => {
        abortController?.abort();
      });
    }

    for await (const message of queryFn({ prompt, options: sdkOptions } as Parameters<QueryFunction>[0])) {
      if (shouldStop() || signal?.aborted) {
        logger.debug("query stopped by caller or aborted");
        return {
          status: "stopped",
          result: null,
          usage: null,
        };
      }

      onEvent(message);

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

    logger.debug("query completed");
    return {
      status: "completed",
      result: terminalResult,
      usage: terminalUsage,
    };
  } catch (err) {
    logger.error("query error", { error: String(err) });
    throw err;
  }
}

let defaultProvider: LLMProvider | null = null;

export function getDefaultProvider(): LLMProvider | null {
  return defaultProvider;
}

export async function initializeDefaultProvider(config?: Partial<ProviderConfig>): Promise<LLMProvider> {
  if (defaultProvider) {
    return defaultProvider;
  }

  const providerConfig: ProviderConfig = {
    id: config?.id ?? "default-anthropic",
    type: "anthropic",
    apiKey: config?.apiKey,
    model: config?.model,
    temperature: config?.temperature,
    maxTokens: config?.maxTokens,
    ...config,
  };

  const adapter = new AnthropicAdapter(providerConfig);
  await adapter.initialize();
  defaultProvider = adapter;

  logger.info("Default LLM provider initialized", { providerId: defaultProvider.id });
  return defaultProvider;
}

export function destroyDefaultProvider(): void {
  if (defaultProvider) {
    defaultProvider.destroy();
    defaultProvider = null;
    logger.info("Default LLM provider destroyed");
  }
}
