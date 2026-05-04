import type { StorageBackend, PersistencePolicy } from "./types.js";

export class MemoryStorageAdapter<T = unknown> implements StorageBackend<T> {
  private store: Map<string, T>;
  private policy?: PersistencePolicy<T>;

  constructor(policy?: PersistencePolicy<T>) {
    this.store = new Map();
    this.policy = policy;
  }

  async get(key: string): Promise<T | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: T): Promise<void> {
    if (this.policy && !this.policy(key, value)) {
      return;
    }
    this.store.set(key, value);
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async list(): Promise<string[]> {
    return Array.from(this.store.keys());
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}
