import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { MemoryStorageBackend } from "../../src/llm-provider/memory-cache.js";
import { FileStorageBackend } from "../../src/llm-provider/file-cache.js";
import { QueryResult } from "../../src/llm-provider/types.js";
import * as fs from "fs/promises";
import * as path from "path";

describe("MemoryStorageBackend", () => {
  let cache: MemoryStorageBackend;

  const mockResult: QueryResult = {
    status: "completed",
    result: "test response",
    usage: { inputTokens: 10, outputTokens: 5 },
  };

  beforeEach(() => {
    cache = new MemoryStorageBackend();
  });

  it("should store and retrieve a value", async () => {
    await cache.set("key1", mockResult);
    const retrieved = await cache.get("key1");
    expect(retrieved).toEqual(mockResult);
  });

  it("should return null for missing keys", async () => {
    const retrieved = await cache.get("missing-key");
    expect(retrieved).toBeNull();
  });

  it("should expire values based on ttl", async () => {
    await cache.set("key-ttl", mockResult, 10);
    // wait for expiration
    await new Promise(resolve => setTimeout(resolve, 15));
    const retrieved = await cache.get("key-ttl");
    expect(retrieved).toBeNull();
  });

  it("should delete a value", async () => {
    await cache.set("key-del", mockResult);
    await cache.delete("key-del");
    const retrieved = await cache.get("key-del");
    expect(retrieved).toBeNull();
  });

  it("should clear all values", async () => {
    await cache.set("k1", mockResult);
    await cache.set("k2", mockResult);
    await cache.clear();
    expect(await cache.get("k1")).toBeNull();
    expect(await cache.get("k2")).toBeNull();
  });
});

describe("FileStorageBackend", () => {
  const cacheDir = path.join(process.cwd(), "tmp_test_cache_" + Math.random().toString(36).slice(2));
  let cache: FileStorageBackend;

  const mockResult: QueryResult = {
    status: "completed",
    result: "file test response",
    usage: { inputTokens: 20, outputTokens: 15 },
  };

  beforeEach(async () => {
    cache = new FileStorageBackend(cacheDir);
    await cache.initialize();
  });

  afterEach(async () => {
    try {
      await fs.rm(cacheDir, { recursive: true, force: true });
    } catch (e) {
      // ignore
    }
  });

  it("should store and retrieve a value", async () => {
    await cache.set("file-key1", mockResult);
    const retrieved = await cache.get("file-key1");
    expect(retrieved).toEqual(mockResult);
  });

  it("should return null for missing keys", async () => {
    const retrieved = await cache.get("file-missing-key");
    expect(retrieved).toBeNull();
  });

  it("should expire values based on ttl", async () => {
    await cache.set("file-key-ttl", mockResult, 10);
    await new Promise(resolve => setTimeout(resolve, 15));
    const retrieved = await cache.get("file-key-ttl");
    expect(retrieved).toBeNull();
  });

  it("should delete a value", async () => {
    await cache.set("file-key-del", mockResult);
    await cache.delete("file-key-del");
    const retrieved = await cache.get("file-key-del");
    expect(retrieved).toBeNull();
  });

  it("should clear all values", async () => {
    await cache.set("file-k1", mockResult);
    await cache.set("file-k2", mockResult);
    await cache.clear();
    expect(await cache.get("file-k1")).toBeNull();
    expect(await cache.get("file-k2")).toBeNull();
  });
});
