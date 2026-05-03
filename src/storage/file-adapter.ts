import fs from "node:fs/promises";
import path from "node:path";
import type { StorageBackend } from "./types.js";

export class FileStorageAdapter<T = unknown> implements StorageBackend<T> {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  private getFilePath(key: string): string {
    // Basic sanitization for file names
    const safeKey = encodeURIComponent(key);
    return path.join(this.baseDir, `${safeKey}.json`);
  }

  private async ensureDir(): Promise<void> {
    try {
      await fs.access(this.baseDir);
    } catch {
      await fs.mkdir(this.baseDir, { recursive: true });
    }
  }

  async get(key: string): Promise<T | null> {
    const filePath = this.getFilePath(key);
    try {
      const data = await fs.readFile(filePath, "utf8");
      return JSON.parse(data) as T;
    } catch (err: any) {
      if (err.code === "ENOENT") {
        return null;
      }
      throw err;
    }
  }

  async set(key: string, value: T): Promise<void> {
    await this.ensureDir();
    const filePath = this.getFilePath(key);
    const tmpPath = `${filePath}.tmp`;
    const data = JSON.stringify(value, null, 2);
    await fs.writeFile(tmpPath, data, "utf8");
    await fs.rename(tmpPath, filePath);
  }

  async delete(key: string): Promise<boolean> {
    const filePath = this.getFilePath(key);
    try {
      await fs.unlink(filePath);
      return true;
    } catch (err: any) {
      if (err.code === "ENOENT") {
        return false;
      }
      throw err;
    }
  }

  async list(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.baseDir);
      return files
        .filter((file) => file.endsWith(".json"))
        .map((file) => decodeURIComponent(file.slice(0, -5)));
    } catch (err: any) {
      if (err.code === "ENOENT") {
        return [];
      }
      throw err;
    }
  }

  async clear(): Promise<void> {
    try {
      const files = await fs.readdir(this.baseDir);
      for (const file of files) {
        if (file.endsWith(".json") || file.endsWith(".json.tmp")) {
          await fs.unlink(path.join(this.baseDir, file));
        }
      }
    } catch (err: any) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
  }
}
