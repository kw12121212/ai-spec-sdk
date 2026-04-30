import { createHash } from "crypto";
import { LLMProvider, QueryOptions, QueryResult, StreamEvent, ProviderConfig, ProviderCapabilities, TokenPrediction, StorageBackend } from "./types.js";

export class CachingProviderWrapper implements LLMProvider {
  predictTokens?(options: QueryOptions): Promise<TokenPrediction>;

  constructor(
    private readonly provider: LLMProvider,
    private readonly storage: StorageBackend,
    private readonly ttlMs?: number
  ) {
    if (provider.predictTokens) {
      this.predictTokens = (options) => provider.predictTokens!(options);
    }
  }

  get id(): string {
    return this.provider.id;
  }

  get config(): ProviderConfig {
    return this.provider.config;
  }

  async initialize(): Promise<void> {
    return this.provider.initialize();
  }

  async healthCheck(): Promise<boolean> {
    return this.provider.healthCheck();
  }

  getCapabilities(): ProviderCapabilities {
    return this.provider.getCapabilities();
  }

  private generateCacheKey(options: QueryOptions): string {
    // Canonicalize JSON of request including model, messages, tools, system prompt, temperature, top_p, max_tokens
    const relevantOptions = {
      model: this.config.model,
      messages: options.messages,
      tools: options.tools,
      temperature: options.temperature ?? this.config.temperature,
      top_p: options.top_p,
      maxTokens: options.maxTokens ?? this.config.maxTokens,
    };
    
    // Sort object keys for deterministic serialization
    const sortedStringify = (obj: any): string => {
      if (obj === null || typeof obj !== "object") {
        return JSON.stringify(obj);
      }
      if (Array.isArray(obj)) {
        return `[${obj.map(sortedStringify).join(",")}]`;
      }
      const keys = Object.keys(obj).sort();
      const parts = keys.map(k => `"${k}":${sortedStringify(obj[k])}`);
      return `{${parts.join(",")}}`;
    };

    const serialized = sortedStringify(relevantOptions);
    return createHash("sha256").update(serialized).digest("hex");
  }

  async query(options: QueryOptions): Promise<QueryResult> {
    const key = this.generateCacheKey(options);
    const cached = await this.storage.get(key);
    if (cached) {
      return cached;
    }

    const result = await this.provider.query(options);
    if (result.status === "completed") {
      await this.storage.set(key, result, this.ttlMs);
    }
    return result;
  }

  async queryStream(options: QueryOptions, onEvent: (event: StreamEvent) => void, signal?: AbortSignal): Promise<QueryResult> {
    const key = this.generateCacheKey(options);
    const cached = await this.storage.get(key);
    if (cached) {
      // Synthesize a stream event
      if (cached.result && typeof cached.result === "string") {
        onEvent({ type: "text_delta", data: cached.result });
      }
      onEvent({ type: "complete", data: null });
      return cached;
    }

    const result = await this.provider.queryStream(options, onEvent, signal);
    if (result.status === "completed") {
      await this.storage.set(key, result, this.ttlMs);
    }
    return result;
  }

  destroy(): void {
    this.provider.destroy();
  }
}
