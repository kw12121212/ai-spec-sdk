import type {
  TokenRecord,
  TokenStore,
  SessionTokenSummary,
  ProviderTokenSummary,
  ProviderBreakdownEntry,
} from "./types.js";
import { computeTotalTokens, validateTokenRecord } from "./types.js";

class InMemoryTokenStore implements TokenStore {
  private records: Map<string, TokenRecord[]> = new Map();

  record(entry: Omit<TokenRecord, "totalTokens"> & { inputTokens: number; outputTokens: number }): boolean {
    const validated = validateTokenRecord({ inputTokens: entry.inputTokens, outputTokens: entry.outputTokens });
    if (!validated) return false;

    const timestamp = entry.timestamp ?? Date.now();
    const record: TokenRecord = {
      sessionId: entry.sessionId,
      messageId: entry.messageId,
      providerId: entry.providerId,
      providerType: entry.providerType,
      timestamp,
      inputTokens: validated.inputTokens,
      outputTokens: validated.outputTokens,
      toolCallId: entry.toolCallId,
    };

    const existing = this.records.get(entry.sessionId);
    if (existing) {
      existing.push(record);
    } else {
      this.records.set(entry.sessionId, [record]);
    }

    return true;
  }

  getSessionUsage(sessionId: string): SessionTokenSummary | null {
    const sessionRecords = this.records.get(sessionId);
    if (!sessionRecords || sessionRecords.length === 0) return null;

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const providerMap = new Map<string, ProviderBreakdownEntry>();

    for (const record of sessionRecords) {
      totalInputTokens += record.inputTokens;
      totalOutputTokens += record.outputTokens;

      const existing = providerMap.get(record.providerId);
      if (existing) {
        existing.inputTokens += record.inputTokens;
        existing.outputTokens += record.outputTokens;
      } else {
        providerMap.set(record.providerId, {
          providerId: record.providerId,
          inputTokens: record.inputTokens,
          outputTokens: record.outputTokens,
        });
      }
    }

    return {
      sessionId,
      totalInputTokens,
      totalOutputTokens,
      totalTokens: computeTotalTokens(totalInputTokens, totalOutputTokens),
      queryCount: sessionRecords.length,
      providerBreakdown: Array.from(providerMap.values()),
    };
  }

  getMessageUsage(sessionId: string, messageId: string): TokenRecord | null {
    const sessionRecords = this.records.get(sessionId);
    if (!sessionRecords) return null;

    for (const record of sessionRecords) {
      if (record.messageId === messageId) return record;
    }
    return null;
  }

  getProviderUsage(providerId?: string): ProviderTokenSummary[] {
    const result = new Map<string, ProviderTokenSummary>();
    const sessionSets = new Map<string, Set<string>>();

    for (const [sid, sessionRecords] of this.records) {
      for (const record of sessionRecords) {
        if (providerId !== undefined && record.providerId !== providerId) continue;

        const key = record.providerId;
        let summary = result.get(key);

        if (!summary) {
          summary = {
            providerId: record.providerId,
            providerType: record.providerType,
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalTokens: 0,
            queryCount: 0,
            sessionCount: 0,
          };
          result.set(key, summary);
          sessionSets.set(key, new Set());
        }

        summary.totalInputTokens += record.inputTokens;
        summary.totalOutputTokens += record.outputTokens;
        summary.queryCount++;
        sessionSets.get(key)!.add(sid);
      }
    }

    const finalResult: ProviderTokenSummary[] = [];
    for (const [key, s] of result) {
      finalResult.push({
        ...s,
        totalTokens: computeTotalTokens(s.totalInputTokens, s.totalOutputTokens),
        sessionCount: sessionSets.get(key)!.size,
      });
    }

    if (providerId !== undefined && finalResult.length === 0) {
      return [{
        providerId,
        providerType: "unknown",
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        queryCount: 0,
        sessionCount: 0,
      }];
    }

    return finalResult.sort((a, b) => a.providerId.localeCompare(b.providerId));
  }

  clearSession(sessionId: string): number {
    const existing = this.records.get(sessionId);
    if (!existing) return 0;
    const count = existing.length;
    this.records.delete(sessionId);
    return count;
  }

  clearAll(): number {
    let count = 0;
    for (const [, records] of this.records) {
      count += records.length;
    }
    this.records.clear();
    return count;
  }
}

let tokenStoreInstance: InMemoryTokenStore | null = null;

export function getTokenStore(): InMemoryTokenStore {
  if (!tokenStoreInstance) {
    tokenStoreInstance = new InMemoryTokenStore();
  }
  return tokenStoreInstance;
}

export function setTokenStore(store: InMemoryTokenStore | null): void {
  tokenStoreInstance = store;
}

export { InMemoryTokenStore };
