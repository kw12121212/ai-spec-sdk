import { StorageBackend, QueryResult, CacheEntry } from "./types.js";

export class MemoryStorageBackend implements StorageBackend {
  private readonly store = new Map<string, CacheEntry>();

  async get(key: string): Promise<QueryResult | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }

    return entry.result;
  }

  async set(key: string, result: QueryResult, ttlMs?: number): Promise<void> {
    const entry: CacheEntry = {
      key,
      result,
      expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
    };
    this.store.set(key, entry);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}
