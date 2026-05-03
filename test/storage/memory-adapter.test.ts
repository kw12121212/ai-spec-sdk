import { expect, test, describe } from "bun:test";
import { MemoryStorageAdapter } from "../../src/storage/memory-adapter.js";

describe("MemoryStorageAdapter", () => {
  test("set and get operations", async () => {
    const adapter = new MemoryStorageAdapter<{ name: string }>();
    await adapter.set("user:1", { name: "Alice" });
    const val = await adapter.get("user:1");
    expect(val).toEqual({ name: "Alice" });
  });

  test("get non-existent key returns null", async () => {
    const adapter = new MemoryStorageAdapter();
    const val = await adapter.get("missing");
    expect(val).toBeNull();
  });

  test("delete operation", async () => {
    const adapter = new MemoryStorageAdapter();
    await adapter.set("key1", "value1");
    const didDelete = await adapter.delete("key1");
    expect(didDelete).toBeTrue();
    const val = await adapter.get("key1");
    expect(val).toBeNull();
  });

  test("delete non-existent key returns false", async () => {
    const adapter = new MemoryStorageAdapter();
    const didDelete = await adapter.delete("missing");
    expect(didDelete).toBeFalse();
  });

  test("list operation", async () => {
    const adapter = new MemoryStorageAdapter();
    await adapter.set("a", 1);
    await adapter.set("b", 2);
    const keys = await adapter.list();
    expect(keys.length).toBe(2);
    expect(keys).toContain("a");
    expect(keys).toContain("b");
  });

  test("clear operation", async () => {
    const adapter = new MemoryStorageAdapter();
    await adapter.set("a", 1);
    await adapter.clear();
    const keys = await adapter.list();
    expect(keys.length).toBe(0);
  });
});
