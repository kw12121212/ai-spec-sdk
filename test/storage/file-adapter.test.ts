import { expect, test, describe, beforeEach, afterEach } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { FileStorageAdapter } from "../../src/storage/file-adapter.js";

describe("FileStorageAdapter", () => {
  let baseDir: string;
  let adapter: FileStorageAdapter<{ name: string }>;

  beforeEach(async () => {
    baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "file-adapter-test-"));
    adapter = new FileStorageAdapter(baseDir);
  });

  afterEach(async () => {
    await fs.rm(baseDir, { recursive: true, force: true });
  });

  test("set and get operations", async () => {
    await adapter.set("user:1", { name: "Alice" });
    const val = await adapter.get("user:1");
    expect(val).toEqual({ name: "Alice" });
  });

  test("get non-existent key returns null", async () => {
    const val = await adapter.get("missing");
    expect(val).toBeNull();
  });

  test("delete operation", async () => {
    await adapter.set("key1", { name: "test" });
    const didDelete = await adapter.delete("key1");
    expect(didDelete).toBeTrue();
    const val = await adapter.get("key1");
    expect(val).toBeNull();
  });

  test("delete non-existent key returns false", async () => {
    const didDelete = await adapter.delete("missing");
    expect(didDelete).toBeFalse();
  });

  test("list operation", async () => {
    await adapter.set("a", { name: "1" });
    await adapter.set("b", { name: "2" });
    const keys = await adapter.list();
    expect(keys.length).toBe(2);
    expect(keys).toContain("a");
    expect(keys).toContain("b");
  });

  test("clear operation", async () => {
    await adapter.set("a", { name: "1" });
    await adapter.clear();
    const keys = await adapter.list();
    expect(keys.length).toBe(0);
  });

  test("directory is created automatically", async () => {
    const newDir = path.join(baseDir, "nested");
    const nestedAdapter = new FileStorageAdapter(newDir);
    await nestedAdapter.set("key1", { name: "1" });
    const keys = await nestedAdapter.list();
    expect(keys).toContain("key1");
  });
});
