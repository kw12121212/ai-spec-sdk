import { StorageBackend, QueryResult, CacheEntry, CacheStats } from "./types.js";

export class MemoryStorageBackend implements StorageBackend {
  private readonly store = new Map<string, CacheEntry>();
  private readonly stats: CacheStats = { hits: 0, misses: 0 };

  async get(key: string): Promise<QueryResult | null> {
    const entry = this.store.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
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
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  getStats(): CacheStats {
    let sizeBytes = 0;
    for (const [key, entry] of this.store.entries()) {
      // Rough estimation of size: string keys + serialized result
      sizeBytes += key.length * 2;
      sizeBytes += Buffer.byteLength(JSON.stringify(entry.result), 'utf8');
    }
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      sizeBytes
    };
  }
}
