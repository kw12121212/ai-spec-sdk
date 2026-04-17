import { test, expect } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadKeys, saveKeys, addKey, revokeKey, type StoredKey } from "../src/key-store.js";

function tempKeysFile(): { keysFile: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-ks-"));
  const keysFile = path.join(dir, "keys.json");
  return { keysFile, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

function sampleKey(id: string, overrides: Partial<StoredKey> = {}): StoredKey {
  return {
    id,
    name: "test",
    hash: "abc123",
    createdAt: new Date().toISOString(),
    scopes: ["session:read"],
    ...overrides,
  };
}

test("loadKeys returns empty array when file does not exist", () => {
  const { keysFile, cleanup } = tempKeysFile();
  try {
    // Don't create the file — it should return []
    const keys = loadKeys(keysFile);
    expect(keys).toEqual([]);
  } finally {
    cleanup();
  }
});

test("addKey and loadKeys round-trip", () => {
  const { keysFile, cleanup } = tempKeysFile();
  try {
    const key = sampleKey("k1");
    addKey(key, keysFile);
    const loaded = loadKeys(keysFile);
    expect(loaded.length).toBe(1);
    expect(loaded[0]).toEqual(key);
  } finally {
    cleanup();
  }
});

test("addKey accumulates multiple keys", () => {
  const { keysFile, cleanup } = tempKeysFile();
  try {
    addKey(sampleKey("k1"), keysFile);
    addKey(sampleKey("k2"), keysFile);
    const loaded = loadKeys(keysFile);
    expect(loaded.length).toBe(2);
    expect(loaded[0]!.id).toBe("k1");
    expect(loaded[1]!.id).toBe("k2");
  } finally {
    cleanup();
  }
});

test("addKey and loadKeys round-trip with roles", () => {
  const { keysFile, cleanup } = tempKeysFile();
  try {
    const key = sampleKey("k1", { roles: ["admin"] });
    addKey(key, keysFile);
    const loaded = loadKeys(keysFile);
    expect(loaded.length).toBe(1);
    expect(loaded[0]).toEqual(key);
  } finally {
    cleanup();
  }
});

test("saved file does not contain raw token — only the fields of StoredKey", () => {
  const { keysFile, cleanup } = tempKeysFile();
  try {
    const key = sampleKey("k1", { hash: "sha256hashonly" });
    addKey(key, keysFile);
    const raw = fs.readFileSync(keysFile, "utf8");
    // The file should contain the hash field but no field named "token"
    expect(!raw.includes('"token"')).toBeTruthy();
    expect(raw.includes("sha256hashonly")).toBeTruthy();
  } finally {
    cleanup();
  }
});

test("revokeKey removes the key and returns true", () => {
  const { keysFile, cleanup } = tempKeysFile();
  try {
    addKey(sampleKey("k1"), keysFile);
    addKey(sampleKey("k2"), keysFile);
    const removed = revokeKey("k1", keysFile);
    expect(removed).toBe(true);
    const loaded = loadKeys(keysFile);
    expect(loaded.length).toBe(1);
    expect(loaded[0]!.id).toBe("k2");
  } finally {
    cleanup();
  }
});

test("revokeKey returns false when id does not exist", () => {
  const { keysFile, cleanup } = tempKeysFile();
  try {
    addKey(sampleKey("k1"), keysFile);
    const removed = revokeKey("no-such-id", keysFile);
    expect(removed).toBe(false);
    expect(loadKeys(keysFile).length).toBe(1);
  } finally {
    cleanup();
  }
});

test("saveKeys creates parent directory if it does not exist", () => {
  const { keysFile, cleanup } = tempKeysFile();
  try {
    // Use a nested path that doesn't exist yet
    const nested = path.join(path.dirname(keysFile), "sub", "dir", "keys.json");
    saveKeys([sampleKey("k1")], nested);
    const loaded = loadKeys(nested);
    expect(loaded.length).toBe(1);
  } finally {
    cleanup();
  }
});
