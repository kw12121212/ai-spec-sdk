import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { MemoryStorageBackend } from "../../src/llm-provider/memory-cache.js";
import { FileStorageBackend } from "../../src/llm-provider/file-cache.js";
import { QueryResult } from "../../src/llm-provider/types.js";
import * as fs from "fs/promises";
import * as path from "path";

describe("Cache Monitoring - MemoryStorageBackend", () => {
  let cache: MemoryStorageBackend;

  const mockResult: QueryResult = {
    status: "completed",
    result: "test response",
    usage: { inputTokens: 10, outputTokens: 5 },
  };

  beforeEach(() => {
    cache = new MemoryStorageBackend();
  });

  it("should track cache hits and misses", async () => {
    // Initial stats
    let stats = await cache.getStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);

    // Cache miss
    await cache.get("key1");
    stats = await cache.getStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(1);

    // Populate and hit
    await cache.set("key1", mockResult);
    await cache.get("key1");
    stats = await cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);

    // Another hit
    await cache.get("key1");
    stats = await cache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
  });

  it("should track cache miss when expired", async () => {
    await cache.set("key-ttl", mockResult, 10);
    await new Promise(resolve => setTimeout(resolve, 15));
    
    await cache.get("key-ttl");
    const stats = await cache.getStats();
    expect(stats.misses).toBe(1);
  });
});

describe("Cache Monitoring - FileStorageBackend", () => {
  const cacheDir = path.join(process.cwd(), "tmp_test_cache_mon_" + Math.random().toString(36).slice(2));
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

  it("should track cache hits and misses", async () => {
    // Initial stats
    let stats = await cache.getStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);

    // Cache miss
    await cache.get("file-key1");
    stats = await cache.getStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(1);

    // Populate and hit
    await cache.set("file-key1", mockResult);
    await cache.get("file-key1");
    stats = await cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);

    // Size bytes should be calculated
    expect(stats.sizeBytes).toBeGreaterThan(0);
  });

  it("should track cache miss when expired", async () => {
    await cache.set("file-key-ttl", mockResult, 10);
    await new Promise(resolve => setTimeout(resolve, 15));
    
    await cache.get("file-key-ttl");
    const stats = await cache.getStats();
    expect(stats.misses).toBe(1);
  });
});
