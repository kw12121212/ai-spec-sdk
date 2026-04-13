import type { TokenCounter, TokenUsage } from "../types.js";
import { computeTotalTokens } from "../types.js";

export class AnthropicTokenCounter implements TokenCounter {
  readonly providerType = "anthropic";

  count(usage: unknown): TokenUsage | null {
    if (!usage || typeof usage !== "object") return null;
    const u = usage as Record<string, unknown>;

    const sdkFormat =
      typeof u["input_tokens"] === "number" && typeof u["output_tokens"] === "number";

    const providerFormat =
      typeof u["inputTokens"] === "number" && typeof u["outputTokens"] === "number";

    if (sdkFormat) {
      const inputTokens = u["input_tokens"] as number;
      const outputTokens = u["output_tokens"] as number;
      if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens)) return null;
      if (inputTokens < 0 || outputTokens < 0) return null;
      return { inputTokens, outputTokens, totalTokens: computeTotalTokens(inputTokens, outputTokens) };
    }

    if (providerFormat) {
      const inputTokens = u["inputTokens"] as number;
      const outputTokens = u["outputTokens"] as number;
      if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens)) return null;
      if (inputTokens < 0 || outputTokens < 0) return null;
      return { inputTokens, outputTokens, totalTokens: computeTotalTokens(inputTokens, outputTokens) };
    }

    return null;
  }
}

export class PassthroughTokenCounter implements TokenCounter {
  readonly providerType: string;

  constructor(providerType: string) {
    this.providerType = providerType;
  }

  count(usage: unknown): TokenUsage | null {
    if (!usage || typeof usage !== "object") return null;
    const u = usage as Record<string, unknown>;

    const inputTokens = typeof u["inputTokens"] === "number" ? u["inputTokens"] : undefined;
    const outputTokens = typeof u["outputTokens"] === "number" ? u["outputTokens"] : undefined;

    if (inputTokens === undefined || outputTokens === undefined) return null;
    if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens)) return null;
    if (inputTokens < 0 || outputTokens < 0) return null;

    return { inputTokens, outputTokens, totalTokens: computeTotalTokens(inputTokens, outputTokens) };
  }
}
