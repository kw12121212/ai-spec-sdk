export interface ProviderConfig {
  id: string;
  type: "anthropic" | "openai" | "local";
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  fallbackProviderIds?: string[];
  [key: string]: unknown;
}

export interface ProviderCapabilities {
  streaming: boolean;
  tokenUsageTracking: boolean;
  functionCalling: boolean;
  maxContextLength?: number;
  supportedModels: string[];
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface QueryMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface QueryOptions {
  messages: QueryMessage[];
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  [key: string]: unknown;
}

export interface StreamEvent {
  type: "text_delta" | "usage_delta" | "complete" | "error";
  data: unknown;
}

export interface QueryResult {
  status: "completed" | "stopped";
  result: unknown;
  usage: TokenUsage | null;
}

export interface LLMProvider {
  readonly id: string;
  readonly config: ProviderConfig;

  initialize(): Promise<void>;
  healthCheck(): Promise<boolean>;
  getCapabilities(): ProviderCapabilities;

  query(options: QueryOptions): Promise<QueryResult>;
  queryStream(options: QueryOptions, onEvent: (event: StreamEvent) => void, signal?: AbortSignal): Promise<QueryResult>;

  destroy(): void;
}
