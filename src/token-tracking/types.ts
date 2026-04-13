export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface TokenRecord {
  sessionId: string;
  messageId?: string;
  providerId: string;
  providerType: string;
  timestamp: number;
  inputTokens: number;
  outputTokens: number;
  toolCallId?: string;
}

export interface SessionTokenSummary {
  sessionId: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  queryCount: number;
  providerBreakdown: ProviderBreakdownEntry[];
}

export interface ProviderBreakdownEntry {
  providerId: string;
  inputTokens: number;
  outputTokens: number;
}

export interface ProviderTokenSummary {
  providerId: string;
  providerType: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  queryCount: number;
  sessionCount: number;
}

export interface TokenCounter {
  readonly providerType: string;
  count(usage: unknown): TokenUsage | null;
}

export interface TokenStore {
  record(entry: Omit<TokenRecord, "totalTokens"> & { inputTokens: number; outputTokens: number }): boolean;
  getSessionUsage(sessionId: string): SessionTokenSummary | null;
  getMessageUsage(sessionId: string, messageId: string): TokenRecord | null;
  getProviderUsage(providerId?: string): ProviderTokenSummary[];
  clearSession(sessionId: string): number;
  clearAll(): number;
}

export function computeTotalTokens(inputTokens: number, outputTokens: number): number {
  return inputTokens + outputTokens;
}

export function validateTokenRecord(raw: {
  inputTokens: unknown;
  outputTokens: unknown;
}): { inputTokens: number; outputTokens: number } | null {
  if (typeof raw.inputTokens !== "number" || typeof raw.outputTokens !== "number") return null;
  if (!Number.isFinite(raw.inputTokens) || !Number.isFinite(raw.outputTokens)) return null;
  if (raw.inputTokens < 0 || raw.outputTokens < 0) return null;
  return { inputTokens: raw.inputTokens, outputTokens: raw.outputTokens };
}
