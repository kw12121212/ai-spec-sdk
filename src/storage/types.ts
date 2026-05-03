export interface StorageBackend<T = unknown> {
  /**
   * Get a value by key.
   * Returns null if the key does not exist.
   */
  get(key: string): Promise<T | null>;

  /**
   * Set a value for a given key.
   * Overwrites any existing value for that key.
   */
  set(key: string, value: T): Promise<void>;

  /**
   * Delete a key-value pair.
   * Returns true if the key existed and was deleted, false otherwise.
   */
  delete(key: string): Promise<boolean>;

  /**
   * List all keys currently stored in the backend.
   */
  list(): Promise<string[]>;

  /**
   * Clear all keys in the storage. (Optional)
   */
  clear?(): Promise<void>;
}
