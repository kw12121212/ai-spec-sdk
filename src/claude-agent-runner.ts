import { query } from "@anthropic-ai/claude-agent-sdk";
import { defaultLogger as logger } from "./logger.js";
import { AnthropicAdapter } from "./llm-provider/adapters/anthropic.js";
import type { LLMProvider, ProviderConfig } from "./llm-provider/types.js";
import { getTokenStore } from "./token-tracking/store.js";
import { counterRegistry } from "./token-tracking/counters/index.js";
import type { TokenUsage } from "./token-tracking/types.js";
import { computeTotalTokens } from "./token-tracking/types.js";
import { preQueryCheck, postQueryCheck } from "./quota/enforcer.js";
import type { QuotaEnforceResult, QuotaBlockedNotification } from "./quota/types.js";

type QueryFunction = typeof query;

declare global {
  // eslint-disable-next-line no-var
  var __AI_SPEC_SDK_QUERY__: QueryFunction | undefined;
}

function getQueryFunction(): QueryFunction {
  return globalThis.__AI_SPEC_SDK_QUERY__ ?? query;
}

function recordTokenUsage(
  sessionId: string,
  providerId: string,
  providerType: string,
  usage: TokenUsage | null,
  messageId?: string,
): void {
  if (!usage) return;
  try {
    getTokenStore().record({
      sessionId,
      messageId,
      providerId,
      providerType,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      timestamp: Date.now(),
    });
  } catch (err) {
    logger.warn("failed to record token usage", { error: String(err), sessionId });
  }
}

export interface RunClaudeQueryOptions {
  prompt: string;
  options: Record<string, unknown>;
  cwd?: string;
  env?: Record<string, string | undefined>;
  onEvent: (message: unknown) => void;
  shouldStop?: () => boolean;
  signal?: AbortSignal;
  provider?: LLMProvider;
  onQuotaWarning?: (warning: import("./quota/types.js").QuotaWarning) => void;
  onQuotaBlocked?: (notification: QuotaBlockedNotification) => void;
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
  provider,
  onQuotaWarning,
  onQuotaBlocked,
}: RunClaudeQueryOptions): Promise<QueryResult> {
  const queryFn = getQueryFunction();
  logger.debug("query started", { promptLength: prompt.length });

  const sessionId = (options["sessionId"] as string) ?? "unknown";
  const effectiveProviderId = provider?.id ?? defaultProvider?.id ?? "default-anthropic";

  const quotaResult = preQueryCheck(sessionId, effectiveProviderId, {
    onWarning: onQuotaWarning,
    onBlocked: onQuotaBlocked,
  });

  if (!quotaResult.allowed) {
    const err: Error & { code?: number; quotaData?: unknown } = new Error("Quota exceeded");
    err.code = -32060;
    err.quotaData = quotaResult.violation
      ? {
          quotaId: quotaResult.violation.quotaId,
          scope: (quotaResult.violation as unknown as Record<string, unknown>).scope,
          limit: quotaResult.violation.limit,
          currentUsage: quotaResult.violation.usageAtViolation,
        }
      : undefined;
    throw err;
  }

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

    if (provider) {
      const queryOptions = {
        messages: [{ role: "user" as const, content: prompt }],
        stream: true,
        ...(options.temperature !== undefined ? { temperature: options.temperature as number } : {}),
        ...(options.maxTokens !== undefined ? { maxTokens: options.maxTokens as number } : {}),
      };

      const result = await provider.queryStream(queryOptions, (event: { type: string; data?: unknown }) => {
        if (event.type === "complete" && event.data) {
          const data = event.data as Record<string, unknown>;
          terminalResult = data["result"];
          const rawUsage = data["usage"];
          if (rawUsage && typeof rawUsage === "object") {
            const u = rawUsage as Record<string, unknown>;
            if (typeof u["inputTokens"] === "number" && typeof u["outputTokens"] === "number") {
              const inT = u["inputTokens"] as number;
              const outT = u["outputTokens"] as number;
              terminalUsage = { inputTokens: inT, outputTokens: outT, totalTokens: computeTotalTokens(inT, outT) };
            }
          }
        }
        if (event.type === "text_delta" || event.type === "reasoning_delta" || event.type === "error") {
          onEvent(event.data);
        }
      }, abortController?.signal);

      if (result.status === "completed") {
        terminalResult = result.result;
        if (result.usage) {
          terminalUsage = { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, totalTokens: computeTotalTokens(result.usage.inputTokens, result.usage.outputTokens) };
        }
      }

      recordTokenUsage(
        (options["sessionId"] as string) ?? "unknown",
        provider.id,
        provider.config.type,
        terminalUsage,
        options["messageId"] as string | undefined,
      );

      postQueryCheck(sessionId, effectiveProviderId, { onWarning: onQuotaWarning });

      return { status: result.status, result: terminalResult, usage: terminalUsage };
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
            const inT = u["input_tokens"] as number;
            const outT = u["output_tokens"] as number;
            terminalUsage = { inputTokens: inT, outputTokens: outT, totalTokens: computeTotalTokens(inT, outT) };
          }
        }
      }
    }

    logger.debug("query completed");
    recordTokenUsage(
      (options["sessionId"] as string) ?? "unknown",
      defaultProvider?.id ?? "default-anthropic",
      defaultProvider?.config.type ?? "anthropic",
      terminalUsage,
      options["messageId"] as string | undefined,
    );

    postQueryCheck(sessionId, effectiveProviderId, { onWarning: onQuotaWarning });

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
