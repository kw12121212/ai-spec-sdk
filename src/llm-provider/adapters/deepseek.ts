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

function getFetchFunction(): typeof fetch {
  return globalThis.__AI_SPEC_SDK_FETCH__ ?? globalThis.fetch.bind(globalThis);
}

export class DeepSeekAdapter implements LLMProvider {
  readonly id: string;
  readonly config: ProviderConfig;
  private initialized = false;

  constructor(config: ProviderConfig) {
    this.id = config.id;
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!this.config.apiKey && !process.env.DEEPSEEK_API_KEY) {
      throw new Error("DeepSeek API key is required. Set config.apiKey or DEEPSEEK_API_KEY environment variable.");
    }

    this.initialized = true;
    logger.debug("DeepSeekAdapter initialized", { providerId: this.id });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const hasApiKey = !!this.config.apiKey || !!process.env.DEEPSEEK_API_KEY;
      return hasApiKey && this.initialized;
    } catch {
      return false;
    }
  }

  getCapabilities(): ProviderCapabilities {
    return {
      streaming: true,
      tokenUsageTracking: true,
      functionCalling: true, // DeepSeek claims OpenAI compatibility for tool calling
      maxContextLength: 64000,
      supportedModels: [
        "deepseek-chat",
        "deepseek-coder",
      ],
    };
  }

  async query(options: QueryOptions): Promise<QueryResult> {
    this.ensureInitialized();
    const apiKey = this.config.apiKey || process.env.DEEPSEEK_API_KEY;
    const url = "https://api.deepseek.com/v1/chat/completions";
    
    const body: Record<string, unknown> = {
      model: this.config.model || "deepseek-chat",
      messages: this.mapMessages(options.messages),
    };
    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;

    const fetchFn = getFetchFunction();
    const response = await fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} ${errText}`);
    }

    const data = await response.json() as any;
    const message = data.choices?.[0]?.message;
    const usage = data.usage;

    return {
      status: "completed",
      result: message?.content || null,
      usage: usage ? { inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens } : null,
    };
  }

  async queryStream(
    options: QueryOptions,
    onEvent: (event: StreamEvent) => void,
    signal?: AbortSignal
  ): Promise<QueryResult> {
    this.ensureInitialized();
    const apiKey = this.config.apiKey || process.env.DEEPSEEK_API_KEY;
    const url = "https://api.deepseek.com/v1/chat/completions";
    
    const body: Record<string, unknown> = {
      model: this.config.model || "deepseek-chat",
      messages: this.mapMessages(options.messages),
      stream: true,
      // DeepSeek doesn't explicitly guarantee stream_options: { include_usage: true } yet in all cases,
      // but if it uses OpenAI SDK compatibility, it might.
      stream_options: { include_usage: true },
    };
    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;

    const fetchFn = getFetchFunction();
    const response = await fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      onEvent({ type: "error", data: { error: `DeepSeek API error: ${response.status} ${errText}` } });
      throw new Error(`DeepSeek API error: ${response.status} ${errText}`);
    }

    if (!response.body) {
      throw new Error("No response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let terminalResult = "";
    let terminalUsage: TokenUsage | null = null;
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(line => line.trim() !== "");
        for (const line of lines) {
          if (line === "data: [DONE]") continue;
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              const delta = data.choices?.[0]?.delta?.content || "";
              if (delta) {
                terminalResult += delta;
                onEvent({ type: "text_delta", data: { delta } });
              }
              if (data.usage) {
                terminalUsage = { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens };
                onEvent({ type: "usage_delta", data: terminalUsage });
              }
            } catch (e) {
              // Ignore parse errors on incomplete chunks
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
    logger.debug("DeepSeekAdapter destroyed", { providerId: this.id });
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(`Provider ${this.id} is not initialized. Call initialize() first.`);
    }
  }

  private mapMessages(messages: QueryMessage[]): Record<string, string>[] {
    return messages.map(msg => ({
      role: msg.role === "assistant" ? "assistant" : msg.role === "system" ? "system" : "user",
      content: msg.content
    }));
  }
}
