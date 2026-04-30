import * as fs from "fs/promises";
import * as path from "path";
import { StorageBackend, QueryResult, CacheEntry } from "./types.js";

export class FileStorageBackend implements StorageBackend {
  constructor(private readonly cacheDir: string) {}

  async initialize(): Promise<void> {
    await fs.mkdir(this.cacheDir, { recursive: true });
  }

  private getFilePath(key: string): string {
    // Basic sanitization for the cache key to use as filename
    const safeKey = key.replace(/[^a-z0-9]/gi, '_');
    return path.join(this.cacheDir, `${safeKey}.json`);
  }

  async get(key: string): Promise<QueryResult | null> {
    try {
      const filePath = this.getFilePath(key);
      const data = await fs.readFile(filePath, "utf-8");
      const entry: CacheEntry = JSON.parse(data);

      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        await this.delete(key);
        return null;
      }

      return entry.result;
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async set(key: string, result: QueryResult, ttlMs?: number): Promise<void> {
    const filePath = this.getFilePath(key);
    const entry: CacheEntry = {
      key,
      result,
      expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
    };
    await fs.writeFile(filePath, JSON.stringify(entry), "utf-8");
  }

  async delete(key: string): Promise<void> {
    try {
      const filePath = this.getFilePath(key);
      await fs.unlink(filePath);
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  async clear(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);
      for (const file of files) {
        if (file.endsWith(".json")) {
          await fs.unlink(path.join(this.cacheDir, file));
        }
      }
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }
}
