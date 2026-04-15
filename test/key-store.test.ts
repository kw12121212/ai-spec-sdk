import test from "node:test";
import assert from "node:assert/strict";
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
    assert.deepEqual(keys, []);
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
    assert.equal(loaded.length, 1);
    assert.deepEqual(loaded[0], key);
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
    assert.equal(loaded.length, 2);
    assert.equal(loaded[0]!.id, "k1");
    assert.equal(loaded[1]!.id, "k2");
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
    assert.equal(loaded.length, 1);
    assert.deepEqual(loaded[0], key);
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
    assert.ok(!raw.includes('"token"'), `file should not contain "token" field`);
    assert.ok(raw.includes("sha256hashonly"), "file should contain the hash");
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
    assert.equal(removed, true);
    const loaded = loadKeys(keysFile);
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0]!.id, "k2");
  } finally {
    cleanup();
  }
});

test("revokeKey returns false when id does not exist", () => {
  const { keysFile, cleanup } = tempKeysFile();
  try {
    addKey(sampleKey("k1"), keysFile);
    const removed = revokeKey("no-such-id", keysFile);
    assert.equal(removed, false);
    assert.equal(loadKeys(keysFile).length, 1);
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
    assert.equal(loaded.length, 1);
  } finally {
    cleanup();
  }
});
